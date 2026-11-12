import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { checkVpsAccess, failureResult, readConfiguration, verifyIdentity, verifyDeploymentStatus } from './check-vps-access.mjs';

// Format-only synthetic fixtures; never real private or server keys.
const blob = Buffer.concat([Buffer.from([0, 0, 0, 11]), Buffer.from('ssh-ed25519'),
  Buffer.from([0, 0, 0, 32]), Buffer.alloc(32, 7)]);
const expectedFingerprint = 'SHA256:' + createHash('sha256').update(blob).digest('base64').replace(/=+$/, '');
const environment = () => ({ GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/master',
  VPS_HOST: '166.0.112.187', VPS_PORT: '22', VPS_USER: 'nodia-deploy',
  VPS_KNOWN_HOSTS: `166.0.112.187 ssh-ed25519 ${blob.toString('base64')}\n`,
  VPS_SSH_PRIVATE_KEY: '-----BEGIN OPENSSH PRIVATE KEY-----\nsynthetic-fixture-only\n-----END OPENSSH PRIVATE KEY-----\n' });
const identity = () => ({ schema_version: 1, status: 'identity_verified', user: 'nodia-deploy',
  forced_command: true, deployment_implemented: false, privileged_helper_enabled: false, deployment_requested: false });
const deployed = () => ({ schema_version: 1, status: 'deployment_ready', user: 'nodia-deploy',
  forced_command: true, deployment_implemented: true, privileged_helper_enabled: true, deployment_requested: false,
  current: { source_sha: 'a'.repeat(40), package_tree_sha256: 'b'.repeat(64), release_id: `backend-${'a'.repeat(12)}-${'b'.repeat(12)}` },
  blocked: false, application: { api_active: true, worker_active: true } });

test('updated gateway status is explicitly typed while retaining compatibility with the old status-only identity', () => {
  const status = deployed();
  assert.equal(verifyIdentity(status).privileged_helper_enabled, true);
  assert.equal(verifyIdentity(status).application_ready, true);
  assert.deepEqual(verifyDeploymentStatus(status), status.current);
  assert.equal(verifyIdentity(identity()).privileged_helper_enabled, false);
  for (const value of [{ ...status, blocked: 'false' }, { ...status, unexpected: 1 },
    { ...status, current: { ...status.current, source_sha: 'a'.repeat(40) + '\n' } },
    { ...status, current: { ...status.current, release_id: 'other' } },
    { ...status, application: { api_active: true } }, { ...status, forced_command: false },
    { ...status, application: { api_active: true, worker_active: 'true' } }]) assert.throws(() => verifyDeploymentStatus(value));
});

test('invalid events, refs, destinations, key format and host pins fail before SSH', async () => {
  for (const change of [
    { GITHUB_EVENT_NAME: 'push' }, { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_REF: 'refs/heads/development' }, { GITHUB_REF: 'refs/tags/master' },
    { VPS_HOST: 'other.invalid' }, { VPS_PORT: '2222' }, { VPS_USER: 'root' },
    { VPS_SSH_PRIVATE_KEY: '' }, { VPS_SSH_PRIVATE_KEY: environment().VPS_SSH_PRIVATE_KEY.replaceAll('\n', '\r\n') },
    { VPS_KNOWN_HOSTS: '' }, { VPS_KNOWN_HOSTS: '*.example.invalid ssh-ed25519 invalid' },
    { VPS_KNOWN_HOSTS: '166.0.112.187 ssh-ed25519 aaaa' },
    { VPS_KNOWN_HOSTS: environment().VPS_KNOWN_HOSTS + 'extra-entry' },
  ]) {
    let called = false;
    await assert.rejects(checkVpsAccess({ ...environment(), ...change }, {
      expectedFingerprint, run: async () => { called = true; throw new Error('must not run'); },
    }));
    assert.equal(called, false);
  }
  assert.throws(() => readConfiguration(environment(), 'SHA256:wrong'));
});

test('SSH uses exact temporary bytes, strict pinned trust, no agent and status only; files are removed', async () => {
  let files;
  const result = await checkVpsAccess(environment(), { expectedFingerprint, run: async (file, args, options) => {
    assert.equal(file, 'ssh');
    assert.deepEqual(args.slice(-2), ['nodia-deploy@166.0.112.187', 'status']);
    const key = args[args.indexOf('-i') + 1];
    const hosts = args.find(value => value.startsWith('UserKnownHostsFile=')).split('=').slice(1).join('=');
    files = [key, hosts, path.dirname(key)];
    assert.equal(readFileSync(key, 'utf8'), environment().VPS_SSH_PRIVATE_KEY);
    assert.equal(readFileSync(hosts, 'utf8'), environment().VPS_KNOWN_HOSTS);
    if (process.platform !== 'win32') {
      assert.equal(statSync(key).mode & 0o777, 0o600);
      assert.equal(statSync(hosts).mode & 0o777, 0o600);
      assert.equal(statSync(path.dirname(key)).mode & 0o777, 0o700);
    }
    for (const value of ['StrictHostKeyChecking=yes', 'IdentityAgent=none', 'IdentitiesOnly=yes',
      'BatchMode=yes', 'UpdateHostKeys=no', 'HostKeyAlgorithms=ssh-ed25519']) assert.ok(args.includes(value));
    assert.ok(args.some(value => value.startsWith('GlobalKnownHostsFile=')));
    assert.equal(options.timeout, 20_000);
    assert.equal(options.maxBuffer, 16_384);
    assert.equal(options.shell, undefined);
    assert.equal(options.env.VPS_SSH_PRIVATE_KEY, undefined);
    assert.equal(options.env.CLOUDFLARE_API_TOKEN, undefined);
    assert.equal(options.env.GITHUB_TOKEN, undefined);
    return { stdout: JSON.stringify(identity()), stderr: 'ignored synthetic remote message' };
  } });
  assert.ok(files.every(filename => !existsSync(filename)));
  assert.equal(result.status, 'ssh_access_verified');
  assert.equal(result.deployment_requested, false);
  assert.equal(result.privileged_helper_enabled, false);
  assert.equal(JSON.stringify(result).includes('synthetic'), false);
});

test('connection failure, timeout or oversized output is sanitized and leaves no temporary key', async () => {
  let filename;
  try {
    await checkVpsAccess(environment(), { expectedFingerprint, run: async (_file, args) => {
      filename = args[args.indexOf('-i') + 1];
      throw new Error('synthetic-fixture-only secret stderr and paths');
    } });
    assert.fail('must reject');
  } catch (error) {
    assert.equal(failureResult(error).error_code, 'ssh_connection_or_command_failed');
    assert.equal(JSON.stringify(failureResult(error)).includes('synthetic-fixture-only'), false);
  }
  assert.equal(existsSync(filename), false);
  assert.equal(existsSync(path.dirname(filename)), false);
});

test('invalid output and a different or already privileged identity never pass', async () => {
  let filename;
  await assert.rejects(checkVpsAccess(environment(), { expectedFingerprint, run: async (_file, args) => {
    filename = args[args.indexOf('-i') + 1];
    return { stdout: 'invalid JSON', stderr: '' };
  } }), { message: 'ssh_response_invalid_json' });
  assert.equal(existsSync(filename), false);
  for (const value of [null, [], {}, { ...identity(), user: 'root' }, { ...identity(), forced_command: false },
    { ...identity(), deployment_implemented: true }, { ...identity(), privileged_helper_enabled: true },
    { ...identity(), unexpected: 'field' }]) assert.throws(() => verifyIdentity(value));
  assert.equal(failureResult(new Error('secret')).error_code, 'unexpected_ssh_check_error');
});
