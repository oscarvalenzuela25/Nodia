import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deliveryEvent, publishDeliveryEvent, reportDelivery } from './cd-observability.mjs';
import { repository } from './cd-github.mjs';

const run = { runId: '42', runAttempt: '1', conclusion: 'failure' };
const receipt = {
  schema_version: 1, repository,
  source_sha: 'a'.repeat(40), ci: { run_id: '41', run_attempt: '2' },
  delivery: { run_id: run.runId, run_attempt: run.runAttempt },
};

test('a failed run without a confirmed component remains failure and free text is excluded', () => {
  const event = deliveryEvent({
    ...receipt,
    backend: { status: 'unknown', operation_id: 'private-backend-operation' },
    client: { status: 'private-client-status', body: 'private-body' },
    failure: { error_code: 'private-error', headers: { Authorization: 'private-token' } },
    unavailable_sources: ['private-filename'],
    automatic_retry_allowed: true,
  }, run);
  assert.equal(event.outcome, 'failed');
  assert.equal(event.phase, 'backend');
  assert.equal(event.backend_status, 'unknown');
  assert.equal(event.client_status, 'not_confirmed');
  assert.equal(event.error_code, 'cd_failed_inspect_private_state');
  assert.equal(event.delivery_run_url, `https://github.com/${repository}/actions/runs/42/attempts/1`);
  assert.equal(event.receipt_artifact, 'delivery-receipt-42-1');
  assert.equal(event.automatic_retry_allowed, false);
  assert.doesNotMatch(JSON.stringify(event), /private-|Authorization/);
});

test('partial delivery preserves the distinction between unconfirmed Pages and failed asset verification', () => {
  for (const [status, code] of [
    ['asset_check_requested', 'pages_response_unsuccessful_asset_check_http_200_cf_10000'],
    ['submitted', 'pages_status_deadline_requires_reconciliation'],
    ['published_assets_verification_failed', 'pwa_public_asset_digest_mismatch'],
  ]) {
    const event = deliveryEvent({
      ...receipt, backend: { status: 'complete' }, client: { status }, failure: { error_code: code },
    }, run);
    assert.equal(event.outcome, 'partial');
    assert.equal(event.phase, 'client');
    assert.equal(event.client_status, status);
    assert.equal(event.error_code, code);
  }

  const unchanged = deliveryEvent({
    ...receipt, backend: { status: 'already_current' }, client: { status: 'submitted' },
  }, run);
  assert.equal(unchanged.outcome, 'failed');
});

test('publishes successful CD only with both components confirmed and the exact first attempt', () => {
  const success = { ...receipt, backend: { status: 'content_unchanged' }, client: { status: 'not_required' } };
  assert.equal(deliveryEvent(success, { ...run, conclusion: 'success' }).outcome, 'succeeded');
  for (const context of [{ ...run, runId: '43' }, { ...run, runAttempt: '2' }, { ...run, conclusion: 'cancelled' }]) {
    assert.equal(deliveryEvent(success, context), null);
  }
  assert.equal(deliveryEvent({ ...success, repository: 'fork/Nodia' }, run), null);
  assert.equal(deliveryEvent(receipt, { ...run, conclusion: 'success' }), null);
});

test('the sender uses a single bounded Loki POST and treats responses and transport failures as telemetry status', async () => {
  const url = 'https://logs-prod-000.grafana.net/loki/api/v1/push';
  const event = deliveryEvent(receipt, run);
  let calls = 0;
  const fetchImpl = async (destination, options) => {
    calls += 1;
    assert.equal(destination, url);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('21:token-canary').toString('base64'));
    const { streams } = JSON.parse(options.body);
    assert.equal(streams.length, 1);
    assert.deepEqual(streams[0].stream, { service_name: 'nodia-cd', job: 'nodia-cd', environment: 'production' });
    const [[timestamp, line]] = streams[0].values;
    assert.match(timestamp, /^[0-9]{19}$/);
    assert.deepEqual(JSON.parse(line), event);
    assert.doesNotMatch(options.body, /token-canary/);
    return new Response(calls === 1 ? null : 'private response', { status: calls === 1 ? 204 : 503 });
  };
  const config = { url, user: '21', token: 'token-canary', fetchImpl };
  assert.equal(await publishDeliveryEvent(event, config), 'sent');
  assert.equal(await publishDeliveryEvent(event, config), 'rejected');
  assert.equal(await publishDeliveryEvent(event, { ...config, url: `${url}?other=1` }), 'invalid_configuration');
  assert.equal(await publishDeliveryEvent(event, { ...config, url: 'https://logs-prod-x.grafana.net.example.invalid/loki/api/v1/push' }), 'invalid_configuration');
  assert.equal(await publishDeliveryEvent(event, { ...config, token: '' }), 'not_configured');
  assert.equal(calls, 2);
  assert.equal(await publishDeliveryEvent(event, { ...config, fetchImpl: async () => { throw Error('private token'); } }), 'unavailable');
});

test('missing artifact and malformed receipt leave publication outside the report step', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nodia-cd-observability-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'delivery-receipt.json');
  const environment = { NODIA_CD_RUN_ID: '42', NODIA_CD_RUN_ATTEMPT: '1', NODIA_CD_RUN_CONCLUSION: 'failure' };
  assert.equal(await reportDelivery(filename, environment), 'receipt_unavailable');
  fs.writeFileSync(filename, '{broken');
  assert.equal(await reportDelivery(filename, environment), 'receipt_unavailable');
  fs.writeFileSync(filename, JSON.stringify(receipt));
  assert.equal(await reportDelivery(filename, environment), 'not_configured');
});
