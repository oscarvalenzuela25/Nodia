import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkPagesAccess, failureResult, readConfiguration, verifyProject } from './check-pages-access.mjs';

// Synthetic credentials only. No Cloudflare connection is made by this suite.
const environment = () => ({
  GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/master',
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_PAGES_PROJECT_NAME: 'nodia',
  CLOUDFLARE_API_TOKEN: 'synthetic-fixture-token',
});
const project = () => ({
  success: true, errors: [], result: {
    name: 'nodia', subdomain: 'nodia-1ge.pages.dev', production_branch: 'master',
    source: { type: 'github', config: { production_branch: 'master',
      production_deployments_enabled: false, preview_deployment_setting: 'none' } },
    deployment_configs: { production: { env_vars: { PRIVATE_FIXTURE: { value: 'never-print-this' } } } },
  },
});

test('missing credentials, wrong branches/events and unexpected projects fail before any request', async () => {
  for (const change of [
    { CLOUDFLARE_ACCOUNT_ID: '' }, { CLOUDFLARE_ACCOUNT_ID: 'https://foreign.invalid' },
    { CLOUDFLARE_API_TOKEN: '' }, { CLOUDFLARE_API_TOKEN: 'token\nheader' },
    { CLOUDFLARE_PAGES_PROJECT_NAME: 'other-project' },
    { GITHUB_REF: 'refs/heads/development' }, { GITHUB_REF: 'refs/tags/master' },
    { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_EVENT_NAME: 'push' },
  ]) {
    let called = false;
    await assert.rejects(checkPagesAccess({ ...environment(), ...change }, {
      request: async () => { called = true; throw new Error('must not run'); },
    }));
    assert.equal(called, false);
  }
  assert.equal(readConfiguration(environment()).project, 'nodia');
});

test('performs exactly one fixed-origin GET without redirects and emits only allowlisted metadata', async () => {
  let calls = 0;
  const result = await checkPagesAccess(environment(), { request: async (url, options) => {
    calls++;
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/pages/projects/nodia`);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-fixture-token');
    assert.equal(options.signal.aborted, false);
    assert.equal(options.body, undefined);
    return Response.json(project());
  } });
  assert.equal(calls, 1);
  assert.equal(result.status, 'read_access_verified');
  assert.equal(result.write_permission_verified, false);
  assert.equal(result.deployment_requested, false);
  assert.equal(result.builds_executed, 0);
  const output = JSON.stringify(result);
  for (const hidden of ['synthetic-fixture-token', 'never-print-this', 'env_vars', 'a'.repeat(32)])
    assert.equal(output.includes(hidden), false);
});

test('denied, absent, rate-limited and unavailable HTTP responses do not expose remote content or retry', async () => {
  for (const status of [301, 401, 403, 404, 429, 500, 503]) {
    let calls = 0;
    await assert.rejects(checkPagesAccess(environment(), { request: async () => {
      calls++;
      return new Response('confidential remote body', { status });
    } }), { message: 'cloudflare_http_request_failed' });
    assert.equal(calls, 1);
  }
});

test('invalid JSON, unsuccessful payloads and incomplete settings never pass', async () => {
  await assert.rejects(checkPagesAccess(environment(), {
    request: async () => new Response('not-json'),
  }), { message: 'cloudflare_response_invalid_json' });
  for (const body of [null, {}, { ...project(), success: false }, { ...project(), errors: [{}] },
    { ...project(), result: null }]) assert.throws(() => verifyProject(body, 'nodia'));
  for (const change of [
    { name: 'other' }, { subdomain: 'other.pages.dev' }, { production_branch: 'development' },
    { source: undefined }, { source: { type: 'github', config: {} } },
    { source: { type: 'gitlab', config: project().result.source.config } },
  ]) assert.throws(() => verifyProject({ ...project(), result: { ...project().result, ...change } }, 'nodia'));
});

test('enabled or unknown auto-deploy/preview settings and source branch mismatches are rejected', () => {
  for (const change of [
    { production_branch: 'development' }, { production_deployments_enabled: true },
    { production_deployments_enabled: undefined }, { production_deployments_enabled: 'false' },
    { preview_deployment_setting: 'all' }, { preview_deployment_setting: 'custom' },
    { preview_deployment_setting: undefined },
  ]) {
    const body = project();
    Object.assign(body.result.source.config, change);
    assert.throws(() => verifyProject(body, 'nodia'));
  }
});

test('network and unexpected failures cannot leak error text or stack traces', async () => {
  try {
    await checkPagesAccess(environment(), { request: async () => {
      throw new Error('Bearer synthetic-fixture-token');
    } });
    assert.fail('must reject');
  } catch (error) {
    assert.equal(failureResult(error).error_code, 'cloudflare_network_or_timeout_error');
    assert.equal(JSON.stringify(failureResult(error)).includes('synthetic-fixture-token'), false);
  }
  assert.equal(failureResult(new Error('private-data')).error_code, 'unexpected_check_error');
});

test('CLI validation emits a safe error and fails before using any remote credentials', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-pages-access.mjs', import.meta.url))], {
    encoding: 'utf8', windowsHide: true, env: { ...process.env, ...environment(), GITHUB_REF: 'refs/heads/development' },
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(JSON.parse(result.stderr).error_code, 'master_branch_required');
  assert.equal(result.stderr.includes('synthetic-fixture-token'), false);
});
