import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ManageNodiaAiBackupsUseCase } from './manage-nodia-ai-backups.use-case.js';
import type { NodiaAiBackupEntry, NodiaAiBackupObservation, NodiaAiBackupPorts } from '../types/nodia-ai-backup.types.js';

const useCase = new ManageNodiaAiBackupsUseCase();
function fixture() {
  let now = new Date('2026-10-20T12:00:00.000Z');
  let catalog: NodiaAiBackupEntry[] = [];
  const objects = new Map<string, NodiaAiBackupObservation>();
  const receipt = { cipher_bytes: 100, cipher_sha256: 'b'.repeat(64) };
  const ports: NodiaAiBackupPorts = {
    now: () => now,
    catalog: {
      async read() { return structuredClone(catalog); },
      async mutate(update) { catalog = update(structuredClone(catalog)); },
      async checkpoint() { return { sequence: 2, sha256: 'c'.repeat(64), coverage_from: '2026-10-20T00:00:00.000Z' }; },
    },
    prepare: vi.fn(async () => receipt),
    upload: vi.fn(async entry => { objects.set(entry.object_key, { ...receipt, backup_id: entry.backup_id, encryption_key_id: entry.encryption_key_id, etag: '"test"', version_id: null }); }),
    inspect: vi.fn(async entry => objects.get(entry.object_key) ?? null),
    deleteExact: vi.fn(async entry => { objects.delete(entry.object_key); }),
    cleanupSpool: vi.fn(async () => {}),
  };
  const input = { backup_id: randomUUID(), prefix: 'nodia-ai-recovery/test', encryption_key_id: 'a'.repeat(64), backup_max_days: 7 };
  return { ports, input, objects, receipt, setNow(value: string) { now = new Date(value); }, get catalog() { return catalog; }, set catalog(value: NodiaAiBackupEntry[]) { catalog = value; } };
}

describe('ManageNodiaAiBackupsUseCase', () => {
  it('persists reservation and expected digest before PUT and publishes only after verification', async () => {
    const f = fixture();
    f.ports.upload = vi.fn(async entry => {
      expect(f.catalog[0]).toEqual(entry);
      expect(entry.status).toBe('pending');
      expect(entry.cipher_sha256).toBe(f.receipt.cipher_sha256);
      f.objects.set(entry.object_key, { ...f.receipt, backup_id: entry.backup_id, encryption_key_id: entry.encryption_key_id, etag: 'a', version_id: null });
    });
    const result = await useCase.create(f.input, f.ports, AbortSignal.timeout(1000));
    expect(result.status).toBe('ready');
    expect(result.expires_at).toBe('2026-10-27T12:00:00.000Z');
    expect(f.ports.cleanupSpool).toHaveBeenCalledOnce();
  });
  it('rejects duplicate reservation without another dump or PUT', async () => {
    const f = fixture();
    await useCase.create(f.input, f.ports, AbortSignal.timeout(1000));
    await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('already_reserved');
    expect(f.ports.prepare).toHaveBeenCalledOnce();
    expect(f.ports.upload).toHaveBeenCalledOnce();
  });
  it('recovers a committed PUT whose response was lost without uploading twice', async () => {
    const f = fixture();
    const upload = f.ports.upload;
    f.ports.upload = vi.fn(async (entry, signal) => { await upload(entry, signal); throw Error('lost response'); });
    await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('lost response');
    expect(f.catalog[0].status).toBe('pending');
    expect(await useCase.rotate(f.ports, AbortSignal.timeout(1000))).toEqual({ removed: 0, pending_recovered: 1, retained: 0 });
    expect(f.catalog[0].status).toBe('ready');
    expect(f.ports.upload).toHaveBeenCalledOnce();
  });
  it('cleans a pending reservation after a crash before any PUT', async () => {
    const f = fixture(); f.ports.prepare = vi.fn(async () => { throw Error('crash'); });
    await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('crash');
    expect(await useCase.rotate(f.ports, AbortSignal.timeout(1000))).toEqual({ removed: 1, pending_recovered: 0, retained: 0 });
    expect(f.catalog).toEqual([]); expect(f.ports.deleteExact).not.toHaveBeenCalled();
  });
  it('retains the pre-PUT witness on 404 and cleans only its local encrypted spool', async () => {
    const f = fixture();
    f.ports.upload = vi.fn(async () => { throw Error('remote PUT outcome unknown'); });
    await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('remote PUT outcome unknown');
    const before = structuredClone(f.catalog[0]);
    vi.mocked(f.ports.cleanupSpool).mockClear();
    expect(await useCase.rotate(f.ports, AbortSignal.timeout(1000))).toEqual({ removed: 0, pending_recovered: 0, retained: 1 });
    expect(f.catalog[0]).toEqual(before);
    expect(f.ports.cleanupSpool).toHaveBeenCalledOnce();
    expect(f.ports.deleteExact).not.toHaveBeenCalled(); expect(f.ports.upload).toHaveBeenCalledOnce();
  });
  it('reconciles a late PUT that appears after an earlier 404 without repeating it', async () => {
    const f = fixture();
    f.ports.upload = vi.fn(async () => { throw Error('remote PUT outcome unknown'); });
    await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('remote PUT outcome unknown');
    await useCase.rotate(f.ports, AbortSignal.timeout(1000));
    const entry = f.catalog[0];
    f.objects.set(entry.object_key, { ...f.receipt, backup_id: entry.backup_id, encryption_key_id: entry.encryption_key_id, etag: '"late"', version_id: null });
    expect((await useCase.rotate(f.ports, AbortSignal.timeout(1000))).pending_recovered).toBe(1);
    f.setNow(entry.expires_at);
    expect((await useCase.rotate(f.ports, AbortSignal.timeout(1000))).removed).toBe(1);
    expect(f.ports.deleteExact).toHaveBeenCalledOnce(); expect(f.ports.upload).toHaveBeenCalledOnce();
  });
  it('retains an unresolved pending receipt after seven days without extending its fixed expiry', async () => {
    const f = fixture();
    f.ports.upload = vi.fn(async () => { throw Error('remote PUT outcome unknown'); });
    await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('remote PUT outcome unknown');
    const expiry = f.catalog[0].expires_at;
    f.setNow('2026-11-10T12:00:00.000Z');
    expect((await useCase.rotate(f.ports, AbortSignal.timeout(1000))).retained).toBe(1);
    expect(f.catalog[0].status).toBe('pending'); expect(f.catalog[0].expires_at).toBe(expiry);
    expect(f.ports.deleteExact).not.toHaveBeenCalled(); expect(f.ports.upload).toHaveBeenCalledOnce();
  });
  it('retains a ready backup before expiry and deletes it exactly at seven days', async () => {
    const f = fixture(); await useCase.create(f.input, f.ports, AbortSignal.timeout(1000));
    f.setNow('2026-10-27T11:59:59.999Z');
    expect((await useCase.rotate(f.ports, AbortSignal.timeout(1000))).retained).toBe(1);
    f.setNow('2026-10-27T12:00:00.000Z');
    expect((await useCase.rotate(f.ports, AbortSignal.timeout(1000))).removed).toBe(1);
    expect(f.objects.size).toBe(0); expect(f.catalog).toEqual([]);
  });
  it('reconciles delete response loss from deleting state and never recreates it', async () => {
    const f = fixture(); await useCase.create(f.input, f.ports, AbortSignal.timeout(1000));
    f.setNow('2026-10-27T12:00:00.000Z');
    f.ports.deleteExact = vi.fn(async entry => { f.objects.delete(entry.object_key); throw Error('delete unknown'); });
    await expect(useCase.rotate(f.ports, AbortSignal.timeout(1000))).rejects.toThrow('delete unknown');
    expect(f.catalog[0].status).toBe('deleting');
    expect((await useCase.rotate(f.ports, AbortSignal.timeout(1000))).removed).toBe(1);
    expect(f.ports.deleteExact).toHaveBeenCalledOnce();
  });
  it.each(['sha', 'bytes', 'identity', 'key'] as const)('never deletes a changed object: %s', async field => {
    const f = fixture(); const entry = await useCase.create(f.input, f.ports, AbortSignal.timeout(1000));
    const value = f.objects.get(entry.object_key)!;
    if (field === 'sha') value.cipher_sha256 = 'd'.repeat(64);
    if (field === 'bytes') value.cipher_bytes++;
    if (field === 'identity') value.backup_id = randomUUID();
    if (field === 'key') value.encryption_key_id = 'e'.repeat(64);
    f.setNow('2026-10-27T12:00:00.000Z');
    await expect(useCase.rotate(f.ports, AbortSignal.timeout(1000))).rejects.toThrow('object_mismatch');
    expect(f.ports.deleteExact).not.toHaveBeenCalled(); expect(f.catalog).toHaveLength(1);
  });
  it('refuses to claim deletion while GET still observes the object', async () => {
    const f = fixture(); await useCase.create(f.input, f.ports, AbortSignal.timeout(1000));
    f.setNow('2026-10-27T12:00:00.000Z'); f.ports.deleteExact = vi.fn(async () => {});
    await expect(useCase.rotate(f.ports, AbortSignal.timeout(1000))).rejects.toThrow('delete_unconfirmed');
    expect(f.catalog[0].status).toBe('deleting');
  });
  it('rejects corrupted catalog, expiry extension and traversal before any remote effect', async () => {
    for (const mutate of [(e: NodiaAiBackupEntry) => { e.object_key = '../foreign'; }, (e: NodiaAiBackupEntry) => { e.expires_at = '2026-10-28T12:00:00.000Z'; }]) {
      const f = fixture(); await useCase.create(f.input, f.ports, AbortSignal.timeout(1000)); mutate(f.catalog[0]);
      vi.mocked(f.ports.inspect).mockClear();
      await expect(useCase.rotate(f.ports, AbortSignal.timeout(1000))).rejects.toThrow('catalog_invalid');
      expect(f.ports.inspect).not.toHaveBeenCalled(); expect(f.ports.deleteExact).not.toHaveBeenCalled();
    }
  });
  it('fails closed without a supported key, clock or covered external journal', async () => {
    const f = fixture();
    await expect(useCase.create({ ...f.input, encryption_key_id: '' }, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('configuration_invalid');
    f.ports.catalog.checkpoint = async () => ({ sequence: 0, sha256: 'c'.repeat(64), coverage_from: '2026-10-21T00:00:00.000Z' });
    await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('journal_uncovered');
    expect(f.ports.prepare).not.toHaveBeenCalled(); expect(f.catalog).toEqual([]);
  });
  it('compares catalog entries semantically when a canonical external serializer reorders fields', async () => {
    const f = fixture(); const mutate = f.ports.catalog.mutate;
    f.ports.catalog.mutate = async update => mutate(current => update(current.map(entry => Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) as unknown as NodiaAiBackupEntry)));
    expect((await useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).status).toBe('ready');
  });
  it('never replaces a concurrently changed reservation or performs its PUT', async () => {
    const f = fixture();
    f.ports.prepare = vi.fn(async () => { f.catalog[0].status = 'deleting'; return f.receipt; });
    await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('catalog_conflict');
    expect(f.ports.upload).not.toHaveBeenCalled(); expect(f.catalog[0].status).toBe('deleting');
  });
  it('never publishes a backup if capture crosses expiry or the clock moves backwards', async () => {
    for (const time of ['2026-10-27T12:00:00.000Z', '2026-10-20T11:59:59.000Z']) {
      const f = fixture(); f.ports.prepare = vi.fn(async () => { f.setNow(time); return f.receipt; });
      await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow(/backup_(expired|clock_invalid)/u);
      expect(f.catalog[0].status).toBe('pending'); expect(f.ports.upload).not.toHaveBeenCalled();
    }
  });
  it('deletes instead of recovering a pending object if verification crosses expiry', async () => {
    const f = fixture(); const upload = f.ports.upload;
    f.ports.upload = vi.fn(async (entry, signal) => { await upload(entry, signal); throw Error('lost'); });
    await expect(useCase.create(f.input, f.ports, AbortSignal.timeout(1000))).rejects.toThrow('lost');
    f.setNow('2026-10-27T11:59:59.999Z'); const inspect = f.ports.inspect;
    f.ports.inspect = async (entry, signal) => { const observed = await inspect(entry, signal); f.setNow('2026-10-27T12:00:00.000Z'); return observed; };
    expect(await useCase.rotate(f.ports, AbortSignal.timeout(1000))).toEqual({ removed: 1, pending_recovered: 0, retained: 0 });
  });
  it('does not clean or reserve anything when cancelled before admission', async () => {
    const f = fixture();
    await expect(useCase.create(f.input, f.ports, AbortSignal.abort())).rejects.toThrow();
    expect(f.catalog).toEqual([]); expect(f.ports.prepare).not.toHaveBeenCalled(); expect(f.ports.cleanupSpool).not.toHaveBeenCalled();
  });
});
