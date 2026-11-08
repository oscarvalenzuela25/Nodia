// Operator-only recovery helpers. No account/runtime/DB is constructed by this module.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const RECOVERY_RELEASE = '/opt/nodia/releases/nodia-server-ai40-r07';
export const RECOVERY_RELEASE_SHA = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476';
export const RECOVERY_REQUEST = 'Prueba técnica autorizada de recuperación. Llama exactamente una vez a nodia_knowledge_index con {} y espera su resultado antes de responder. No solicites ninguna otra herramienta ni modificación de negocio.';
export const RECOVERY_CONTENDER_CASES = Object.freeze(['chat', 'discovery', 'ocr', 'logout', 'login_start']);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const exactObject = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');

export function validateRecoveryInput(config, withFixture = false) {
  const keys = ['schema_version', 'authorize_recovery_workflow', 'scenario', 'execution_mode',
    'max_provider_dispatches', 'blocked_login_request_id', 'selection', 'provider', 'expected_binary_sha256'];
  if (withFixture) keys.push('provided_fixture');
  assert.ok(exactObject(config, keys));
  assert.equal(config.schema_version, 1); assert.equal(config.authorize_recovery_workflow, true);
  assert.ok(['cancel', 'revoke'].includes(config.scenario));
  assert.ok(['bootstrap', 'live'].includes(config.execution_mode));
  assert.equal(config.max_provider_dispatches, 1);
  if (config.scenario === 'cancel') assert.match(config.blocked_login_request_id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
  else assert.equal(config.blocked_login_request_id, null);
  assert.match(config.expected_binary_sha256, /^[a-f0-9]{64}$/u);
  const selection = config.selection;
  assert.ok(exactObject(selection, ['connection_id', 'mode', 'model_id', 'effort_id']));
  assert.equal(selection.connection_id, '1'); assert.equal(selection.mode, 'token_plan_agentic');
  assert.ok(typeof selection.model_id === 'string' && selection.model_id.trim() && Buffer.byteLength(selection.model_id) <= 128);
  assert.ok(selection.effort_id === null || typeof selection.effort_id === 'string' && /^[a-z][a-z0-9_-]{0,31}$/u.test(selection.effort_id));
  assert.ok(exactObject(config.provider, ['is_active', 'catalog_active', 'use_token_plan_agentic',
    'can_use_token_plan_agentic', 'updated_at', 'agentic_fields']));
  for (const key of ['is_active', 'catalog_active', 'use_token_plan_agentic', 'can_use_token_plan_agentic']) assert.equal(config.provider[key], true);
  assert.ok(typeof config.provider.updated_at === 'string' && Number.isFinite(Date.parse(config.provider.updated_at)));
  assert.ok(config.provider.agentic_fields && typeof config.provider.agentic_fields === 'object' && !Array.isArray(config.provider.agentic_fields));
  assert.ok(Buffer.byteLength(JSON.stringify(config.provider.agentic_fields)) <= 65536);
  if (withFixture) {
    const supplied = config.provided_fixture;
    assert.ok(exactObject(supplied, ['schema_version', 'container_name', 'options', 'identities']));
    assert.equal(supplied.schema_version, 1); assert.match(supplied.container_name, /^template_ai40_[1-9]\d*_[a-f0-9]{8}$/u);
    const options = supplied.options;
    assert.ok(exactObject(options, ['type', 'host', 'port', 'username', 'password', 'database', 'synchronize', 'entities', 'migrations']));
    assert.equal(options.type, 'postgres'); assert.equal(options.host, '127.0.0.1');
    assert.equal(options.username, 'ai40'); assert.equal(options.database, 'ai40'); assert.equal(options.synchronize, false);
    assert.ok(Number.isSafeInteger(options.port) && options.port > 1024 && options.port <= 65535 && options.port !== 5432);
    assert.match(options.password, /^[a-f0-9]{40}$/u);
    assert.deepEqual(options.entities, [RECOVERY_RELEASE + '/dist/**/*.entity.js']);
    assert.deepEqual(options.migrations, [RECOVERY_RELEASE + '/dist/migrations/*.js']);
    assert.ok(Array.isArray(supplied.identities) && supplied.identities.length === 3);
    supplied.identities.forEach((actor, index) => {
      assert.ok(exactObject(actor, ['userId', 'sessionId'])); assert.equal(actor.userId, String(index + 1));
      assert.match(actor.sessionId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    });
  }
  return config;
}

export function safeRecoveryError(error) {
  const response = typeof error?.getResponse === 'function' ? error.getResponse() : null;
  const candidate = typeof error?.code === 'string' ? error.code : typeof response?.message === 'string' ? response.message : error?.message;
  return { name: ['AssertionError', 'Error', 'NodiaAiAdapterError', 'NodiaAiLostLeaseError', 'QueryFailedError',
    'ForbiddenException', 'UnauthorizedException', 'TypeError', 'SyntaxError', 'ReferenceError'].includes(error?.name) ? error.name : 'unclassified',
  code: typeof candidate === 'string' && (/^(?:nodia_ai|codex|auth):[a-z0-9_:]{1,95}$/u.test(candidate) ||
    ['codex_profile_busy', 'codex_login_unknown', 'codex_result_unknown', 'codex_timeout', 'codex_cancelled', 'runtime_busy', 'runtime_unavailable',
      'result_unknown', 'cancelled', 'operator_settlement_timeout', 'operator_native_signal_missing'].includes(candidate)) ? candidate : null };
}

export async function settledWithin(operation, milliseconds) {
  let timer;
  try {
    return await Promise.race([Promise.resolve(operation).then(value => ({ value }), error => ({ error })),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('operator_settlement_timeout')), milliseconds); })]);
  } finally { clearTimeout(timer); }
}

export async function waitForNativeAbort(signal, milliseconds) {
  if (signal.aborted) return true;
  let timer, abort;
  try {
    return await new Promise((resolve, reject) => {
      abort = () => resolve(true);
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => reject(new Error('operator_native_signal_missing')), milliseconds);
      if (signal.aborted) abort();
    });
  } finally { clearTimeout(timer); if (abort) signal.removeEventListener('abort', abort); }
}

/** Uses the captured identity after SQL cleanup; never reads a deleted finalJob.kind. */
export async function inspectRecoveryAck({ journal, request, profileRoot, sameProcess, assertGroupEmpty }) {
  const record = await journal.read(request.attemptId);
  assert.ok(record); assert.deepEqual(record.identity, request);
  assert.equal(record.state, 'abandoned_unknown'); assert.equal(record.acknowledged, true);
  assert.ok(record.terminalProofId && record.native);
  assert.equal(record.unforwardedRequests, 0); assert.equal(record.rpcCount, 1);
  assert.equal(await sameProcess(record.native), false); await assertGroupEmpty(record.native.group);
  const staging = {};
  for (const name of ['nodia-chat-images', 'nodia-chat-audio']) {
    const root = join(profileRoot, request.adapterIdentity.connectionId, name);
    let entries = [];
    try {
      const info = await lstat(root);
      assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o077) === 0);
      entries = await readdir(root);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    assert.equal(entries.length, 0);
    staging[name] = { entries: 0, exact_attempt_directory_absent: true };
  }
  return { attempt_id: request.attemptId, terminal_proof_id: record.terminalProofId,
    outcome: record.state, journal_state: record.state, process_closed: true, exact_native_ack_settled: true, journal_acknowledged: true, cancel_requested: record.cancelRequested,
    exact_native_process_absent: true, owned_native_process_group_empty: true, image_staging_entries: 0, staging,
    rpc_count: record.rpcCount, unforwarded_requests: record.unforwardedRequests,
    frames: record.frames, bytes: record.bytes, decoded_journal_sha256: sha256(JSON.stringify(record)) };
}
