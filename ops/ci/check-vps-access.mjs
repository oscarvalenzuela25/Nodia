import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execute = promisify(execFile);
const recordedFingerprint = 'SHA256:9uAxNDxAxuRpicxnP+w4C5bJGHCi/hmnOpBIo2xrXKU';
class VpsCheckError extends Error {}
const requireValue = (condition, code) => {
  if (!condition) throw new VpsCheckError(code);
};

export function readConfiguration(environment, expectedFingerprint = recordedFingerprint, { allowedEvents = ['workflow_dispatch'] } = {}) {
  requireValue(allowedEvents.includes(environment.GITHUB_EVENT_NAME), 'manual_event_required');
  requireValue(environment.GITHUB_REF === 'refs/heads/master', 'master_branch_required');
  requireValue(environment.VPS_HOST === '166.0.112.187' && environment.VPS_PORT === '22' &&
    environment.VPS_USER === 'nodia-deploy', 'recorded_ssh_destination_required');
  const privateKey = environment.VPS_SSH_PRIVATE_KEY;
  requireValue(typeof privateKey === 'string' && privateKey.length < 16_384 &&
    privateKey.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----\n') &&
    privateKey.endsWith('-----END OPENSSH PRIVATE KEY-----\n') && !privateKey.includes('\r'),
  'openssh_private_key_missing_or_format_invalid');
  const knownHosts = environment.VPS_KNOWN_HOSTS;
  requireValue(typeof knownHosts === 'string' && knownHosts.length < 1024, 'known_hosts_missing_or_invalid');
  const fields = knownHosts.trim().split(/\s+/);
  requireValue(fields.length === 3 && fields[0] === '166.0.112.187' && fields[1] === 'ssh-ed25519',
    'recorded_known_hosts_entry_required');
  const key = Buffer.from(fields[2], 'base64');
  requireValue(key.length === 51 && key.toString('base64') === fields[2] &&
    key.readUInt32BE(0) === 11 && key.subarray(4, 15).toString() === 'ssh-ed25519' &&
    key.readUInt32BE(15) === 32, 'known_hosts_key_invalid');
  const fingerprint = 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
  requireValue(fingerprint === expectedFingerprint, 'recorded_server_fingerprint_mismatch');
  return { privateKey, knownHosts };
}

export function verifyIdentity(body) {
  if (body?.status === 'deployment_ready') {
    const current = verifyDeploymentStatus(body);
    return { schema_version: 1, status: 'ssh_access_verified', recorded_destination_matched: true,
      host_key_verified: true, restricted_identity_verified: true, deployment_requested: false,
      privileged_helper_enabled: true, deployment_ready: true, blocked: body.blocked,
      application_ready: body.application.api_active && body.application.worker_active,
      current, builds_executed: 0 };
  }
  const expected = { schema_version: 1, status: 'identity_verified', user: 'nodia-deploy',
    forced_command: true, deployment_implemented: false, privileged_helper_enabled: false,
    deployment_requested: false };
  requireValue(body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, value]) => body[key] === value), 'restricted_identity_response_mismatch');
  return { schema_version: 1, status: 'ssh_access_verified', recorded_destination_matched: true,
    host_key_verified: true, restricted_identity_verified: true, deployment_requested: false,
    privileged_helper_enabled: false, builds_executed: 0 };
}

export function verifyDeploymentStatus(body) {
  const expectedKeys = ['application', 'blocked', 'current', 'deployment_implemented', 'deployment_requested',
    'forced_command', 'privileged_helper_enabled', 'schema_version', 'status', 'user'];
  const current = body?.current;
  requireValue(body && Object.keys(body).sort().join(',') === expectedKeys.join(',') && body.schema_version === 1 &&
    body.status === 'deployment_ready' && body.user === 'nodia-deploy' && body.forced_command === true &&
    body.privileged_helper_enabled === true && body.deployment_implemented === true && body.deployment_requested === false &&
    body.blocked === false && current &&
    Object.keys(current).sort().join(',') === 'package_tree_sha256,release_id,source_sha' &&
    typeof current.source_sha === 'string' && /^[a-f0-9]{40}$/.test(current.source_sha) && current.source_sha.length === 40 &&
    typeof current.package_tree_sha256 === 'string' && /^[a-f0-9]{64}$/.test(current.package_tree_sha256) &&
    current.package_tree_sha256.length === 64 && current.release_id ===
      `backend-${current.source_sha.slice(0, 12)}-${current.package_tree_sha256.slice(0, 12)}` &&
    body.application && Object.keys(body.application).sort().join(',') === 'api_active,worker_active' &&
    body.application.api_active === true && body.application.worker_active === true,
  'deployment_status_invalid_or_gateway_not_installed');
  return current;
}

export async function withSshFiles(environment, callback, { expectedFingerprint = recordedFingerprint,
  allowedEvents = ['workflow_dispatch'] } = {}) {
  const { privateKey, knownHosts } = readConfiguration(environment, expectedFingerprint, { allowedEvents });
  let directory;
  const created = [];
  try {
    directory = await mkdtemp(path.join(os.tmpdir(), 'nodia-ci-ssh-'));
    await chmod(directory, 0o700);
    const identity = path.join(directory, 'identity');
    const hosts = path.join(directory, 'known_hosts');
    for (const [filename, content] of [[identity, privateKey], [hosts, knownHosts]]) {
      // Track before writing so a partial write is removed too. The directory is new/private.
      created.push(filename);
      await writeFile(filename, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    }
    const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
    const args = ['-F', nullDevice, '-T', '-i', identity, '-p', '22',
      '-o', 'IdentityAgent=none', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${hosts}`,
      '-o', `GlobalKnownHostsFile=${nullDevice}`, '-o', 'UpdateHostKeys=no',
      '-o', 'HostKeyAlgorithms=ssh-ed25519', '-o', 'ConnectTimeout=10',
      '-o', 'ServerAliveInterval=5', '-o', 'ServerAliveCountMax=1',
      'nodia-deploy@166.0.112.187'];
    const childEnvironment = { PATH: process.env.PATH, HOME: directory, LANG: 'C', LC_ALL: 'C',
        SSH_ASKPASS_REQUIRE: 'never' };
      // Windows OpenSSH needs its normal OS/profile paths. Preserve only these
      // named runtime variables, never the workflow's credential environment.
      if (process.platform === 'win32') {
        for (const name of ['SystemRoot', 'SystemDrive', 'WINDIR', 'ProgramData', 'USERPROFILE',
          'USERNAME', 'USERDOMAIN', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'LOCALAPPDATA',
          'APPDATA', 'COMSPEC', 'PATHEXT']) {
          if (process.env[name]) childEnvironment[name] = process.env[name];
        }
      }
    return await callback({ program: 'ssh', args, options: { encoding: 'utf8', windowsHide: true,
      timeout: 20_000, killSignal: 'SIGKILL', maxBuffer: 16_384, env: childEnvironment } });
  } finally {
    // Unlink only our two files and remove the empty temporary directory; no recursive delete.
    const removals = await Promise.allSettled(created.map(filename => unlink(filename)));
    let directoryRemoved = true;
    if (directory) {
      try { await rmdir(directory); }
      catch { directoryRemoved = false; }
    }
    requireValue(directoryRemoved && removals.every(result => result.status === 'fulfilled' ||
      result.reason?.code === 'ENOENT'), 'private_temporary_file_cleanup_failed');
  }
}

export async function checkVpsAccess(environment, { run = execute, expectedFingerprint = recordedFingerprint } = {}) {
  return withSshFiles(environment, async session => {
    let output;
    try { output = await run(session.program, [...session.args, 'status'], session.options); }
    catch { throw new VpsCheckError('ssh_connection_or_command_failed'); }
    let body;
    try { body = JSON.parse(output.stdout); }
    catch { throw new VpsCheckError('ssh_response_invalid_json'); }
    return verifyIdentity(body);
  }, { expectedFingerprint });
}

export function failureResult(error) {
  return { schema_version: 1, status: 'failed',
    error_code: error instanceof VpsCheckError ? error.message : 'unexpected_ssh_check_error',
    deployment_requested: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await checkVpsAccess(process.env))); }
  catch (error) {
    console.error(JSON.stringify(failureResult(error)));
    process.exitCode = 1;
  }
}
