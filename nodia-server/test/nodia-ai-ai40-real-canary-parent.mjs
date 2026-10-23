// OPERATOR ONLY, Linux root: provision disposable PostgreSQL; run the real-profile canary as nodia.
// No Docker group/socket permission changes. Private DB options travel only in the child stdin pipe.
// Unknown/crashed/timeout child outcomes preserve the container for reconciliation, never generation replay.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { lstat, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodiaAiIntegrationFixture } from './nodia-ai.integration.fixture.mjs';

assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 0, 'Root operator parent is required');
const sha = value => createHash('sha256').update(value).digest('hex');
const script = fileURLToPath(new URL('./nodia-ai-ai40-real-canary.mjs', import.meta.url));
const cwd = resolve(dirname(script), '..');
let fixture, child, childResult = null, container = null, phase = 'operator_input', error = null;
let timedOut = false, removed = false, safe = false, stdoutBytes = 0, stderrBytes = 0;
let exitCode = null, exitSignal = null, sourceStdout = '', sourceStderr = '';
const began = new Date().toISOString();
try {
  let bytes = 0; const chunks = [];
  for await (const chunk of process.stdin) {
    bytes += chunk.length; assert.ok(bytes <= 1024 * 1024); chunks.push(chunk);
  }
  const config = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(config && typeof config === 'object' && !Array.isArray(config));
  assert.equal(config.schema_version, 1); assert.equal(config.authorize_one_real_generation, true);
  assert.equal(Object.hasOwn(config, 'provided_fixture'), false, 'Only this root parent provisions the fixture');
  const expectedKeys = ['schema_version', 'authorize_one_real_generation', 'selection', 'provider', 'expected_binary_sha256'];
  assert.equal(Object.keys(config).sort().join(','), expectedKeys.sort().join(','));
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
  }, 300000).unref();
  try { [exitCode, exitSignal] = await once(child, 'close'); }
  finally { clearTimeout(timer); clearTimeout(forceStop); }
  phase = 'child_receipt_and_root_sql_control';
  if (!error && !timedOut && exitSignal === null && stdoutBytes <= outputLimit) {
    try {
      childResult = JSON.parse(sourceStdout);
      assert.equal(childResult.schema, 'nodia-ai-ai40-real-canary-v1');
      assert.equal(childResult.disposable_lifecycle, 'root_operator_parent');
      assert.equal(childResult.operational_database_accessed, false);
      assert.equal(childResult.readiness_overridden, false); assert.equal(childResult.executable_overridden, false);
      assert.equal(childResult.publication_overridden, false);
      assert.equal(childResult.fixture_resources_removed, false);
      safe = childResult.fixture_sql_safe_to_remove === true;
    } catch { error = 'operator_child_receipt_invalid'; childResult = null; }
  } else error ??= timedOut ? 'operator_child_timeout' : 'operator_child_crashed';
  if (safe) {
    // Independent control of the parent's disposable DB before destroying it.
    const [pending] = await fixture.db.query(`SELECT
      (SELECT count(*)::integer FROM nodia_ai_jobs WHERE state IN ('leased','unknown') OR kind='reconcile') jobs,
      (SELECT count(*)::integer FROM nodia_ai_runtime_slots WHERE state<>'free') slots`);
    safe = pending.jobs === 0 && pending.slots === 0;
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
  schema: 'nodia-ai-ai40-real-canary-parent-v1',
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
}, null, 2));
if (error || childResult?.status !== 'passed' || !removed || exitCode !== 0) process.exitCode = 1;
