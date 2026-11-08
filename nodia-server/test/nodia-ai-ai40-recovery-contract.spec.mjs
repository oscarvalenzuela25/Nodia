// Operator boundary tests only: no SDK, provider, PostgreSQL, account or real profile.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRecoveryInput, safeRecoveryError, settledWithin, waitForNativeAbort, inspectRecoveryAck,
  RECOVERY_CONTENDER_CASES } from '../../docs/evidence/scripts/nodia-ai-ai40-recovery-sources-r01.mjs';

const input = () => ({ schema_version: 1, authorize_recovery_workflow: true, scenario: 'cancel', execution_mode: 'bootstrap',
  max_provider_dispatches: 1, blocked_login_request_id: randomUUID(), expected_binary_sha256: 'a'.repeat(64),
  selection: { connection_id: '1', mode: 'agentic', model_id: 'synthetic-discovered-model', effort_id: null },
  provider: { is_active: true, catalog_active: true, use_agentic: true, can_use_agentic: true,
    updated_at: '2026-10-23T00:00:00.000Z', agentic_fields: {} } });

test('only an explicit one-dispatch scenario with durable login identity enters the workflow', () => {
  const valid = input(); assert.equal(validateRecoveryInput(valid), valid);
  assert.deepEqual(RECOVERY_CONTENDER_CASES, ['chat', 'discovery', 'ocr', 'logout', 'login_start']);
  assert.throws(() => validateRecoveryInput({ ...valid, blocked_login_request_id: null }));
  assert.throws(() => validateRecoveryInput({ ...valid, scenario: 'revoke' }));
  assert.doesNotThrow(() => validateRecoveryInput({ ...valid, scenario: 'revoke', blocked_login_request_id: null }));
  assert.throws(() => validateRecoveryInput({ ...valid, max_provider_dispatches: 2 }));
  assert.throws(() => validateRecoveryInput({ ...valid, authorize_recovery_workflow: false }));
  assert.throws(() => validateRecoveryInput({ ...valid, execution_mode: 'retry' }));
  assert.throws(() => validateRecoveryInput({ ...valid, readiness_override: true }));
});

test('fixture must be the disposable PostgreSQL port with exact isolated entities and identities', () => {
  const supplied = { ...input(), provided_fixture: { schema_version: 1, container_name: 'template_ai40_123_abcdef12',
    options: { type: 'postgres', host: '127.0.0.1', port: 40001, username: 'ai40', password: 'a'.repeat(40), database: 'ai40',
      synchronize: false, entities: ['/opt/nodia/releases/nodia-server-ai40-r07/dist/**/*.entity.js'],
      migrations: ['/opt/nodia/releases/nodia-server-ai40-r07/dist/migrations/*.js'] },
    identities: ['1', '2', '3'].map(userId => ({ userId, sessionId: randomUUID() })) } };
  assert.doesNotThrow(() => validateRecoveryInput(supplied, true));
  for (const patch of [{ port: 5432 }, { host: 'db.example.invalid' }, { database: 'nodia' }, { synchronize: true },
    { entities: ['/arbitrary/entities.js'] }]) {
    assert.throws(() => validateRecoveryInput({ ...supplied, provided_fixture: { ...supplied.provided_fixture,
      options: { ...supplied.provided_fixture.options, ...patch } } }, true));
  }
});

test('error projection retains approved underscore codes and never returns arbitrary private text', () => {
  for (const code of ['codex_profile_busy', 'codex_cancelled', 'codex_result_unknown', 'runtime_busy', 'nodia_ai:capability_denied']) {
    assert.equal(safeRecoveryError(Object.assign(new Error('private detail'), { code })).code, code);
  }
  const privateError = new Error('token=private-example /tmp/private/profile');
  assert.deepEqual(safeRecoveryError(privateError), { name: 'Error', code: null });
  assert.equal(JSON.stringify(safeRecoveryError(privateError)).includes('private-example'), false);
  assert.equal(safeRecoveryError(Object.assign(new Error(), { code: 'unknown_secrets_example' })).code, null);
});

test('settlement and native abort retain original rejection without retrying operation', async () => {
  let calls = 0; const failure = new Error('synthetic original rejection');
  const original = (async () => { calls++; throw failure; })();
  assert.equal((await settledWithin(original, 100)).error, failure); assert.equal(calls, 1);
  const controller = new AbortController(); const pending = waitForNativeAbort(controller.signal, 100);
  controller.abort(failure); assert.equal(await pending, true);
  assert.equal(await waitForNativeAbort(controller.signal, 100), true);
  await assert.rejects(settledWithin(new Promise(() => {}), 5), /operator_settlement_timeout/u);
  await assert.rejects(waitForNativeAbort(new AbortController().signal, 5), /operator_native_signal_missing/u);
});

test('native ACK requires exact scope, prior ACK, one callback and exact physical group closure', async () => {
  const request = { engine: 'agentic', attemptId: randomUUID(), operationRef: '', resourceKey: 'codex-profile:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32), adapterIdentity: { providerKey: 'openai', contractVersion: 'nodia-ai-codex-chat/1', connectionId: '1' } };
  request.operationRef = request.attemptId;
  const group = { synthetic: true }, native = { group };
  const record = { identity: request, state: 'abandoned_unknown', acknowledged: true, native,
    terminalProofId: randomUUID(), cancelRequested: true, rpcCount: 1, unforwardedRequests: 0, frames: 1, bytes: 1 };
  let live = false, groupClosed = false;
  const args = { journal: { read: async () => record }, request, profileRoot: join(tmpdir(), 'absent-ai40-' + randomUUID()),
    sameProcess: async seen => { assert.equal(seen, native); return live; },
    assertGroupEmpty: async seen => { assert.equal(seen, group); groupClosed = true; } };
  const receipt = await inspectRecoveryAck(args);
  assert.equal(groupClosed, true); assert.equal(receipt.exact_native_ack_settled, true);
  assert.equal(receipt.owned_native_process_group_empty, true); assert.equal(receipt.image_staging_entries, 0);
  record.acknowledged = false; await assert.rejects(inspectRecoveryAck(args)); record.acknowledged = true;
  record.rpcCount = 2; await assert.rejects(inspectRecoveryAck(args)); record.rpcCount = 1;
  live = true; await assert.rejects(inspectRecoveryAck(args)); live = false;
  await assert.rejects(inspectRecoveryAck({ ...args, request: { ...request, sessionGeneration: 'c'.repeat(32) } }));
});
