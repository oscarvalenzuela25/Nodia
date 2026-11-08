// OPERATOR ONLY, Linux root: one controlled recovery intention, at most one native dispatch, disposable PostgreSQL.
// No Docker group/socket permission changes. Private DB options travel only in the child stdin pipe.
// Unknown/crashed/timeout child outcomes preserve the container for reconciliation, never generation replay.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { lstat, realpath, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RECOVERY_RELEASE as RELEASE, RECOVERY_RELEASE_SHA as RELEASE_SHA, validateRecoveryInput, RECOVERY_CONTENDER_CASES } from './nodia-ai-ai40-recovery-sources-r01.mjs';
const { createNodiaAiIntegrationFixture } = await import(pathToFileURL(RELEASE + '/test/nodia-ai.integration.fixture.mjs'));

assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 0, 'Root operator parent is required');
const sha = value => createHash('sha256').update(value).digest('hex');
const script = fileURLToPath(new URL('./nodia-ai-ai40-recovery-child-r01.mjs', import.meta.url));
const cwd = RELEASE;
let fixture, child, childResult = null, container = null, phase = 'operator_input', error = null;
let timedOut = false, removed = false, safe = false, stdoutBytes = 0, stderrBytes = 0;
let exitCode = null, exitSignal = null, sourceStdout = '', sourceStderr = '';
let scenario = null, blockedLoginRequestId = null;
const began = new Date().toISOString();
try {
  let bytes = 0; const chunks = [];
  for await (const chunk of process.stdin) {
    bytes += chunk.length; assert.ok(bytes <= 1024 * 1024); chunks.push(chunk);
  }
  const config = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  validateRecoveryInput(config);
  scenario = config.scenario; blockedLoginRequestId = config.blocked_login_request_id;
  assert.equal(sha(await readFile(RELEASE + '/release-manifest.json')), RELEASE_SHA);
  const account = execFileSync('getent', ['passwd', 'nodia'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split(':');
  assert.equal(account.length, 7); assert.equal(account[0], 'nodia');
  const nativeUid = Number(account[2]);
  assert.ok(Number.isSafeInteger(nativeUid) && nativeUid > 0);
  assert.ok(account[5] && resolve(account[5]) === account[5]);
  assert.equal(process.env.NODIA_CODEX_ENABLED, 'true');
  const profileRoot = process.env.NODIA_CODEX_PROFILE_ROOT;
  assert.ok(profileRoot && resolve(profileRoot) === profileRoot && await realpath(profileRoot) === profileRoot);
  const profileInfo = await lstat(profileRoot);
  assert.ok(profileInfo.isDirectory() && !profileInfo.isSymbolicLink() && profileInfo.uid === nativeUid && (profileInfo.mode & 0o077) === 0);
  const env = {
    PATH: '/usr/local/bin:/usr/bin:/bin', HOME: account[5], NODE_ENV: 'test',
    DOTENV_CONFIG_PATH: '/dev/null', RATE_LIMIT_STORAGE: 'memory',
    NODIA_CODEX_ENABLED: 'true', NODIA_CODEX_PROFILE_ROOT: profileRoot,
  };
  // Keyring transport addresses only; no operational API keys, JWT/Google secrets or dotenv values.
  for (const key of ['DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR']) {
    const value = process.env[key];
    if (value !== undefined) {
      assert.ok(value.length > 0 && value.length <= 4096 && !/[\r\n\0]/u.test(value));
      env[key] = value;
    }
  }
  if (env.XDG_RUNTIME_DIR) {
    const runtimeInfo = await lstat(env.XDG_RUNTIME_DIR);
    assert.ok(runtimeInfo.isDirectory() && !runtimeInfo.isSymbolicLink() && runtimeInfo.uid === nativeUid);
  }
  phase = 'root_disposable_postgres';
  fixture = await createNodiaAiIntegrationFixture('ai40');
  container = execFileSync('docker', ['ps', '--filter', `name=^template_ai40_${process.pid}_`, '--format', '{{.Names}}'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  assert.match(container, new RegExp(`^template_ai40_${process.pid}_[a-f0-9]{8}$`, 'u'));
  const supplied = { ...config, provided_fixture: {
    schema_version: 1, container_name: container, options: fixture.options,
    identities: [...fixture.identities.values()],
  } };
  phase = 'nodia_real_profile_canary';
  // Environment is replaced rather than inherited. The DB password appears only in this private pipe.
  child = spawn('/usr/sbin/runuser', ['--preserve-environment', '-u', 'nodia', '--', process.execPath, script], {
    cwd, env, stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.on('error', () => { error = 'operator_child_start_failed'; });
  const outputLimit = 4 * 1024 * 1024;
  child.stdout.on('data', chunk => {
    stdoutBytes += chunk.length;
    if (stdoutBytes <= outputLimit) sourceStdout += chunk.toString('utf8');
    else { error = 'operator_child_output_exceeded'; child.kill('SIGTERM'); }
  });
  child.stderr.on('data', chunk => {
    stderrBytes += chunk.length;
    if (stderrBytes <= 65536) sourceStderr += chunk.toString('utf8');
  });
  child.stdin.on('error', () => { error ??= 'operator_child_input_failed'; });
  child.stdin.end(JSON.stringify(supplied));
  let forceStop;
  const timer = setTimeout(() => {
    timedOut = true; child.kill('SIGTERM');
    forceStop = setTimeout(() => child.kill('SIGKILL'), 3000).unref();
  }, 420000).unref();
  try { [exitCode, exitSignal] = await once(child, 'close'); }
  finally { clearTimeout(timer); clearTimeout(forceStop); }
  phase = 'child_receipt_and_root_sql_control';
  if (!error && !timedOut && exitSignal === null && stdoutBytes <= outputLimit) {
    try {
      childResult = JSON.parse(sourceStdout);
      assert.equal(childResult.schema, 'nodia-ai-ai40-recovery-child-v1');
      assert.equal(childResult.scenario, config.scenario);
      assert.equal(childResult.blocked_login_request_id, config.blocked_login_request_id);
      assert.deepEqual(childResult.selection, config.selection);
      for (const field of ['runtime_policy_overridden', 'operational_database_accessed', 'readiness_overridden',
        'executable_overridden', 'publication_overridden', 'operational_profile_removed'])
        assert.equal(childResult[field], false);
      assert.equal(childResult.max_authorized_provider_dispatches, 1);
      if (childResult.status === 'passed') {
        assert.equal(childResult.redis_event_bus_synthetic, true);
        if (config.execution_mode === 'bootstrap') {
          assert.equal(childResult.dry_bootstrap_complete_before_account_or_dispatch, true);
          assert.equal(childResult.production_context_stage_used, false);
          assert.equal(childResult.diagnostic_inference_handler_used, false);
          assert.equal(childResult.total_provider_dispatches, 0);
          assert.equal(childResult.native_request, null);
          assert.equal(childResult.native_terminal_ack_receipts.length, 0);
          assert.equal(childResult.contenders.length, 0);
        } else {
          assert.equal(childResult.dry_bootstrap_complete_before_account_or_dispatch, false);
          assert.equal(childResult.production_context_stage_used, true);
          assert.equal(childResult.diagnostic_inference_handler_used, true);
          assert.equal(childResult.total_provider_dispatches, 1);
          assert.equal(childResult.native_terminal_ack_receipts.length, 1);
          const proof = childResult.native_terminal_ack_receipts[0];
          assert.equal(proof.attempt_id, childResult.native_request.attemptId);
          assert.equal(proof.outcome, 'abandoned_unknown');
          assert.ok(proof.process_closed && proof.exact_native_ack_settled && proof.journal_acknowledged &&
            proof.exact_native_process_absent && proof.owned_native_process_group_empty && proof.image_staging_entries === 0);
          assert.equal(childResult.scenario_assertions.real_provider_callback_before_gateway, true);
          assert.equal(childResult.scenario_assertions.exactly_one_callback_and_one_armed_dispatch, true);
          assert.equal(childResult.scenario_assertions.no_late_result_business_effect_or_replay, true);
          if (config.scenario === 'cancel') {
            assert.deepEqual(childResult.contenders.map(value => value.case), [...RECOVERY_CONTENDER_CASES]);
            assert.ok(childResult.contenders.every(value => value.exit_code === 0 && value.exit_signal === null && value.result.status === 'passed'));
            assert.equal(childResult.scenario_assertions.durable_native_cancel_requested, true);
          } else {
            assert.equal(childResult.contenders.length, 0);
            for (const field of ['core_save_user_removed_fixture_modules', 'current_authorization_rejects_revoked_actor',
              'late_checkpoint_probe_has_live_unmodified_lease', 'late_callback_work_not_executed',
              'late_finish_persist_not_executed', 'real_gateway_rejects_late_callback'])
              assert.equal(childResult.scenario_assertions[field], true);
          }
        }
      }
      safe = childResult.fixture_sql_safe_to_remove === true;
    } catch { error = 'operator_child_receipt_invalid'; childResult = null; }
  } else error ??= timedOut ? 'operator_child_timeout' : 'operator_child_crashed';
  if (safe) {
    // Independent control of the parent's disposable DB before destroying it.
    const [pending] = await fixture.db.query(`SELECT
      (SELECT count(*)::integer FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting') OR kind='reconcile') jobs,
      (SELECT count(*)::integer FROM nodia_ai_runtime_slots WHERE state<>'free') slots,
      (SELECT count(*)::integer FROM nodia_ai_executions) business_executions,
      (SELECT count(*)::integer FROM nodia_ai_tool_calls) tool_receipts,
      (SELECT count(*)::integer FROM nodia_ai_messages WHERE role='assistant') assistant_messages`);
    safe = Object.values(pending).every(value => value === 0);
    if (!safe) error = 'operator_root_sql_pending';
  }
  if (safe) { await fixture.close(); removed = true; }
  phase = removed ? 'complete' : 'retained_for_operator_reconciliation';
} catch {
  error ??= 'operator_parent_failed';
} finally {
  // A failure before any native child starts is safe to clean. Otherwise, keep ownership evidence.
  if (fixture && !child && !removed) {
    try { await fixture.close(); removed = true; } catch { error ??= 'operator_fixture_cleanup_failed'; }
  } else if (fixture?.db.isInitialized) await fixture.db.destroy().catch(() => {});
}
console.log(JSON.stringify({
  schema: 'nodia-ai-ai40-recovery-parent-v1',
  scenario, blocked_login_request_id: blockedLoginRequestId,
  status: !error && childResult?.status === 'passed' && removed && exitCode === 0 ? 'passed' : 'failed', phase,
  started_at_utc: began, finished_at_utc: new Date().toISOString(), error,
  native_process_user: 'nodia', root_only_disposable_provisioning: true,
  docker_permissions_changed: false, private_db_options_emitted: false,
  child_exit_code: exitCode, child_exit_signal: exitSignal, child_timed_out: timedOut,
  child_stdout_bytes: stdoutBytes, child_stdout_sha256: sha(sourceStdout),
  child_stderr_bytes: stderrBytes, child_stderr_sha256: sha(sourceStderr), child_stderr_withheld: true,
  child: childResult, fixture_resources_removed: removed,
  retained_disposable_container: fixture && !removed ? container : null,
  operational_profile_removed: false, operational_database_accessed: false,
  release: RELEASE, release_manifest_sha256: RELEASE_SHA, full_C40_09_accepted: false,
}, null, 2));
if (error || childResult?.status !== 'passed' || !removed || exitCode !== 0) process.exitCode = 1;
