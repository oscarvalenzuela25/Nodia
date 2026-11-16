// Byte continuation is separate from application submission. Never sends a deploy command.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { CdRejected, isHex, numeric, requireCd, ZIP_LIMIT } from './cd-github.mjs';

const CHUNK_LIMIT = 8 * 1024 * 1024;
const EMPTY_SHA = createHash('sha256').digest('hex');
const assets = ['archive-completed-backend-upload.py', 'backend_upload.py', 'deploy-backend-receiver.py', 'deploy-gateway.py'];
const keys = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort().join(',') : '';
const sameKeys = (value, expected) => keys(value) === [...expected].sort().join(',');
const identityKeys = ['artifact_id', 'artifact_zip_sha256', 'run_id', 'run_attempt', 'bytes'];
const statusKeys = ['schema_version', 'status', 'protocol_version', 'upload_id', 'identity', 'phase', 'offset',
  'prefix_sha256', 'receipt_recorded', 'deployment_requested', 'automatic_retry_allowed'];
const failureKeys = ['schema_version', 'status', 'error_code', 'automatic_retry_allowed'];
const immutableFile = info => [info.dev, info.ino, info.size, info.mtimeMs, info.ctimeMs].join(':');

export function uploadIdentity(artifact, ci, bytes) {
  const identity = { artifact_id: artifact.id, artifact_zip_sha256: artifact.digest?.slice(7),
    run_id: ci.run_id, run_attempt: ci.run_attempt, bytes };
  requireCd(numeric(identity.artifact_id) && /^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '') &&
    numeric(ci.run_id) && typeof ci.run_attempt === 'string' && /^[1-9][0-9]{0,5}$/.test(ci.run_attempt) &&
    Number.isSafeInteger(bytes) && bytes > 0 && bytes <= ZIP_LIMIT,
  'upload_identity_invalid');
  return identity;
}
export function uploadId(value) {
  return createHash('sha256').update(`nodia-upload-v2:${value.run_id}:${value.run_attempt}:${value.artifact_id}:${value.artifact_zip_sha256}:${value.bytes}`).digest('hex');
}
const tuple = value => `${value.artifact_id} ${value.artifact_zip_sha256} ${value.run_id} ${value.run_attempt} ${value.bytes}`;
const knownFailure = result => Number.isInteger(result?.code) && result.code >= 1 && result.code <= 255 &&
  sameKeys(result.body, failureKeys) && result.body.schema_version === 1 && result.body.status === 'failed' &&
  result.body.automatic_retry_allowed === false ? result.body.error_code : null;
const fatalFailures = new Set(['incoming_quota_reached_operator_cleanup_required', 'insufficient_upload_headroom',
  'prior_update_requires_reconciliation', 'upload_unmanaged_requires_reconciliation', 'upload_ledger_requires_reconciliation',
  'upload_identity_conflict', 'upload_offset_conflict', 'upload_prefix_conflict', 'upload_chunk_digest_mismatch',
  'archive_intent_already_recorded_no_automatic_replay', 'upload_protocol_upgrade_required',
  'upload_requires_operator_reconciliation', 'upload_ledger_invalid', 'upload_digest_mismatch',
  'upload_size_or_digest_mismatch', 'upload_storage_conflict', 'upload_storage_changed',
  'upload_file_changed', 'upload_file_size_invalid', 'upload_ledger_conflict', 'upload_archive_requires_reconciliation',
  'upload_archive_record_invalid', 'upload_archive_limit_reached', 'upload_ledger_limit_reached',
  'upload_chunk_digest_invalid', 'upload_chunk_size_invalid', 'upload_not_receiving', 'upload_not_complete',
  'upload_finalization_requires_reconciliation', 'upload_transport_refresh_requires_reconciliation']);

export function validateUploadStatus(result, identity) {
  const body = result?.body;
  requireCd(result?.code === 0 && sameKeys(body, statusKeys) && body.schema_version === 1 && body.status === 'upload_status' &&
    body.protocol_version === 2 && body.upload_id === uploadId(identity) && sameKeys(body.identity, identityKeys) &&
    identityKeys.every(key => body.identity[key] === identity[key]) &&
    ['absent', 'receiving', 'ready', 'verified', 'archived'].includes(body.phase) &&
    Number.isSafeInteger(body.offset) && body.offset >= 0 && body.offset <= identity.bytes && isHex(body.prefix_sha256) &&
    typeof body.receipt_recorded === 'boolean' && body.deployment_requested === false && body.automatic_retry_allowed === false &&
    (body.offset !== 0 || body.prefix_sha256 === EMPTY_SHA) &&
    (body.phase !== 'absent' || body.offset === 0 && body.receipt_recorded === false) &&
    (body.phase !== 'receiving' || body.offset < identity.bytes && body.receipt_recorded === false) &&
    (!['ready', 'verified', 'archived'].includes(body.phase) || body.offset === identity.bytes && body.prefix_sha256 === identity.artifact_zip_sha256) &&
    (body.phase !== 'ready' || body.receipt_recorded === false) &&
    (body.phase !== 'archived' || body.receipt_recorded === true), 'upload_status_invalid');
  return body;
}
export function validateUploadCapabilities(result) {
  const body = result?.body;
  requireCd(result?.code === 0 && sameKeys(body, ['schema_version', 'status', 'protocol_version', 'max_chunk_bytes', 'max_upload_bytes',
    'incoming_limit_bytes', 'incoming_limit_files', 'logical_incoming_bytes', 'logical_incoming_files', 'free_bytes',
    'retention_policy', 'retention_deletes_files', 'assets_sha256', 'deployment_requested', 'automatic_retry_allowed']) &&
    body.schema_version === 1 && body.status === 'upload_capabilities' && body.protocol_version === 2 &&
    Number.isSafeInteger(body.max_chunk_bytes) && body.max_chunk_bytes > 0 && body.max_chunk_bytes <= CHUNK_LIMIT &&
    body.max_upload_bytes === ZIP_LIMIT && body.incoming_limit_bytes === 2 * 1024 ** 3 && body.incoming_limit_files === 10 &&
    ['logical_incoming_bytes', 'logical_incoming_files', 'free_bytes'].every(key => Number.isSafeInteger(body[key]) && body[key] >= 0) &&
    body.retention_policy === 'archive_completed_noncurrent_on_demand' && body.retention_deletes_files === false &&
    sameKeys(body.assets_sha256, assets) && Object.values(body.assets_sha256).every(isHex) &&
    body.deployment_requested === false && body.automatic_retry_allowed === false, 'upload_protocol_upgrade_required');
  return body;
}

export async function uploadArtifact({ session, send, artifact, ci, zipFile, zipBytes, record = () => {},
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => performance.now(), deadlineMs = 12 * 60_000 }) {
  const identity = uploadIdentity(artifact, ci, zipBytes), id = uploadId(identity), value = tuple(identity);
  const original = fs.lstatSync(zipFile);
  requireCd(original.isFile() && !original.isSymbolicLink() && original.size === zipBytes, 'upload_local_artifact_invalid');
  const stable = () => requireCd(immutableFile(fs.lstatSync(zipFile)) === immutableFile(original), 'upload_local_artifact_changed');
  async function digest(start, end) {
    stable();
    const hash = createHash('sha256');
    if (end >= start) for await (const block of fs.createReadStream(zipFile, { start, end })) hash.update(block);
    stable(); return hash.digest('hex');
  }
  requireCd(await digest(0, zipBytes - 1) === identity.artifact_zip_sha256, 'upload_local_digest_mismatch');
  const deadline = now() + deadlineMs;
  let calls = 0, recoveries = 0, recovered = false;
  async function request(command, options) {
    requireCd(++calls <= 256 && now() < deadline, 'upload_transfer_budget_exhausted');
    return send(session, command, options);
  }
  async function read(command) {
    for (let attempt = 0; attempt < 4; attempt++) {
      let result;
      try { result = await request(command); }
      catch (error) {
        if (!(error instanceof CdRejected) || !/^ssh_/.test(error.message)) throw error;
        if (attempt === 3) throw new CdRejected('upload_status_outcome_unknown');
        await sleep(1_000); continue;
      }
      const failure = knownFailure(result);
      if (failure === 'receiver_busy') { await sleep(1_000); continue; }
      if (fatalFailures.has(failure)) throw new CdRejected(failure);
      return result;
    }
    throw new CdRejected('upload_status_outcome_unknown');
  }
  const capabilities = validateUploadCapabilities(await read('capabilities'));
  const readStatus = async () => {
    const proof = validateUploadStatus(await read(`upload-status ${value}`), identity);
    requireCd(proof.phase !== 'archived', 'upload_archived_no_automatic_replay');
    requireCd(await digest(0, proof.offset - 1) === proof.prefix_sha256, 'upload_remote_prefix_mismatch');
    record({ status: 'upload_receiving', upload_protocol_version: 2, upload_id: id,
      upload_phase: proof.phase, upload_offset: proof.offset, upload_bytes: zipBytes,
      upload_recovered: recovered, deployment_requested: false });
    return proof;
  };
  async function mutation(command, options) {
    try {
      const result = await request(command, options), failure = knownFailure(result);
      if (fatalFailures.has(failure)) throw new CdRejected(failure);
      validateUploadStatus(result, identity);
      return result;
    } catch (error) {
      if (error instanceof CdRejected && (fatalFailures.has(error.message) ||
        ['upload_transfer_budget_exhausted', 'upload_local_artifact_changed'].includes(error.message))) throw error;
      requireCd(++recoveries <= 4, 'upload_transfer_requires_reconciliation');
      recovered = true;
      // Read after any ambiguous byte operation; never infer an offset or replay a deploy.
      return null;
    }
  }
  let status = await readStatus();
  if (status.phase === 'absent') {
    record({ status: 'upload_open_requested', upload_protocol_version: 2, upload_id: id,
      upload_bytes: zipBytes, deployment_requested: false });
    await mutation(`upload-open ${value}`, { timeout: 120_000 });
    status = await readStatus();
    requireCd(status.phase !== 'absent', 'upload_open_outcome_unknown'); // No second open after uncertainty.
  }
  for (let step = 0; step < 128; step++) {
    requireCd(status.phase !== 'absent', 'upload_transfer_requires_reconciliation');
    if (status.phase === 'verified' && status.receipt_recorded) return { upload_protocol_version: 2,
      upload_id: id, upload_phase: 'verified', upload_offset: zipBytes, upload_bytes: zipBytes, upload_recovered: recovered };
    if (status.phase === 'ready' || status.phase === 'verified') {
      await mutation(`upload-finish ${value}`);
      status = await readStatus();
      if (status.phase !== 'verified' || !status.receipt_recorded) {
        requireCd(++recoveries <= 4, 'upload_transfer_requires_reconciliation');
        recovered = true;
      }
      continue;
    }
    requireCd(status.phase === 'receiving' && status.offset < zipBytes, 'upload_transfer_requires_reconciliation');
    const offset = status.offset, length = Math.min(capabilities.max_chunk_bytes, zipBytes - offset);
    const hash = await digest(offset, offset + length - 1);
    await mutation(`upload-append ${value} ${offset} ${status.prefix_sha256} ${length} ${hash}`,
      { inputFile: zipFile, start: offset, end: offset + length - 1, timeout: 90_000 });
    const next = await readStatus();
    requireCd(next.offset >= offset && next.offset <= offset + length, 'upload_offset_conflict');
    if (next.offset === offset) {
      requireCd(++recoveries <= 4, 'upload_transfer_requires_reconciliation');
      recovered = true;
    }
    status = next;
  }
  throw new CdRejected('upload_transfer_budget_exhausted');
}
