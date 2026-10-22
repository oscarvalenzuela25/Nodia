import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { ValidateNodiaAiRestoreUseCase, type NodiaAiRestoreInput, type NodiaAiDeletionManifest, type NodiaAiResourceDeletionManifest } from './validate-nodia-ai-restore.use-case.js';

const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(policyEnvelope());
const now = new Date('2026-10-20T12:00:00.000Z');
function fixture() {
  const backup = { id: randomUUID(), captured_at: '2026-10-19T12:00:00.000Z' };
  const manifest: NodiaAiDeletionManifest = {
    schema_version: 1,
    backup_id: backup.id,
    coverage_from: backup.captured_at,
    coverage_through: now.toISOString(),
    first_sequence: 37,
    entries: [{ sequence: 37, conversation_id: randomUUID(), deleted_at: '2026-10-20T10:00:00.000Z', storage_generations: [randomUUID()] }],
  };
  const input: NodiaAiRestoreInput = {
    operationMode: 'quarantine', backup, quarantined_at: now.toISOString(),
    journalHead: { sha256: '', last_sequence: 37 }, manifest: '',
  };
  function seal() { input.manifest = JSON.stringify(manifest); input.journalHead.sha256 = createHash('sha256').update(input.manifest).digest('hex'); }
  seal();
  return { input, manifest, seal };
}
const validate = new ValidateNodiaAiRestoreUseCase();
describe('ValidateNodiaAiRestoreUseCase', () => {
  it('accepts externally pinned contiguous coverage without conferring release permission', () => {
    const { input, manifest } = fixture();
    expect(validate.execute(input, now, policy)).toEqual(manifest);
  });
  it('accepts a sealed empty interval and preserves a real zero head', () => {
    const { input, manifest, seal } = fixture();
    manifest.first_sequence = 1; manifest.entries = []; input.journalHead.last_sequence = 0; seal();
    expect(validate.execute(input, now, policy).entries).toEqual([]);
  });
  it.each(['normal', '', 'QUARANTINE'])('rejects non-quarantine mode %s before application effects', operationMode => {
    const { input } = fixture(); input.operationMode = operationMode;
    expect(() => validate.execute(input, now, policy)).toThrow();
  });
  it('rejects a backup older than the seven-day policy horizon', () => {
    const { input, manifest, seal } = fixture();
    input.backup.captured_at = manifest.coverage_from = '2026-10-12T12:00:00.000Z'; seal();
    expect(() => validate.execute(input, now, policy)).toThrow('restore_backup_expired');
  });
  it('rejects modified content even when a caller writes complete=true', () => {
    const { input } = fixture(); input.manifest += ' ';
    expect(() => validate.execute(input, now, policy)).toThrow('restore_manifest_invalid');
  });
  it.each(['missing_tail', 'gap', 'coverage_gap', 'wrong_backup', 'duplicate_chat', 'secret_field', 'invalid_date', 'future_coverage', 'invalid_generation'])('rejects %s even when its digest matches', scenario => {
    const { input, manifest, seal } = fixture();
    if (scenario === 'missing_tail') input.journalHead.last_sequence++;
    if (scenario === 'gap') manifest.entries[0].sequence++;
    if (scenario === 'coverage_gap') manifest.coverage_from = '2026-10-20T00:00:00.000Z';
    if (scenario === 'wrong_backup') manifest.backup_id = randomUUID();
    if (scenario === 'duplicate_chat') { manifest.entries.push({ ...manifest.entries[0], sequence: 38 }); input.journalHead.last_sequence = 38; }
    if (scenario === 'secret_field') Object.assign(manifest.entries[0], { prompt: 'forbidden' });
    if (scenario === 'invalid_date') manifest.entries[0].deleted_at = '2026-02-30T12:00:00.000Z';
    if (scenario === 'future_coverage') manifest.coverage_through = '2026-10-21T12:00:00.000Z';
    if (scenario === 'invalid_generation') manifest.entries[0].storage_generations = ['not-a-generation'];
    seal(); expect(() => validate.execute(input, now, policy)).toThrow('restore_manifest_invalid');
  });
  it('rejects an unsealed/missing manifest and oversized input before JSON parsing', () => {
    const { input } = fixture(); input.manifest = 'x'.repeat(8 * 1024 * 1024 + 1);
    expect(() => validate.execute(input, now, policy)).toThrow('restore_manifest_invalid');
  });
  it('accepts contiguous v2 conversation, independent attachment and preference tombstones', () => {
    const { input } = fixture();
    const manifest: NodiaAiResourceDeletionManifest = {
      schema_version: 2, backup_id: input.backup.id, coverage_from: input.backup.captured_at,
      coverage_through: now.toISOString(), first_sequence: 1,
      entries: [
        { kind: 'conversation', sequence: 1, deleted_at: now.toISOString(), conversation_id: randomUUID(), storage_generations: [] },
        { kind: 'attachment', sequence: 2, deleted_at: now.toISOString(), conversation_id: randomUUID(), attachment_id: randomUUID(), storage_generations: [randomUUID()] },
        { kind: 'preference', sequence: 3, deleted_at: now.toISOString(), preference_id: randomUUID() },
      ],
    };
    input.journalHead.last_sequence = 3;
    input.manifest = JSON.stringify(manifest); input.journalHead.sha256 = createHash('sha256').update(input.manifest).digest('hex');
    expect(validate.execute(input, now, policy)).toEqual(manifest);
  });
  it.each(['unknown_kind', 'missing_generation', 'extra_generation', 'duplicate_resource', 'secret_field', 'legacy_kind', 'wrong_schema_type'])('rejects invalid v2 resource %s even with valid digest', scenario => {
    const { input } = fixture();
    const entry: Record<string, unknown> = { kind: 'attachment', sequence: 1, deleted_at: now.toISOString(), conversation_id: randomUUID(), attachment_id: randomUUID(), storage_generations: [randomUUID()] };
    const manifest: Record<string, unknown> = { schema_version: 2, backup_id: input.backup.id, coverage_from: input.backup.captured_at, coverage_through: now.toISOString(), first_sequence: 1, entries: [entry] };
    input.journalHead.last_sequence = 1;
    if (scenario === 'unknown_kind') entry.kind = 'database';
    if (scenario === 'missing_generation') entry.storage_generations = [];
    if (scenario === 'extra_generation') entry.storage_generations = [randomUUID(), randomUUID()];
    if (scenario === 'duplicate_resource') { (manifest.entries as unknown[]).push({ ...entry, sequence: 2 }); input.journalHead.last_sequence = 2; }
    if (scenario === 'secret_field') entry.text = 'private';
    if (scenario === 'legacy_kind') manifest.schema_version = 1;
    if (scenario === 'wrong_schema_type') manifest.schema_version = '2';
    input.manifest = JSON.stringify(manifest); input.journalHead.sha256 = createHash('sha256').update(input.manifest).digest('hex');
    expect(() => validate.execute(input, now, policy)).toThrow('restore_manifest_invalid');
  });
});
