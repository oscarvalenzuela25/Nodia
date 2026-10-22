// Real main.js with fresh production dependencies; synthetic sessions, never Google login.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const config = JSON.parse(fs.readFileSync(0, 'utf8'));
assert.equal(config.project, '/opt/nodia/verification/ai38-dependencies-r01/nodia-server');
assert.match(config.work, /^\/opt\/nodia\/verification\/ai38-fresh-api-process-r0[1-9]$/u);
const project = config.project, work = config.work;
assert.ok(fs.statSync(project + '/node_modules').isDirectory() && !fs.lstatSync(project + '/node_modules').isSymbolicLink());
assert.ok(!fs.existsSync(project + '/.env'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { stage: 'AI-38', scope: 'real_main_entrypoint_fresh_production_dependencies_disposable_PostgreSQL_Redis',
  status: 'running', started_at_utc: new Date().toISOString(), checks: [], HTTP_requests: [],
  candidate_manifest_sha256: config.candidate_manifest_sha256, harness_sha256: sha(fs.readFileSync(process.argv[1])),
  entrypoint: 'dist/main.js', entrypoint_sha256: sha(fs.readFileSync(project + '/dist/main.js')),
  NODE_ENV: 'production', fresh_production_dependencies: true, configured_database_used: false,
  provider_requests: 0, storage_operations: 0, operational_services_modified: false, adopted: false,
  full_Google_login_tested: false, password_login_exists: false, fixture_issued_sessions: true,
  Nest_testing_used: false, service_overrides: false, own_API_stopped: false };
const save = () => fs.writeFileSync(work + '/public-native-report.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
const check = (name, value = true) => { assert.ok(value, name); report.checks.push(name); save(); };
const require = createRequire(project + '/package.json');
const net = require('node:net');
const parentNetwork = { postgres_connections: 0, API_connections: 0, blocked_sockets: 0, fetch_requests: 0, blocked_fetch: 0, listen_attempts: 0 };
const connect = net.Socket.prototype.connect, originalFetch = globalThis.fetch;
net.Socket.prototype.connect = function (...input) {
  let args = input; if (Array.isArray(args[0])) args = args[0];
  const value = args[0], opts = value && typeof value === 'object' ? value : { port: value, host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  const port = Number(opts.port), host = opts.host ?? 'localhost';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || ![config.pg_port, config.api_port].includes(port)) {
    parentNetwork.blocked_sockets++; throw Error('AI38_PARENT_SOCKET_FORBIDDEN');
  }
  parentNetwork[port === config.pg_port ? 'postgres_connections' : 'API_connections']++;
  return connect.apply(this, input);
};
net.Server.prototype.listen = function () { parentNetwork.listen_attempts++; throw Error('AI38_PARENT_LISTENER_FORBIDDEN'); };
globalThis.fetch = (url, options = {}) => {
  const target = new URL(url);
  if (target.origin !== 'http://127.0.0.1:' + config.api_port || (options.method ?? 'GET') !== 'GET') {
    parentNetwork.blocked_fetch++; throw Error('AI38_PARENT_FETCH_FORBIDDEN');
  }
  parentNetwork.fetch_requests++;
  return originalFetch(url, options);
};
require('reflect-metadata');
const { DataSource } = require('typeorm');
const load = file => import(pathToFileURL(project + '/dist/' + file + '.js').href);
let db, child, childExit;
const stopChild = async () => {
  if (!child) return;
  if (!childExit) {
    child.kill('SIGTERM');
    for (let index = 0; index < 200 && !childExit; index++) await delay(50);
    if (!childExit) { child.kill('SIGKILL'); report.API_forced_kill = true; await new Promise(resolve => child.once('exit', resolve)); }
  }
  report.own_API_stopped = true;
  report.child_exit = childExit;
};
const environment = { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: work, NODE_ENV: 'production',
  DOTENV_CONFIG_PATH: '/dev/null', NODIA_AI_OPERATION_MODE: 'normal', RATE_LIMIT_STORAGE: 'redis',
  RATE_LIMIT_KEY_PREFIX: 'ai38:freshapi:' + randomBytes(8).toString('hex'),
  POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: String(config.pg_port), POSTGRES_DB: 'ai38api',
  POSTGRES_USER: 'ai38api', POSTGRES_PASSWORD: config.pg_password,
  REDIS_HOST: '127.0.0.1', REDIS_PORT: String(config.redis_port), PORT: String(config.api_port),
  AUTH_JWT_SECRET: randomBytes(32).toString('hex'), GOOGLE_CLIENT_ID: 'ai38-synthetic.apps.googleusercontent.com',
  AUTH_ALLOWED_ORIGINS: 'https://ai38-fixture.example.invalid', SECRET_SEED: randomBytes(32).toString('hex'),
  AI_SECRET_MASTER_KEY: randomBytes(32).toString('hex'), GEMINI_SERVICE_TOKEN: randomBytes(32).toString('hex'),
  GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:1' };
Object.assign(process.env, environment);
save();
try {
  db = await new DataSource({ type: 'postgres', host: '127.0.0.1', port: config.pg_port,
    username: 'ai38api', password: config.pg_password, database: 'ai38api', entities: [],
    migrations: [project + '/dist/migrations/*.js'], synchronize: false }).initialize();
  const migrations = await db.runMigrations();
  check('actual compiled migrations applied to empty disposable PostgreSQL', migrations.length > 0);
  const users = [];
  const [{ AuthTokenService }, { readAuthConfig }] = await Promise.all([load('auth/auth-token.service'), load('auth/auth.config')]);
  const { JwtService } = require('@nestjs/jwt');
  const tokens = new AuthTokenService(new JwtService(), readAuthConfig(environment));
  for (const ordinal of [1, 2]) {
    const [user] = await db.query('INSERT INTO users(email,name) VALUES($1,$2) RETURNING id::text,email,name',
      ['ai38-fresh-api-' + ordinal + '@example.invalid', 'Synthetic API ' + ordinal]);
    const sid = randomUUID(), expires = new Date(Date.now() + 3600_000);
    const issued = await tokens.issue({ ...user, image_url: null }, sid, expires);
    await db.query('INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,$4)',
      [sid, user.id, tokens.hash(issued.refreshToken), expires]);
    users.push({ ...user, sid, token: issued.response.token });
  }
  const [module] = await db.query("SELECT id::text FROM modules WHERE key='nodia_ai' AND is_active");
  assert.ok(module);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES($1,$2)', [users[0].id, module.id]);
  const chats = [randomUUID(), randomUUID()];
  for (const [index, id] of chats.entries()) {
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '90 days')",
      [id, users[index].id, randomUUID(), sha(randomBytes(16)), 'Synthetic fresh API chat ' + index]);
  }
  const counter = work + '/private-child-network.json', guard = work + '/private-child-network.cjs';
  fs.writeFileSync(guard, `const fs=require('node:fs'),net=require('node:net');
const counts={postgres_connections:0,redis_connections:0,blocked_sockets:0,fetch_attempts:0,API_listeners:0,blocked_listeners:0,loopback_bind_enforced:false};
const save=()=>fs.writeFileSync(${JSON.stringify(counter)},JSON.stringify(counts),{mode:0o600});save();
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...input){let args=input;if(Array.isArray(args[0]))args=args[0];const value=args[0];
const opts=value&&typeof value==='object'?value:{port:value,host:typeof args[1]==='string'?args[1]:'localhost'};
const port=Number(opts.port),host=opts.host??'localhost';
if(!['127.0.0.1','localhost','::1'].includes(host)||![${config.pg_port},${config.redis_port}].includes(port)){counts.blocked_sockets++;save();throw Error('AI38_API_SOCKET_FORBIDDEN');}
counts[port===${config.pg_port}?'postgres_connections':'redis_connections']++;save();return connect.apply(this,input);};
const listen=net.Server.prototype.listen;
net.Server.prototype.listen=function(...args){const opts=args[0],port=Number(opts&&typeof opts==='object'?opts.port:opts),host=opts&&typeof opts==='object'?opts.host:(typeof args[1]==='string'?args[1]:undefined);
if(port!==${config.api_port}||(host!==undefined&&!['127.0.0.1','localhost','::1'].includes(host))){counts.blocked_listeners++;save();throw Error('AI38_API_LISTENER_FORBIDDEN');}
if(opts&&typeof opts==='object')args[0]={...opts,host:'127.0.0.1'};else if(typeof args[1]==='string')args[1]='127.0.0.1';else args.splice(1,0,'127.0.0.1');
counts.API_listeners++;counts.loopback_bind_enforced=true;save();return listen.apply(this,args);};
globalThis.fetch=()=>{counts.fetch_attempts++;save();throw Error('AI38_API_PROVIDER_FETCH_FORBIDDEN');};process.on('exit',save);
`, { flag: 'wx', mode: 0o600 });
  report.network_guard_sha256 = sha(fs.readFileSync(guard));
  const stdout = fs.openSync(work + '/private-API-stdout.log', 'wx', 0o600);
  const stderr = fs.openSync(work + '/private-API-stderr.log', 'wx', 0o600);
  child = spawn(process.execPath, ['--require', guard, project + '/dist/main.js'], { cwd: work, env: environment, stdio: ['ignore', stdout, stderr] });
  fs.closeSync(stdout); fs.closeSync(stderr);
  child.once('exit', (code, signal) => { childExit = { code, signal }; });
  child.once('error', () => { childExit = { code: null, signal: 'spawn_error' }; });
  for (let index = 0; index < 400; index++) {
    if (childExit) throw Error('API_exited_before_readiness');
    try {
      const response = await fetch('http://127.0.0.1:' + config.api_port + '/api/v1', { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { await response.text(); break; }
      await response.text();
    } catch {}
    if (index === 399) throw Error('API_readiness_timeout');
    await delay(100);
  }
  const http = async (route, user, expected) => {
    const response = await fetch('http://127.0.0.1:' + config.api_port + '/api/v1' + route,
      { headers: user ? { authorization: 'Bearer ' + user.token } : {}, signal: AbortSignal.timeout(5000) });
    const text = await response.text();
    report.HTTP_requests.push({ method: 'GET', endpoint: route.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gu, ':uuid'), status: response.status });
    assert.equal(response.status, expected, 'HTTP status ' + route.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gu, ':uuid'));
    save(); return text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : text;
  };
  await http('', null, 200); check('real main.js production API returns public HTTP200');
  await http('/nodia-ai/conversations', null, 401); check('actual global AuthGuard rejects anonymous NodiaAI HTTP401');
  const me = await http('/auth/me', users[0], 200); check('actual JWT verification and active SQL session identify fixture owner', me.id === users[0].id);
  const list = await http('/nodia-ai/conversations', users[0], 200);
  check('assigned module grants own conversation list and filters other owner', list.items.length === 1 && list.items[0].conversation_id === chats[0]);
  const detail = await http('/nodia-ai/conversations/' + chats[0], users[0], 200);
  check('actual detail returns saved fixture chat without a run or execution', detail.conversation.conversation_id === chats[0] && detail.current_run === null && detail.active_execution === null);
  await http('/nodia-ai/conversations/' + chats[1], users[0], 404); check('ordinary actor cannot read foreign conversation');
  await http('/nodia-ai/conversations', users[1], 403); check('valid session without destination module remains forbidden');
  await db.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1', [users[0].sid]);
  await http('/auth/me', users[0], 401); check('real guard rejects revoked SQL session with otherwise valid JWT');
  const [pending] = await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_runs) runs,
    (SELECT count(*)::int FROM nodia_ai_jobs) jobs,(SELECT count(*)::int FROM nodia_ai_job_attempts) attempts,
    (SELECT count(*)::int FROM nodia_ai_executions) executions`);
  report.disposable_job_counts = pending;
  check('read-only HTTP flow admitted no AI runs jobs attempts or executions', Object.values(pending).every(value => value === 0));
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure_class = error.constructor.name;
  report.failure_stage_after_checks = report.checks.length;
  process.exitCode = 1;
} finally {
  await stopChild();
  if (db?.isInitialized) await db.destroy();
  report.parent_network = parentNetwork;
  if (fs.existsSync(work + '/private-child-network.json')) report.API_network = JSON.parse(fs.readFileSync(work + '/private-child-network.json', 'utf8'));
  const network = report.API_network;
  const safe = network && network.postgres_connections > 0 && network.redis_connections > 0 && network.blocked_sockets === 0
    && network.fetch_attempts === 0 && network.API_listeners === 1 && network.blocked_listeners === 0 && network.loopback_bind_enforced === true
    && parentNetwork.postgres_connections > 0 && parentNetwork.API_connections > 0 && parentNetwork.blocked_sockets === 0
    && parentNetwork.blocked_fetch === 0 && parentNetwork.listen_attempts === 0;
  report.network_isolation_verified = Boolean(safe);
  if (report.status === 'passed' && (!safe || !report.own_API_stopped || report.API_forced_kill)) { report.status = 'failed_cleanup_or_network'; process.exitCode = 1; }
  if (report.status === 'passed') report.checks.push('API drained with SIGTERM and both processes used only disposable loopback ports');
  report.finished_at_utc = new Date().toISOString(); save();
  console.log(JSON.stringify(report, null, 2));
}
