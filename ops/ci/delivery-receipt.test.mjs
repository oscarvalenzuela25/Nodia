import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deliveryReceipt } from './delivery-receipt.mjs';
import { releaseSummary } from './cd-release.mjs';

function fixture(t) {
  const parent = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'nodia-receipt-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const directory = path.join(parent, 'delivery'), root = path.join(parent, 'source');
  fs.mkdirSync(directory); fs.mkdirSync(root);
  const environment = { GITHUB_WORKSPACE: root, CD_WORKSPACE: directory, CI_SOURCE_SHA: 'a'.repeat(40),
    GITHUB_RUN_ID: '70', GITHUB_RUN_ATTEMPT: '1', CI_RUN_ID: '50', CI_RUN_ATTEMPT: '1', CD_PRIOR_RUN: 'false',
    GITHUB_STEP_SUMMARY: path.join(parent, 'summary.md'), CLOUDFLARE_API_TOKEN: 'private-environment-token' };
  const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value));
  return { directory, environment, write };
}

test('durable partial-delivery receipt retains exact identities but excludes raw state, paths and transport secrets', t => {
  const f = fixture(t), source = f.environment.CI_SOURCE_SHA, digest = 'sha256:' + 'b'.repeat(64);
  const marker = `nodia-ci:${source}:${'c'.repeat(64)}:${'d'.repeat(64)}:50:1`;
  f.write('release-plan.json', { source_sha: source, private_token: 'private-plan-secret',
    artifacts: { client: { id: '90', digest, directory: 'private-runner-path',
      metadata: { package_tree_sha256: 'c'.repeat(64), public_configuration_sha256: 'd'.repeat(64), token: 'private-meta-secret' } } },
    client_baseline: { status: 'baseline_verified', source_sha: 'e'.repeat(40),
      deployment_id: '11111111-1111-1111-1111-111111111111', recorded_marker: marker } });
  f.write('backend-state.json', { status: 'complete', source_sha: source, operation_id: 'f'.repeat(32), deployment_requested: true });
  f.write('backend-result.json', { status: 'complete', source_sha: source, secret: 'private-backend-secret' });
  f.write('client-preflight.json', { status: 'preflight_verified', source_sha: source,
    missing_assets: null, asset_check_performed: false, jwt: 'private-upload-jwt' });
  f.write('pages-state.json', { status: 'asset_check_requested', marker, deployment_requested: false,
    headers: { Authorization: 'private-auth-secret' }, response: 'private-cloudflare-body' });
  f.write('failure.json', { error_code: 'pages_response_unsuccessful_asset_check_http_200_cf_10000', body: 'private-failure-body' });
  const summary = releaseSummary(f.environment);
  assert.equal(summary.backend, 'complete'); assert.equal(summary.client, 'asset_check_requested');
  const text = fs.readFileSync(path.join(f.directory, 'delivery-receipt.json'), 'utf8'), receipt = JSON.parse(text);
  assert.equal(receipt.backend.operation_id, 'f'.repeat(32)); assert.equal(receipt.backend.deployment_requested, true);
  assert.equal(receipt.client.marker, marker); assert.equal(receipt.artifacts.client.digest, digest);
  assert.equal(receipt.preflight.missing_assets, null); assert.equal(receipt.preflight.asset_check_performed, false);
  assert.equal(receipt.failure.error_code, 'pages_response_unsuccessful_asset_check_http_200_cf_10000');
  assert.equal(receipt.delivery.run_id, '70'); assert.equal(receipt.ci.run_id, '50');
  assert.equal(receipt.automatic_retry_allowed, false);
  assert.doesNotMatch(text + fs.readFileSync(f.environment.GITHUB_STEP_SUMMARY, 'utf8'), /private-|Authorization|"headers"|jwt|"response"/);
});

test('malformed evidence and malicious values cannot prevent or contaminate the remaining sanitized receipt', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.directory, 'release-plan.json'), '{broken');
  f.write('backend-state.json', { status: 'complete', source_sha: f.environment.CI_SOURCE_SHA,
    operation_id: 'd'.repeat(32), error_code: 'private_secret_in_lowercase', marker: 'private-marker',
    deployment_id: 'private-deployment-id', automatic_retry_allowed: true });
  f.write('failure.json', { error_code: 'private token https://remote.invalid/secret\ntrace' });
  const receipt = deliveryReceipt(f.directory, f.environment);
  assert.deepEqual(receipt.unavailable_sources, ['release-plan.json']);
  assert.equal(receipt.source_sha, f.environment.CI_SOURCE_SHA); assert.equal(receipt.backend.operation_id, 'd'.repeat(32));
  assert.equal(receipt.backend.error_code, 'cd_failed_inspect_private_state');
  assert.equal(receipt.failure.error_code, 'cd_failed_inspect_private_state');
  assert.equal(receipt.backend.automatic_retry_allowed, false);
  assert.doesNotMatch(JSON.stringify(receipt), /private_secret|private token|remote\.invalid|private-marker|private-deployment-id|trace/);
});
