import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { AiProviderService } from '../dist/ai-provider/ai-provider.service.js';
import { AiProvider } from '../dist/ai-provider/entities/ai-provider.entity.js';
import { AiApiKey } from '../dist/ai-provider/entities/ai-api-key.entity.js';
import { AiProviderCatalog } from '../dist/ai-provider/entities/ai-provider-catalog.entity.js';
import { AiProviderEvent } from '../dist/ai-provider/entities/ai-provider-event.entity.js';
import { SaveAiProviderConfigurationUseCase } from '../dist/ai-provider/use-case/save-ai-provider-configuration.use-case.js';
import { TranslationService } from '../dist/translation/translation.service.js';
import { Translation } from '../dist/translation/entities/translation.entity.js';
import { CreateAiProviderUseCase } from '../dist/ai-provider/use-case/create-ai-provider.use-case.js';
import { CreateAiApiKeyUseCase } from '../dist/ai-provider/use-case/create-ai-api-key.use-case.js';
import { SaveAiApiKeyUseCase } from '../dist/ai-provider/use-case/save-ai-api-key.use-case.js';
import { UpdateAiApiKeyUseCase } from '../dist/ai-provider/use-case/update-ai-api-key.use-case.js';
import { RestoreAiApiCatalog1791320000000 } from '../dist/migrations/1791320000000-RestoreAiApiCatalog.js';
import { SelectSoleAiApiKey1791330000000 } from '../dist/migrations/1791330000000-SelectSoleAiApiKey.js';

// Disposable PostgreSQL only. No .env, configured DataSource, Google/OpenAI or real keys.
const container = `template_ai_api_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
let db,
  started = false;
try {
  docker(
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    'POSTGRES_DB=ai_api_test',
    '--env',
    'POSTGRES_USER=ai_api_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'ai_api_test',
        '-d',
        'ai_api_test',
      );
      break;
    } catch (error) {
      if (attempt === 29) throw error;
      await delay(250);
    }
  }
  db = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'ai_api_test',
    password,
    database: 'ai_api_test',
    synchronize: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
  });
  await db.initialize();
  // Schema generation is restricted to the isolated, disposable database above.
  await db.synchronize();
  const migration = new RestoreAiApiCatalog1791320000000();
  // Exercise the historical migration in a temporary legacy table; never restore
  // its removed columns into the current synchronized schema.
  const verifyHistoricalCatalog = async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await runner.query(`CREATE TEMP TABLE ai_provider_catalog (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, key text UNIQUE,
        name text, created_at timestamptz, updated_at timestamptz)`);
      await migration.up(runner);
      await migration.up(runner);
      await migration.down(runner);
      const legacy = await runner.query(
        'SELECT * FROM pg_temp.ai_provider_catalog ORDER BY key',
      );
      assert.equal(legacy.length, 2);
      assert.equal(
        legacy.find((row) => row.key === 'gemini').can_use_token_plan_web,
        true,
        'historical migration bytes retain their original behavior in isolation',
      );
    } finally {
      await runner.query('DROP TABLE IF EXISTS pg_temp.ai_provider_catalog');
      await runner.release();
    }
  };
  await verifyHistoricalCatalog();
  await db.query(`INSERT INTO ai_provider_catalog(key,name,can_use_api_key,can_use_agentic)
    VALUES('gemini','Synthetic Gemini',true,true),('openai','Synthetic OpenAI',true,true)`);
  const catalogs = await db.getRepository(AiProviderCatalog).find();
  assert.equal(catalogs.length, 2);
  const gemini = catalogs.find((row) => row.key === 'gemini');
  const openai = catalogs.find((row) => row.key === 'openai');
  assert(gemini.can_use_api_key && gemini.can_use_agentic);
  assert(openai.can_use_api_key && openai.can_use_agentic);
  assert(
    catalogs.every((row) => !Object.hasOwn(row, 'can_use_token_plan_web')),
    'the current catalog exposes only Agentic and API key',
  );
  const translations = new TranslationService(db.getRepository(Translation));
  const actor = { userId: '1', sessionId: randomUUID() };
  await db.query(
    "INSERT INTO users(id,email,name) VALUES(1,'synthetic-ai28@example.invalid','Synthetic AI28 actor')",
  );
  const [role] = await db.query(
    "INSERT INTO roles(key) VALUES('super_admin') RETURNING id",
  );
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES(1,$1)', [
    role.id,
  ]);
  await db.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,1,'synthetic',clock_timestamp()+interval '1 hour')",
    [actor.sessionId],
  );
  const service = new AiProviderService(
    db.getRepository(AiProvider),
    db.getRepository(AiApiKey),
    db.getRepository(AiProviderEvent),
    db.getRepository(AiProviderCatalog),
    translations,
  );
  const createProvider = new CreateAiProviderUseCase(
    new SaveAiProviderConfigurationUseCase(db, translations),
  );
  const connection = await createProvider.execute(
    {
      catalog_id: openai.id,
      name: 'Synthetic OpenAI',
      use_api_key: true,
      default_mode: 'api_key',
    },
    actor,
  );
  await assert.rejects(
    createProvider.execute(
      { catalog_id: openai.id, use_token_plan_web: true },
      actor,
    ),
    /invalid_configuration/,
  );
  await assert.rejects(
    createProvider.execute({ catalog_id: '999999', use_api_key: true }, actor),
    /catálogo/,
  );
  const keyWriter = new SaveAiApiKeyUseCase(db);
  const createKey = new CreateAiApiKeyUseCase(keyWriter);
  const updateKey = new UpdateAiApiKeyUseCase(keyWriter);
  const first = await createKey.execute(
    {
      provider_id: connection.id,
      label: 'Synthetic first',
      secret: 'synthetic-first',
      is_selected: false,
    },
    actor,
  );
  assert.equal(
    first.is_selected,
    true,
    'a sole active key is automatically selected',
  );
  await updateKey.execute(first.id, { is_selected: false }, actor);
  assert.equal(
    (await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id }))
      .is_selected,
    true,
  );
  assert(!('secret_ciphertext' in first) && !('secret_fingerprint' in first));
  await assert.rejects(
    createKey.execute(
      {
        provider_id: connection.id,
        label: 'Duplicate',
        secret: 'synthetic-first',
        is_selected: true,
      },
      actor,
    ),
    /ya está registrada/,
  );
  assert.equal(
    (await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id }))
      .is_selected,
    true,
    'duplicate insert rollback must preserve previous selection',
  );
  const second = await createKey.execute(
    {
      provider_id: connection.id,
      label: 'Synthetic second',
      secret: 'synthetic-second',
      is_selected: false,
    },
    actor,
  );
  const inactive = await createKey.execute(
    {
      provider_id: connection.id,
      label: 'Synthetic inactive',
      secret: 'synthetic-inactive',
      is_active: false,
    },
    actor,
  );
  await assert.rejects(
    updateKey.execute(inactive.id, { is_selected: true }, actor),
    /inactiva/,
  );
  assert.equal(
    (await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id }))
      .is_selected,
    true,
  );
  await Promise.all([
    updateKey.execute(first.id, { is_selected: true }, actor),
    updateKey.execute(second.id, { is_selected: true }, actor),
  ]);
  assert.equal(
    await db
      .getRepository(AiApiKey)
      .countBy({ provider_id: connection.id, is_selected: true }),
    1,
  );
  assert.equal(
    (await service.getEligibleApiKeySecrets(connection.id, false)).length,
    1,
  );
  const secrets = await service.getEligibleApiKeySecrets(connection.id, true);
  assert.equal(secrets.length, 2);
  assert(
    secrets.includes('synthetic-first') && secrets.includes('synthetic-second'),
  );
  const encrypted = await db
    .getRepository(AiApiKey)
    .createQueryBuilder('key')
    .addSelect('key.secret_ciphertext')
    .getMany();
  assert(
    encrypted.every(
      (key) =>
        key.secret_ciphertext.startsWith('v2:') &&
        !key.secret_ciphertext.includes('synthetic'),
    ),
  );
  await keyWriter.remove(inactive.id, actor);
  await keyWriter.remove(second.id, actor);
  assert.equal(
    (await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id }))
      .is_selected,
    true,
    'deletion must select the sole remaining active key',
  );
  await db
    .getRepository(AiApiKey)
    .update({ id: first.id }, { is_selected: false });
  const repair = db.createQueryRunner();
  try {
    await repair.startTransaction();
    await new SelectSoleAiApiKey1791330000000().up(repair);
    await new SelectSoleAiApiKey1791330000000().up(repair);
    await repair.commitTransaction();
  } finally {
    await repair.release();
  }
  assert.equal(
    (await db.getRepository(AiApiKey).findOneByOrFail({ id: first.id }))
      .is_selected,
    true,
    'historical singleton repair is idempotent',
  );
  const count = await db.getRepository(AiProvider).count();
  await verifyHistoricalCatalog();
  assert.equal(await db.getRepository(AiProvider).count(), count);
  console.log(
    'Isolated PostgreSQL: catalog rerun/down preserves rows; catalog modes enforced; encrypted keys, duplicate rollback and concurrent selection verified.',
  );
} finally {
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '--force', container);
}
