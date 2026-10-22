import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { NodiaAiAttachment } from '../../nodia-ai-attachment/entities/nodia-ai-attachment.entity.js';
import { AttestNodiaAiNativeSourcesUseCase } from './attest-nodia-ai-native-sources.use-case.js';

function fixture() {
  const row = Object.assign(new NodiaAiAttachment(), {
    id: '11111111-1111-4111-8111-111111111111',
    conversation_id: '22222222-2222-4222-8222-222222222222',
    generation: '33333333-3333-4333-8333-333333333333',
    state: 'ready',
    kind: 'image',
    media_type: 'image/png',
    content_hash: 'a'.repeat(64),
    byte_count: '16',
    retention_epoch: '2',
    expires_at: new Date(Date.now() + 60_000),
    storage_key: 'private-never-return',
  });
  const input = {
    attachment_id: row.id,
    kind: 'image' as const,
    media_type: 'image/png',
    content_hash: row.content_hash!,
    byte_count: 16,
  };
  const run = { conversation_id: row.conversation_id, retention_epoch: '2' };
  const find = vi.fn(async () => row as NodiaAiAttachment | null);
  const manager = {
    queryRunner: { isTransactionActive: true },
    getRepository: vi.fn(() => ({ findOneBy: find })),
  } as unknown as EntityManager;
  return {
    row,
    input,
    run,
    find,
    manager,
    subject: new AttestNodiaAiNativeSourcesUseCase(),
  };
}

describe('AttestNodiaAiNativeSourcesUseCase', () => {
  it('records only matching loaded bytes and immutable source metadata under the current transaction', async () => {
    const f = fixture();
    expect(await f.subject.execute(f.manager, f.run, [f.input])).toEqual([
      {
        ...f.input,
        generation: f.row.generation,
        retention_epoch: '2',
      },
    ]);
    expect(f.find).toHaveBeenCalledExactlyOnceWith({
      id: f.row.id,
      conversation_id: f.run.conversation_id,
    });
    expect(
      JSON.stringify(await f.subject.execute(f.manager, f.run, [f.input])),
    ).not.toContain('private-never-return');
  });
  it('does not restrict an ordinary native chat attachment to the separate 10MiB invoice limit', async () => {
    const f = fixture();
    f.input.byte_count = 12 * 1024 * 1024;
    f.row.byte_count = String(f.input.byte_count);
    expect(await f.subject.execute(f.manager, f.run, [f.input])).toHaveLength(
      1,
    );
  });
  it.each([
    'state',
    'epoch',
    'expiry',
    'kind',
    'mime',
    'hash',
    'bytes',
    'generation',
    'missing',
  ])(
    'rejects changed %s before dispatch rather than attesting another source',
    async (field) => {
      const f = fixture();
      if (field === 'state') f.row.state = 'expired';
      if (field === 'epoch') f.row.retention_epoch = '3';
      if (field === 'expiry') f.row.expires_at = new Date(0);
      if (field === 'kind') f.row.kind = 'pdf';
      if (field === 'mime') f.row.media_type = 'image/jpeg';
      if (field === 'hash') f.row.content_hash = 'b'.repeat(64);
      if (field === 'bytes') f.row.byte_count = '17';
      if (field === 'generation') f.row.generation = 'invalid';
      if (field === 'missing') f.find.mockResolvedValueOnce(null);
      await expect(
        f.subject.execute(f.manager, f.run, [f.input]),
      ).rejects.toThrow('attachment_source_changed');
    },
  );
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN])(
    'rejects invalid actual byte count %s',
    async (byte_count) => {
      const f = fixture();
      await expect(
        f.subject.execute(f.manager, f.run, [{ ...f.input, byte_count }]),
      ).rejects.toThrow('attachment_source_changed');
    },
  );
  it('rejects duplicate sources and absent transaction before querying metadata', async () => {
    const f = fixture();
    await expect(
      f.subject.execute(f.manager, f.run, [f.input, f.input]),
    ).rejects.toThrow('attachment_source_changed');
    await expect(
      f.subject.execute({} as EntityManager, f.run, [f.input]),
    ).rejects.toThrow('attachment_source_changed');
    expect(f.find).not.toHaveBeenCalled();
  });
  it('records no sources for an empty original-file set', async () => {
    const f = fixture();
    expect(await f.subject.execute(f.manager, f.run, [])).toEqual([]);
    expect(f.find).not.toHaveBeenCalled();
  });
});
