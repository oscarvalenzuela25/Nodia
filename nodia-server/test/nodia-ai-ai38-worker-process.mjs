// Actual compiled standalone worker; disposable PG/Redis and fixture-authenticated HTTP.
// No inline execution coordinator, configured database, provider, R2 or UI automation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

assert.equal(process.env.NODIA_AI38_WORKER_PROCESS_ONLY, 'disposable');
const output = process.env.NODIA_AI_LAB_REPORT_JSON;
assert.ok(output && path.isAbsolute(output) && !fs.existsSync(output));
assert.match(process.env.AI38_PACKAGE_MANIFEST_SHA256 ?? '', /^[a-f0-9]{64}$/u);
process.env.SECRET_SEED = randomBytes(32).toString('hex');
const work = path.dirname(output), sha = value => createHash('sha256').update(value).digest('hex');
const report = { stage: 'AI-38', scope: 'actual_compiled_standalone_worker_confirmed_finance_disposable_SQL_Redis',
  status: 'running', started_at_utc: new Date().toISOString(), checks: [],
  package_manifest_sha256: process.env.AI38_PACKAGE_MANIFEST_SHA256,
  configured_database_access: false, provider_generations: 0, storage_operations: 0,
  operational_services_touched: false, fixture_HTTP_actor: true, physical_UI_or_generative_acceptance: false,
  inline_claim_or_execution: false, child_entrypoint: 'dist/nodia-ai-worker.js',
  HTTP_requests: [], worker_network: null, own_child_stopped: false, disposable_cleanup_complete: false };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
const check = (name, value = true) => { assert.ok(value, name); report.checks.push(name); save(); };
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const redisName = 'template_ai38worker_redis_' + process.pid + '_' + randomBytes(4).toString('hex');
let fixture, observer, app, compiled, child, childExit, redisStarted = false, blockedApiCalls = 0;
const wait = async (read, accept, message, timeout = 60000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = await read(); if (accept(value)) return value;
    if (childExit) throw Error('Standalone worker exited before ' + message);
    await delay(100);
  }
  throw Error('Timed out waiting for ' + message);
};
const stopChild = async () => {
  if (!child) return;
  if (!childExit) {
    child.kill('SIGTERM');
    const until = Date.now() + 15000;
    while (!childExit && Date.now() < until) await delay(50);
    if (!childExit) { child.kill('SIGKILL'); await new Promise(resolve => child.once('exit', resolve)); report.worker_forced_kill = true; }
  }
  report.own_child_stopped = true; report.child_exit = childExit;
};
save();
try {
  fixture = await createNodiaAiIntegrationFixture('ai3803');
  const { db, options, identities } = fixture;
  // The returning HTTP composition needs the actual entity metadata as well as
  // the SQL observer connection; an entities:[] connection cannot back repositories.
  observer = await new DataSource({ ...options, migrations: [] }).initialize();
  docker('run', '-d', '--rm', '--pull=never', '--name', redisName, '-p', '127.0.0.1::6379', 'redis:7-alpine');
  redisStarted = true;
  const redisPort = Number(docker('port', redisName, '6379/tcp').split(':').at(-1));
  assert.ok(Number.isInteger(redisPort) && redisPort !== 6379);
  for (let index = 0; index < 40; index++) {
    try { assert.equal(docker('exec', redisName, 'redis-cli', 'ping'), 'PONG'); break; }
    catch (error) { if (index === 39) throw error; await delay(100); }
  }
  report.redis_image_id = JSON.parse(docker('inspect', redisName))[0].Image;
  const entries = [
    ['nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'],
    ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['finance-movement/finance-movement.module', 'FinanceMovementModule'],
    ['nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'],
    ['common/redis/redis.service', 'RedisService'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentStorage'],
    ['common/filters/all-exceptions.filter', 'AllExceptionsFilter'],
  ];
  const [Confirmation, Execution, Conversation, Finance, Prepare, Redis, Adapter, Storage, Filter] =
    await Promise.all(entries.map(([file, name]) => loadAi(file, name)));
  async function openApi(source) {
    compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options,
      dataSourceFactory: async () => source }), Confirmation, Execution, Conversation, Finance] })
      .overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] })
      .overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration', 'measureContext'].map(name => [name, async () => { blockedApiCalls++; throw Error('API fixture forbids provider'); }])))
      .overrideProvider(Storage).useValue(Object.fromEntries(['put', 'get', 'delete'].map(name => [name, async () => { blockedApiCalls++; throw Error('API fixture forbids R2'); }])))
      .compile();
    app = compiled.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new Filter());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalGuards({ canActivate(context) {
      const request = context.switchToHttp().getRequest(), identity = identities.get(request.headers['x-fixture-actor']);
      if (!identity) throw new UnauthorizedException();
      request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId }; return true;
    } });
    await app.listen(0, '127.0.0.1'); return await app.getUrl();
  }
  let base = await openApi(db);
  const http = async (route, body, expected = 200) => {
    const response = await fetch(base + '/api/v1' + route, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', 'x-fixture-actor': '1' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    report.HTTP_requests.push({ method: body === undefined ? 'GET' : 'POST', endpoint: route.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gu, ':uuid').replace(/\/\d+$/u, '/:id'), status: response.status });
    assert.equal(response.status, expected); save(); return await response.json();
  };
  let [financeModule] = await db.query("SELECT id::text FROM modules WHERE link='/finances-personal'");
  if (!financeModule) [financeModule] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/finances-personal','personal_finance' FROM modules WHERE key='nodia_ai' RETURNING id::text");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [financeModule.id]);
  const [category] = await db.query("INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Disposable worker food','ai38_worker_food') RETURNING id::text");
  const chat = randomUUID();
  await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,1,$2,$3,'Disposable standalone worker',clock_timestamp()+interval '90 days')", [chat, randomUUID(), 'a'.repeat(64)]);
  const name = 'AI38 standalone financial effect ' + randomBytes(8).toString('hex');
  const prepared = await db.transaction(manager => compiled.get(Prepare).execute(manager, identities.get('1'), {
    conversationId: chat, toolName: 'nodia_finance_movements_prepare_create',
    partial: { name, amount: '21000', category_id: category.id, type: 'expense', status: 'paid' },
  }));
  assert.equal(prepared.status, 'ready');
  const proposal = prepared.proposal;
  const challenge = await http(`/nodia-ai/proposals/${proposal.proposal_id}/confirmation-challenge`, { proposal_revision: proposal.revision, expected_hash: proposal.hash });
  const confirm = { client_request_id: randomUUID(), proposal_revision: proposal.revision,
    expected_hash: proposal.hash, confirmation_token: challenge.confirmation_token };
  const accepted = await http(`/nodia-ai/proposals/${proposal.proposal_id}/confirm`, confirm, 202);
  const execution = accepted.execution.execution_id;
  assert.equal(accepted.execution.state, 'queued');
  const [before] = await observer.query('SELECT count(*)::int n FROM finance_movements');
  check('HTTP confirmation admits exact queued execution without an inline financial effect', before.n === 0);
  await app.close(); app = undefined; compiled = undefined;
  report.fixture_API_closed_before_worker = true;
  const guard = path.join(work, 'private-worker-network.cjs'), counter = path.join(work, 'private-worker-network.json');
  fs.writeFileSync(guard, `const net=require('node:net'),fs=require('node:fs');
const counts={postgres_connections:0,redis_connections:0,blocked_sockets:0,fetch_attempts:0,listen_attempts:0};
const persist=()=>fs.writeFileSync(${JSON.stringify(counter)},JSON.stringify(counts),{mode:0o600});persist();
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...input){let args=input;if(Array.isArray(args[0]))args=args[0];const value=args[0];
const opts=value&&typeof value==='object'?value:{port:value,host:typeof args[1]==='string'?args[1]:'localhost'};
const port=Number(opts.port),host=opts.host??'localhost';
if(!['127.0.0.1','localhost','::1'].includes(host)||![${options.port},${redisPort}].includes(port)){counts.blocked_sockets++;persist();throw Error('AI38_FORBIDDEN_WORKER_SOCKET');}
counts[port===${options.port}?'postgres_connections':'redis_connections']++;persist();return connect.apply(this,input);};
net.Server.prototype.listen=function(){counts.listen_attempts++;persist();throw Error('AI38_WORKER_LISTENER_FORBIDDEN');};
globalThis.fetch=()=>{counts.fetch_attempts++;persist();throw Error('AI38_PROVIDER_FETCH_FORBIDDEN');};
process.on('exit',persist);
`, { flag: 'wx', mode: 0o600 });
  const entry = fileURLToPath(new URL('../dist/nodia-ai-worker.js', import.meta.url));
  report.worker_entrypoint_sha256 = sha(fs.readFileSync(entry)); report.network_guard_sha256 = sha(fs.readFileSync(guard));
  const stdout = fs.openSync(path.join(work, 'private-worker-stdout.log'), 'wx', 0o600);
  const stderr = fs.openSync(path.join(work, 'private-worker-stderr.log'), 'wx', 0o600);
  child = spawn(process.execPath, ['--require', guard, entry], { cwd: work, stdio: ['ignore', stdout, stderr],
    env: { PATH: process.env.PATH, HOME: process.env.HOME ?? '/root', NODE_ENV: 'test', RATE_LIMIT_STORAGE: 'memory',
      DOTENV_CONFIG_PATH: '/dev/null', NODIA_AI_OPERATION_MODE: 'normal',
      POSTGRES_HOST: options.host, POSTGRES_PORT: String(options.port), POSTGRES_DB: options.database,
      POSTGRES_USER: options.username, POSTGRES_PASSWORD: options.password, REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redisPort),
      SECRET_SEED: randomBytes(32).toString('hex'), GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:1' } });
  fs.closeSync(stdout); fs.closeSync(stderr);
  child.once('exit', (code, signal) => { childExit = { code, signal }; });
  child.once('error', () => { childExit = { code: null, signal: 'spawn_error' }; });
  report.worker_pid = child.pid; save();
  await wait(async () => (await observer.query('SELECT state FROM nodia_ai_executions WHERE id=$1', [execution]))[0], value => value.state === 'completed', 'standalone financial completion');
  const [joined] = await observer.query(`SELECT e.state,j.state job_state,s.state step_state,s.minimal_receipt,s.bound_command_hash,
    m.id::text movement_id,m.user_id::text,m.amount::text,m.name,m.category_id::text,m.type,m.status
    FROM nodia_ai_executions e JOIN nodia_ai_jobs j ON j.execution_id=e.id
    JOIN nodia_ai_execution_steps s ON s.execution_id=e.id
    JOIN finance_movements m ON m.id=(s.minimal_receipt->>'resource_id')::bigint WHERE e.id=$1`, [execution]);
  check('actual standalone worker commits financial effect and receipt with terminal job', joined.state === 'completed' && joined.job_state === 'done' && joined.step_state === 'completed');
  check('worker preserves exact approved financial fields', joined.amount === '21000' && joined.user_id === '1' && joined.category_id === category.id && joined.name === name && joined.type === 'expense' && joined.status === 'paid');
  check('receipt retains resource owner and immutable bound command', joined.minimal_receipt.schema_version === 1 && joined.minimal_receipt.resource_key === 'finance_movements' && joined.minimal_receipt.resource_id === joined.movement_id && joined.minimal_receipt.subject_user_id === '1' && /^[a-f0-9]{64}$/u.test(joined.bound_command_hash));
  await stopChild();
  check('standalone process drains after SIGTERM without forced kill', !report.worker_forced_kill && report.own_child_stopped && childExit.signal !== 'spawn_error');
  report.worker_network = JSON.parse(fs.readFileSync(counter, 'utf8'));
  check('real worker connected only to disposable PostgreSQL and Redis', report.worker_network.postgres_connections > 0 && report.worker_network.redis_connections > 0 && report.worker_network.blocked_sockets === 0 && report.worker_network.fetch_attempts === 0 && report.worker_network.listen_attempts === 0);
  base = await openApi(observer);
  const returned = await http(`/nodia-ai/operations/${execution}`);
  check('returning HTTP client observes saved execution and receipt', returned.execution_id === execution && returned.state === 'completed' && returned.steps[0].state === 'completed');
  const movement = await http(`/finance/movements/${joined.movement_id}`);
  check('returning client sees worker-created movement through actual finance endpoint', movement.id === joined.movement_id && movement.amount === '21000' && movement.name === name);
  const duplicate = await http(`/nodia-ai/proposals/${proposal.proposal_id}/confirm`, confirm, 202);
  check('repeated exact HTTP confirmation returns the same execution', duplicate.execution.execution_id === execution);
  const [final] = await observer.query(`SELECT (SELECT count(*)::int FROM finance_movements) effects,
    (SELECT count(*)::int FROM nodia_ai_execution_steps WHERE state='completed') receipts,
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`);
  report.disposable_final = final;
  check('one effect one receipt and no pending SQL identities remain', final.effects === 1 && final.receipts === 1 && final.pending_jobs === 0 && final.open_attempts === 0 && final.retained_slots === 0);
  check('fixture API never requested provider or storage', blockedApiCalls === 0);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure_class = error.constructor.name;
  if (error instanceof assert.AssertionError) report.failure_assertion = error.message.slice(0, 300);
  process.exitCode = 1;
} finally {
  await stopChild();
  if (app) await app.close(); else if (compiled) await compiled.close();
  if (observer?.isInitialized) await observer.destroy();
  await fixture?.close();
  if (redisStarted) {
    assert.match(redisName, /^template_ai38worker_redis_[0-9]+_[a-f0-9]{8}$/u);
    docker('rm', '-f', redisName); redisStarted = false;
  }
  report.disposable_cleanup_complete = true; report.finished_at_utc = new Date().toISOString(); save();
  console.log(JSON.stringify(report, null, 2));
}
