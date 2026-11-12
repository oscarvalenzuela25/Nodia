import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { withSshFiles, verifyDeploymentStatus } from './check-vps-access.mjs';
import { CdRejected, isHex, isSha, numeric, outputs, requireCd, safeFailure, writeState, ZIP_LIMIT } from './cd-github.mjs';

export async function sshCommand(session, command, { inputFile, timeout = 20_000 } = {}) {
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
    if (inputFile) pipeline(fs.createReadStream(inputFile), child.stdin).catch(() => { inputFailed = true; });
    else child.stdin.end();
  });
}
export function requireReady(body) {
  let current;
  try { current = verifyDeploymentStatus(body); }
  catch { throw new CdRejected('deployment_gateway_not_ready'); }
  return current;
}
export async function readBackend(environment = process.env, { send = sshCommand, sshOptions = {} } = {}) {
  return withSshFiles(environment, async session => {
    const result = await send(session, 'status');
    requireCd(result.code === 0, 'backend_status_failed');
    return { schema_version: 1, status: 'baseline_verified', current: requireReady(result.body),
      source_sha: result.body.current.source_sha, deployment_requested: false };
  }, { ...sshOptions, allowedEvents: ['push', 'workflow_dispatch'] });
}
export function operationId(artifact, ci) {
  requireCd(numeric(artifact.id) && /^sha256:[a-f0-9]{64}$/.test(artifact.digest) && numeric(ci.run_id) &&
    numeric(ci.run_attempt) && isSha(ci.source_sha), 'operation_identity_invalid');
  return createHash('sha256').update(JSON.stringify({ component: 'server', artifact: artifact.id,
    digest: artifact.digest, run: ci.run_id, attempt: ci.run_attempt, source: ci.source_sha })).digest('hex').slice(0, 32);
}
export async function deployBackend({ environment = process.env, plan, artifact, zipFile, zipBytes, ci,
  expectedRelease, expectedTree, candidateRelease, candidateTree, allowNewSubmission = true, stateFile, send = sshCommand, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  sshOptions = {}, pollLimit = 240 }) {
  requireCd(environment.GITHUB_EVENT_NAME === 'workflow_dispatch' && environment.GITHUB_REF === 'refs/heads/master' &&
    environment.GITHUB_RUN_ATTEMPT === '1' &&
    plan.server_required === true && isSha(ci.source_sha) && ci.source_sha === plan.source_sha &&
    /^backend-[a-f0-9]{12}-[a-f0-9]{12}$/.test(expectedRelease) && isHex(expectedTree) &&
    isHex(candidateTree) && candidateRelease === `backend-${ci.source_sha.slice(0, 12)}-${candidateTree.slice(0, 12)}` &&
    Number.isSafeInteger(zipBytes) && zipBytes > 0 && zipBytes <= ZIP_LIMIT, 'backend_deploy_input_invalid');
  const id = operationId(artifact, ci);
  const record = value => { if (stateFile) writeState(stateFile, { operation_id: id, automatic_retry_allowed: false, ...value }); };
  return withSshFiles(environment, async session => {
    const existing = await send(session, `status ${id}`);
    let submitted = false;
    if (existing.code !== 0 && existing.body?.status === 'failed' && existing.body.error_code === 'operation_not_found') {
      const status = await send(session, 'status');
      requireCd(status.code === 0, 'backend_status_failed');
      const current = requireReady(status.body);
      if (current.source_sha === ci.source_sha) {
        requireCd(current.release_id === candidateRelease && current.package_tree_sha256 === candidateTree,
          'backend_current_artifact_mismatch');
        record({ status: 'already_current', deployment_requested: false });
        return { status: 'already_current', source_sha: current.source_sha, deployment_requested: false };
      }
      requireCd(current.release_id === expectedRelease && current.package_tree_sha256 === expectedTree &&
        current.source_sha === plan.server_base, 'backend_changed_after_plan');
      requireCd(allowNewSubmission === true, 'prior_cd_run_requires_operator_reconciliation');
      record({ status: 'upload_requested', deployment_requested: false });
      const uploaded = await send(session, `upload ${artifact.id} ${artifact.digest.slice(7)} ${ci.run_id} ${ci.run_attempt} ${zipBytes}`,
        { inputFile: zipFile, timeout: 180_000 });
      requireCd(uploaded.code === 0 && uploaded.body?.schema_version === 1 && uploaded.body.status === 'uploaded' &&
        uploaded.body.artifact_id === artifact.id && uploaded.body.artifact_zip_sha256 === artifact.digest.slice(7) &&
        uploaded.body.bytes === zipBytes && uploaded.body.deployment_requested === false, 'backend_upload_outcome_unknown');
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
        record({ status: 'complete', deployment_requested: true, deployment_performed: true, source_sha: ci.source_sha });
        return { status: 'complete', source_sha: ci.source_sha, operation_id: id, deployment_performed: true };
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
    outputs({ source_sha: result.source_sha });
    if (process.env.CD_STATE_FILE) writeState(process.env.CD_STATE_FILE, result);
    console.log(JSON.stringify(result));
  } catch (error) { console.error(JSON.stringify(safeFailure(error))); process.exitCode = 1; }
}
