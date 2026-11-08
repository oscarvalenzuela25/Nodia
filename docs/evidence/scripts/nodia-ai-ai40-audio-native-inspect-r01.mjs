// Pure native journal/proc/staging reconciliation. No runtime/account/CLI construction.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, readFile, lstat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [attempt, parentReceiptSha, root, manifestPin] = process.argv.slice(2);
assert.match(root, /^\/opt\/nodia\/verification\/ai40-audio-candidate-r[0-9]{2}\/server$/u);
assert.match(manifestPin, /^[a-f0-9]{64}$/u);
assert.match(attempt, /^[a-f0-9-]{36}$/u);
assert.match(parentReceiptSha, /^[a-f0-9]{64}$/u);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile(root + '/../candidate-manifest.json');
assert.equal(sha(manifestBytes), manifestPin);
const manifest = JSON.parse(manifestBytes);
for (const name of ['codex-chat-journal', 'codex-login-journal', 'codex-process-ownership']) {
  const file = 'dist/common/ai/codex/' + name + '.js';
  assert.equal(sha(await readFile(root + '/' + file)), manifest.files[file]);
}
const handle = await open('/var/lib/nodia/codex/chat-jobs/' + attempt + '.json', constants.O_RDONLY | constants.O_NOFOLLOW);
let record, recordSha;
try {
  const info = await handle.stat();
  assert.ok(info.isFile() && info.uid === process.getuid() && info.nlink === 1 && (info.mode & 0o777) === 0o600 && info.size <= 4096);
  const bytes = await handle.readFile(); record = JSON.parse(bytes); recordSha = sha(bytes);
} finally { await handle.close(); }
const { CodexChatJournal } = await import(pathToFileURL(root + '/dist/common/ai/codex/codex-chat-journal.js'));
const decoder = new CodexChatJournal(); record = decoder.decode(record); const proof = decoder.proof(record);
assert.equal(record.identity.attemptId, attempt); assert.equal(record.identity.operationRef, attempt);
assert.equal(record.identity.adapterIdentity.connectionId, '1'); assert.equal(record.identity.adapterIdentity.providerKey, 'openai');
assert.equal(record.identity.sessionGeneration, '2a552f6b8a434521b8b438a8f7b01dca');
assert.equal(record.state, 'completed'); assert.equal(record.acknowledged, true); assert.equal(record.unforwardedRequests, 0);
assert.equal(proof.processClosed, true); assert.equal(proof.outcome, 'completed'); assert.ok(record.native);
const { assertCodexGroupEmpty, sameCodexProcess } = await import(pathToFileURL(root + '/dist/common/ai/codex/codex-process-ownership.js'));
assert.equal(await sameCodexProcess(record.native), false); await assertCodexGroupEmpty(record.native.group);
const staging = '/var/lib/nodia/codex/1/nodia-chat-audio';
let attemptAbsent = false;
try { await lstat(staging + '/' + attempt); } catch (error) { if (error.code === 'ENOENT') attemptAbsent = true; else throw error; }
assert.equal(attemptAbsent, true); const entries = await readdir(staging); assert.equal(entries.length, 0);
let acceptedAbsent = false;
try { await lstat('/var/lib/nodia/codex/1/nodia-chat-mcp-audio-wav'); } catch (error) { if (error.code === 'ENOENT') acceptedAbsent = true; else throw error; }
assert.equal(acceptedAbsent, true);
console.log(JSON.stringify({ schema: 'nodia-ai-ai40-audio-native-reconciliation-v1', status: 'passed_closed_not_audio_accepted',
  observed_at_VM_utc: new Date().toISOString(), attempt_id: attempt, parent_receipt_sha256: parentReceiptSha,
  journal_record_sha256: recordSha, terminal_proof_id: proof.terminalProofId, terminal_observed_at: proof.observedAt.toISOString(),
  native_state: record.state, native_outcome: proof.outcome, acknowledged: record.acknowledged,
  process_closed: proof.processClosed, exact_process_absent: true, owned_process_group_empty: true,
  unforwarded_requests: record.unforwardedRequests, rpc_count: record.rpcCount, protocol_frames: record.frames, protocol_bytes: record.bytes,
  attempt_audio_staging_absent: attemptAbsent, audio_staging_entries: entries.length, audio_acceptance_file_absent: acceptedAbsent,
  raw_reply_or_error_code_stored_in_journal: false, semantic_transcription_acceptance: false,
  source_sha256: sha(await readFile(process.argv[1])), candidate_manifest_sha256: sha(manifestBytes),
  provider_observations: 0, provider_generations: 0, operational_SQL_writes: 0, services_changed: false }));
