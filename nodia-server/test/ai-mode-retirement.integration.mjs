import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { RetireWebAiModes1793300000000 } from '../dist/migrations/1793300000000-RetireWebAiModes.js';

// Fresh isolated PostgreSQL container only; never load .env or the application DataSource.
const container = `nodia_ai_modes_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let db,
  started = false;
const checks = [];
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
    'POSTGRES_DB=ai_modes_test',
    '--env',
    'POSTGRES_USER=ai_modes_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'ai_modes_test',
        '-d',
        'ai_modes_test',
      );
      break;
    } catch (error) {
      if (attempt === 39) throw error;
      await delay(250);
    }
  }
  db = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'ai_modes_test',
    password,
    database: 'ai_modes_test',
    synchronize: false,
  });
  await db.initialize();
  await db.query(`CREATE TABLE ai_provider_catalog(id bigint PRIMARY KEY,can_use_api_key boolean,
    can_use_token_plan_web boolean,can_use_token_plan_agentic boolean);
    CREATE TABLE ai_providers(id bigint PRIMARY KEY,use_api_key boolean,use_token_plan_web boolean,
      use_token_plan_agentic boolean,default_mode text,fields jsonb,
      CONSTRAINT chk_ai_providers_default_mode CHECK(default_mode IS NULL OR default_mode IN('api_key','token_plan_web','token_plan_agentic')));
    CREATE TABLE nodia_ai_conversations(id uuid PRIMARY KEY,selected_connection_id bigint,selected_mode text,
      selected_model_id text,selected_effort_id text,routing_enabled boolean,routing_target_selection jsonb,
      routing_revision integer,revision integer,updated_at timestamptz,active_job_id uuid,
      CHECK((selected_mode IS NULL AND selected_model_id IS NULL AND selected_effort_id IS NULL AND selected_connection_id IS NULL)
        OR(selected_mode IS NOT NULL AND selected_mode IN('api_key','token_plan_web','token_plan_agentic') AND selected_model_id IS NOT NULL)));
    CREATE TABLE nodia_ai_jobs(state text);
    CREATE TABLE nodia_ai_job_attempts(ended_at timestamptz,selection_snapshot jsonb);
    CREATE TABLE nodia_ai_runtime_slots(state text);
    CREATE TABLE unrelated_probe(id integer PRIMARY KEY,zero integer,unknown_value integer,private_fixture text);
    INSERT INTO unrelated_probe VALUES(1,0,NULL,'synthetic-not-a-key');
    INSERT INTO ai_provider_catalog VALUES(1,true,true,true);
    INSERT INTO ai_providers VALUES
      (1,true,true,true,'token_plan_agentic','{"token_plan_agentic":{"selected_model":"synthetic-native"},"api_key":{"selected_model":"synthetic-api"}}'),
      (2,true,true,false,'token_plan_web','{"selected_model":"synthetic-old-web","default_model":"synthetic-old-web","model":"synthetic-old-web","chat_model":"synthetic-old-web","token_plan_web":{"selected_model":"synthetic-old-web"},"other":0}');
    INSERT INTO nodia_ai_conversations VALUES
      ('00000000-0000-4000-8000-000000000001',1,'token_plan_agentic','synthetic-native',NULL,false,NULL,1,1,now(),NULL),
      ('00000000-0000-4000-8000-000000000002',2,'token_plan_web','synthetic-old-web',NULL,true,'{"selection":{"mode":"token_plan_agentic"}}',1,1,now(),NULL);
    INSERT INTO nodia_ai_job_attempts VALUES(now(),'{"mode":"token_plan_agentic","hash":"synthetic-immutable"}');
    INSERT INTO nodia_ai_runtime_slots VALUES('free')`);
  const before = await db.query('SELECT * FROM ai_providers ORDER BY id');
  const historical = await db.query('SELECT * FROM nodia_ai_job_attempts');
  const unrelated = await db.query('SELECT * FROM unrelated_probe');
  const migrate = async (direction) => {
    const runner = db.createQueryRunner();
    await runner.startTransaction();
    try {
      await new RetireWebAiModes1793300000000()[direction](runner);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  };
  await db.query(`INSERT INTO nodia_ai_jobs VALUES('leased')`);
  await assert.rejects(migrate('up'), /runtime_not_quiet/);
  checks.push('busy blocks migration');
  await db.query('DELETE FROM nodia_ai_jobs');
  await db.query(
    `UPDATE ai_providers SET fields=fields||'{"agentic":{"selected_model":"conflict"}}'::jsonb WHERE id=1`,
  );
  await assert.rejects(migrate('up'), /configuration_conflict/);
  checks.push('scope conflict rolls back');
  await db.query(`UPDATE ai_providers SET fields=fields-'agentic' WHERE id=1`);
  await migrate('up');
  const providers = await db.query('SELECT * FROM ai_providers ORDER BY id');
  assert.equal(providers[0].default_mode, 'agentic');
  assert.equal(providers[0].use_agentic, true);
  assert.equal(providers[0].fields.agentic.selected_model, 'synthetic-native');
  assert.equal(providers[0].fields.api_key.selected_model, 'synthetic-api');
  assert.equal(providers[1].default_mode, null);
  assert.equal(providers[1].fields.selected_model, undefined);
  for (const alias of ['default_model', 'model', 'chat_model'])
    assert.equal(providers[1].fields[alias], undefined);
  assert.equal(providers[1].fields.other, 0);
  assert.equal(providers[1].use_token_plan_web, undefined);
  checks.push('provider config preserved and retired default unassigned');
  const chats = await db.query(
    'SELECT * FROM nodia_ai_conversations ORDER BY id',
  );
  assert.equal(chats[0].selected_mode, 'agentic');
  assert.equal(chats[1].selected_connection_id, null);
  assert.equal(chats[1].selected_mode, null);
  assert.equal(chats[1].routing_enabled, false);
  assert.equal(chats[1].routing_target_selection, null);
  checks.push('chat reconfiguration explicit');
  assert.deepEqual(
    await db.query('SELECT * FROM nodia_ai_job_attempts'),
    historical,
  );
  assert.deepEqual(await db.query('SELECT * FROM unrelated_probe'), unrelated);
  checks.push('immutable history and unrelated data preserved');
  await assert.rejects(
    db.query(
      `UPDATE ai_providers SET default_mode='token_plan_web' WHERE id=1`,
    ),
  );
  await assert.rejects(
    db.query(
      `UPDATE nodia_ai_conversations SET selected_mode=NULL WHERE id='00000000-0000-4000-8000-000000000001'`,
    ),
  );
  checks.push('new constraints reject retired/incomplete selections');
  await db.query(
    `UPDATE ai_providers SET fields=fields||'{"after":1}'::jsonb WHERE id=1`,
  );
  await assert.rejects(migrate('down'), /rollback_would_overwrite_changes/);
  checks.push('down refuses newer configuration');
  await db.query(`UPDATE ai_providers SET fields=fields-'after' WHERE id=1`);
  await migrate('down');
  assert.deepEqual(
    await db.query('SELECT * FROM ai_providers ORDER BY id'),
    before,
  );
  checks.push('down restores original configuration');
  await migrate('up');
  checks.push('upgrade after rollback works');
  process.stdout.write(
    JSON.stringify({
      success: true,
      isolated_postgresql: true,
      checks,
      provider_inferences: 0,
    }) + '\n',
  );
} finally {
  await db?.destroy();
  if (started) docker('rm', '--force', '--volumes', container);
}
