// Operator-only, nodia UID: active R05 adapter and read-only operational SQL.
// Native session/model metadata only. No generation, login, settings or effects.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = '/opt/nodia/releases/nodia-server-ai40-r05';
assert.equal(process.cwd(), root);
const require = createRequire(root + '/package.json');
require('reflect-metadata');
const config = require('dotenv').parse(readFileSync(process.env.DOTENV_CONFIG_PATH));
const effective = { ...config, ...process.env };
for (const name of ['NODIA_CODEX_ENABLED', 'NODIA_CODEX_PROFILE_ROOT']) {
  assert.equal(typeof effective[name], 'string');
  process.env[name] = effective[name];
}
assert.equal(process.env.NODIA_CODEX_ENABLED, 'true');
assert.equal(process.env.NODIA_CODEX_PROFILE_ROOT, '/var/lib/nodia/codex');
const { DataSource } = require('typeorm');
const db = new DataSource({ type: 'postgres', host: effective.POSTGRES_HOST,
  port: Number(effective.POSTGRES_PORT), database: effective.POSTGRES_DB,
  username: effective.POSTGRES_USER, password: effective.POSTGRES_PASSWORD,
  ssl: effective.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  synchronize: false, migrationsRun: false, logging: false,
  extra: { connectionTimeoutMillis: 5000, statement_timeout: 5000,
    options: '-c default_transaction_read_only=on' } });
const load = async (path, name) => (await import(pathToFileURL(root + '/dist/' + path + '.js').href))[name];
let native;
try {
  await db.initialize();
  const [{ default_transaction_read_only: readOnly }] = await db.query('SHOW default_transaction_read_only');
  assert.equal(readOnly, 'on');
  const [row] = await db.query(`SELECT p.id::text,p.fields->'token_plan_agentic' AS fields
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id='1' AND c.key='openai'`);
  assert.equal(row?.id, '1');
  const fields = row.fields, model = fields.selected_model;
  assert.ok(typeof model === 'string' && model.trim());
  const levels = fields.thinking_levels ?? {};
  const effort = Object.hasOwn(levels, model) ? levels[model] : (fields.thinking_level ?? null);
  const selection = { connection_id: row.id, mode: 'token_plan_agentic', model_id: model, effort_id: effort };
  const Native = await load('common/ai/codex/codex-runtime.service', 'CodexRuntimeService');
  const Chat = await load('common/ai/codex/codex-chat-runtime', 'CodexChatRuntime');
  const Adapter = await load('nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case', 'CodexNodiaAiAdapterUseCase');
  const Validate = await load('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase');
  const Store = await load('common/ai/codex/codex-chat-acceptance', 'CodexChatAcceptanceStore');
  native = new Native();
  const chat = new Chat(native);
  const policy = new Validate().execute(JSON.parse(readFileSync(root + '/dist/nodia-ai-runtime/config/runtime-policy.json', 'utf8')));
  const adapter = new Adapter(db, chat, policy);
  const observation = await adapter.observe(selection, AbortSignal.timeout(35000));
  assert.equal(observation.available, true);
  assert.equal(observation.supportsMcp, true);
  assert.deepEqual([...observation.verifiedAttachmentMediaTypes].sort(), ['image/jpeg', 'image/png', 'image/webp']);
  const mcp = await new Store(chat.journal).read(selection.connection_id);
  assert.equal(mcp.scope.runtimeFingerprint, '51a284da7f892943e9101d08af7513f405b81034c7b85f7c05517d0daab82543');
  assert.equal(mcp.scope.sessionGeneration, observation.sessionGeneration);
  assert.equal(mcp.scope.configurationGeneration, observation.configurationGeneration);
  const manifest = readFileSync(root + '/release-manifest.json');
  assert.equal(createHash('sha256').update(manifest).digest('hex'), '07b83a30d4721dba1d1ca34d0b083868b5a8b64369d8ac853d389434f73a76cd');
  console.log(JSON.stringify({ schema: 'nodia-ai-ai40-r05-active-observation-v1', status: 'passed',
    observed_at_VM_utc: new Date().toISOString(), active_release: root,
    active_manifest_sha256: createHash('sha256').update(manifest).digest('hex'),
    selection, available: observation.available, supports_mcp: observation.supportsMcp,
    verified_attachment_media_types: observation.verifiedAttachmentMediaTypes,
    configuration_generation: observation.configurationGeneration, session_generation: observation.sessionGeneration,
    runtime_fingerprint: mcp.scope.runtimeFingerprint, mcp_terminal_proof_id: mcp.terminalProofId,
    adapter_source: observation.source, SQL_connection_default_read_only: true,
    provider_generations: 0, configured_SQL_writes: 0, credentials_exported: false,
    availability_overridden: false, settings_or_services_changed: false }));
} catch (error) {
  console.log(JSON.stringify({ schema: 'nodia-ai-ai40-r05-active-observation-v1', status: 'failed',
    error_class: error?.constructor?.name, safe_code: typeof error?.code === 'string' &&
      /^(codex_|nodia_ai:)[a-z_]{1,100}$/u.test(error.code) ? error.code : null,
    provider_generations: 0, private_details_emitted: false }));
  process.exitCode = 1;
} finally {
  await native?.onModuleDestroy();
  if (db.isInitialized) await db.destroy();
}
