// Real compiled Nest DI/use cases + disposable PostgreSQL. No configured DB, Redis or providers.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Global, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { InitialCoreSchema1789257400000 } from '../dist/migrations/1789257400000-InitialCoreSchema.js';
import { AuthSessions1789257600000 } from '../dist/migrations/1789257600000-AuthSessions.js';
import { RegisterNodiaAiNavigation1792100000000 } from '../dist/migrations/1792100000000-RegisterNodiaAiNavigation.js';
import { NodiaAiModule } from '../dist/nodia-ai/nodia-ai.module.js';
import { AuthorizeNodiaAiUseCase } from '../dist/nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { AuthorizeNodiaAiResourceUseCase } from '../dist/nodia-ai/use-case/authorize-nodia-ai-resource.use-case.js';
import { SeedNodiaAiNavigationUseCase } from '../dist/nodia-ai/use-case/seed-nodia-ai-navigation.use-case.js';

const container = `template_nodia_ai_authorization_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let db,
  app,
  started = false;
const checks = [];
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
};
const denies = async (name, operation, status) => {
  await assert.rejects(
    operation,
    (error) => error.getStatus?.() === status,
    name,
  );
  checks.push(name);
};
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
    'POSTGRES_DB=nodia_ai_test',
    '--env',
    'POSTGRES_USER=nodia_ai_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'nodia_ai_test',
      );
      break;
    } catch (error) {
      if (attempt === 79) throw error;
      await delay(250);
    }
  }
  db = await new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'nodia_ai_test',
    password,
    database: 'nodia_ai_test',
    synchronize: false,
    entities: [],
    migrations: [
      InitialCoreSchema1789257400000,
      AuthSessions1789257600000,
      RegisterNodiaAiNavigation1792100000000,
    ],
  }).initialize();
  await db.runMigrations();
  class IsolatedDatabase {}
  Global()(IsolatedDatabase);
  Module({
    providers: [{ provide: DataSource, useValue: db }],
    exports: [DataSource],
  })(IsolatedDatabase);
  class TestRoot {}
  Module({ imports: [IsolatedDatabase, NodiaAiModule] })(TestRoot);
  app = await NestFactory.createApplicationContext(TestRoot, { logger: false });
  const authorize = app.get(AuthorizeNodiaAiUseCase),
    resource = app.get(AuthorizeNodiaAiResourceUseCase);
  const seed = app.get(SeedNodiaAiNavigationUseCase);
  const ids = await seed.execute();
  const again = await seed.execute();
  check(
    'repeat seed preserves catalog identities',
    JSON.stringify(ids) === JSON.stringify(again),
  );
  const concurrent = await Promise.all([seed.execute(), seed.execute()]);
  check('concurrent seeds converge on the same catalog identities',
    concurrent.every(value => JSON.stringify(value) === JSON.stringify(ids)));
  const beforeFailure = (await db.query('SELECT updated_at::text AS value FROM modules WHERE id=$1', [ids.module_id]))[0].value;
  await db.query(`CREATE FUNCTION reject_qa_translation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic translation failure'; END; $$`);
  await db.query('CREATE TRIGGER reject_qa_translation BEFORE INSERT ON translations FOR EACH ROW EXECUTE FUNCTION reject_qa_translation()');
  await assert.rejects(() => seed.execute(), /synthetic translation failure/);
  checks.push('translation failure rejects the entire seed');
  check('failed seed rolls back the preceding module update',
    (await db.query('SELECT updated_at::text AS value FROM modules WHERE id=$1', [ids.module_id]))[0].value === beforeFailure);
  await db.query('DROP TRIGGER reject_qa_translation ON translations');
  await db.query('DROP FUNCTION reject_qa_translation()');
  check(
    'no user assignments from migration/seed',
    (await db.query('SELECT count(*)::int AS count FROM user_modules'))[0]
      .count === 0,
  );
  check(
    'both module translations exist',
    (
      await db.query(
        "SELECT count(*)::int AS count FROM translations WHERE source_entity='modules' AND source_id=$1",
        [ids.module_id],
      )
    )[0].count === 2,
  );
  const [[owner], [other]] = await Promise.all(
    ['owner', 'other'].map(async (name) =>
      db.query(
        'INSERT INTO users(email,name) VALUES ($1,$2) RETURNING id::text',
        [`${name}@example.invalid`, name],
      ),
    ),
  );
  const identity = { userId: owner.id, sessionId: randomUUID() };
  await db.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES ($1,$2,'synthetic',now()+interval '1 hour')",
    [identity.sessionId, owner.id],
  );
  await denies(
    'ordinary actor without NodiaAI assignment',
    () => authorize.execute(identity),
    403,
  );
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES ($1,$2)', [
    owner.id,
    ids.module_id,
  ]);
  check(
    'current actor admitted after assignment',
    (await authorize.execute(identity)).actorId === owner.id,
  );
  const [target] = await db.query(
    "INSERT INTO modules(key,link,module_group_id) VALUES ('finance_test','/tools/finance-test',$1) RETURNING id::text",
    [ids.group_id],
  );
  const requirements = { moduleRoutes: ['/tools/finance-test'] };
  await denies(
    'unassigned destination rejected',
    () => authorize.execute(identity, requirements),
    403,
  );
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES ($1,$2)', [
    owner.id,
    target.id,
  ]);
  check(
    'discovery resolves current target ID',
    (await authorize.execute(identity, requirements)).modules.some(
      (m) => m.id === target.id,
    ),
  );
  await db.query(
    'UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2',
    [owner.id, target.id],
  );
  await denies(
    'revoked destination blocks recovery immediately',
    () =>
      resource.execute(
        identity,
        { ownerId: owner.id, access: 'read' },
        requirements,
      ),
    403,
  );
  await db.query('UPDATE user_modules SET is_active=true WHERE user_id=$1', [
    owner.id,
  ]);
  await db.query('UPDATE modules SET is_active=false WHERE id=$1', [target.id]);
  await denies(
    'inactive destination rejected',
    () => authorize.execute(identity, requirements),
    403,
  );
  await db.query('UPDATE modules SET is_active=true WHERE id=$1', [target.id]);
  await db.query('UPDATE module_groups SET is_active=false WHERE id=$1', [
    ids.group_id,
  ]);
  await denies(
    'inactive group blocks NodiaAI',
    () => authorize.execute(identity),
    403,
  );
  await seed.execute();
  check(
    'repeat seed preserves disabled group',
    (
      await db.query('SELECT is_active FROM module_groups WHERE id=$1', [
        ids.group_id,
      ])
    )[0].is_active === false,
  );
  await db.query('UPDATE module_groups SET is_active=true WHERE id=$1', [
    ids.group_id,
  ]);
  await db.query('UPDATE modules SET is_active=false WHERE id=$1', [
    ids.module_id,
  ]);
  await seed.execute();
  await denies(
    'seed does not reactivate NodiaAI',
    () => authorize.execute(identity),
    403,
  );
  await db.query('UPDATE modules SET is_active=true WHERE id=$1', [
    ids.module_id,
  ]);
  await db.query(
    "UPDATE translations SET value='Custom' WHERE source_entity='modules' AND source_id=$1 AND locale='en'",
    [ids.module_id],
  );
  await seed.execute();
  check(
    'seed preserves edited translations',
    (
      await db.query(
        "SELECT value FROM translations WHERE source_entity='modules' AND source_id=$1 AND locale='en'",
        [ids.module_id],
      )
    )[0].value === 'Custom',
  );
  await denies(
    'ordinary foreign resource hidden',
    () => resource.execute(identity, { ownerId: other.id, access: 'read' }),
    404,
  );
  await denies(
    'existing action missing',
    () => authorize.execute(identity, { actionKeys: ['ai:manage'] }),
    403,
  );
  const [role] = await db.query(
    "INSERT INTO roles(key) VALUES ('ai_test') RETURNING id::text",
  );
  const [action] = await db.query(
    "INSERT INTO actions(key) VALUES ('ai:manage') RETURNING id::text",
  );
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES ($1,$2)', [
    owner.id,
    role.id,
  ]);
  await db.query('INSERT INTO role_actions(role_id,action_id) VALUES ($1,$2)', [
    role.id,
    action.id,
  ]);
  check(
    'existing action granted via active roles',
    !!(await authorize.execute(identity, { actionKeys: ['ai:manage'] })),
  );
  await db.query('UPDATE role_actions SET is_active=false WHERE role_id=$1', [
    role.id,
  ]);
  await denies(
    'revoked role action rejected',
    () => authorize.execute(identity, { actionKeys: ['ai:manage'] }),
    403,
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE key='super_admin'",
    [owner.id],
  );
  await db.query('UPDATE user_modules SET is_active=false WHERE user_id=$1', [
    owner.id,
  ]);
  const superActor = await resource.execute(
    identity,
    { ownerId: other.id, access: 'read' },
    requirements,
  );
  check(
    'super administrator bypasses assignments while retaining actor',
    superActor.isSuperAdmin && superActor.actorId === owner.id,
  );
  await denies(
    'super administrator cannot author/confirm for another owner',
    () => resource.execute(identity, { ownerId: other.id, access: 'author' }),
    403,
  );
  await db.query("UPDATE roles SET is_active=false WHERE key='super_admin'");
  await denies(
    'super administrator role revocation effective immediately',
    () => authorize.execute(identity),
    403,
  );
  await db.query("UPDATE roles SET is_active=true WHERE key='super_admin'");
  await db.query(
    'UPDATE auth_sessions SET revoked_at=now() WHERE public_id=$1',
    [identity.sessionId],
  );
  await denies(
    'revoked session rejected even for super administrator',
    () => authorize.execute(identity),
    401,
  );
  await db.query(
    "UPDATE auth_sessions SET revoked_at=NULL,expires_at=now()-interval '1 second' WHERE public_id=$1",
    [identity.sessionId],
  );
  await denies(
    'expired session rejected',
    () => authorize.execute(identity),
    401,
  );
  await db.query(
    "UPDATE auth_sessions SET expires_at=now()+interval '1 hour' WHERE public_id=$1",
    [identity.sessionId],
  );
  await db.query('UPDATE users SET is_active=false WHERE id=$1', [owner.id]);
  await denies(
    'inactive user rejected',
    () => authorize.execute(identity),
    401,
  );
  await db.query('UPDATE users SET is_active=true WHERE id=$1', [owner.id]);
  await denies(
    'session cannot be used as another actor',
    () => authorize.execute({ ...identity, userId: other.id }),
    401,
  );
  const nextSession = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES ($1,$2,'synthetic',now()+interval '1 hour')",
    [nextSession, owner.id],
  );
  check(
    'new valid session can recover own resource',
    (
      await resource.execute(
        { ...identity, sessionId: nextSession },
        { ownerId: owner.id, access: 'read' },
        requirements,
      )
    ).sessionId === nextSession,
  );
  console.log(
    JSON.stringify({
      task: 'AI-07',
      scope: 'compiled_nest_di_disposable_postgresql16',
      checks: checks.length,
      passed: checks,
      configuredDatabaseTouched: false,
      providersCalled: false,
    }),
  );
} finally {
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '--force', container);
}
