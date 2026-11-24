import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { withSshFiles, verifyDeploymentStatus } from './check-vps-access.mjs';
import { CdRejected, isHex, isSha, numeric, outputs, requireCd, safeFailure, writeState, ZIP_LIMIT } from './cd-github.mjs';
import { uploadArtifact, uploadId, uploadIdentity } from './cd-upload.mjs';
import { isGeminiRuntimeProof, sameGeminiRuntimeProof } from './gemini-runtime-proof.mjs';

const uploadRejectionCodes = new Set(['incoming_quota_reached_operator_cleanup_required',
  'insufficient_upload_headroom', 'prior_update_requires_reconciliation',
  'upload_already_recorded_no_automatic_replay']);
function uploadRejection(result) {
  const body = result?.body;
  return Number.isInteger(result?.code) && result.code >= 1 && result.code <= 255 &&
    body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).sort().join(',') === 'automatic_retry_allowed,error_code,schema_version,status' &&
    body.schema_version === 1 && body.status === 'failed' && body.automatic_retry_allowed === false &&
    uploadRejectionCodes.has(body.error_code) ? body.error_code : null;
}

export async function sshCommand(session, command, { inputFile, start, end, timeout = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(session.program, [...session.args, command], { env: session.options.env, windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', total = 0, inputFailed = false, ended = false;
    const fail = () => { if (!ended) { ended = true; child.kill('SIGKILL'); reject(new CdRejected('ssh_effect_or_status_outcome_unknown')); } };
    const timer = setTimeout(fail, timeout);
    for (const [stream, name] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) stream.on('data', chunk => {
      total += chunk.length;
      if (total > 16_384) return fail();
      if (name === 'stdout') stdout += chunk.toString('utf8'); else stderr += chunk.toString('utf8');
    });
    child.on('error', fail);
    child.on('close', code => {
      clearTimeout(timer);
      if (ended) return;
      ended = true;
      let body;
      try { body = JSON.parse(stdout || stderr); }
      catch { return reject(new CdRejected('ssh_effect_or_status_outcome_unknown')); }
      if (inputFailed && code === 0) return reject(new CdRejected('ssh_upload_outcome_unknown'));
      resolve({ code, body });
    });
    if (inputFile) pipeline(fs.createReadStream(inputFile, { start, end }), child.stdin).catch(() => { inputFailed = true; });
    else child.stdin.end();
  });
}
export function requireReady(body) {
  let current;
  try { current = verifyDeploymentStatus(body); }
  catch { throw new CdRejected('deployment_gateway_not_ready'); }
  return current;
}
export function requireGeminiRuntimeMatch(expected, observed) {
  if (expected === undefined) return {};
  requireCd(sameGeminiRuntimeProof(expected, observed), 'gemini_runtime_attestation_changed');
  return { gemini_runtime: observed };
}
export async function readBackend(environment = process.env, { send = sshCommand, sshOptions = {} } = {}) {
  return withSshFiles(environment, async session => {
    const result = await send(session, 'status');
    requireCd(result.code === 0, 'backend_status_failed');
    return { schema_version: 1, status: 'baseline_verified', current: requireReady(result.body),
      source_sha: result.body.current.source_sha, deployment_requested: false,
      ...(result.body.gemini_runtime ? { gemini_runtime: result.body.gemini_runtime } : {}) };
  }, { ...sshOptions, allowedEvents: ['push', 'workflow_dispatch'] });
}
export function operationId(artifact, ci) {
  requireCd(numeric(artifact.id) && /^sha256:[a-f0-9]{64}$/.test(artifact.digest) && numeric(ci.run_id) &&
    numeric(ci.run_attempt) && isSha(ci.source_sha), 'operation_identity_invalid');
  return createHash('sha256').update(JSON.stringify({ component: 'server', artifact: artifact.id,
    digest: artifact.digest, run: ci.run_id, attempt: ci.run_attempt, source: ci.source_sha })).digest('hex').slice(0, 32);
}
export function operationAbsent(result) {
  const body = result?.body;
  return Number.isInteger(result?.code) && result.code >= 1 && result.code <= 255 &&
    body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).sort().join(',') === 'automatic_retry_allowed,error_code,schema_version,status' &&
    body.schema_version === 1 && body.status === 'failed' && body.error_code === 'operation_not_found' &&
    body.automatic_retry_allowed === false;
}
export async function deployBackend({ environment = process.env, plan, artifact, zipFile, zipBytes, ci,
  expectedRelease, expectedTree, candidateRelease, candidateTree, allowNewSubmission = true, stateFile, send = sshCommand, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  sshOptions = {}, pollLimit = 240, transfer = uploadArtifact, revalidate = async () => {} }) {
  requireCd(environment.GITHUB_EVENT_NAME === 'workflow_dispatch' && environment.GITHUB_REF === 'refs/heads/master' &&
    environment.GITHUB_RUN_ATTEMPT === '1' &&
    plan.server_required === true && isSha(ci.source_sha) && ci.source_sha === plan.source_sha &&
    /^backend-[a-f0-9]{12}-[a-f0-9]{12}$/.test(expectedRelease) && isHex(expectedTree) &&
    isHex(candidateTree) && candidateRelease === `backend-${ci.source_sha.slice(0, 12)}-${candidateTree.slice(0, 12)}` &&
    Number.isSafeInteger(zipBytes) && zipBytes > 0 && zipBytes <= ZIP_LIMIT, 'backend_deploy_input_invalid');
  const id = operationId(artifact, ci);
  const protocol = plan.server_upload_protocol_version ?? 2;
  const expectedGemini = plan.gemini_runtime;
  requireCd(expectedGemini === undefined || isGeminiRuntimeProof(expectedGemini), 'gemini_runtime_attestation_invalid');
  requireCd([1, 2].includes(protocol), 'upload_protocol_upgrade_required');
  let uploadProof = {};
  const record = value => { if (stateFile) writeState(stateFile, { operation_id: id, automatic_retry_allowed: false, ...uploadProof, ...value }); };
  return withSshFiles(environment, async session => {
    const existing = await send(session, `status ${id}`);
    let submitted = false;
    if (operationAbsent(existing)) {
      const status = await send(session, 'status');
      requireCd(status.code === 0, 'backend_status_failed');
      const current = requireReady(status.body);
      const runtime = requireGeminiRuntimeMatch(expectedGemini, status.body.gemini_runtime);
      if (current.source_sha === ci.source_sha) {
        requireCd(current.release_id === candidateRelease && current.package_tree_sha256 === candidateTree,
          'backend_current_artifact_mismatch');
        record({ status: 'already_current', deployment_requested: false, ...runtime });
        return { status: 'already_current', source_sha: current.source_sha, deployment_requested: false, ...runtime };
      }
      requireCd(current.release_id === expectedRelease && current.package_tree_sha256 === expectedTree &&
        current.source_sha === plan.server_base, 'backend_changed_after_plan');
      requireCd(allowNewSubmission === true, 'prior_cd_run_requires_operator_reconciliation');
      if (plan.server_content_equivalence_allowed === true && candidateTree === current.package_tree_sha256) {
        const result = { status: 'content_unchanged', source_sha: current.source_sha,
          release_id: current.release_id, package_tree_sha256: current.package_tree_sha256,
          candidate_source_sha: ci.source_sha, deployment_requested: false, deployment_performed: false };
        record(result);
        return result;
      }
      if (protocol === 2) {
        uploadProof = await transfer({ session, send, artifact, ci, zipFile, zipBytes, record, sleep });
        requireCd(uploadProof?.upload_protocol_version === 2 && uploadProof.upload_phase === 'verified' &&
          uploadProof.upload_offset === zipBytes && uploadProof.upload_bytes === zipBytes &&
          uploadProof.upload_id === uploadId(uploadIdentity(artifact, ci, zipBytes)) &&
          typeof uploadProof.upload_recovered === 'boolean', 'upload_status_invalid');
      } else {
        // Explicit legacy plan only. A failed v2 handshake never downgrades to this transport.
        record({ status: 'upload_requested', deployment_requested: false });
        const uploaded = await send(session, `upload ${artifact.id} ${artifact.digest.slice(7)} ${ci.run_id} ${ci.run_attempt} ${zipBytes}`,
          { inputFile: zipFile, timeout: 180_000 });
        const rejected = uploadRejection(uploaded);
        if (rejected) {
          record({ status: 'upload_rejected', deployment_requested: false, error_code: rejected });
          throw new CdRejected(rejected);
        }
        requireCd(uploaded.code === 0 && uploaded.body?.schema_version === 1 && uploaded.body.status === 'uploaded' &&
          uploaded.body.artifact_id === artifact.id && uploaded.body.artifact_zip_sha256 === artifact.digest.slice(7) &&
          uploaded.body.bytes === zipBytes && uploaded.body.deployment_requested === false, 'backend_upload_outcome_unknown');
      }
      record({ status: 'upload_verified', deployment_requested: false });
      // A long transfer must not submit an application attempt for a superseded master.
      await revalidate();
      if (expectedGemini) {
        const fresh = await send(session, 'status');
        requireCd(fresh.code === 0, 'backend_status_failed');
        const deployed = requireReady(fresh.body);
        requireCd(deployed.release_id === expectedRelease && deployed.package_tree_sha256 === expectedTree &&
          deployed.source_sha === plan.server_base, 'backend_changed_after_plan');
        requireGeminiRuntimeMatch(expectedGemini, fresh.body.gemini_runtime);
      }
      record({ status: 'deployment_requested', deployment_requested: true });
      const accepted = await send(session, `deploy ${id} ${artifact.id} ${artifact.digest.slice(7)} ${ci.run_id} ${ci.run_attempt} ${ci.source_sha} ${expectedRelease} ${expectedTree}`);
      requireCd(accepted.code === 0 && accepted.body?.schema_version === 1 && accepted.body.status === 'submitted' &&
        accepted.body.operation_id === id && accepted.body.phase === 'submitted' && accepted.body.deployment_requested === true &&
        accepted.body.automatic_retry_allowed === false, 'backend_submission_outcome_unknown');
      submitted = true;
    } else requireCd(existing.code === 0 && existing.body?.operation_id === id && existing.body.status === 'operation_status',
      'existing_backend_operation_requires_reconciliation');
    for (let index = 0; index < pollLimit; index++) {
      const result = !submitted && index === 0 ? existing : await send(session, `status ${id}`);
      const body = result.body;
      requireCd(result.code === 0 && body?.schema_version === 1 && body.status === 'operation_status' && body.operation_id === id &&
        typeof body.effects_started === 'boolean' && typeof body.migration_requested === 'boolean' &&
        typeof body.deployment_performed === 'boolean', 'backend_poll_outcome_unknown');
      requireCd(!['failed', 'unknown'].includes(body.phase), 'backend_operation_requires_reconciliation');
      if (body.phase === 'complete') {
        requireCd(body.deployment_performed === true, 'backend_complete_receipt_invalid');
        const final = await send(session, 'status');
        const deployed = final.code === 0 ? requireReady(final.body) : null;
        requireCd(deployed?.source_sha === ci.source_sha && deployed.release_id === candidateRelease &&
          deployed.package_tree_sha256 === candidateTree, 'backend_final_version_mismatch');
        const committed = { status: 'complete', deployment_requested: true, deployment_performed: true, source_sha: ci.source_sha };
        if (expectedGemini && !sameGeminiRuntimeProof(expectedGemini, final.body.gemini_runtime)) {
          // Node already committed. Preserve that fact without allowing Pages to publish.
          record(committed);
          throw new CdRejected('gemini_runtime_attestation_changed');
        }
        const runtime = requireGeminiRuntimeMatch(expectedGemini, final.body.gemini_runtime);
        record({ ...committed, ...runtime });
        return { status: 'complete', source_sha: ci.source_sha, operation_id: id, deployment_performed: true, ...runtime };
      }
      requireCd(typeof body.phase === 'string' && /^[a-z_]{1,64}$/.test(body.phase) && body.deployment_performed === false,
        'backend_poll_state_invalid');
      await sleep(5_000);
    }
    throw new CdRejected('backend_operation_poll_deadline_requires_reconciliation');
  }, sshOptions);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireCd(process.argv[2] === 'baseline', 'vps_command_invalid');
    const result = await readBackend();
    outputs({ source_sha: result.source_sha, release_id: result.current.release_id,
      package_tree_digest: result.current.package_tree_sha256 });
    if (process.env.CD_STATE_FILE) writeState(process.env.CD_STATE_FILE, result);
    console.log(JSON.stringify(result));
  } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
