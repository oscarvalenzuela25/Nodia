import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { NodiaAiAttachment } from '../../nodia-ai-attachment/entities/nodia-ai-attachment.entity.js';
import type { NodiaAiAttachmentService } from '../../nodia-ai-attachment/nodia-ai-attachment.service.js';
import type { ExpireNodiaAiConversationsUseCase } from '../../nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { PrepareNodiaAiRestoreUseCase } from './prepare-nodia-ai-restore.use-case.js';
import { ValidateNodiaAiRestoreUseCase, type NodiaAiRestoreInput, type NodiaAiResourceDeletionManifest } from './validate-nodia-ai-restore.use-case.js';

function fixture() {
  const now = new Date('2026-10-20T12:00:00.000Z');
  const attachment = Object.assign(new NodiaAiAttachment(), {
    id: randomUUID(), conversation_id: randomUUID(), generation: randomUUID(),
    state: 'ready', interpretation_text: 'private synthetic derivative',
    interpretation_origin: 'user_reviewed', interpretation_reviewed: true, interpretation_revision: 2,
  });
  let bound = false, present = true, parentLifecycle = 'active', parentExpiry = new Date(now.getTime() + 86_400_000), pending = false;
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('clock_timestamp() AS now')) return [{ now }];
    if (sql.startsWith('SELECT EXISTS')) return [{ exists: bound }];
    if (sql.startsWith('SELECT lifecycle,expires_at')) return [{ lifecycle: parentLifecycle, expires_at: parentExpiry }];
    if (sql.startsWith('SELECT count')) return [{ count: pending ? '1' : '0' }];
    if (sql.startsWith('DELETE FROM nodia_ai_preferences')) return [{ id: preferenceId }];
    return [];
  });
  const repository = { findOne: vi.fn(async () => present ? attachment : null) };
  const manager = { query, getRepository: () => repository } as unknown as EntityManager;
  const source = { transaction: async <T>(work: (m: EntityManager) => Promise<T>) => work(manager), query } as unknown as DataSource;
  const cleanup = vi.fn().mockResolvedValue(undefined);
  const attachments = { queueCleanup: cleanup } as unknown as NodiaAiAttachmentService;
  const expire = { execute: vi.fn(async () => { pending = false; return { purged_chats: 1 }; }) } as unknown as ExpireNodiaAiConversationsUseCase;
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(policyEnvelope());
  const backup = { id: randomUUID(), captured_at: '2026-10-19T12:00:00.000Z' };
  const preferenceId = randomUUID();
  const manifest: NodiaAiResourceDeletionManifest = {
    schema_version: 2, backup_id: backup.id, coverage_from: backup.captured_at, coverage_through: now.toISOString(), first_sequence: 1,
    entries: [
      { kind: 'attachment', sequence: 1, deleted_at: now.toISOString(), conversation_id: attachment.conversation_id, attachment_id: attachment.id, storage_generations: [attachment.generation] },
      { kind: 'preference', sequence: 2, deleted_at: now.toISOString(), preference_id: preferenceId },
    ],
  };
  const text = JSON.stringify(manifest);
  const input: NodiaAiRestoreInput = { operationMode: 'quarantine', backup, quarantined_at: now.toISOString(), manifest: text, journalHead: { sha256: createHash('sha256').update(text).digest('hex'), last_sequence: 2 } };
  return {
    attachment, preferenceId, query, repository, cleanup, expire, input, manifest,
    subject: new PrepareNodiaAiRestoreUseCase(source, policy, expire, new ValidateNodiaAiRestoreUseCase(), attachments),
    setBound: () => { bound = true; }, setAbsent: () => { present = false; },
    setParentForPurge: (kind: 'expired' | 'expiring' | 'manifest') => {
      bound = true; pending = true;
      if (kind === 'expired') parentExpiry = now;
      if (kind === 'expiring') parentLifecycle = 'expiring';
      if (kind === 'manifest') {
        manifest.entries.push({ kind: 'conversation', sequence: 3, deleted_at: now.toISOString(), conversation_id: attachment.conversation_id, storage_generations: [attachment.generation] });
        input.manifest = JSON.stringify(manifest); input.journalHead.sha256 = createHash('sha256').update(input.manifest).digest('hex'); input.journalHead.last_sequence = 3;
      }
    },
  };
}
describe('PrepareNodiaAiRestoreUseCase independent resource privacy', () => {
  it('applies independent tombstones without deleting or expiring their live conversation', async () => {
    const f = fixture();
    await expect(f.subject.execute(f.input)).resolves.toMatchObject({
      prepared: true, release_authorized: false, dispatches: 0,
      attachment_tombstones_applied: 1, preference_tombstones_applied: 1,
    });
    expect(f.attachment.state).toBe('expired');
    expect(f.attachment.interpretation_text).toBeNull();
    expect(f.cleanup).toHaveBeenCalledTimes(1);
    expect(f.query).toHaveBeenCalledWith('DELETE FROM nodia_ai_preferences WHERE id=$1 RETURNING id', [f.preferenceId]);
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE nodia_ai_conversations SET lifecycle='expiring'"))).toBe(false);
    expect(f.expire.execute).not.toHaveBeenCalled();
  });
  it('does not erase a bound message or chat when an individual discard conflicts with restored data', async () => {
    const f = fixture(); f.setBound();
    await expect(f.subject.execute(f.input)).rejects.toThrow('restore_resource_conflict');
    expect(f.cleanup).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('DELETE FROM nodia_ai_message_parts'))).toBe(false);
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('DELETE FROM nodia_ai_conversations'))).toBe(false);
  });
  it('treats an already absent attachment as idempotent without cleaning a different generation', async () => {
    const f = fixture(); f.setAbsent();
    await expect(f.subject.execute(f.input)).resolves.toMatchObject({ attachment_tombstones_applied: 0, release_authorized: false });
    expect(f.cleanup).not.toHaveBeenCalled();
    expect(f.repository.findOne).toHaveBeenCalledWith({ where: { id: f.attachment.id, conversation_id: f.attachment.conversation_id, generation: f.attachment.generation }, lock: { mode: 'pessimistic_write' } });
  });
  it.each(['expired', 'expiring', 'manifest'] as const)('defers bound file tombstones to ordinary whole-chat purge when parent is %s', async kind => {
    const f = fixture(); f.setParentForPurge(kind);
    await expect(f.subject.execute(f.input)).resolves.toMatchObject({
      prepared: true, purged_chats: 1, attachment_tombstones_applied: 0, release_authorized: false,
    });
    expect(f.expire.execute).toHaveBeenCalledTimes(1);
    expect(f.repository.findOne).not.toHaveBeenCalled();
    expect(f.cleanup).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('SELECT EXISTS(SELECT 1 FROM nodia_ai_message_parts'))).toBe(false);
  });
});
