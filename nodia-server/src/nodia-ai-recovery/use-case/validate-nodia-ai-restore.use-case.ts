import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { AssertNodiaAiOperationModeUseCase } from '../../nodia-ai-runtime/use-case/assert-nodia-ai-operation-mode.use-case.js';
import type { NodiaAiJournalResource } from '../types/deletion-journal.js';

/** The head is supplied from the deletion journal's trusted external store, never the backup. */
export interface NodiaAiRestoreInput {
  operationMode: string;
  backup: { id: string; captured_at: string };
  quarantined_at: string;
  journalHead: { sha256: string; last_sequence: number };
  manifest: string;
}
export interface NodiaAiDeletionEntry {
  sequence: number;
  conversation_id: string;
  deleted_at: string;
  storage_generations: string[];
}
export interface NodiaAiDeletionManifest {
  schema_version: 1;
  backup_id: string;
  coverage_from: string;
  coverage_through: string;
  first_sequence: number;
  entries: NodiaAiDeletionEntry[];
}
export type NodiaAiResourceDeletionEntry = NodiaAiJournalResource & {
  sequence: number;
  deleted_at: string;
};
export interface NodiaAiResourceDeletionManifest {
  schema_version: 2;
  backup_id: string;
  coverage_from: string;
  coverage_through: string;
  first_sequence: number;
  entries: NodiaAiResourceDeletionEntry[];
}
export type NodiaAiValidatedDeletionManifest = NodiaAiDeletionManifest | NodiaAiResourceDeletionManifest;

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
const maxManifestBytes = 8 * 1024 * 1024;
const maxEntries = 10_000;
const invalid = (): never => { throw Error('nodia_ai:restore_manifest_invalid'); };
const closed = (value: unknown, fields: string[]): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== fields.length || fields.some(key => !Object.hasOwn(record, key))) return invalid();
  return record;
};
const date = (value: unknown): number => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value)) return invalid();
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) return invalid();
  return time;
};

/** Pure admission rule. A SHA/head cannot attest deletions that the external journal never recorded. */
@Injectable()
export class ValidateNodiaAiRestoreUseCase {
  execute(input: NodiaAiRestoreInput, now: Date, policy: NodiaAiRuntimePolicy): NodiaAiValidatedDeletionManifest {
    closed(input, ['operationMode', 'backup', 'quarantined_at', 'journalHead', 'manifest']);
    new AssertNodiaAiOperationModeUseCase().execute({ NODIA_AI_OPERATION_MODE: input.operationMode }, 'restore');
    closed(input.backup, ['id', 'captured_at']);
    closed(input.journalHead, ['sha256', 'last_sequence']);
    if (!uuid.test(input.backup.id) || !/^[a-f0-9]{64}$/u.test(input.journalHead.sha256) ||
      !Number.isSafeInteger(input.journalHead.last_sequence) || input.journalHead.last_sequence < 0 ||
      typeof input.manifest !== 'string' || Buffer.byteLength(input.manifest, 'utf8') > maxManifestBytes ||
      createHash('sha256').update(input.manifest).digest('hex') !== input.journalHead.sha256) return invalid();
    const captured = date(input.backup.captured_at), quarantine = date(input.quarantined_at);
    if (!Number.isFinite(now.getTime()) || captured > quarantine || quarantine > now.getTime() ||
      now.getTime() - captured > policy.retention.backup_max_days * 86_400_000) throw Error('nodia_ai:restore_backup_expired');
    let parsed: unknown;
    try { parsed = JSON.parse(input.manifest); } catch { return invalid(); }
    const manifest = closed(parsed, ['schema_version', 'backup_id', 'coverage_from', 'coverage_through', 'first_sequence', 'entries']);
    if ((manifest.schema_version !== 1 && manifest.schema_version !== 2) || manifest.backup_id !== input.backup.id ||
      !Number.isSafeInteger(manifest.first_sequence) || (manifest.first_sequence as number) < 1 ||
      !Array.isArray(manifest.entries) || manifest.entries.length > maxEntries) return invalid();
    const from = date(manifest.coverage_from), through = date(manifest.coverage_through);
    if (from > captured || through < quarantine || through > now.getTime() ||
      quarantine - from > policy.retention.backup_max_days * 86_400_000 + policy.retention.physical_cleanup_target_seconds * 1000 ||
      (manifest.first_sequence as number) + manifest.entries.length - 1 !== input.journalHead.last_sequence) return invalid();
    const resources = new Set<string>();
    for (const [index, raw] of manifest.entries.entries()) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
      const candidate = raw as Record<string, unknown>;
      const kind = manifest.schema_version === 1 ? 'conversation' : candidate.kind;
      const fields = kind === 'conversation'
        ? ['conversation_id', 'storage_generations']
        : kind === 'attachment'
          ? ['conversation_id', 'attachment_id', 'storage_generations']
          : kind === 'preference' ? ['preference_id'] : null;
      if (!fields) return invalid();
      const entry = closed(raw, ['sequence', 'deleted_at', ...fields, ...(manifest.schema_version === 2 ? ['kind'] : [])]);
      if (entry.sequence !== (manifest.first_sequence as number) + index) return invalid();
      for (const field of fields.filter(field => field !== 'storage_generations'))
        if (typeof entry[field] !== 'string' || !uuid.test(entry[field] as string)) return invalid();
      if (kind !== 'preference' &&
        (!Array.isArray(entry.storage_generations) || entry.storage_generations.length > policy.admission.attachments_per_chat ||
        entry.storage_generations.some(value => typeof value !== 'string' || !uuid.test(value)) ||
        new Set(entry.storage_generations).size !== entry.storage_generations.length)) return invalid();
      if (kind === 'attachment' && (entry.storage_generations as unknown[]).length !== 1) return invalid();
      const identity = kind === 'conversation' ? `conversation:${String(entry.conversation_id)}`
        : kind === 'attachment' ? `attachment:${String(entry.attachment_id)}:${String((entry.storage_generations as string[])[0])}`
          : `preference:${String(entry.preference_id)}`;
      if (resources.has(identity)) return invalid();
      const deleted = date(entry.deleted_at);
      if (deleted < from || deleted > through) return invalid();
      resources.add(identity);
    }
    return parsed as NodiaAiValidatedDeletionManifest;
  }
}
