import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSha, numeric, repository } from './cd-github.mjs';
import { receiptError, receiptStatus } from './delivery-receipt.mjs';

const confirmed = new Set(['complete', 'already_current', 'not_required']);

export function deliveryEvent(receipt, { runId, runAttempt, conclusion }) {
  if (receipt?.schema_version !== 1 || receipt.repository !== repository ||
    !numeric(runId) || runAttempt !== '1' || receipt.delivery?.run_id !== runId ||
    receipt.delivery.run_attempt !== runAttempt || !['success', 'failure'].includes(conclusion)) return null;

  const backend = receiptStatus(receipt.backend?.status);
  const client = receiptStatus(receipt.client?.status);
  const preflight = receiptStatus(receipt.preflight?.status);
  const backendConfirmed = confirmed.has(backend) || backend === 'content_unchanged';
  const clientConfirmed = confirmed.has(client);
  if (conclusion === 'success' && (!backendConfirmed || !clientConfirmed || receipt.failure)) return null;

  let outcome = 'succeeded';
  let phase = 'complete';
  if (conclusion === 'failure') {
    outcome = backend === 'complete' && !clientConfirmed ? 'partial' : 'failed';
    phase = 'workflow';
    if (backendConfirmed && !clientConfirmed) phase = 'client';
    else if (backend !== 'not_confirmed' && !backendConfirmed) phase = 'backend';
    else if (!backendConfirmed && preflight !== 'not_confirmed') {
      phase = ['preflight_verified', 'not_required'].includes(preflight) ? 'backend' : 'preflight';
    }
  }

  return {
    schema_version: 1,
    event: 'cd_delivery',
    outcome,
    phase,
    backend_status: backend,
    client_status: client,
    preflight_status: preflight,
    error_code: conclusion === 'failure'
      ? receiptError(receipt.failure?.error_code ?? receipt[phase]?.error_code) : null,
    source_sha: isSha(receipt.source_sha) ? receipt.source_sha : null,
    ci_run_id: numeric(receipt.ci?.run_id) ? receipt.ci.run_id : null,
    ci_run_attempt: numeric(receipt.ci?.run_attempt) ? receipt.ci.run_attempt : null,
    delivery_run_id: runId,
    delivery_run_attempt: runAttempt,
    delivery_run_url: `https://github.com/${repository}/actions/runs/${runId}/attempts/${runAttempt}`,
    receipt_artifact: `delivery-receipt-${runId}-${runAttempt}`,
    automatic_retry_allowed: false,
  };
}

export async function publishDeliveryEvent(event, { url, user, token, environment = 'production', fetchImpl = fetch }) {
  if (!url || !user || !token) return 'not_configured';
  if (!/^https:\/\/logs-prod-[a-z0-9-]+\.grafana\.net\/loki\/api\/v1\/push$/.test(url) ||
    !numeric(user) || !/^[\x21-\x7e]{1,4096}$/.test(token) || !['production', 'test'].includes(environment)) {
    return 'invalid_configuration';
  }

  try {
    const timestamp = String(BigInt(Date.now()) * 1_000_000n);
    const body = JSON.stringify({ streams: [{
      stream: { service_name: 'nodia-cd', job: 'nodia-cd', environment },
      values: [[timestamp, JSON.stringify(event)]],
    }] });
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`,
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
    await response.body?.cancel();
    return response.status === 204 ? 'sent' : 'rejected';
  } catch {
    return 'unavailable';
  }
}

export async function reportDelivery(receiptPath, environment = process.env) {
  let receipt;
  try {
    const info = fs.lstatSync(receiptPath);
    if (!info.isFile() || info.size > 64 * 1024) return 'invalid_receipt';
    receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  } catch {
    return 'receipt_unavailable';
  }

  const event = deliveryEvent(receipt, {
    runId: environment.NODIA_CD_RUN_ID,
    runAttempt: environment.NODIA_CD_RUN_ATTEMPT,
    conclusion: environment.NODIA_CD_RUN_CONCLUSION,
  });
  if (!event) return 'invalid_receipt';
  return publishDeliveryEvent(event, {
    url: environment.NODIA_CD_LOKI_URL,
    user: environment.NODIA_CD_LOKI_USER,
    token: environment.NODIA_CD_LOKI_TOKEN,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const status = await reportDelivery(process.argv[2]);
  console.log(`Nodia CD telemetry: ${status}`);
}
