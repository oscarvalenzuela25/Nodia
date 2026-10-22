import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { DataSource, EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaAiDeletionJournalPort } from '../../nodia-ai-recovery/types/deletion-journal.js';
import { ExpireNodiaAiConversationsUseCase } from './expire-nodia-ai-conversations.use-case.js';

const now = new Date('2026-10-20T10:00:00.000Z');
const policy = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/mvp/nodia-ai-v1-runtime-policy.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as NodiaAiRuntimePolicy;

/** Transactional synthetic state; journal intentionally lives outside its rollback boundary. */
function fixture(chatCount = 1, enabled = true) {
  const chats = Array.from({ length: chatCount }, () => ({
    id: randomUUID(),
    retention_epoch: '1',
    content: 'synthetic private content',
  }));
  let committed = structuredClone(chats);
  const generations: { conversation_id: string; storage_generation: string }[] =
    [];
  const durable: Parameters<
    NodiaAiDeletionJournalPort['recordDeletions']
  >[0][] = [];
  const order: string[] = [];
  let failure: 'journal' | 'delete' | null = null;
  let activeTransaction = false;
  let afterJournal: (() => void) | null = null;
  const journal: NodiaAiDeletionJournalPort = {
    enabled,
    recordResources: vi.fn(),
    assertResourcesRecorded: vi.fn(),
    confirmResources: vi.fn(async () => {
      expect(activeTransaction).toBe(false);
    }),
    recordDeletions: vi.fn(async (input) => {
      expect(activeTransaction).toBe(false);
      order.push('external_ack');
      if (failure === 'journal') throw Error('synthetic_external_unavailable');
      durable.push(structuredClone(input));
      afterJournal?.();
    }),
  };
  const source = {
    transaction: async <T>(
      work: (manager: EntityManager) => Promise<T>,
    ): Promise<T> => {
      activeTransaction = true;
      let staged = structuredClone(committed);
      const manager = {
        query: vi.fn(async (sql: string, parameters: unknown[] = []) => {
          if (sql.includes('clock_timestamp() AS now')) return [{ now }];
          if (
            sql.startsWith(
              'SELECT id,retention_epoch FROM nodia_ai_conversations',
            )
          ) {
            const selected = parameters[2] as string[] | null;
            return selected
              ? staged.filter((chat) => selected.includes(chat.id))
              : staged;
          }
          if (sql.includes('AS storage_generation'))
            return generations.filter((row) =>
              (parameters[0] as string[]).includes(row.conversation_id),
            );
          if (/^(UPDATE|DELETE|INSERT)/u.test(sql)) order.push(sql);
          if (sql === 'DELETE FROM nodia_ai_conversations WHERE id=$1') {
            if (failure === 'delete') throw Error('synthetic_commit_failure');
            staged = staged.filter((chat) => chat.id !== parameters[0]);
          }
          return [];
        }),
      } as unknown as EntityManager;
      try {
        const result = await work(manager);
        committed = staged;
        return result;
      } finally {
        activeTransaction = false;
      }
    },
  } as unknown as DataSource;
  const subject = new ExpireNodiaAiConversationsUseCase(
    new NodiaAiConversationService(source),
    policy,
    undefined,
    journal,
  );
  return {
    subject,
    chats,
    generations,
    durable,
    order,
    journal,
    content: () => committed,
    fail: (value: typeof failure) => {
      failure = value;
    },
    betweenPhases: (hook: () => void) => {
      afterJournal = hook;
    },
    addChat: () => {
      committed.push({
        id: randomUUID(),
        retention_epoch: '1',
        content: 'another synthetic chat',
      });
    },
    concurrentPurge: () => {
      committed = [];
    },
  };
}

describe('ExpireNodiaAiConversationsUseCase deletion journal barrier', () => {
  it('persists one complete batch of opaque chat and generation identities before content changes', async () => {
    const f = fixture(2),
      generation = randomUUID(),
      pendingGeneration = randomUUID();
    f.generations.push(
      { conversation_id: f.chats[0].id, storage_generation: generation },
      { conversation_id: f.chats[0].id, storage_generation: pendingGeneration },
      { conversation_id: f.chats[0].id, storage_generation: generation },
    );
    await expect(f.subject.execute()).resolves.toEqual({
      purged_chats: 2,
      unresolved_jobs: 0,
    });
    expect(f.content()).toEqual([]);
    expect(f.durable).toEqual([
      {
        deleted_at: now.toISOString(),
        entries: [
          {
            conversation_id: f.chats[0].id,
            storage_generations: [generation, pendingGeneration].sort(),
          },
          { conversation_id: f.chats[1].id, storage_generations: [] },
        ],
      },
    ]);
    expect(f.order[0]).toBe('external_ack');
    expect(f.journal.confirmResources).toHaveBeenCalledExactlyOnceWith(
      f.durable[0].entries.map((entry) => ({ kind: 'conversation', ...entry })),
    );
    expect(JSON.stringify(f.durable)).not.toContain(
      'synthetic private content',
    );
  });

  it('preserves all private SQL content and creates no cleanup effects when the external journal fails', async () => {
    const f = fixture(2);
    f.fail('journal');
    await expect(f.subject.execute()).rejects.toThrow(
      'synthetic_external_unavailable',
    );
    expect(f.content()).toEqual(f.chats);
    expect(f.order).toEqual(['external_ack']);
    expect(f.durable).toEqual([]);
    expect(f.journal.confirmResources).not.toHaveBeenCalled();
  });

  it('retains the external deletion intent when SQL fails and safely records the same identities on retry', async () => {
    const f = fixture(),
      generation = randomUUID();
    f.generations.push({
      conversation_id: f.chats[0].id,
      storage_generation: generation,
    });
    f.fail('delete');
    await expect(f.subject.execute()).rejects.toThrow(
      'synthetic_commit_failure',
    );
    expect(f.content()).toEqual(f.chats);
    expect(f.durable).toHaveLength(1);
    expect(f.journal.confirmResources).not.toHaveBeenCalled();
    f.fail(null);
    await expect(f.subject.execute()).resolves.toMatchObject({
      purged_chats: 1,
    });
    expect(f.content()).toEqual([]);
    expect(f.durable[1].entries).toEqual(f.durable[0].entries);
  });

  it('does not contact the journal when no chats are due', async () => {
    const f = fixture(0);
    await expect(f.subject.execute()).resolves.toEqual({
      purged_chats: 0,
      unresolved_jobs: 0,
    });
    expect(f.journal.recordDeletions).not.toHaveBeenCalled();
    expect(f.order).toEqual([]);
  });

  it('aborts without removing content when generation identity changes while locks are released', async () => {
    const f = fixture();
    f.betweenPhases(() =>
      f.generations.push({
        conversation_id: f.chats[0].id,
        storage_generation: randomUUID(),
      }),
    );
    await expect(f.subject.execute()).rejects.toThrow(
      'nodia_ai:deletion_journal_generation_changed',
    );
    expect(f.content()).toEqual(f.chats);
    expect(f.order).toEqual(['external_ack']);
    expect(f.durable).toHaveLength(1);
  });

  it('never purges newly eligible chats outside the journaled batch', async () => {
    const f = fixture();
    f.betweenPhases(f.addChat);
    await expect(f.subject.execute()).resolves.toMatchObject({
      purged_chats: 1,
    });
    expect(f.content()).toHaveLength(1);
    expect(f.content()[0].id).not.toBe(f.chats[0].id);
    expect(f.durable[0].entries.map((entry) => entry.conversation_id)).toEqual([
      f.chats[0].id,
    ]);
  });

  it('preserves explicit unprotected/quarantine mode without accessing an external journal', async () => {
    const f = fixture(1, false);
    await expect(f.subject.execute()).resolves.toEqual({
      purged_chats: 1,
      unresolved_jobs: 0,
    });
    expect(f.content()).toEqual([]);
    expect(f.journal.recordDeletions).not.toHaveBeenCalled();
  });

  it('accepts an already purged batch without issuing a second content mutation', async () => {
    const f = fixture();
    f.betweenPhases(f.concurrentPurge);
    await expect(f.subject.execute()).resolves.toEqual({
      purged_chats: 0,
      unresolved_jobs: 0,
    });
    expect(f.content()).toEqual([]);
    expect(f.order).toEqual(['external_ack']);
    expect(f.durable).toHaveLength(1);
  });

  it('does not report a failed effect or replay content deletion when post-commit journal confirmation fails', async () => {
    const f = fixture();
    vi.mocked(f.journal.confirmResources).mockRejectedValueOnce(
      Error('synthetic_confirm_failed'),
    );
    await expect(f.subject.execute()).resolves.toEqual({
      purged_chats: 1,
      unresolved_jobs: 0,
    });
    expect(f.content()).toEqual([]);
    expect(
      f.order.filter(
        (event) => event === 'DELETE FROM nodia_ai_conversations WHERE id=$1',
      ),
    ).toHaveLength(1);
    expect(f.durable).toHaveLength(1);
  });
});
