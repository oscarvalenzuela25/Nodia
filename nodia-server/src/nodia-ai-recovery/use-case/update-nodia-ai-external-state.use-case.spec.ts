import { describe, expect, it } from 'vitest';
import { UpdateNodiaAiExternalStateUseCase, type ExternalStateTransport, type NodiaAiExternalState } from './update-nodia-ai-external-state.use-case.js';
import type { NodiaAiJournalResource } from '../types/deletion-journal.js';

const era = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const chat = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const backup = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const preference = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const gen = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const day = 86_400_000;
const origin = Date.parse('2026-10-20T20:00:00.000Z');
function fixture() {
  let clock = origin;
  let bytes: Buffer | null = null;
  let etag = '0';
  let conflicts = 0;
  let unavailable = false;
  let lostACK = false;
  const transport: ExternalStateTransport = {
    async read() { if (unavailable) throw Error('unavailable'); return bytes ? { bytes: Buffer.from(bytes), etag } : null; },
    async compareAndSwap(next, previous) {
      if (unavailable) throw Error('unavailable');
      if (conflicts-- > 0) return false;
      if ((bytes === null ? null : etag) !== previous) return false;
      bytes = Buffer.from(next); etag = String(Number(etag) + 1);
      if (lostACK) throw Error('uncertain');
      return true;
    },
  };
  const store = new UpdateNodiaAiExternalStateUseCase(transport, era, 'nodia-ai-recovery/lab', () => new Date(clock));
  const resource: NodiaAiJournalResource = { kind: 'conversation', conversation_id: chat, storage_generations: [gen] };
  return { store, resource, advance: (days: number) => { clock += days * day; }, now: () => new Date(clock),
    state: () => JSON.parse(bytes!.toString()) as NodiaAiExternalState,
    corrupt: (change: (state: NodiaAiExternalState) => void) => { const value = JSON.parse(bytes!.toString()); change(value); bytes = Buffer.from(JSON.stringify(value)); },
    conflicts: (value: number) => { conflicts = value; }, unavailable: (value: boolean) => { unavailable = value; },
    lostACK: (value: boolean) => { lostACK = value; } };
}
async function initialized() { const f = fixture(); await f.store.initialize(); return f; }

describe('external deletion journal and protected backup catalog', () => {
  it('never auto-creates a missing authoritative journal', async () => {
    const f = fixture();
    await expect(f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] })).rejects.toThrow('journal_missing');
    await expect(f.store.catalog.checkpoint()).rejects.toThrow('journal_missing');
  });
  it('bootstrap is exclusive and refuses resetting an existing era', async () => {
    const f = await initialized();
    await expect(f.store.initialize()).rejects.toThrow('already_initialized');
    expect(f.state().last_sequence).toBe(0);
  });
  it('closing an era prevents claiming coverage after an incompatible rollback', async () => {
    const f = await initialized(); await f.store.closeEra();
    await expect(f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] })).rejects.toThrow('journal_closed');
    await expect(f.store.catalog.checkpoint()).rejects.toThrow('journal_closed');
    await expect(f.store.exportManifest(backup, f.now().toISOString())).rejects.toThrow('journal_closed');
    expect(f.state().closed_at).toBe(f.now().toISOString());
  });
  it('records opaque resources without owner, text, filename or reason', async () => {
    const f = await initialized();
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    expect(f.state().entries).toEqual([{ ...f.resource, sequence: 1, deleted_at: f.now().toISOString(), confirmed_at: null }]);
    await expect(f.store.catalog.checkpoint()).rejects.toThrow('unconfirmed_deletions');
  });
  it('deduplicates the same intent after lost ACK and a later clock', async () => {
    const f = await initialized(); f.lostACK(true);
    await expect(f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] })).rejects.toThrow('uncertain');
    f.lostACK(false); f.advance(0.1);
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    expect(f.state().last_sequence).toBe(1);
  });
  it('conversation retries retain missing historical generations without a duplicate event', async () => {
    const f = await initialized();
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    const subset: NodiaAiJournalResource = { kind: 'conversation', conversation_id: chat, storage_generations: [] };
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [subset] });
    await f.store.assertResourcesRecorded([subset]); await f.store.confirmResources([subset]);
    expect(f.state().last_sequence).toBe(1);
    expect(f.state().entries[0]).toMatchObject({ storage_generations: [gen] });
  });
  it('rejects attachment tombstones without exactly one generation', async () => {
    const f = await initialized();
    await expect(f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [{ kind: 'attachment', attachment_id: preference, conversation_id: chat, storage_generations: [] }] })).rejects.toThrow('resource_invalid');
  });
  it('external failure cannot manufacture a confirmed checkpoint', async () => {
    const f = await initialized(); f.unavailable(true);
    await expect(f.store.catalog.checkpoint()).rejects.toThrow();
    expect(f.state().last_sequence).toBe(0);
  });
  it('confirms committed removals separately and retains intent identity', async () => {
    const f = await initialized();
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    await f.store.confirmResources([f.resource]);
    expect((await f.store.catalog.checkpoint()).sequence).toBe(1);
    f.advance(1); await f.store.confirmResources([f.resource]);
    expect(f.state().entries[0].confirmed_at).toBe(new Date(origin).toISOString());
  });
  it('does not confirm a resource never durably recorded', async () => {
    const f = await initialized();
    await expect(f.store.confirmResources([f.resource])).rejects.toThrow('journal_uncovered');
  });
  it('CAS conflicts are bounded and re-read the authoritative state', async () => {
    const f = await initialized(); f.conflicts(2);
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    expect(f.state().last_sequence).toBe(1);
    f.conflicts(3);
    await expect(f.store.confirmResources([f.resource])).rejects.toThrow('catalog_conflict');
    expect(f.state().entries[0].confirmed_at).toBeNull();
  });
  it('concurrent append preserves both intents with contiguous sequences', async () => {
    const f = await initialized();
    await Promise.all([
      f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] }),
      f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [{ kind: 'preference', preference_id: preference }] }),
    ]);
    expect(f.state().entries.map(entry => entry.sequence)).toEqual([1, 2]);
    expect(f.state().entries.map(entry => entry.kind).sort()).toEqual(['conversation', 'preference']);
  });
  it('catalog mutation cannot overwrite journal entries', async () => {
    const f = await initialized();
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    await f.store.catalog.mutate(entries => entries);
    expect(f.state().entries).toHaveLength(1);
  });
  it('never trims unresolved records, even after eight days', async () => {
    const f = await initialized();
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    f.advance(9); await f.store.prune();
    expect(f.state().entries).toHaveLength(1);
  });
  it('keeps an empty closed era readable when pruning nine days after closure', async () => {
    const f = await initialized();
    await f.store.closeEra();
    const closedAt = f.state().closed_at;
    f.advance(9);
    await f.store.prune();
    const { state } = await f.store.snapshot();
    expect(state.coverage_from).toBe(closedAt);
    expect(state.closed_at).toBe(closedAt);
    expect(state.entries).toEqual([]);
    expect(state.backups).toEqual([]);
    expect(state.first_sequence).toBe(1);
    expect(state.last_sequence).toBe(0);
    await expect(f.store.catalog.checkpoint()).rejects.toThrow('journal_closed');
  });
  it('removes an aged resolved prefix without advancing coverage beyond closed_at', async () => {
    const f = await initialized();
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    await f.store.confirmResources([f.resource]);
    f.advance(0.1); await f.store.closeEra();
    const closedAt = f.state().closed_at;
    f.advance(9); await f.store.prune();
    const { state } = await f.store.snapshot();
    expect(state.entries).toEqual([]);
    expect(state.coverage_from).toBe(closedAt);
    expect(state.first_sequence).toBe(2);
    expect(state.last_sequence).toBe(1);
  });
  it('allows unresolved cleanup and old backup retirement after closure before collecting its witness', async () => {
    const f = await initialized();
    await f.store.catalog.mutate(() => [{ backup_id: backup,
      object_key: `nodia-ai-recovery/lab/backups/${backup}.bin`, captured_at: f.now().toISOString(),
      expires_at: new Date(origin + 7 * day).toISOString(), encryption_key_id: 'a'.repeat(64), status: 'pending',
      cipher_bytes: null, cipher_sha256: null, journal_sequence: 0, journal_sha256: 'c'.repeat(64) }]);
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    await f.store.closeEra(); f.advance(9); await f.store.prune();
    expect((await f.store.snapshot()).state.entries[0].confirmed_at).toBeNull();
    expect(f.state().backups).toHaveLength(1);
    await f.store.confirmResources([f.resource]);
    await f.store.catalog.mutate(() => []);
    f.advance(8); await f.store.prune();
    const { state } = await f.store.snapshot();
    expect(state.entries).toEqual([]);
    expect(state.backups).toEqual([]);
    expect(state.coverage_from).toBe(state.closed_at);
    expect(state.first_sequence).toBe(2);
    expect(state.last_sequence).toBe(1);
  });
  it('trims only the resolved prefix and preserves sequence head', async () => {
    const f = await initialized();
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    await f.store.confirmResources([f.resource]); f.advance(1);
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [{ kind: 'preference', preference_id: preference }] });
    f.advance(8); await f.store.prune();
    expect(f.state().first_sequence).toBe(2);
    expect(f.state().last_sequence).toBe(2);
    expect(f.state().entries[0].kind).toBe('preference');
  });
  it('a registered old backup prevents trimming until confirmed absence', async () => {
    const f = await initialized();
    await f.store.catalog.mutate(entries => [...entries, { backup_id: backup,
      object_key: `nodia-ai-recovery/lab/backups/${backup}.bin`, captured_at: f.now().toISOString(),
      expires_at: new Date(origin + 7 * day).toISOString(), encryption_key_id: 'a'.repeat(64), status: 'ready',
      cipher_bytes: 10, cipher_sha256: 'b'.repeat(64), journal_sequence: 0, journal_sha256: 'c'.repeat(64) }]);
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    await f.store.confirmResources([f.resource]); f.advance(9); await f.store.prune();
    expect(f.state().entries).toHaveLength(1);
    await f.store.catalog.mutate(() => []); await f.store.prune();
    expect(f.state().entries).toHaveLength(0); expect(f.state().first_sequence).toBe(2);
  });
  it('exports ALL retained tombstones, including intent before capture', async () => {
    const f = await initialized();
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    await f.store.confirmResources([f.resource]); f.advance(0.1);
    await f.store.catalog.mutate(() => [{ backup_id: backup, object_key: `nodia-ai-recovery/lab/backups/${backup}.bin`, captured_at: f.now().toISOString(),
      expires_at: new Date(f.now().getTime() + 7 * day).toISOString(), encryption_key_id: 'a'.repeat(64), status: 'ready',
      cipher_bytes: 10, cipher_sha256: 'b'.repeat(64), journal_sequence: 1, journal_sha256: 'c'.repeat(64) }]);
    const output = await f.store.exportManifest(backup, f.now().toISOString());
    expect(JSON.parse(output.manifest).entries[0].conversation_id).toBe(chat);
    expect(JSON.parse(output.manifest).entries[0]).not.toHaveProperty('confirmed_at');
    f.advance(7);
    await expect(f.store.exportManifest(backup, f.now().toISOString())).rejects.toThrow('backup_unavailable');
  });
  it.each(['era', 'sequence', 'future', 'secret', 'generation', 'duplicate'])("rejects malformed external state: %s", async kind => {
    const f = await initialized();
    await f.store.recordResources({ deleted_at: f.now().toISOString(), resources: [f.resource] });
    f.corrupt(value => {
      if (kind === 'era') value.era_id = chat;
      if (kind === 'sequence') value.last_sequence++;
      if (kind === 'future') value.updated_at = new Date(origin + day).toISOString();
      if (kind === 'secret') Object.assign(value, { text: 'synthetic' });
      if (kind === 'generation' && value.entries[0].kind === 'conversation') value.entries[0].storage_generations = ['invalid'];
      if (kind === 'duplicate') { value.entries.push({ ...value.entries[0], sequence: 2 }); value.last_sequence++; }
    });
    await expect(f.store.snapshot()).rejects.toThrow();
  });
});
