import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiAttachmentStorage } from '../../nodia-ai-attachment/types/attachment-ports.js';
import type { NodiaAiRuntimeService } from '../nodia-ai-runtime.service.js';
import type { NodiaAiRuntimePolicy } from '../config/runtime-policy.js';
import { CleanupNodiaAiAttachmentsUseCase } from './cleanup-nodia-ai-attachments.use-case.js';
import { DisabledNodiaAiDeletionJournal } from '../../nodia-ai-recovery/types/deletion-journal.js';

function fixture(journal = new DisabledNodiaAiDeletionJournal()) {
  const now = new Date('2026-10-17T23:00:00Z');
  const id = '11111111-1111-4111-8111-111111111111',
    generation = '22222222-2222-4222-8222-222222222222',
    chat = '33333333-3333-4333-8333-333333333333';
  const job = {
    id: 'job',
    conversation_id: chat,
    storage_generation: generation,
    storage_key: `nodia-ai/${chat}/${id}/${generation}`,
    state: 'ready',
    fence: '2',
    attempt_count: 0,
    available_at: new Date(now.getTime() - 1000),
    lease_until: null as Date | null,
    lease_owner: null as string | null,
    recovery_descriptor: {
      reason: 'attachment_cleanup',
      attachment_id: id,
      write_deadline_until: new Date(now.getTime() - 1000).toISOString(),
    },
  };
  const attachment = {
    id,
    state: 'rejected',
    write_until_at: null as Date | null,
  };
  let inTransaction = false;
  const query = vi
    .fn()
    .mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('SELECT id,conversation_id,storage_generation'))
        return [job];
      if (sql.startsWith('SELECT id,state,write_until_at')) return [attachment];
      if (sql.includes("SET state='leased'")) {
        Object.assign(job, {
          state: 'leased',
          lease_owner: params![1],
          fence: params![3],
          attempt_count: job.attempt_count + 1,
        });
      }
      if (sql.includes("SET state='expired'")) attachment.state = 'expired';
      return [];
    });
  const manager = { query } as unknown as EntityManager;
  const runtime = {
    transaction: vi.fn(
      async (work: (manager: EntityManager) => Promise<unknown>) => {
        inTransaction = true;
        try {
          return await work(manager);
        } finally {
          inTransaction = false;
        }
      },
    ),
    lockJob: vi.fn().mockResolvedValue(job),
    now: vi.fn().mockResolvedValue(now),
  };
  const storage = {
    delete: vi.fn().mockImplementation(async () => {
      expect(inTransaction).toBe(false);
    }),
  };
  const policy = {
    queue: { maintenance_workers: 2 },
    timing: { lease_seconds: 30 },
    retry: { cleanup_attempts: 3, cleanup_delay_seconds: [5, 30, 60] },
  } as unknown as NodiaAiRuntimePolicy;
  const subject = new CleanupNodiaAiAttachmentsUseCase(
    runtime as unknown as NodiaAiRuntimeService,
    storage as unknown as NodiaAiAttachmentStorage,
    policy,
    journal,
  );
  return { now, job, attachment, query, storage, subject, inTransaction: () => inTransaction };
}
describe('AI-32 generation-owned attachment cleanup', () => {
  it('fences stale publication before external DELETE and removes identity only after ACK', async () => {
    const f = fixture();
    expect(await f.subject.execute()).toEqual({ processed: 1, settled: 1 });
    expect(f.attachment.state).toBe('expired');
    expect(f.storage.delete).toHaveBeenCalledWith(f.job.storage_key);
    const statements = f.query.mock.calls.map(([sql]) => String(sql));
    expect(
      statements.findIndex((sql) => sql.includes("SET state='expired'")),
    ).toBeLessThan(
      statements.findIndex((sql) => sql.includes("SET state='leased'")),
    );
    expect(
      statements.filter((sql) => sql.startsWith('DELETE FROM nodia_ai_jobs')),
    ).toHaveLength(1);
  });
  it('retains generation and quota identity when DELETE is uncertain', async () => {
    const f = fixture();
    f.storage.delete.mockRejectedValue(Error('storage response lost'));
    expect(await f.subject.execute()).toEqual({ processed: 1, settled: 0 });
    expect(
      f.query.mock.calls.find(([sql]) =>
        String(sql).startsWith('DELETE FROM nodia_ai_jobs'),
      ),
    ).toBeUndefined();
    expect(
      f.query.mock.calls.find(([sql]) =>
        String(sql).includes('SET state=$2'),
      )?.[1],
    ).toEqual(['job', 'waiting', 5]);
  });
  it('will not DELETE or free quota before an in-flight PUT window ends, including manual retry', async () => {
    const f = fixture();
    f.attachment.write_until_at = new Date(f.now.getTime() + 1000);
    expect(await f.subject.execute('job', true)).toEqual({
      processed: 0,
      settled: 0,
    });
    expect(f.storage.delete).not.toHaveBeenCalled();
  });
  it('cannot erase a published live original from a stale cleanup intent', async () => {
    const f = fixture();
    f.attachment.state = 'ready';
    expect(await f.subject.execute()).toEqual({ processed: 0, settled: 0 });
    expect(f.storage.delete).not.toHaveBeenCalled();
  });
  it('rejects an object key from a different generation before external I/O', async () => {
    const f = fixture();
    f.job.storage_key = f.job.storage_key.replace(
      f.job.storage_generation,
      '44444444-4444-4444-8444-444444444444',
    );
    await expect(f.subject.execute()).rejects.toThrow(
      'nodia_ai:attachment_cleanup_invalid',
    );
    expect(f.storage.delete).not.toHaveBeenCalled();
  });
  it('journals legacy cleanup work before deleting its exact object outside SQL', async () => {
    const order: string[] = [];
    const journal = Object.assign(new DisabledNodiaAiDeletionJournal(), {
      enabled: true,
      recordResources: vi.fn(async () => { expect(f.inTransaction()).toBe(false); order.push('journal'); }),
      confirmResources: vi.fn(async () => { expect(f.inTransaction()).toBe(false); order.push('confirmed'); }),
    });
    const f = fixture(journal);
    f.job.conversation_id = null as unknown as string;
    f.storage.delete.mockImplementation(async () => { order.push('delete'); });
    await expect(f.subject.execute()).resolves.toEqual({ processed: 1, settled: 1 });
    expect(order).toEqual(['journal', 'delete', 'confirmed']);
    expect(journal.recordResources).toHaveBeenCalledWith({ deleted_at: f.now.toISOString(), resources: [{
      kind: 'attachment', conversation_id: '33333333-3333-4333-8333-333333333333',
      attachment_id: f.attachment.id, storage_generations: [f.job.storage_generation],
    }] });
  });
  it('retains object and SQL witness when external journal is uncertain', async () => {
    const journal = Object.assign(new DisabledNodiaAiDeletionJournal(), {
      enabled: true, recordResources: vi.fn().mockRejectedValue(Error('response lost')),
    });
    const f = fixture(journal);
    await expect(f.subject.execute()).resolves.toEqual({ processed: 1, settled: 0 });
    expect(f.storage.delete).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql]) => String(sql).startsWith('DELETE FROM nodia_ai_attachments'))).toBe(false);
  });
  it('does not misreport committed deletion when external confirmation ACK is lost', async () => {
    const journal = Object.assign(new DisabledNodiaAiDeletionJournal(), {
      enabled: true, recordResources: vi.fn().mockResolvedValue(undefined),
      confirmResources: vi.fn().mockRejectedValue(Error('ACK lost')),
    });
    const f = fixture(journal);
    await expect(f.subject.execute()).resolves.toEqual({ processed: 1, settled: 1 });
    expect(f.storage.delete).toHaveBeenCalledTimes(1);
    expect(journal.confirmResources).toHaveBeenCalledTimes(1);
  });
});
