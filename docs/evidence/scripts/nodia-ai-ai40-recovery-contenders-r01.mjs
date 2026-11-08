/** Operator-only contenders. This process never owns the original chat; login_start must fail before native authentication.
 * OCR uses real read-only fixture repositories; second-chat lease callbacks are explicit fixture seams.
 * Invoke once per case in a separate Node process while the owner MCP callback waits.
 */
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { readFile, open, lstat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = '/opt/nodia/releases/nodia-server-ai40-r07';
const MANIFEST = '1799e821e6c2f668989a972fde26b162772e02e821ce9744fbe431894dfce476';
const PROFILE = '/var/lib/nodia/codex';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);

export function validateContenderInput(value) {
  const keys = ['schema_version', 'release_root', 'case', 'selection', 'provider', 'owner_identity'];
  const extra = value?.case === 'login_start' ? ['provided_fixture', 'login_request_id'] : value?.provided_fixture !== undefined ? ['provided_fixture'] : [];
  assert.ok(exact(value, [...keys, ...extra]));
  assert.equal(value.schema_version, 1); assert.equal(value.release_root, ROOT);
  assert.ok(['chat', 'discovery', 'ocr', 'logout', 'login_start'].includes(value.case));
  assert.ok(exact(value.selection, ['connection_id', 'mode', 'model_id', 'effort_id']));
  assert.equal(value.selection.connection_id, '1'); assert.equal(value.selection.mode, 'token_plan_agentic');
  assert.ok(typeof value.selection.model_id === 'string' && value.selection.model_id.trim() && Buffer.byteLength(value.selection.model_id) <= 128);
  assert.ok(value.selection.effort_id === null || typeof value.selection.effort_id === 'string' && /^[a-z][a-z0-9_-]{0,31}$/u.test(value.selection.effort_id));
  assert.ok(exact(value.provider, ['is_active', 'catalog_active', 'use_token_plan_agentic', 'can_use_token_plan_agentic', 'updated_at', 'agentic_fields']));
  for (const key of ['is_active', 'catalog_active', 'use_token_plan_agentic', 'can_use_token_plan_agentic']) assert.equal(value.provider[key], true);
  assert.ok(typeof value.provider.updated_at === 'string' && Number.isFinite(Date.parse(value.provider.updated_at)));
  assert.ok(value.provider.agentic_fields !== null && typeof value.provider.agentic_fields === 'object' && !Array.isArray(value.provider.agentic_fields));
  assert.ok(Buffer.byteLength(JSON.stringify(value.provider.agentic_fields)) <= 65536);
  const i = value.owner_identity;
  assert.ok(exact(i, ['engine', 'attemptId', 'resourceKey', 'sessionGeneration', 'operationRef', 'adapterIdentity']));
  assert.equal(i.engine, 'agentic'); assert.ok(uuid(i.attemptId)); assert.equal(i.operationRef, i.attemptId);
  assert.match(i.resourceKey, /^codex-profile:[a-f0-9]{64}$/u); assert.match(i.sessionGeneration, /^[a-f0-9]{32}$/u);
  assert.ok(exact(i.adapterIdentity, ['providerKey', 'contractVersion', 'connectionId']));
  assert.equal(i.adapterIdentity.providerKey, 'openai'); assert.equal(i.adapterIdentity.contractVersion, 'nodia-ai-codex-chat/1');
  assert.equal(i.adapterIdentity.connectionId, value.selection.connection_id);
  if (value.case === 'login_start') { assert.ok(uuid(value.login_request_id)); assert.notEqual(value.login_request_id, i.attemptId); }
  if (['ocr', 'logout', 'login_start'].includes(value.case) || value.provided_fixture !== undefined) {
    const f = value.provided_fixture;
    assert.ok(exact(f, ['schema_version', 'container_name', 'options', 'identities'])); assert.equal(f.schema_version, 1);
    assert.match(f.container_name, /^template_ai40_[1-9]\d*_[a-f0-9]{8}$/u);
    const o = f.options;
    assert.ok(exact(o, ['type', 'host', 'port', 'username', 'password', 'database', 'synchronize', 'entities', 'migrations']));
    assert.equal(o.type, 'postgres'); assert.equal(o.host, '127.0.0.1'); assert.equal(o.username, 'ai40'); assert.equal(o.database, 'ai40');
    assert.ok(Number.isSafeInteger(o.port) && o.port > 1024 && o.port <= 65535 && o.port !== 5432);
    assert.match(o.password, /^[a-f0-9]{40}$/u); assert.equal(o.synchronize, false);
    assert.deepEqual(o.entities, [ROOT + '/dist/**/*.entity.js']); assert.deepEqual(o.migrations, [ROOT + '/dist/migrations/*.js']);
    assert.ok(Array.isArray(f.identities) && f.identities.length === 3);
    for (const [index, identity] of f.identities.entries()) {
      assert.ok(exact(identity, ['userId', 'sessionId'])); assert.equal(identity.userId, String(index + 1)); assert.ok(uuid(identity.sessionId));
    }
  }
  return value;
}

async function privateBytes(path, max) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    assert.ok(info.isFile() && info.nlink === 1 && info.uid === process.getuid() && (info.mode & 0o777) === 0o600 && info.size <= max);
    const bytes = await handle.readFile(); assert.equal(bytes.length, info.size);
    return { bytes, inode: info.ino };
  } finally { await handle.close(); }
}

export async function runRecoveryContender(raw) {
  const input = validateContenderInput(raw);
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 10000);
  assert.equal(process.env.NODIA_CODEX_ENABLED, 'true'); assert.equal(process.env.NODIA_CODEX_PROFILE_ROOT, PROFILE);
  const manifestBytes = await readFile(ROOT + '/release-manifest.json'); assert.equal(sha(manifestBytes), MANIFEST);
  const manifest = JSON.parse(manifestBytes);
  const boundaries = ['common/ai/codex/codex-runtime.service', 'common/ai/codex/codex-chat-runtime', 'common/ai/codex/codex-chat-journal',
    'common/ai/codex/codex-login-journal', 'common/ai/codex/codex-process-ownership', 'ai-provider/use-case/execute-codex-invoice.use-case',
    'nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ai-provider/ai-provider.service', 'ai-provider/entities/ai-provider.entity',
    'translation/translation.service', 'translation/entities/translation.entity', 'invoice/invoice-file-validation',
    'ai-provider/use-case/manage-codex-session.use-case', 'common/ai/codex/codex-login-control', 'common/ai/codex/codex-login-supervisor'];
  for (const name of boundaries) assert.equal(sha(await readFile(ROOT + '/dist/' + name + '.js')), manifest.files['dist/' + name + '.js']);
  const load = name => import(pathToFileURL(ROOT + '/dist/' + name + '.js'));
  const { Logger } = createRequire(ROOT + '/package.json')('@nestjs/common'); Logger.overrideLogger(false);
  const [{ CodexRuntimeService }, { CodexChatRuntime }, { CodexChatJournal }, { sameCodexProcess, assertCodexGroupEmpty }, { ValidateNodiaAiRuntimePolicyUseCase: Validate }] = await Promise.all([
    load(boundaries[0]), load(boundaries[1]), load(boundaries[2]), load(boundaries[4]), load(boundaries[6]),
  ]);
  const journal = new CodexChatJournal();
  const ownerPath = PROFILE + '/chat-jobs/' + input.owner_identity.attemptId + '.json';
  const lockPath = PROFILE + '/1/nodia.lock';
  async function witness() {
    const owner = await privateBytes(ownerPath, 4096), lock = await privateBytes(lockPath, 4096);
    const session = await privateBytes(PROFILE + '/1/nodia-chat-session', 32);
    assert.equal(session.bytes.toString(), input.owner_identity.sessionGeneration);
    const record = journal.decode(JSON.parse(owner.bytes));
    assert.deepEqual(record.identity, input.owner_identity);
    assert.equal(record.state, 'submitted'); assert.equal(record.acknowledged, false); assert.ok(record.native);
    assert.notEqual(record.owner.pid, process.pid); assert.equal(record.native.group, record.native.pid);
    assert.equal(await sameCodexProcess(record.owner), true); assert.equal(await sameCodexProcess(record.native), true);
    const certificate = JSON.parse(lock.bytes);
    assert.equal(certificate.serverPid, record.owner.pid); assert.equal(certificate.serverBirth, record.owner.birth); assert.equal(certificate.serverBoot, record.owner.boot);
    assert.equal(certificate.runtimePid, record.native.pid); assert.equal(certificate.runtimeBirth, record.native.birth); assert.equal(certificate.runtimeBoot, record.native.boot);
    const proofs = {};
    for (const name of ['nodia-chat-mcp', 'nodia-chat-mcp-image-png', 'nodia-chat-mcp-image-jpeg', 'nodia-chat-mcp-image-webp']) {
      try { proofs[name] = sha((await privateBytes(PROFILE + '/1/' + name, 4096)).bytes); }
      catch (error) { if (error.code === 'ENOENT') proofs[name] = null; else throw error; }
    }
    return { session_generation_sha256: sha(session.bytes), owner_record_sha256: sha(owner.bytes), lock_sha256: sha(lock.bytes), lock_inode: lock.inode,
      owner: record.owner, native: record.native, owner_state: record.state, owner_rpc_count: record.rpcCount, proofs };
  }
  const before = await witness();
  const runtime = new CodexRuntimeService();
  let error = null, fixtureDB = null, secondAttempt = null, prepared = 0, checks = 0, protocol = 0, callbacks = 0;
  let providers = null, loginResult = null, loginIdentity = null;
  async function realProviders() {
    const [{ AiProviderService }, { AiProvider }, { TranslationService }, { Translation }] = await Promise.all([
      load('ai-provider/ai-provider.service'), load('ai-provider/entities/ai-provider.entity'), load('translation/translation.service'), load('translation/entities/translation.entity'),
    ]);
    const { DataSource } = createRequire(ROOT + '/package.json')('typeorm');
    fixtureDB = new DataSource({ ...input.provided_fixture.options, migrationsRun: false, installExtensions: false, logging: false,
      extra: { max: 1, connectionTimeoutMillis: 5000, statement_timeout: 5000, options: '-c default_transaction_read_only=on' } });
    await fixtureDB.initialize();
    const [mode] = await fixtureDB.query('SHOW transaction_read_only'); assert.equal(mode.transaction_read_only, 'on');
    const result = new AiProviderService(fixtureDB.getRepository(AiProvider), undefined, undefined, undefined, new TranslationService(fixtureDB.getRepository(Translation)));
    const mirrored = await result.findProviderById(input.selection.connection_id);
    assert.equal(mirrored.catalog.key, 'openai'); assert.equal(mirrored.is_active, true);
    assert.deepEqual(mirrored.fields.token_plan_agentic, input.provider.agentic_fields);
    return result;
  }
  try {
    if (['ocr', 'logout', 'login_start'].includes(input.case)) providers = await realProviders();
    if (input.case === 'chat') {
      const asset = ROOT + '/dist/nodia-ai-runtime/config/runtime-policy.json';
      const bytes = await readFile(asset); assert.equal(sha(bytes), manifest.files['dist/nodia-ai-runtime/config/runtime-policy.json']);
      const policy = new Validate().execute(JSON.parse(bytes));
      const chat = new CodexChatRuntime(runtime, journal); secondAttempt = randomUUID();
      const identity = { ...input.owner_identity, attemptId: secondAttempt, operationRef: secondAttempt };
      await chat.execute({ identity, modelId: input.selection.model_id, ...(input.selection.effort_id ? { effort: input.selection.effort_id } : {}),
        prompt: 'Authorized exclusion fixture. No operation or tool is requested.', tools: [], deadlineAt: new Date(Date.now() + 15000), signal: AbortSignal.timeout(15000),
        limits: { requests: policy.budget.mcp_rpc_messages_per_run, toolCalls: policy.budget.tool_calls_per_run, argumentUtf8Bytes: policy.results.tool_arguments_utf8_bytes,
          resultUtf8Bytes: policy.results.tool_result_utf8_bytes, jsonDepth: policy.results.json_depth, collectionItems: policy.results.json_collection_items } },
      { onPrepared: async value => { assert.deepEqual(value, identity); prepared++; }, assertLease: async signal => { signal.throwIfAborted(); checks++; },
        onProtocolProgress: async () => { protocol++; throw Error('Unexpected contender protocol'); }, onToolCall: async () => { callbacks++; throw Error('Unexpected contender tool'); } });
    } else if (input.case === 'discovery') {
      await runtime.listModels(input.selection.connection_id, AbortSignal.timeout(15000));
    } else if (input.case === 'ocr') {
      const { ExecuteCodexInvoiceUseCase } = await load(boundaries[5]);
      // Valid synthetic PNG signature; acquisition fails before OCR decoding or SDK.
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await new ExecuteCodexInvoiceUseCase(providers, runtime).execute(input.selection.connection_id, input.selection.model_id,
        { buffer, mimetype: 'image/png', originalname: 'synthetic-exclusion.png', size: buffer.length }, undefined, undefined,
        input.selection.effort_id ?? undefined, AbortSignal.timeout(15000));
    } else {
      const { ManageCodexSessionUseCase } = await load('ai-provider/use-case/manage-codex-session.use-case');
      const manage = new ManageCodexSessionUseCase(providers, runtime);
      if (input.case === 'logout') await manage.logout(input.selection.connection_id);
      else {
        const requestId = input.login_request_id, actorId = input.provided_fixture.identities[2].userId;
        const expiresAt = new Date(Date.now() + 15000).toISOString();
        loginIdentity = { provider_id: input.selection.connection_id, actor_id: actorId, request_id: requestId, expires_at: expiresAt };
        // Normal start/control/supervisor path. The owner's pending journal must
        // reject acquisition before rotateChatGeneration or account/login/start.
        const job = await manage.start(input.selection.connection_id, actorId, requestId, expiresAt);
        assert.equal(job.id, requestId); assert.equal(job.state, 'failed'); assert.equal(job.reason, 'codex_login_failed');
        assert.equal(job.userCode, null); assert.equal(job.verificationUrl, null);
        const { CodexLoginJournal } = await load('common/ai/codex/codex-login-journal');
        const logins = new CodexLoginJournal();
        const record = await logins.read(requestId); assert.ok(record); assert.ok(record.owner);
        assert.equal(record.providerId, input.selection.connection_id); assert.equal(record.actorId, actorId);
        assert.equal(record.state, 'failed'); assert.equal(record.native, null); assert.equal(record.expiresAt, expiresAt);
        assert.equal(record.acknowledged, false);
        const paths = await logins.paths(requestId), deadline = Math.min(Date.parse(expiresAt), Date.now() + 5000);
        let socketAbsent = false, supervisorAbsent = false;
        do {
          supervisorAbsent = !(await sameCodexProcess(record.owner));
          try { await lstat(paths.socket); socketAbsent = false; } catch (failure) { if (failure.code === 'ENOENT') socketAbsent = true; else throw failure; }
          if (socketAbsent && supervisorAbsent) break;
          assert.ok(Date.now() < deadline, 'Login supervisor closure was not proved'); await delay(25);
        } while (true);
        await assertCodexGroupEmpty(record.owner.group);
        assert.deepEqual(await manage.acknowledgeRequest(input.selection.connection_id, requestId, actorId), { acknowledged: true });
        const acknowledged = await logins.read(requestId);
        assert.equal(acknowledged.acknowledged, true); assert.equal(acknowledged.state, 'failed');
        assert.equal(acknowledged.native, null); assert.equal(acknowledged.expiresAt, expiresAt);
        loginResult = { ...loginIdentity, state: acknowledged.state, reason: job.reason, native: null, acknowledged: true,
          original_expiry_preserved: true, supervisor: record.owner, supervisor_process_absent: supervisorAbsent, supervisor_group_empty: true,
          socket_absent: socketAbsent, user_code_and_verification_url_null: true,
          auth_RPC_exclusion_basis: 'Pinned supervisor awaits rotateChatGeneration before account/login/start; the existing generation is byte-identical before/after and no native is recorded.' };
      }
    }
  } catch (failure) { if (loginIdentity) failure.contender_login_identity = loginIdentity; error = failure; }
  finally {
    // This separate runtime instance owns no original owner's profile.
    await runtime.onModuleDestroy();
    if (fixtureDB?.isInitialized) await fixtureDB.destroy();
  }
  if (input.case === 'login_start') { if (error) throw error; assert.ok(loginResult); }
  else { assert.ok(error); assert.equal(error.code, 'codex_profile_busy'); }
  if (input.case === 'chat') {
    assert.equal(error.outcome, 'not_dispatched'); assert.equal(prepared, 1); assert.equal(checks, 1);
    assert.equal(protocol, 0); assert.equal(callbacks, 0); assert.equal(await journal.read(secondAttempt), null);
  }
  const after = await witness(); assert.deepEqual(after, before);
  return { schema: 'nodia-ai-ai40-recovery-contender-v1', status: 'passed', case: input.case, release_manifest_sha256: MANIFEST,
    contender_pid: process.pid, error_code: input.case === 'login_start' ? loginResult.reason : error.code, outcome: input.case === 'chat' ? error.outcome : input.case === 'login_start' ? 'blocked_login_failed_closed' : 'acquisition_rejected',
    before, after, owner_unchanged: true, second_chat_attempt_absent: input.case === 'chat' ? true : null,
    shared_pending_journal_rejected_before_native_start: !['chat', 'login_start'].includes(input.case), physical_lock_witness_preserved: true,
    physical_O_EXCL_contention_exercised: false, new_chat_journal_reservation_rejected: input.case === 'chat',
    login_start_called: input.case === 'login_start', login_result: loginResult, account_or_credential_mutations: 0, business_writes: 0, provider_generations: 0,
    fixture_seams: { second_chat_lease_callbacks_have_no_SQL_claim: input.case === 'chat', OCR_provider_lookup_uses_real_repositories_in_readonly_disposable_DB: input.case === 'ocr',
      OCR_fixture_validates_signature_only_before_acquisition: input.case === 'ocr', logout_compiled_entrypoint: input.case === 'logout', blocked_login_compiled_entrypoint: input.case === 'login_start' },
    limits: ['Owner completion/ACK and cancellation are verified by the separate parent recovery harness.', 'No device login, account logout, credential change or session rotation is expected; the login_start case creates only its own bounded failed/ACKed technical login reservation.', 'Shared pending-journal admission rejects before the physical O_EXCL acquisition; O_EXCL itself is not exercised.', 'The second-chat reserve may prune already-expired acknowledged historical receipts under normal production policy.'] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let size = 0; const chunks = [];
    for await (const chunk of process.stdin) { size += chunk.length; assert.ok(size <= 1048576); chunks.push(chunk); }
    console.log(JSON.stringify(await runRecoveryContender(JSON.parse(Buffer.concat(chunks)))));
  } catch (error) {
    console.log(JSON.stringify({ schema: 'nodia-ai-ai40-recovery-contender-v1', status: 'failed',
      error_code: typeof error.code === 'string' && /^(codex_[a-z_]{1,80}|ERR_ASSERTION)$/u.test(error.code) ? error.code : null,
      error_class: /^[A-Za-z0-9_]{1,64}$/u.test(error.name ?? '') ? error.name : 'Error', private_details_emitted: false,
      retained_login_identity: error.contender_login_identity ?? null, automatic_login_retry_allowed: false }));
    process.exitCode = 1;
  }
}
