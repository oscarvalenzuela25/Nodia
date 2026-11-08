import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { LoadNodiaAiContextHistoryUseCase } from './load-nodia-ai-context-history.use-case.js';

const input = {
  conversationId: '11111111-1111-4111-8111-111111111111', actorId: '1',
  throughSeq: '3', moduleRoutes: ['/business'], maxBytes: 131072,
};
const message = (seq: string, scope: unknown = { schema_version: 1, module_routes: ['/business'] }) => ({
  seq, role: 'user', scope, parts: [{ kind: 'text', text: `Message ${seq}` }],
});
function fixture(row: unknown = { history: [message('1'), message('3')], complete: true, through_seq: '3' }) {
  const query = vi.fn(async (_sql: string, _parameters?: unknown[]) => [row]);
  const manager = { query, queryRunner: { isTransactionActive: true } } as unknown as EntityManager;
  return { query, manager, useCase: new LoadNodiaAiContextHistoryUseCase() };
}

describe('canonical history window and source fingerprint', () => {
  it('preserves ordered canonical content and exact attachment descriptors', async () => {
    const first = message('1');
    const last = { ...message('3'), parts: [
      { kind: 'audio', text: null, attachment_id: input.conversationId },
      { kind: 'pdf', text: 'Texto revisado', attachment_id: input.conversationId },
    ] };
    const f = fixture({ history: [first, last], complete: true, through_seq: '3' });
    await expect(f.useCase.load(f.manager, input)).resolves.toEqual({
      history: [first, last], complete: true, throughSeq: '3',
    });
    expect(f.query.mock.calls[0]?.[1]).toEqual([
      input.conversationId, '3', '1', ['/business', '/tools/business'], '0', 131072,
    ]);
  });
  it('returns a bounded prefix with an explicit continuation anchor', async () => {
    const f = fixture({ history: [message('2')], complete: false, through_seq: '2' });
    await expect(f.useCase.load(f.manager, { ...input, afterSeq: '1' })).resolves.toMatchObject({
      complete: false, throughSeq: '2', history: [{ seq: '2' }],
    });
  });
  it('reports an empty window as incomplete when the next item does not fit', async () => {
    const f = fixture({ history: [], complete: false, through_seq: '1' });
    await expect(f.useCase.load(f.manager, { ...input, afterSeq: '1', maxBytes: 2 }))
      .resolves.toEqual({ history: [], complete: false, throughSeq: '1' });
  });
  it('has no arbitrary 128-message cap for small messages within the byte window', async () => {
    const history = Array.from({ length: 500 }, (_, i) => message(String(i + 1)));
    const f = fixture({ history, complete: true, through_seq: '500' });
    const result = await f.useCase.load(f.manager, { ...input, throughSeq: '500' });
    expect(result.history).toHaveLength(500);
    expect(result.complete).toBe(true);
  });
  it.each([
    null,
    { schema_version: 1, module_routes: ['/finances-personal'] },
    { schema_version: 1, module_routes: ['/business'], ignored: true },
    { schema_version: 1, module_routes: 'invalid' },
  ])('redacts content whose returned scope is unavailable or malformed', async (scope) => {
    const f = fixture({ history: [message('1', scope)], complete: true, through_seq: '1' });
    const result = await f.useCase.load(f.manager, input);
    expect(result.history).toEqual([{ seq: '1', role: 'user', scope: null, parts: [] }]);
    expect(JSON.stringify(result)).not.toContain('Message');
  });
  it.each([
    { throughSeq: '-1' }, { throughSeq: '01' }, { afterSeq: '4' },
    { maxBytes: 1 }, { maxBytes: 1.1 }, { maxBytes: Number.POSITIVE_INFINITY },
    { moduleRoutes: ['arbitrary'] }, { moduleRoutes: Array(65).fill('/business') },
  ])('rejects an invalid window before SQL', async (change) => {
    const f = fixture();
    await expect(f.useCase.load(f.manager, { ...input, ...change })).rejects.toThrow('nodia_ai:context_invalid');
    expect(f.query).not.toHaveBeenCalled();
  });
  it.each([
    { history: [], complete: 'true', through_seq: '0' },
    { history: [message('3'), message('1')], complete: true, through_seq: '1' },
    { history: [message('1')], complete: true, through_seq: '2' },
    { history: [message('4')], complete: true, through_seq: '4' },
    { history: [{ ...message('1'), role: 'system' }], complete: true, through_seq: '1' },
    { history: [{ ...message('1'), parts: [{ kind: 'text', text: 7 }] }], complete: true, through_seq: '1' },
  ])('refuses a malformed storage projection rather than treating it as empty success', async (row) => {
    const f = fixture(row);
    await expect(f.useCase.load(f.manager, input)).rejects.toThrow('nodia_ai:context_invalid');
  });
  it('rejects an oversized returned window using actual UTF-8 bytes', async () => {
    const f = fixture({ history: [message('1')], complete: true, through_seq: '1' });
    await expect(f.useCase.load(f.manager, { ...input, maxBytes: 5 })).rejects.toThrow('nodia_ai:context_invalid');
  });
  it('requires a durable transaction for history and fingerprint reads', async () => {
    const f = fixture();
    Object.assign(f.manager.queryRunner!, { isTransactionActive: false });
    await expect(f.useCase.load(f.manager, input)).rejects.toThrow('authorization:transaction_required');
    await expect(f.useCase.fingerprint(f.manager, input.conversationId, '3')).rejects.toThrow('authorization:transaction_required');
    expect(f.query).not.toHaveBeenCalled();
  });
  it('uses a validated full SHA256 result without returning source content', async () => {
    const f = fixture({ hash: 'a'.repeat(64) });
    await expect(f.useCase.fingerprint(f.manager, input.conversationId, '3')).resolves.toBe('a'.repeat(64));
    expect(f.query.mock.calls[0]?.[1]).toEqual([input.conversationId, '3']);
  });
  it.each([{ hash: '' }, { hash: 'a'.repeat(63) }, { hash: 123 }, null])('rejects an invalid database hash', async (row) => {
    const f = fixture(row);
    await expect(f.useCase.fingerprint(f.manager, input.conversationId, '3')).rejects.toThrow('nodia_ai:context_invalid');
  });
});
