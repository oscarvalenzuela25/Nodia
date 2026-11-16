import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { CdRejected, ZIP_LIMIT } from './cd-github.mjs';
import { uploadArtifact, uploadId, uploadIdentity, validateUploadCapabilities, validateUploadStatus } from './cd-upload.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = Object.fromEntries(['archive-completed-backend-upload.py', 'backend_upload.py', 'deploy-backend-receiver.py', 'deploy-gateway.py']
  .map(name => [name, 'd'.repeat(64)]));
const caps = () => ({ schema_version: 1, status: 'upload_capabilities', protocol_version: 2, max_chunk_bytes: 4,
  max_upload_bytes: ZIP_LIMIT, incoming_limit_bytes: 2 * 1024 ** 3, incoming_limit_files: 10,
  logical_incoming_bytes: 0, logical_incoming_files: 0, free_bytes: 5 * 1024 ** 3,
  retention_policy: 'archive_completed_noncurrent_on_demand', retention_deletes_files: false,
  assets_sha256: assets, deployment_requested: false, automatic_retry_allowed: false });
const failure = code => ({ code: 1, body: { schema_version: 1, status: 'failed', error_code: code, automatic_retry_allowed: false } });

function fixture(t, behavior = {}) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'nodia-upload-client-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const zipFile = path.join(directory, 'original.zip'), bytes = Buffer.from('synthetic-original-zip');
  fs.writeFileSync(zipFile, bytes);
  const ci = { run_id: '10', run_attempt: '1', source_sha: 'a'.repeat(40) };
  const artifact = { id: '20', digest: 'sha256:' + sha(bytes) };
  const identity = uploadIdentity(artifact, ci, bytes.length), calls = [], records = [];
  let received = Buffer.alloc(0), opened = false, renamed = false, sealed = false, injected = false;
  const status = () => ({ schema_version: 1, status: 'upload_status', protocol_version: 2,
    upload_id: uploadId(identity), identity, phase: !opened ? 'absent' : renamed ? 'verified' : received.length === bytes.length ? 'ready' : 'receiving',
    offset: received.length, prefix_sha256: sha(received), receipt_recorded: sealed,
    deployment_requested: false, automatic_retry_allowed: false });
  const send = async (_, command, options) => {
    calls.push(command);
    const [operation, , , , , , offset, prefix, length, chunk] = command.split(' ');
    if (operation === 'capabilities') return { code: 0, body: behavior.capabilities ?? caps() };
    if (operation === 'upload-status') return behavior.status?.(status(), received) ?? { code: 0, body: status() };
    if (operation === 'upload-open') { opened = true; return { code: 0, body: status() }; }
    if (operation === 'upload-append') {
      assert.equal(Number(offset), received.length); assert.equal(prefix, sha(received));
      assert.equal(options.inputFile, zipFile); assert.equal(options.start, received.length);
      assert.equal(options.end, Number(offset) + Number(length) - 1); assert.equal(options.timeout, 90_000);
      const payload = bytes.subarray(options.start, options.end + 1);
      assert.equal(chunk, sha(payload));
      if (behavior.cut && !injected) {
        injected = true;
        received = Buffer.concat([received, payload.subarray(0, behavior.cut === 'before' ? 0 : behavior.cut === 'partial' ? 2 : payload.length)]);
        throw new CdRejected('ssh_effect_or_status_outcome_unknown');
      }
      if (behavior.reject) return failure(behavior.reject);
      received = Buffer.concat([received, payload]);
      return { code: 0, body: behavior.ack?.(status()) ?? status() };
    }
    if (operation === 'upload-finish') {
      assert.deepEqual(received, bytes); renamed = true;
      if (behavior.finishUnsealed && !injected) { injected = true; throw new CdRejected('ssh_effect_or_status_outcome_unknown'); }
      sealed = true;
      if (behavior.finishAckLost && !injected) { injected = true; throw new CdRejected('ssh_effect_or_status_outcome_unknown'); }
      return { code: 0, body: status() };
    }
    throw new Error('Unexpected application effect in upload protocol');
  };
  return { zipFile, zipBytes: bytes.length, artifact, ci, identity, calls, records, status, send,
    sleep: async () => {}, record: item => records.push(item), received: () => received };
}

test('chunk transport verifies the immutable ZIP and seals bytes without any application submission', async t => {
  const f = fixture(t), result = await uploadArtifact(f);
  assert.equal(result.upload_phase, 'verified'); assert.equal(result.upload_recovered, false);
  assert.equal(result.upload_offset, f.zipBytes); assert.equal(result.upload_id, uploadId(f.identity));
  assert.equal(f.calls.filter(x => x.startsWith('upload-open ')).length, 1);
  assert.equal(f.calls.filter(x => x.startsWith('upload-finish ')).length, 1);
  assert.equal(f.calls.filter(x => x.startsWith('upload-status ')).length, 1);
  assert.ok(f.calls.every(x => !/^(deploy|upload |status )/.test(x)));
  assert.ok(f.records.every(x => x.deployment_requested === false));
});
for (const cut of ['before', 'partial', 'after']) test(`lost connection ${cut} byte append resumes only from an exact observed prefix`, async t => {
  const f = fixture(t, { cut }), result = await uploadArtifact(f);
  assert.equal(result.upload_recovered, true); assert.equal(result.upload_offset, f.zipBytes);
  assert.deepEqual(f.received(), fs.readFileSync(f.zipFile));
  const offsets = f.calls.filter(x => x.startsWith('upload-append ')).map(x => Number(x.split(' ')[6]));
  if (cut === 'partial') assert.equal(offsets[1], 2);
  if (cut === 'after') assert.equal(offsets[1], 4);
  assert.ok(offsets.every((value, index) => index === 0 || value >= offsets[index - 1]));
});
test('lost final ACK is confirmed by reading without a second finish or application command', async t => {
  const f = fixture(t, { finishAckLost: true }); await uploadArtifact(f);
  assert.equal(f.calls.filter(x => x.startsWith('upload-finish ')).length, 1);
});
test('rename-before-receipt interruption seals only the already verified destination', async t => {
  const f = fixture(t, { finishUnsealed: true }); await uploadArtifact(f);
  assert.equal(f.calls.filter(x => x.startsWith('upload-finish ')).length, 2);
  assert.equal(f.calls.filter(x => x.startsWith('upload-open ')).length, 1);
});
test('protocol or pins mismatch fails before opening or sending bytes, with no legacy downgrade', async t => {
  for (const change of [{ protocol_version: 1 }, { assets_sha256: { ...assets, extra: 'a'.repeat(64) } },
    { retention_deletes_files: true }, { automatic_retry_allowed: true }, { max_chunk_bytes: 8 * 1024 ** 2 + 1 }]) {
    const f = fixture(t, { capabilities: { ...caps(), ...change } });
    await assert.rejects(uploadArtifact(f), /upload_protocol_upgrade_required/);
    assert.deepEqual(f.calls, ['capabilities']);
  }
});
test('conflicting remote prefix, identity and phase never reset, truncate or send another byte', async t => {
  for (const [change, expected] of [[{ identity: { artifact_id: '90' } }, /upload_status_invalid/],
    [{ phase: 'unknown' }, /upload_status_invalid/], [{ prefix_sha256: 'f'.repeat(64) }, /upload_status_invalid/]]) {
    const f = fixture(t, { status: body => ({ code: 0, body: { ...body, ...change } }) });
    await assert.rejects(uploadArtifact(f), expected); assert.equal(f.calls.length, 2);
  }
  const f = fixture(t, { ack: body => ({ ...body, prefix_sha256: 'f'.repeat(64) }) });
  await assert.rejects(uploadArtifact(f), /upload_remote_prefix_mismatch/);
  assert.equal(f.calls.filter(x => x.startsWith('upload-append ')).length, 1);
});
test('known root rejection is preserved and never converted into another append', async t => {
  const f = fixture(t, { reject: 'upload_offset_conflict' });
  await assert.rejects(uploadArtifact(f), /upload_offset_conflict/);
  assert.equal(f.calls.filter(x => x.startsWith('upload-append ')).length, 1);
});
test('a legacy file or contradictory ledger requires reconciliation without opening a new intent', async t => {
  for (const code of ['upload_unmanaged_requires_reconciliation', 'upload_ledger_requires_reconciliation']) {
    const f = fixture(t); const ordinary = f.send;
    f.send = (_, command, options) => command.startsWith('upload-status ') ? Promise.resolve(failure(code)) : ordinary(_, command, options);
    await assert.rejects(uploadArtifact(f), new RegExp(code));
    assert.equal(f.calls.filter(x => x.startsWith('upload-open ')).length, 0);
  }
});
test('local artifact corruption is detected before contacting the server', async t => {
  const f = fixture(t); fs.writeFileSync(f.zipFile, Buffer.alloc(f.zipBytes));
  await assert.rejects(uploadArtifact(f), /upload_local_digest_mismatch/); assert.equal(f.calls.length, 0);
});
test('busy and lost read responses have bounded, read-only retries', async t => {
  const f = fixture(t); let attempts = 0;
  f.send = async () => { attempts++; return failure('receiver_busy'); };
  await assert.rejects(uploadArtifact(f), /upload_status_outcome_unknown/); assert.equal(attempts, 8);
});
test('lost open response never sends a second open when no intent can be proven', async t => {
  const f = fixture(t), normal = f.send;
  f.send = (_, command, options) => command.startsWith('upload-open ') ?
    Promise.reject(new CdRejected('ssh_effect_or_status_outcome_unknown')) : normal(_, command, options);
  await assert.rejects(uploadArtifact(f), /upload_open_outcome_unknown/);
  assert.equal(f.received().length, 0); assert.equal(f.calls.filter(x => x.startsWith('upload-append ')).length, 0);
});
test('public protocol validators reject unbounded or error-bearing evidence', t => {
  const f = fixture(t);
  assert.equal(validateUploadCapabilities({ code: 0, body: caps() }).protocol_version, 2);
  for (const change of [{ error_code: 'unknown' }, { offset: -1 }, { offset: f.zipBytes + 1 }, { automatic_retry_allowed: true },
    { receipt_recorded: true }, { phase: 'verified' }]) {
    assert.throws(() => validateUploadStatus({ code: 0, body: { ...f.status(), ...change } }, f.identity), /upload_status_invalid/);
  }
});
