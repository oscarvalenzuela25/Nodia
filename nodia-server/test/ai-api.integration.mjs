import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { AiProviderService } from '../dist/ai-provider/ai-provider.service.js';
import { AiProvider } from '../dist/ai-provider/entities/ai-provider.entity.js';
import { AiApiKey } from '../dist/ai-provider/entities/ai-api-key.entity.js';
import { AiProviderCatalog } from '../dist/ai-provider/entities/ai-provider-catalog.entity.js';
import { AiProviderEvent } from '../dist/ai-provider/entities/ai-provider-event.entity.js';
import { CreateAiProviderUseCase } from '../dist/ai-provider/use-case/create-ai-provider.use-case.js';
import { CreateAiApiKeyUseCase } from '../dist/ai-provider/use-case/create-ai-api-key.use-case.js';
import { UpdateAiApiKeyUseCase } from '../dist/ai-provider/use-case/update-ai-api-key.use-case.js';
import { RestoreAiApiCatalog1791320000000 } from '../dist/migrations/1791320000000-RestoreAiApiCatalog.js';
import { SelectSoleAiApiKey1791330000000 } from '../dist/migrations/1791330000000-SelectSoleAiApiKey.js';

// Disposable PostgreSQL only. No .env, configured DataSource, Google/OpenAI or real keys.
const container = `template_ai_api_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
let db, started = false;
try {
  docker('run', '--detach', '--rm', '--name', container, '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_DB=ai_api_test', '--env', 'POSTGRES_USER=ai_api_test', '--env', `POSTGRES_PASSWORD=${password}`, 'postgres:16-alpine');
  started = true;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'ai_api_test', '-d', 'ai_api_test'); break; }
    catch (error) { if (attempt === 29) throw error; await delay(250); }
  }
  db = new DataSource({ type: 'postgres', host: '127.0.0.1', port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'ai_api_test', password, database: 'ai_api_test', synchronize: false,
    entities: [fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url))] });
  await db.initialize();
  // Schema generation is restricted to the isolated, disposable database above.
  await db.synchronize();
  const migration = new RestoreAiApiCatalog1791320000000();
  const runner = db.createQueryRunner();
  try { await migration.up(runner); await migration.up(runner); await migration.down(runner); }
  finally { await runner.release(); }
  const catalogs = await db.getRepository(AiProviderCatalog).find();
  assert.equal(catalogs.length, 2);
  const gemini = catalogs.find((row) => row.key === 'gemini');
  const openai = catalogs.find((row) => row.key === 'openai');
  assert(gemini.can_use_api_key && gemini.can_use_token_plan_web && gemini.can_use_token_plan_agentic);
  assert(openai.can_use_api_key && !openai.can_use_token_plan_web && !openai.can_use_token_plan_agentic);
  const translations = { attachTranslationsToOne: async (_table, value) => value };
  const service = new AiProviderService(db.getRepository(AiProvider), db.getRepository(AiApiKey), db.getRepository(AiProviderEvent), db.getRepository(AiProviderCatalog), translations);
  const createProvider = new CreateAiProviderUseCase(service);
  const connection = await createProvider.execute({ catalog_id: openai.id, name: 'Synthetic OpenAI', use_api_key: true, default_mode: 'api_key' });
  await assert.rejects(createProvider.execute({ catalog_id: openai.id, use_token_plan_web: true }), /no permite/);
  await assert.rejects(createProvider.execute({ catalog_id: '999999', use_api_key: true }), /catálogo/);
  const createKey = new CreateAiApiKeyUseCase(service);
  const updateKey = new UpdateAiApiKeyUseCase(service);
  const first = await createKey.execute({ provider_id: connection.id, label: 'Synthetic first', secret: 'synthetic-first', is_selected: false });
  assert.equal(first.is_selected, true, 'a sole active key is automatically selected');
  await updateKey.execute(first.id, { is_selected: false });
  assert.equal((await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id })).is_selected, true);
  assert(!('secret_ciphertext' in first) && !('secret_fingerprint' in first));
  await assert.rejects(createKey.execute({ provider_id: connection.id, label: 'Duplicate', secret: 'synthetic-first', is_selected: true }), /ya está registrada/);
  assert.equal((await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id })).is_selected, true, 'duplicate insert rollback must preserve previous selection');
  const second = await createKey.execute({ provider_id: connection.id, label: 'Synthetic second', secret: 'synthetic-second', is_selected: false });
  const inactive = await createKey.execute({ provider_id: connection.id, label: 'Synthetic inactive', secret: 'synthetic-inactive', is_active: false });
  await assert.rejects(updateKey.execute(inactive.id, { is_selected: true }), /inactiva/);
  assert.equal((await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id })).is_selected, true);
  await Promise.all([updateKey.execute(first.id, { is_selected: true }), updateKey.execute(second.id, { is_selected: true })]);
  assert.equal(await db.getRepository(AiApiKey).countBy({ provider_id: connection.id, is_selected: true }), 1);
  assert.equal((await service.getEligibleApiKeySecrets(connection.id, false)).length, 1);
  const secrets = await service.getEligibleApiKeySecrets(connection.id, true);
  assert.equal(secrets.length, 2);
  assert(secrets.includes('synthetic-first') && secrets.includes('synthetic-second'));
  const encrypted = await db.getRepository(AiApiKey).createQueryBuilder('key').addSelect('key.secret_ciphertext').getMany();
  assert(encrypted.every((key) => key.secret_ciphertext.startsWith('v2:') && !key.secret_ciphertext.includes('synthetic')));
  await service.deleteApiKey(inactive.id);
  await service.deleteApiKey(second.id);
  assert.equal((await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id })).is_selected, true, 'deletion must select the sole remaining active key');
  await db.getRepository(AiApiKey).update({ id: first.id }, { is_selected: false });
  const repair = db.createQueryRunner();
  try {
    await repair.startTransaction();
    await new SelectSoleAiApiKey1791330000000().up(repair);
    await new SelectSoleAiApiKey1791330000000().up(repair);
    await repair.commitTransaction();
  } finally { await repair.release(); }
  assert.equal((await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id })).is_selected, true, 'historical singleton repair is idempotent');
  const count = await db.getRepository(AiProvider).count();
  const next = db.createQueryRunner();
  try { await migration.up(next); } finally { await next.release(); }
  assert.equal(await db.getRepository(AiProvider).count(), count);
  console.log('Isolated PostgreSQL: catalog rerun/down preserves rows; catalog modes enforced; encrypted keys, duplicate rollback and concurrent selection verified.');
} finally {
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '--force', container);
}
