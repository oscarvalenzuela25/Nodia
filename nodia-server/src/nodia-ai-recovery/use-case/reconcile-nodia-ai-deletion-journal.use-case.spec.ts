import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { NodiaAiJournalResource } from '../types/deletion-journal.js';
import type { ExternalDeletionEntry } from './update-nodia-ai-external-state.use-case.js';
import { ReconcileNodiaAiDeletionJournalUseCase } from './reconcile-nodia-ai-deletion-journal.use-case.js';

const subject = new ReconcileNodiaAiDeletionJournalUseCase();
const entry = (resource: NodiaAiJournalResource, sequence = 1): ExternalDeletionEntry => ({
  ...resource, sequence, deleted_at: '2026-10-20T12:00:00.000Z', confirmed_at: null,
});
describe('ReconcileNodiaAiDeletionJournalUseCase', () => {
  it('confirms a later absent resource even when the first hundred pending records still exist', async () => {
    const retained = Array.from({ length: 100 }, () => ({ kind: 'preference' as const, preference_id: randomUUID() }));
    const absent = { kind: 'preference' as const, preference_id: randomUUID() };
    const findExisting = vi.fn(async () => retained.map(value => value.preference_id));
    await expect(subject.execute([...retained, absent].map((value, index) => entry(value, index + 1)), { findExisting })).resolves.toEqual({ confirmed: [absent], pending: 100 });
    expect(findExisting).toHaveBeenCalledTimes(1);
    expect(findExisting).toHaveBeenCalledWith('preference', [...retained.map(value => value.preference_id), absent.preference_id]);
  });
  it('groups all three resource kinds into at most three set reads and preserves present witnesses', async () => {
    const chat = { kind: 'conversation' as const, conversation_id: randomUUID(), storage_generations: [] };
    const file = { kind: 'attachment' as const, conversation_id: chat.conversation_id, attachment_id: randomUUID(), storage_generations: [randomUUID()] };
    const preference = { kind: 'preference' as const, preference_id: randomUUID() };
    const findExisting = vi.fn(async (kind: string) => kind === 'attachment' ? [file.attachment_id] : []);
    await expect(subject.execute([chat, file, preference].map((value, index) => entry(value, index + 1)), { findExisting })).resolves.toEqual({ confirmed: [chat, preference], pending: 1 });
    expect(findExisting).toHaveBeenCalledTimes(3);
    expect(findExisting.mock.calls.map(([kind]) => kind)).toEqual(['conversation', 'attachment', 'preference']);
  });
  it('does no data access for an empty pending set', async () => {
    const findExisting = vi.fn();
    await expect(subject.execute([], { findExisting })).resolves.toEqual({ confirmed: [], pending: 0 });
    expect(findExisting).not.toHaveBeenCalled();
  });
  it('retains all pending witnesses when all resources remain present', async () => {
    const resources = Array.from({ length: 102 }, () => ({ kind: 'preference' as const, preference_id: randomUUID() }));
    await expect(subject.execute(resources.map((value, index) => entry(value, index + 1)), { findExisting: async () => resources.map(value => value.preference_id) })).resolves.toEqual({ confirmed: [], pending: 102 });
  });
  it('rejects an invalid opaque identity before performing a set read', async () => {
    const findExisting = vi.fn();
    await expect(subject.execute([entry({ kind: 'preference', preference_id: 'not-an-id' })], { findExisting })).rejects.toThrow('resource_invalid');
    expect(findExisting).not.toHaveBeenCalled();
  });
  it.each(['foreign', 'duplicate', 'not_array'])('rejects an invalid existence response (%s) instead of manufacturing absence', async kind => {
    const resource = { kind: 'preference' as const, preference_id: randomUUID() };
    const response = kind === 'foreign' ? [randomUUID()] : kind === 'duplicate' ? [resource.preference_id, resource.preference_id] : null;
    await expect(subject.execute([entry(resource)], { findExisting: async () => response })).rejects.toThrow('reconciliation_invalid');
  });
  it('does not acknowledge anything when the SQL read fails', async () => {
    await expect(subject.execute([entry({ kind: 'preference', preference_id: randomUUID() })], { findExisting: async () => { throw Error('SQL unavailable'); } })).rejects.toThrow('SQL unavailable');
  });
  it('rejects over-capacity pending input before data access', async () => {
    const findExisting = vi.fn();
    await expect(subject.execute(Array.from({ length: 10_001 }, () => entry({ kind: 'preference', preference_id: randomUUID() })), { findExisting })).rejects.toThrow('reconciliation_invalid');
    expect(findExisting).not.toHaveBeenCalled();
  });
});
