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
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import {
  assertBusinessesAccess,
  assertBusinessResourcesAccess,
  resolveBusinessAccess,
  scopeBusinessQuery,
} from '../dist/business-access/business-access.js';

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
async function checkModulePolicy(source) {
  const access = new CheckModuleAccessUseCase(source);
  const [[plain], [admin]] = await Promise.all(
    ['plain', 'admin'].map((name) => source.query(
      'INSERT INTO users(email,name) VALUES ($1,$2) RETURNING id::text',
      [`module_policy_${name}@example.invalid`, `Module ${name}`],
    )),
  );
  const [group] = await source.query(
    "INSERT INTO module_groups(key,is_active) VALUES ('module_policy_test',true) RETURNING id::text",
  );
  const routes = ['/tools/module-policy-a', '/tools/module-policy-b'];
  const modules = await source.query(
    `INSERT INTO modules(key,link,module_group_id,is_active) VALUES
      ('module_policy_a',$1,$3,true),('module_policy_b',$2,$3,true) RETURNING id::text,link`,
    [...routes, group.id],
  );
  const first = modules.find((row) => row.link === routes[0]);
  check('ordinary module actor has no role assignments',
    (await source.query('SELECT count(*)::int AS count FROM user_roles WHERE user_id=$1', [plain.id]))[0].count === 0);
  await denies('HTTP module policy rejects unassigned ordinary actor',
    () => access.execute(plain.id, [routes[0]], source.manager), 403);
  await source.query('INSERT INTO user_modules(user_id,module_id) VALUES ($1,$2)', [plain.id, first.id]);
  await access.execute(plain.id, [' /TOOLS/MODULE-POLICY-A/?view=1#section '], source.manager);
  checks.push('HTTP module policy allows assigned module without roles and normalizes routes');
  await denies('HTTP all policy requires every destination',
    () => access.execute(plain.id, routes, source.manager, 'all'), 403);
  await access.execute(plain.id, routes, source.manager, 'any');
  checks.push('HTTP any policy permits one assigned destination');
  await access.execute(plain.id, [routes[0], routes[0]], source.manager);
  checks.push('HTTP all policy deduplicates requested destinations');
  await source.query('UPDATE user_modules SET is_active=false WHERE user_id=$1', [plain.id]);
  await denies('HTTP module policy rejects inactive assignment immediately',
    () => access.execute(plain.id, [routes[0]], source.manager), 403);
  await source.query('UPDATE user_modules SET is_active=true WHERE user_id=$1', [plain.id]);
  await source.query('UPDATE modules SET is_active=false WHERE id=$1', [first.id]);
  await denies('HTTP module policy rejects inactive module',
    () => access.execute(plain.id, [routes[0]], source.manager), 403);
  await source.query('UPDATE modules SET is_active=true WHERE id=$1', [first.id]);
  await source.query('UPDATE module_groups SET is_active=false WHERE id=$1', [group.id]);
  await denies('HTTP module policy rejects inactive group',
    () => access.execute(plain.id, [routes[0]], source.manager), 403);
  await source.query('UPDATE module_groups SET is_active=true WHERE id=$1', [group.id]);
  const [duplicate] = await source.query(
    "INSERT INTO modules(key,link,module_group_id,is_active) VALUES ('module_policy_duplicate',$1,$2,true) RETURNING id::text",
    [' /TOOLS/MODULE-POLICY-A/?legacy=1#section ', group.id],
  );
  await denies('HTTP module policy rejects ambiguous normalized destinations',
    () => access.execute(plain.id, [routes[0]], source.manager), 403);
  await source.query('UPDATE modules SET is_active=false WHERE id=$1', [duplicate.id]);
  await access.execute(plain.id, [routes[0]], source.manager);
  checks.push('HTTP module policy recovers after the duplicate destination is disabled');
  await source.query('UPDATE users SET is_active=false WHERE id=$1', [plain.id]);
  await denies('HTTP module policy rejects inactive actor despite assignment',
    () => access.execute(plain.id, [routes[0]], source.manager), 401);
  await source.query('UPDATE users SET is_active=true WHERE id=$1', [plain.id]);
  const canonicalUsers = await source.query(
    "SELECT id::text,is_active FROM modules WHERE link='/users'",
  );
  await source.query('UPDATE modules SET is_active=false WHERE id=ANY($1::bigint[])', [canonicalUsers.map((row) => row.id)]);
  const [legacy] = await source.query(
    "INSERT INTO modules(key,link,module_group_id,is_active) VALUES ('usuarios','',$1,true) RETURNING id::text",
    [group.id],
  );
  await source.query('INSERT INTO user_modules(user_id,module_id) VALUES ($1,$2)', [plain.id, legacy.id]);
  await access.execute(plain.id, ['/users'], source.manager);
  checks.push('HTTP module policy resolves a known legacy key when its link is blank');
  await source.query("UPDATE modules SET link='SETTINGS/USERS///?foo#bar' WHERE id=$1", [legacy.id]);
  await access.execute(plain.id, ['/users'], source.manager);
  checks.push('HTTP module policy normalizes legacy links without leading slash');
  await source.query('UPDATE modules SET is_active=false WHERE id=$1', [legacy.id]);
  for (const row of canonicalUsers)
    await source.query('UPDATE modules SET is_active=$2 WHERE id=$1', [row.id, row.is_active]);
  await source.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE key='super_admin'",
    [admin.id],
  );
  await source.query('UPDATE module_groups SET is_active=false WHERE id=$1', [group.id]);
  await access.execute(admin.id, [...routes, '/tools/module-policy-absent'], source.manager);
  checks.push('HTTP super administrator bypasses absent assignments and inactive or absent modules');
  await source.query('UPDATE user_roles SET is_active=false WHERE user_id=$1', [admin.id]);
  await denies('HTTP super administrator assignment revocation takes effect immediately',
    () => access.execute(admin.id, [routes[0]], source.manager), 403);
}
async function checkBusinessPolicy(source) {
  // Minimal real relational boundary for the pure policy; no domain services or target DB.
  await source.query('CREATE TABLE businesses (id uuid PRIMARY KEY, owner_id bigint NOT NULL REFERENCES users(id))');
  await source.query(`CREATE TABLE business_collaborators (
    id bigserial PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id),
    user_id bigint NOT NULL REFERENCES users(id), is_active boolean NOT NULL DEFAULT true)`);
  const actors = await Promise.all(['owner', 'member', 'stranger', 'admin'].map(async (name) => {
    const [user] = await source.query(
      'INSERT INTO users(email,name) VALUES ($1,$2) RETURNING id::text',
      [`business_policy_${name}@example.invalid`, name],
    );
    const identity = { userId: user.id, sessionId: randomUUID() };
    await source.query(
      "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES ($1,$2,'synthetic-business-policy',now()+interval '1 hour')",
      [identity.sessionId, identity.userId],
    );
    return identity;
  }));
  const [owner, member, stranger, admin] = actors;
  const owned = randomUUID(), foreign = randomUUID();
  await source.query('INSERT INTO businesses(id,owner_id) VALUES ($1,$2),($3,$4)',
    [owned, owner.userId, foreign, stranger.userId]);
  await source.query('INSERT INTO business_collaborators(business_id,user_id) VALUES ($1,$2)',
    [owned, member.userId]);
  await source.query('CREATE TABLE products (id bigint PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id))');
  await source.query('CREATE TABLE product_logs (id uuid PRIMARY KEY, product_id bigint NOT NULL REFERENCES products(id))');
  await source.query('CREATE TABLE providers (id bigint PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id))');
  await source.query('CREATE TABLE personal_info_provider (id bigint PRIMARY KEY, provider_id bigint NOT NULL REFERENCES providers(id))');
  await source.query('CREATE TABLE invoices (id bigint PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id))');
  for (const table of ['products', 'providers', 'invoices'])
    await source.query(`INSERT INTO ${table}(id,business_id) VALUES (1,$1),(2,$2)`, [owned, foreign]);
  const logOwned = randomUUID(), logForeign = randomUUID();
  await source.query('INSERT INTO product_logs(id,product_id) VALUES ($1,1),($2,2)', [logOwned, logForeign]);
  await source.query('INSERT INTO personal_info_provider(id,provider_id) VALUES (1,1),(2,2)');
  const resourceCases = [
    ['products', '1', '2'], ['providers', '1', '2'], ['invoices', '1', '2'],
    ['product_logs', logOwned, logForeign], ['provider_contacts', '1', '2'],
  ];
  for (const [resource, ownId, foreignId] of resourceCases) {
    await assertBusinessResourcesAccess(source.manager, member, resource, [ownId]);
    checks.push(`cached ${resource} resolves its current explicitly shared business`);
    await denies(`cached ${resource} hides a foreign identity`,
      () => assertBusinessResourcesAccess(source.manager, owner, resource, [foreignId]), 404);
  }
  const visible = async (actor) => {
    const scope = await resolveBusinessAccess(source.manager, actor);
    const query = source.createQueryBuilder().select('business.id', 'id').from('businesses', 'business')
      .where('business.id=:owned OR business.id=:foreign', { owned, foreign });
    return scopeBusinessQuery(query, 'business.id', scope).getRawMany();
  };
  check('business owner SQL cannot escape scope through OR filters',
    JSON.stringify(await visible(owner)) === JSON.stringify([{ id: owned }]));
  check('active business collaborator sees only the explicitly shared business',
    JSON.stringify(await visible(member)) === JSON.stringify([{ id: owned }]));
  await denies('foreign business detail has indistinguishable 404',
    () => assertBusinessesAccess(source.manager, owner, [foreign]), 404);
  await denies('mixed owned and foreign business batch rejected before writes',
    () => source.transaction((manager) => assertBusinessesAccess(manager, owner, [owned, foreign], { lock: true })), 404);
  await source.transaction((manager) => assertBusinessesAccess(manager, owner, [owned, owned], { lock: true }));
  checks.push('business batch locks and deduplicates an owned destination');
  await source.query('UPDATE business_collaborators SET is_active=false WHERE user_id=$1', [member.userId]);
  check('revoked business collaboration immediately removes SQL visibility', (await visible(member)).length === 0);
  await denies('revoked business collaborator cannot mutate the business',
    () => source.transaction((manager) => assertBusinessesAccess(manager, member, [owned], { lock: true })), 404);
  for (const [resource, ownId] of resourceCases)
    await denies(`cached ${resource} blocks revoked collaborator`,
      () => assertBusinessResourcesAccess(source.manager, member, resource, [ownId]), 404);
  await source.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE key='super_admin'", [admin.userId]);
  check('business super administrator SQL sees every owner', (await visible(admin)).length === 2);
  for (const [resource, ownId, foreignId] of resourceCases) {
    await assertBusinessResourcesAccess(source.manager, admin, resource, [ownId, foreignId]);
    checks.push(`cached ${resource} permits current super administrator inspection`);
  }
  await source.transaction((manager) => assertBusinessesAccess(manager, admin, [owned, foreign], { lock: true }));
  checks.push('business super administrator can authorize every existing destination');
  await denies('business super administrator still gets 404 for missing destination',
    () => assertBusinessesAccess(source.manager, admin, [randomUUID()]), 404);
  await source.query('UPDATE auth_sessions SET revoked_at=now() WHERE public_id=$1', [admin.sessionId]);
  await denies('business super administrator requires a current session',
    () => resolveBusinessAccess(source.manager, admin), 401);
}
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
  await checkModulePolicy(db);
  await checkBusinessPolicy(db);
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
    'ordinary foreign author access hidden',
    () => resource.execute(identity, { ownerId: other.id, access: 'author' }),
    404,
  );
  check(
    'ordinary author retains own resource access without role actions',
    (await resource.execute(identity, { ownerId: owner.id, access: 'author' }))
      .actorId === owner.id,
  );
  check(
    'assigned modules allow access without existing action',
    !!(await authorize.execute(identity, { actionKeys: ['ai:manage'] })),
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
    'adding role actions preserves module access',
    !!(await authorize.execute(identity, { actionKeys: ['ai:manage'] })),
  );
  await db.query('UPDATE role_actions SET is_active=false WHERE role_id=$1', [
    role.id,
  ]);
  check(
    'revoking role actions does not remove assigned module access',
    !!(await authorize.execute(identity, { actionKeys: ['ai:manage'] })),
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
