// Real compiled Nest module graph against its own PostgreSQL16 container+volume.
// No AppModule, provider overrides, accounts, .env, implicit build or provider IO.
// TEACHER_SERVER_DIST must explicitly identify the candidate dist directory.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import childProcess from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

assert(process.env.TEACHER_SERVER_DIST, 'explicit_candidate_dist_required');
const dist = pathToFileURL(resolve(process.env.TEACHER_SERVER_DIST) + sep);
const compiled = path => new URL(path, dist);
const nonce = `${process.pid}_${randomBytes(6).toString('hex')}`;
const container = `nodia_teacher_di_${nonce}`;
const volume = `nodia_teacher_di_pg_${nonce}`;
const redisContainer = `nodia_teacher_di_redis_${nonce}`;
const password = randomBytes(20).toString('hex');
const dockerExec = childProcess.execFileSync.bind(childProcess);
const docker = (...args) => {
  try { return dockerExec('docker', args, { encoding: 'utf8', windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).trim(); }
  catch { throw Error('disposable_docker_failed'); }
};
const savedEnvironment = { ...process.env };
const originalFetch = globalThis.fetch;
const guarded = [];
let providerCalls = 0, nativeSpawns = 0;
const guard = (object, name, category) => {
  const previous = object[name];
  guarded.push(() => { object[name] = previous; });
  object[name] = () => {
    if (category === 'http') providerCalls++; else nativeSpawns++;
    throw Error(category === 'http' ? 'provider_http_forbidden' : 'native_process_forbidden');
  };
};
let source, app, temporary, runtimeNative, runtimeCodex;
let containerCreated = false, volumeCreated = false, redisCreated = false, failure = null;
const checks = [];
async function check(name, work) { await work(); checks.push(name); process.stdout.write(`${JSON.stringify({ check: name, pass: true })}\n`); }

try {
  await access(compiled('teacher/teacher.module.js'));
  await access(compiled('nodia-ai-runtime/config/runtime-policy.json'));
  temporary = await mkdtemp(join(tmpdir(), 'nodia-teacher-di-'));
  // Clear inherited credentials/profile endpoints before any candidate import.
  for (const key of Object.keys(process.env)) {
    if (/^(?:POSTGRES_|REDIS_|GEMINI_|MISTRAL_|R2_|NODIA_CODEX_|CODEX_HOME$|DBUS_|XDG_RUNTIME_DIR$|OPENAI_|ANTIGRAVITY_|AI_SECRET_|SECRET_SEED$)/u.test(key)) delete process.env[key];
  }
  Object.assign(process.env, { DOTENV_CONFIG_PATH: process.platform === 'win32' ? 'NUL' : '/dev/null',
    NODE_ENV: 'test', RATE_LIMIT_STORAGE: 'memory', AI_SECRET_MASTER_KEY: randomBytes(32).toString('hex'),
    NODIA_CODEX_PROFILE_ROOT: join(temporary, 'empty-native-profile') });
  globalThis.fetch = async () => { providerCalls++; throw Error('provider_http_forbidden'); };
  for (const transport of [http, https]) for (const method of ['request', 'get']) guard(transport, method, 'http');
  for (const method of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) guard(childProcess, method, 'native');
  syncBuiltinESMExports();

  volumeCreated = true;
  docker('volume', 'create', '--label', 'nodia.teacher.disposable=module-di', volume);
  containerCreated = true;
  docker('run', '-d', '--rm', '--pull', 'never', '--name', container,
    '--label', 'nodia.teacher.disposable=module-di', '--memory', '512m', '--cpus', '1',
    '--mount', `type=volume,src=${volume},dst=/var/lib/postgresql/data`,
    '-e', 'POSTGRES_USER=teacher_di', '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=teacher_di',
    '-p', '127.0.0.1::5432', 'postgres:16-alpine', '-c', 'max_connections=20', '-c', 'shared_buffers=32MB');
  for (let attempt = 0; attempt < 100; attempt++) {
    try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'teacher_di'); break; }
    catch { if (attempt === 99) throw Error('disposable_postgres_unavailable'); await delay(200); }
  }
  const options = { type: 'postgres', host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'teacher_di', password, database: 'teacher_di', synchronize: false,
    entities: [fileURLToPath(compiled('**/*.entity.js'))],
    migrations: [fileURLToPath(compiled('migrations/*.js'))], extra: { max: 4 } };
  // Authorization's real global cache dependency is isolated too, with no
  // persistence volume and no access to the configured Redis service.
  redisCreated = true;
  docker('run', '-d', '--rm', '--pull', 'never', '--name', redisContainer,
    '--label', 'nodia.teacher.disposable=module-di', '--memory', '64m', '--cpus', '0.5',
    '-p', '127.0.0.1::6379', 'redis:7-alpine', 'redis-server', '--save', '', '--appendonly', 'no');
  for (let attempt = 0; attempt < 40; attempt++) {
    try { assert.equal(docker('exec', redisContainer, 'redis-cli', 'ping'), 'PONG'); break; }
    catch { if (attempt === 39) throw Error('disposable_redis_unavailable'); await delay(100); }
  }
  process.env.REDIS_HOST = '127.0.0.1';
  process.env.REDIS_PORT = docker('port', redisContainer, '6379/tcp').split(':').at(-1);
  // Initialize before Nest starts the graph: a later DI error cannot leave an
  // asynchronous TypeORM retry connecting after the disposable DB is removed.
  source = new DataSource(options);
  await source.initialize();
  await source.runMigrations({ transaction: 'all' });
  const load = async (path, name) => (await import(compiled(path).href))[name];
  const RedisModule = await load('common/redis/redis.module.js', 'RedisModule');
  const TeacherModule = await load('teacher/teacher.module.js', 'TeacherModule');
  const AiGenerationModule = await load('ai-generation/ai-generation.module.js', 'AiGenerationModule');
  const AiGenerationPort = await load('ai-generation/ai-generation-port.js', 'AiGenerationPort');
  const Route = await load('ai-generation/route-text-generation.service.js', 'RouteTextGenerationService');
  const Native = await load('ai-generation/teacher-agentic-text.service.js', 'TeacherAgenticTextService');
  const Codex = await load('ai-generation/codex-teacher-text-transport.js', 'CodexTeacherTextTransport');
  const CodexRuntime = await load('common/ai/codex/codex-runtime.service.js', 'CodexRuntimeService');
  const { CODEX_TEACHER_TEXT_TRANSPORT } = await import(compiled('ai-generation/agentic-text-contract.js').href);
  const { TEACHER_GENERATION_PORT } = await import(compiled('teacher/types/teacher.types.js').href);
  const Runtime = await load('ai-generation/teacher-generation-runtime.service.js', 'TeacherGenerationRuntimeService');
  const Registry = await load('ai-generation/worker-source-registry.js', 'GenerationWorkerSourceRegistry');
  const TeacherService = await load('teacher/teacher.service.js', 'TeacherService');
  const Publisher = await load('teacher/use-case/publish-teacher.use-case.js', 'PublishTeacherUseCase');
  const Translation = await load('translation/translation.service.js', 'TranslationService');

  class FixtureModule {}
  Module({ imports: [TypeOrmModule.forRootAsync({
    useFactory: () => options,
    dataSourceFactory: async () => source,
  }), RedisModule, TeacherModule, AiGenerationModule] })(FixtureModule);
  await check('candidate modules construct and initialize through real Nest DI', async () => {
    app = await NestFactory.createApplicationContext(FixtureModule, { logger: false, abortOnError: false });
    await app.init();
    assert.equal(app.get(DataSource), source);
    assert(source.entityMetadatas.length > 50, 'complete_compiled_entity_graph');
    const migrations = await source.query('SELECT timestamp::text FROM migrations WHERE timestamp BETWEEN 1793560000000 AND 1793600000000 ORDER BY timestamp');
    assert.deepEqual(migrations.map(row => row.timestamp), ['1793560000000', '1793570000000', '1793580000000', '1793590000000', '1793600000000']);
  });
  await check('actual router and Native token resolve shared production instances', () => {
    const route = app.get(AiGenerationPort), native = app.get(Native);
    runtimeNative = app.get(Codex); runtimeCodex = app.get(CodexRuntime);
    assert(route instanceof Route);
    assert.equal(route.agentic, native);
    assert.equal(native.codex, runtimeNative);
    assert.equal(app.get(CODEX_TEACHER_TEXT_TRANSPORT), runtimeNative);
    assert.equal(app.get(TEACHER_GENERATION_PORT), app.get(Runtime));
    assert.equal(app.get(Runtime).transport, route);
    assert.equal(app.get(Runtime).agentic, native);
    assert.equal(app.get(TeacherService).source, source);
    assert(app.get(Translation));
  });
  await check('OnModuleInit registers actual worker and bound Teacher publisher once', () => {
    const runtime = app.get(Runtime), registry = app.get(Registry);
    assert.equal(registry.source, runtime);
    assert.equal(typeof runtime.publisher, 'function');
    assert(app.get(Publisher));
    assert.throws(() => runtime.setPublisher(() => Promise.resolve({})), /teacher_publisher_duplicate/u);
    assert.equal(runtimeNative.owned.size, 0);
    assert.equal(runtimeCodex.profiles.size, 0);
    assert(runtimeNative.timer && !runtimeNative.timer._destroyed);
  });
  await check('DI initialization creates no Teacher jobs or account/provider calls', async () => {
    assert.equal(providerCalls, 0); assert.equal(nativeSpawns, 0);
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM teacher_generation_jobs'))[0].n, 0);
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM auth_sessions'))[0].n, 0);
    assert.equal((await source.query('SELECT count(*)::integer AS n FROM ai_api_keys'))[0].n, 0);
  });
  await app.close(); app = null;
  await check('real shutdown closes TypeORM and both Native maintenance timers', () => {
    assert.equal(source.isInitialized, false);
    assert.equal(runtimeNative.timer._destroyed, true);
    assert.equal(runtimeCodex.idleTimer._destroyed, true);
    assert.equal(providerCalls, 0); assert.equal(nativeSpawns, 0);
  });
} catch (error) {
  failure = { status: 'failed', passed_checks: checks.length,
    error_type: /^[A-Za-z]+$/u.test(error?.name ?? '') ? error.name : 'Error',
    di_type: typeof error?.type === 'string' ? error.type : null,
    di_index: Number.isInteger(error?.context?.index) ? error.context.index : null,
    di_dependencies: Array.isArray(error?.context?.dependencies) ? error.context.dependencies.map(value =>
      typeof value === 'function' ? value.name : typeof value === 'string' && /^[A-Za-z_]+$/u.test(value) ? value : typeof value) : null,
    sql_code: /^[0-9A-Z]{5}$/u.test(error?.code ?? '') ? error.code : null,
    assertion: error instanceof assert.AssertionError ? String(error.message).slice(0, 300) : null };
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  try { if (app) await app.close(); } catch { cleanupErrors.push('nest_close_failed'); }
  try { if (source?.isInitialized) await source.destroy(); } catch { cleanupErrors.push('source_close_failed'); }
  if (containerCreated) {
    let exists = false;
    try { docker('container', 'inspect', container, '--format', '{{.Id}}'); exists = true; } catch { /* absent */ }
    if (exists) try { docker('rm', '-f', container); } catch { cleanupErrors.push('owned_container_cleanup_failed'); }
  }
  if (redisCreated) {
    let exists = false;
    try { docker('container', 'inspect', redisContainer, '--format', '{{.Id}}'); exists = true; } catch { /* absent */ }
    if (exists) try { docker('rm', '-f', redisContainer); } catch { cleanupErrors.push('owned_redis_cleanup_failed'); }
  }
  if (volumeCreated) {
    let exists = false;
    try { docker('volume', 'inspect', volume, '--format', '{{.Name}}'); exists = true; } catch { /* absent */ }
    if (exists) try { docker('volume', 'rm', volume); } catch { cleanupErrors.push('owned_volume_cleanup_failed'); }
  }
  try { if (temporary) await rm(temporary, { recursive: true, force: true }); } catch { cleanupErrors.push('owned_temporary_cleanup_failed'); }
  globalThis.fetch = originalFetch;
  for (const restore of guarded.reverse()) restore();
  syncBuiltinESMExports();
  for (const key of Object.keys(process.env)) if (!(key in savedEnvironment)) delete process.env[key];
  Object.assign(process.env, savedEnvironment);
  if (cleanupErrors.length) process.exitCode = 1;
  process.stdout.write(`${JSON.stringify({ status: failure || cleanupErrors.length ? 'failed' : 'passed',
    checks: checks.length, provider_http_attempts: providerCalls, native_spawn_attempts: nativeSpawns,
    configured_database_touched: false, candidate_dist: dist.href,
    cleanup: cleanupErrors.length ? cleanupErrors : 'owned_containers_volume_and_temporary_removed', container, volume, redis_container: redisContainer })}\n`);
}
