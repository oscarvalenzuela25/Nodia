import { Injectable } from '@nestjs/common';
import type { NodiaAiBackupEntry, NodiaAiBackupObservation, NodiaAiBackupPorts, NodiaAiBackupReceipt } from '../types/nodia-ai-backup.types.js';

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u;
const digest = /^[a-f\d]{64}$/u;
const day = 86_400_000;
const fail = (code: string): never => { throw Error(`nodia_ai:backup_${code}`); };
const timestamp = (text: string): number => {
  const value = Date.parse(text);
  if (!Number.isFinite(value) || new Date(value).toISOString() !== text) return fail('catalog_invalid');
  return value;
};
const receiptValid = (value: NodiaAiBackupReceipt): boolean => Number.isSafeInteger(value.cipher_bytes) && value.cipher_bytes > 0 && digest.test(value.cipher_sha256);

/** Operator-only lifecycle. The external catalog is authoritative across VM/DB restore.
 * A local runner lock excludes overlapping snapshot jobs, not journal writers. */
@Injectable()
export class ManageNodiaAiBackupsUseCase {
  private validate(entry: NodiaAiBackupEntry): void {
    const fields = ['backup_id', 'object_key', 'captured_at', 'expires_at', 'encryption_key_id', 'status', 'cipher_bytes', 'cipher_sha256', 'journal_sequence', 'journal_sha256'];
    if (!entry || Object.keys(entry).length !== fields.length || fields.some(field => !Object.hasOwn(entry, field)) ||
      !uuid.test(entry.backup_id) || !/^nodia-ai-recovery\/[a-z0-9_-]{1,48}\/backups\/[a-f\d-]{36}\.bin$/u.test(entry.object_key) ||
      !entry.object_key.endsWith(`/${entry.backup_id}.bin`) || !digest.test(entry.encryption_key_id) ||
      !['pending', 'ready', 'deleting'].includes(entry.status) || !Number.isSafeInteger(entry.journal_sequence) || entry.journal_sequence < 0 ||
      !digest.test(entry.journal_sha256) || timestamp(entry.expires_at) - timestamp(entry.captured_at) !== 7 * day ||
      ((entry.cipher_bytes === null) !== (entry.cipher_sha256 === null)) ||
      (entry.cipher_bytes !== null && !receiptValid({ cipher_bytes: entry.cipher_bytes, cipher_sha256: entry.cipher_sha256! })) ||
      (entry.status === 'ready' && entry.cipher_bytes === null)) fail('catalog_invalid');
  }

  private async replace(ports: NodiaAiBackupPorts, entry: NodiaAiBackupEntry, next: NodiaAiBackupEntry | null): Promise<void> {
    await ports.catalog.mutate(current => {
      const original = current.find(value => value.backup_id === entry.backup_id);
      if (!original || Object.keys(original).length !== Object.keys(entry).length ||
        (Object.keys(entry) as (keyof NodiaAiBackupEntry)[]).some(key => original[key] !== entry[key])) return fail('catalog_conflict');
      return current.flatMap(value => value.backup_id === entry.backup_id ? next ? [{ ...next }] : [] : [value]);
    });
  }

  private assertObservation(entry: NodiaAiBackupEntry, observed: NodiaAiBackupObservation): void {
    if (!receiptValid(observed) || observed.backup_id !== entry.backup_id || observed.encryption_key_id !== entry.encryption_key_id ||
      typeof observed.etag !== 'string' || observed.etag.length < 1 || observed.etag.length > 256 ||
      (observed.version_id !== null && (typeof observed.version_id !== 'string' || observed.version_id.length > 1024)) ||
      observed.cipher_bytes !== entry.cipher_bytes || observed.cipher_sha256 !== entry.cipher_sha256) fail('object_mismatch');
  }

  private assertFresh(entry: NodiaAiBackupEntry, ports: NodiaAiBackupPorts): void {
    const now = ports.now().getTime();
    if (!Number.isFinite(now) || now < timestamp(entry.captured_at)) return fail('clock_invalid');
    if (now >= timestamp(entry.expires_at)) return fail('expired');
  }

  async create(input: { backup_id: string; prefix: string; encryption_key_id: string; backup_max_days: number }, ports: NodiaAiBackupPorts, signal: AbortSignal): Promise<NodiaAiBackupEntry> {
    signal.throwIfAborted();
    if (!uuid.test(input.backup_id) || !/^nodia-ai-recovery\/[a-z0-9_-]{1,48}$/u.test(input.prefix) || !digest.test(input.encryption_key_id) || input.backup_max_days !== 7) return fail('configuration_invalid');
    const now = ports.now();
    if (!Number.isFinite(now.getTime())) return fail('clock_invalid');
    const checkpoint = await ports.catalog.checkpoint();
    if (!Number.isSafeInteger(checkpoint.sequence) || checkpoint.sequence < 0 || !digest.test(checkpoint.sha256) || timestamp(checkpoint.coverage_from) > now.getTime()) return fail('journal_uncovered');
    const entry: NodiaAiBackupEntry = { backup_id: input.backup_id, object_key: `${input.prefix}/backups/${input.backup_id}.bin`, captured_at: now.toISOString(), expires_at: new Date(now.getTime() + 7 * day).toISOString(), encryption_key_id: input.encryption_key_id, status: 'pending', cipher_bytes: null, cipher_sha256: null, journal_sequence: checkpoint.sequence, journal_sha256: checkpoint.sha256 };
    await ports.catalog.mutate(current => {
      current.forEach(value => this.validate(value));
      if (current.some(value => value.backup_id === entry.backup_id || value.object_key === entry.object_key)) return fail('already_reserved');
      if (current.length >= 1024) return fail('catalog_capacity');
      return [...current, { ...entry }];
    });
    let prepared = entry;
    try {
      const receipt = await ports.prepare(entry, signal);
      if (!receiptValid(receipt)) return fail('receipt_invalid');
      prepared = { ...entry, ...receipt };
      await this.replace(ports, entry, prepared);
      this.assertFresh(prepared, ports);
      await ports.upload(prepared, signal);
      const observed = await ports.inspect(prepared, signal);
      if (!observed) return fail('upload_unconfirmed');
      this.assertObservation(prepared, observed);
      this.assertFresh(prepared, ports);
      const ready: NodiaAiBackupEntry = { ...prepared, status: 'ready' };
      await this.replace(ports, prepared, ready);
      return ready;
    } finally { await ports.cleanupSpool(prepared); }
  }

  async rotate(ports: NodiaAiBackupPorts, signal: AbortSignal): Promise<{ removed: number; pending_recovered: number; retained: number }> {
    signal.throwIfAborted();
    const entries = await ports.catalog.read();
    if (entries.length > 1024 || new Set(entries.map(value => value.backup_id)).size !== entries.length || new Set(entries.map(value => value.object_key)).size !== entries.length) return fail('catalog_invalid');
    entries.forEach(entry => this.validate(entry));
    const result = { removed: 0, pending_recovered: 0, retained: 0 };
    for (let entry of entries) {
      signal.throwIfAborted();
      const now = ports.now().getTime();
      if (!Number.isFinite(now) || timestamp(entry.captured_at) > now) return fail('clock_invalid');
      let expired = now >= timestamp(entry.expires_at);
      if (!expired && entry.status === 'ready') { result.retained++; continue; }
      const observed = await ports.inspect(entry, signal);
      if (observed) this.assertObservation(entry, observed);
      const afterInspection = ports.now().getTime();
      if (!Number.isFinite(afterInspection) || afterInspection < now) return fail('clock_invalid');
      expired ||= afterInspection >= timestamp(entry.expires_at);
      // A pending PUT may commit after a crashed client observed 404. Its durable
      // pre-PUT receipt remains the minimal unresolved ownership witness even
      // after expiry; seven days is not an upstream request-latency guarantee.
      // Deleting differs: this lifecycle only enters it after a positive object
      // observation (including a previously verified ready object), or when no
      // receipt existed and therefore upload could not have been issued.
      if (entry.status === 'pending' && !observed && entry.cipher_bytes !== null) {
        await ports.cleanupSpool(entry);
        result.retained++;
        continue;
      }
      if (!expired && entry.status === 'pending' && observed) {
        const ready: NodiaAiBackupEntry = { ...entry, status: 'ready' };
        await this.replace(ports, entry, ready);
        await ports.cleanupSpool(entry);
        result.pending_recovered++;
        continue;
      }
      if (entry.status !== 'deleting') {
        const deleting: NodiaAiBackupEntry = { ...entry, status: 'deleting' };
        await this.replace(ports, entry, deleting);
        entry = deleting;
      }
      if (observed) {
        await ports.deleteExact(entry, observed, signal);
        if (await ports.inspect(entry, signal)) return fail('delete_unconfirmed');
      }
      await ports.cleanupSpool(entry);
      await this.replace(ports, entry, null);
      result.removed++;
    }
    return result;
  }
}
