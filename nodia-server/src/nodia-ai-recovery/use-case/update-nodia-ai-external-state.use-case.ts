import { createHash } from 'node:crypto';
import type { NodiaAiDeletionJournalPort, NodiaAiJournalResource } from '../types/deletion-journal.js';
import type { NodiaAiBackupCatalog, NodiaAiBackupEntry } from '../types/nodia-ai-backup.types.js';

export type ExternalDeletionEntry = NodiaAiJournalResource & { sequence: number; deleted_at: string; confirmed_at: string | null };
export interface NodiaAiExternalState {
  schema_version: 1;
  era_id: string;
  revision: number;
  coverage_from: string;
  updated_at: string;
  closed_at: string | null;
  first_sequence: number;
  last_sequence: number;
  entries: ExternalDeletionEntry[];
  backups: NodiaAiBackupEntry[];
}
export interface ExternalStateTransport {
  read(signal: AbortSignal): Promise<{ bytes: Buffer; etag: string } | null>;
  /** false is a definite precondition conflict; uncertain writes must throw. */
  compareAndSwap(bytes: Buffer, previousETag: string | null, signal: AbortSignal): Promise<boolean>;
}

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u;
const hash = /^[a-f\d]{64}$/u;
const day = 86_400_000;
const fail = (code: string): never => { throw Error(`nodia_ai:recovery_${code}`); };
const closed = (input: unknown, names: string[]): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('state_invalid');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name))) return fail('state_invalid');
  return value;
};
const timestamp = (input: unknown): number => {
  if (typeof input !== 'string') return fail('state_invalid');
  const value = Date.parse(input);
  if (!Number.isFinite(value) || new Date(value).toISOString() !== input) return fail('state_invalid');
  return value;
};
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

function resource(input: unknown): NodiaAiJournalResource {
  const raw = input as Record<string, unknown> | null;
  if (raw?.kind === 'preference') {
    const value = closed(raw, ['kind', 'preference_id']);
    if (typeof value.preference_id !== 'string' || !uuid.test(value.preference_id)) return fail('resource_invalid');
    return { kind: 'preference', preference_id: value.preference_id };
  }
  if (raw?.kind !== 'attachment' && raw?.kind !== 'conversation') return fail('resource_invalid');
  const value = closed(raw, raw.kind === 'attachment' ? ['kind', 'conversation_id', 'attachment_id', 'storage_generations'] : ['kind', 'conversation_id', 'storage_generations']);
  if (typeof value.conversation_id !== 'string' || !uuid.test(value.conversation_id) ||
    !Array.isArray(value.storage_generations) || value.storage_generations.length > 100 ||
    value.storage_generations.some(id => typeof id !== 'string' || !uuid.test(id)) ||
    new Set(value.storage_generations).size !== value.storage_generations.length) return fail('resource_invalid');
  const base = { conversation_id: value.conversation_id, storage_generations: [...value.storage_generations as string[]].sort() };
  if (value.kind === 'attachment') {
    if (typeof value.attachment_id !== 'string' || !uuid.test(value.attachment_id) || base.storage_generations.length !== 1) return fail('resource_invalid');
    return { kind: 'attachment', ...base, attachment_id: value.attachment_id };
  }
  return { kind: 'conversation', ...base };
}

export function journalResource(entry: ExternalDeletionEntry): NodiaAiJournalResource {
  const { sequence: _sequence, deleted_at: _deleted, confirmed_at: _confirmed, ...value } = entry;
  return resource(value);
}
const identity = (value: NodiaAiJournalResource): string => {
  const normalized = resource(value);
  return normalized.kind === 'conversation' ? `conversation:${normalized.conversation_id}`
    : normalized.kind === 'attachment' ? `attachment:${normalized.attachment_id}:${normalized.storage_generations[0]}`
      : `preference:${normalized.preference_id}`;
};
const covers = (recorded: NodiaAiJournalResource, requested: NodiaAiJournalResource): boolean =>
  identity(recorded) === identity(requested) && (recorded.kind === 'preference' || requested.kind === 'preference' ||
    (recorded.conversation_id === requested.conversation_id && requested.storage_generations.every(id => recorded.storage_generations.includes(id))));

/** Single bounded external CAS state. No SQL transaction or local mutex is required.
 * All callbacks are pure and replayable only after a definite CAS conflict. */
export class UpdateNodiaAiExternalStateUseCase implements NodiaAiDeletionJournalPort {
  readonly enabled = true;
  readonly catalog: NodiaAiBackupCatalog;
  constructor(private readonly transport: ExternalStateTransport, private readonly eraId: string,
    private readonly prefix: string, private readonly now: () => Date = () => new Date(),
    private readonly closeTransport?: () => void) {
    if (!uuid.test(eraId) || !/^nodia-ai-recovery\/[a-z0-9_-]{1,48}$/u.test(prefix)) fail('configuration_invalid');
    this.catalog = {
      read: async () => (await this.snapshot()).state.backups,
      mutate: async update => { await this.mutate(state => {
        const next = update(structuredClone(state.backups));
        if (state.closed_at !== null && next.some(backup => !state.backups.some(old => old.backup_id === backup.backup_id))) fail('journal_closed');
        if (next.some(backup => !state.backups.some(old => old.backup_id === backup.backup_id)) && state.entries.some(entry => entry.confirmed_at === null)) fail('unconfirmed_deletions');
        state.backups = next;
      }); },
      checkpoint: async () => {
        const value = await this.snapshot();
        if (value.state.closed_at !== null) return fail('journal_closed');
        if (value.state.entries.some(entry => entry.confirmed_at === null)) return fail('unconfirmed_deletions');
        return { sequence: value.state.last_sequence, sha256: digest(value.bytes), coverage_from: value.state.coverage_from };
      },
    };
  }
  onModuleDestroy(): void { this.closeTransport?.(); }

  private validate(bytes: Buffer, now: Date): NodiaAiExternalState {
    if (bytes.length > 8 * 1024 * 1024) return fail('state_capacity');
    let parsed: unknown;
    try { parsed = JSON.parse(bytes.toString('utf8')); } catch { return fail('state_invalid'); }
    const value = closed(parsed, ['schema_version', 'era_id', 'revision', 'coverage_from', 'updated_at', 'closed_at', 'first_sequence', 'last_sequence', 'entries', 'backups']);
    if (value.schema_version !== 1 || value.era_id !== this.eraId ||
      !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 ||
      !Number.isSafeInteger(value.first_sequence) || Number(value.first_sequence) < 1 ||
      !Number.isSafeInteger(value.last_sequence) || Number(value.last_sequence) < 0 ||
      !Array.isArray(value.entries) || value.entries.length > 10_000 ||
      !Array.isArray(value.backups) || value.backups.length > 1024 ||
      Number(value.first_sequence) + value.entries.length - 1 !== value.last_sequence) return fail('state_invalid');
    const from = timestamp(value.coverage_from), updated = timestamp(value.updated_at);
    if (from > updated || updated > now.getTime()) return fail('clock_invalid');
    if (value.closed_at !== null && (timestamp(value.closed_at) < from || timestamp(value.closed_at) > updated)) return fail('state_invalid');
    const entries: ExternalDeletionEntry[] = [];
    const ids = new Set<string>();
    for (const [index, item] of value.entries.entries()) {
      if (!item || typeof item !== 'object') return fail('state_invalid');
      const { sequence, deleted_at, confirmed_at, ...raw } = item as Record<string, unknown>;
      const normalized = resource(raw);
      const id = identity(normalized);
      const deleted = timestamp(deleted_at);
      if (sequence !== Number(value.first_sequence) + index || deleted < from || deleted > updated || ids.has(id) ||
        (confirmed_at !== null && (timestamp(confirmed_at) < deleted || timestamp(confirmed_at) > updated))) return fail('state_invalid');
      ids.add(id);
      entries.push({ ...normalized, sequence: sequence as number, deleted_at: deleted_at as string, confirmed_at: confirmed_at as string | null });
    }
    const backupIds = new Set<string>();
    for (const item of value.backups) {
      const backup = closed(item, ['backup_id', 'object_key', 'captured_at', 'expires_at', 'encryption_key_id', 'status', 'cipher_bytes', 'cipher_sha256', 'journal_sequence', 'journal_sha256']);
      if (typeof backup.backup_id !== 'string' || !uuid.test(backup.backup_id) || backupIds.has(backup.backup_id) ||
        backup.object_key !== `${this.prefix}/backups/${backup.backup_id}.bin` ||
        !['pending', 'ready', 'deleting'].includes(String(backup.status)) ||
        typeof backup.encryption_key_id !== 'string' || !hash.test(backup.encryption_key_id) ||
        typeof backup.journal_sha256 !== 'string' || !hash.test(backup.journal_sha256) ||
        !Number.isSafeInteger(backup.journal_sequence) || Number(backup.journal_sequence) < 0 || Number(backup.journal_sequence) > Number(value.last_sequence) ||
        timestamp(backup.expires_at) - timestamp(backup.captured_at) !== 7 * day || timestamp(backup.captured_at) < from || timestamp(backup.captured_at) > updated ||
        ((backup.cipher_bytes === null) !== (backup.cipher_sha256 === null)) ||
        (backup.cipher_bytes !== null && (!Number.isSafeInteger(backup.cipher_bytes) || Number(backup.cipher_bytes) <= 0 || typeof backup.cipher_sha256 !== 'string' || !hash.test(backup.cipher_sha256))) ||
        (backup.status === 'ready' && backup.cipher_bytes === null)) return fail('state_invalid');
      backupIds.add(backup.backup_id);
    }
    return { ...value, entries } as unknown as NodiaAiExternalState;
  }

  async snapshot(signal = AbortSignal.timeout(5000)): Promise<{ state: NodiaAiExternalState; bytes: Buffer; etag: string }> {
    const response = await this.transport.read(signal);
    if (!response) return fail('journal_missing');
    return { ...response, state: this.validate(response.bytes, this.now()) };
  }

  async initialize(now = this.now()): Promise<void> {
    if (!Number.isFinite(now.getTime())) return fail('clock_invalid');
    const state: NodiaAiExternalState = { schema_version: 1, era_id: this.eraId, revision: 0,
      coverage_from: now.toISOString(), updated_at: now.toISOString(), closed_at: null, first_sequence: 1, last_sequence: 0, entries: [], backups: [] };
    const signal = AbortSignal.timeout(5000);
    if (!await this.transport.compareAndSwap(Buffer.from(JSON.stringify(state)), null, signal)) fail('already_initialized');
  }

  async mutate(update: (state: NodiaAiExternalState) => void): Promise<void> {
    const signal = AbortSignal.timeout(5000);
    for (let attempt = 0; attempt < 3; attempt++) {
      signal.throwIfAborted();
      const previous = await this.snapshot(signal);
      const next = structuredClone(previous.state);
      update(next);
      const now = this.now();
      next.revision++;
      next.updated_at = now.toISOString();
      const bytes = Buffer.from(JSON.stringify(next));
      this.validate(bytes, now);
      if (await this.transport.compareAndSwap(bytes, previous.etag, signal)) return;
    }
    fail('catalog_conflict');
  }

  async recordDeletions(input: { deleted_at: string; entries: { conversation_id: string; storage_generations: string[] }[] }): Promise<void> {
    await this.recordResources({ deleted_at: input.deleted_at, resources: input.entries.map(entry => ({ kind: 'conversation', ...entry })) });
  }
  async recordResources(input: { deleted_at: string; resources: NodiaAiJournalResource[] }): Promise<void> {
    const deleted = timestamp(input.deleted_at);
    if (!input.resources.length || input.resources.length > 100 || deleted > this.now().getTime()) fail('resource_invalid');
    const resources = input.resources.map(resource);
    await this.mutate(state => {
      if (state.closed_at !== null) fail('journal_closed');
      if (deleted < timestamp(state.coverage_from)) fail('journal_uncovered');
      const existing = new Map(state.entries.map(entry => [identity(journalResource(entry)), entry]));
      for (const value of resources) {
        const id = identity(value);
        const prior = existing.get(id);
        if (prior) {
          if (prior.kind === 'attachment' && value.kind === 'attachment' && prior.conversation_id !== value.conversation_id) fail('resource_conflict');
          if (prior.kind === 'conversation' && value.kind === 'conversation' && !covers(journalResource(prior), value)) {
            prior.storage_generations = [...new Set([...prior.storage_generations, ...value.storage_generations])].sort();
            prior.confirmed_at = null;
          }
          continue;
        }
        const next = { ...value, deleted_at: input.deleted_at, confirmed_at: null, sequence: ++state.last_sequence };
        state.entries.push(next); existing.set(id, next);
      }
    });
  }
  async assertResourcesRecorded(resources: NodiaAiJournalResource[]): Promise<void> {
    const { state } = await this.snapshot();
    if (state.closed_at !== null) fail('journal_closed');
    if (resources.some(value => !state.entries.some(entry => covers(journalResource(entry), value)))) fail('journal_uncovered');
  }
  async confirmResources(resources: NodiaAiJournalResource[]): Promise<void> {
    const requested = new Map(resources.map(value => [identity(value), value]));
    await this.mutate(state => {
      let found = 0;
      for (const entry of state.entries) if (requested.has(identity(journalResource(entry)))) {
        if (!covers(journalResource(entry), requested.get(identity(journalResource(entry)))!)) fail('journal_uncovered');
        found++;
        entry.confirmed_at ??= this.now().toISOString();
      }
      if (found !== requested.size) fail('journal_uncovered');
    });
  }

  /** Drop only a contiguous, resolved prefix after ALL older registered copies are absent. */
  async prune(): Promise<void> {
    await this.mutate(state => {
      const now = this.now().getTime();
      while (state.entries.length) {
        const entry = state.entries[0];
        if (!entry.confirmed_at || now < timestamp(entry.confirmed_at) + 8 * day ||
          state.backups.some(backup => timestamp(backup.captured_at) <= timestamp(entry.confirmed_at!))) break;
        state.entries.shift();
        state.first_sequence++;
      }
      // A closed era has no coverage beyond its terminal boundary. With no
      // remaining entries/backups, the rolling floor must not move past that
      // boundary and invalidate an otherwise clean, still reconcilable state.
      const coverageCeiling = state.closed_at === null ? now : timestamp(state.closed_at);
      const oldest = Math.min(now - 8 * day, coverageCeiling, ...state.backups.map(backup => timestamp(backup.captured_at)),
        ...state.entries.map(entry => timestamp(entry.deleted_at)));
      state.coverage_from = new Date(Math.max(timestamp(state.coverage_from), oldest)).toISOString();
    });
  }

  async exportManifest(backupId: string, quarantinedAt: string) {
    if (timestamp(quarantinedAt) > this.now().getTime()) fail('clock_invalid');
    // Operator has already stopped every writer. The CAS is a barrier AFTER that
    // instant, not a claim that an earlier GET covered later wall-clock time.
    await this.mutate(() => {});
    const snapshot = await this.snapshot();
    if (snapshot.state.closed_at !== null) fail('journal_closed');
    const backup = snapshot.state.backups.find(entry => entry.backup_id === backupId);
    const now = this.now().getTime();
    if (!backup || backup.status !== 'ready' || timestamp(backup.expires_at) <= now ||
      timestamp(backup.captured_at) > timestamp(quarantinedAt) || timestamp(quarantinedAt) > timestamp(snapshot.state.updated_at)) fail('backup_unavailable');
    const manifest = JSON.stringify({ schema_version: 2, backup_id: backupId, coverage_from: snapshot.state.coverage_from,
      coverage_through: snapshot.state.updated_at, first_sequence: snapshot.state.first_sequence,
      entries: snapshot.state.entries.map(({ confirmed_at: _confirmed, ...entry }) => entry) });
    return { manifest, head: { sha256: digest(manifest), last_sequence: snapshot.state.last_sequence },
      metadata: { backup: { id: backupId, captured_at: backup!.captured_at }, quarantined_at: quarantinedAt } };
  }
  async closeEra(): Promise<void> {
    await this.mutate(state => { state.closed_at ??= this.now().toISOString(); });
  }
}
