// Real compiled Core cases/HTTP and disposable PostgreSQL16; never the configured DB.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { Global, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import qs from 'qs';
import { installAuthorityFixture } from './fixtures/authority.integration.mjs';

process.env.DOTENV_CONFIG_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = 'order-owner@example.invalid';

const { InitialCoreSchema1789257400000 } = await import('../dist/migrations/1789257400000-InitialCoreSchema.js');
const { AddModuleSortOrder1793200000000 } = await import('../dist/migrations/1793200000000-AddModuleSortOrder.js');
const { ModuleModule } = await import('../dist/module/module.module.js');
const { ModuleGroupModule } = await import('../dist/module-group/module-group.module.js');
const { RedisService } = await import('../dist/common/redis/redis.service.js');
const { AuthorizationService } = await import('../dist/authorization/authorization.service.js');
const { TranslationService } = await import('../dist/translation/translation.service.js');
const { User } = await import('../dist/user/entities/user.entity.js');
const { ModuleGroup } = await import('../dist/module-group/entities/module-group.entity.js');
const { MoveModuleOrderUseCase } = await import('../dist/module/use-case/move-module-order.use-case.js');
const { withCoreAuthorityLock } = await import('../dist/authorization/core-authority-transaction.js');

const container = `template_module_order_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) => execFileSync('docker', args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
let db, cleanDb, app, started = false, invalidations = 0, requests = 0, checks = 0;
const queryLog = [];
const queryFailures = [];
const logger = {
  logQuery(query) { queryLog.push(query); },
  logQueryError(error, query) { queryFailures.push({ message: String(error), query }); },
  logQuerySlow() {}, logSchemaBuild() {}, logMigration() {}, log() {},
};
function check(value, message) { assert.ok(value, message); checks += 1; }
const pointer = (item) => item ? { id: String(item.id), sort_order: item.sort_order } : null;

try {
  docker('run', '--detach', '--rm', '--pull=never', '--name', container,
    '--tmpfs', '/var/lib/postgresql/data:rw,size=160m',
    '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_DB=order_test',
    '--env', 'POSTGRES_USER=order_test', '--env', `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine');
  started = true;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'order_test'); break; }
    catch (error) { if (attempt === 79) throw error; await delay(250); }
  }
  const options = {
    type: 'postgres', host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'order_test', password, database: 'order_test',
    synchronize: false, logging: ['query'], logger,
    entities: [fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url))],
  };
  db = await new DataSource(options).initialize();
  const runner = db.createQueryRunner();
  try {
    await new InitialCoreSchema1789257400000().up(runner);
    await db.query(`
      INSERT INTO module_groups(id,key,is_active) VALUES
        (10,'settings',true),(20,'other',true),(30,'business',true),(40,'inactive_group',false);
      INSERT INTO modules(id,module_group_id,key,link,is_active) VALUES
        (100,30,'first','/first',true),(101,30,'inactive_middle','/middle',false),
        (102,30,'third','/third',true),(9007199254740993,30,'large_id','/large',true),
        (200,20,'other_module','/other',true),(300,10,'settings_module','/settings',true),
        (400,40,'hidden_parent','/hidden',true);
      SELECT setval(pg_get_serial_sequence('module_groups','id'),1000);
      SELECT setval(pg_get_serial_sequence('modules','id'),1000);
    `);
    await runner.startTransaction();
    try {
      await new AddModuleSortOrder1793200000000().up(runner);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    }
  } finally { await runner.release(); }

  const migratedGroups = await db.query('SELECT id,sort_order FROM module_groups ORDER BY sort_order,id');
  check(JSON.stringify(migratedGroups.map((item) => item.id)) === JSON.stringify(['30','20','40','1','10']), 'Backfill retains group priority intent, deterministic ID ties, and the baseline settings group');
  check(migratedGroups.every((item, index) => item.sort_order === index), 'Backfill gives distinct group positions');
  const migratedModules = await db.query('SELECT id,sort_order FROM modules WHERE module_group_id=30 ORDER BY sort_order,id');
  check(JSON.stringify(migratedModules.map((item) => item.id)) === JSON.stringify(['100','101','102','9007199254740993']), 'Module backfill preserves full bigint identity order');
  const constraints = await db.query(`SELECT conname,condeferrable,condeferred FROM pg_constraint WHERE conname IN ('uq_module_groups_sort_order','uq_modules_group_sort_order') ORDER BY conname`);
  check(constraints.length === 2 && constraints.every((item) => item.condeferrable && !item.condeferred), 'Uniqueness is deferrable and initially immediate');
  const defaults = await db.query("SELECT column_default FROM information_schema.columns WHERE table_name IN ('modules','module_groups') AND column_name='sort_order'");
  check(defaults.length === 2 && defaults.every((item) => item.column_default === null), 'No colliding DEFAULT0 is installed');
  await assert.rejects(db.query("INSERT INTO module_groups(key,sort_order) VALUES('negative',-1)"), (error) => error.code === '23514'); checks += 1;
  await assert.rejects(db.query("INSERT INTO module_groups(key,sort_order) VALUES('duplicate',0)"), (error) => error.code === '23505'); checks += 1;
  await assert.rejects(db.query("INSERT INTO modules(key,link,module_group_id,sort_order) VALUES('duplicate','/',30,0)"), (error) => error.code === '23505'); checks += 1;

  const authority = await installAuthorityFixture(db, ['1','2']);
  const cache = new Map();
  const redis = {
    async delByPattern(pattern) { assert.equal(pattern, 'auth:context:*'); cache.clear(); invalidations += 1; },
    async get(key) { return cache.get(key) ?? null; },
    async set(key, value) { cache.set(key, value); },
  };
  class FakeCacheModule {}
  Global()(FakeCacheModule);
  Module({ providers: [{ provide: RedisService, useValue: redis }], exports: [RedisService] })(FakeCacheModule);
  class SyntheticGuard {
    canActivate(context) {
      const request = context.switchToHttp().getRequest();
      if (request.headers['x-order-test'] !== 'fixture') throw new UnauthorizedException();
      request.auth = authority.principal();
      return true;
    }
  }
  class IntegrationModule {}
  Module({
    imports: [TypeOrmModule.forRoot(options), FakeCacheModule, ModuleModule, ModuleGroupModule],
    providers: [{ provide: APP_GUARD, useClass: SyntheticGuard }],
  })(IntegrationModule);
  app = await NestFactory.create(IntegrationModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.getHttpAdapter().getInstance().set('query parser', (value) => qs.parse(value));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const call = async (path, method = 'GET', body, authenticated = true) => {
    requests += 1;
    const response = await fetch(`${base}/api/v1/${path}`, {
      method, headers: { ...(authenticated ? { 'x-order-test': 'fixture' } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  const groups = () => db.query('SELECT * FROM module_groups ORDER BY sort_order,id');
  const modules = (group) => db.query('SELECT * FROM modules WHERE module_group_id=$1 ORDER BY sort_order,id', [group]);
  const groupPayload = (item, direction, neighbor, pageSize = 1) => ({ direction, expected_sort_order: item.sort_order, expected_neighbor: pointer(neighbor), page_size: pageSize });
  const modulePayload = (item, direction, neighbor, pageSize = 1) => ({ ...groupPayload(item, direction, neighbor, pageSize), expected_module_group_id: String(item.module_group_id) });

  for (const path of ['module/100/order','modules/100/order','module-group/30/order','module-groups/30/order'])
    check((await call(path, 'PATCH', {}, false)).status === 401, `Authenticated order boundary ${path}`);
  for (const id of ['0','01','-1','9223372036854775808','text'])
    check((await call(`module/${id}/order`, 'PATCH', modulePayload({ ...migratedModules[0], module_group_id: '30' }, 'down', migratedModules[1]))).status === 400, 'Strict bigint route IDs');
  for (const payload of [
    { direction: 'sideways', expected_sort_order: 0, expected_neighbor: null, expected_module_group_id: '30' },
    { direction: 'up', expected_sort_order: -1, expected_neighbor: null, expected_module_group_id: '30' },
    { direction: 'up', expected_sort_order: 0, expected_module_group_id: '30' },
    { direction: 'up', expected_sort_order: 0, expected_neighbor: { id: '101', sort_order: 1, foreign: true }, expected_module_group_id: '30' },
  ]) check((await call('module/100/order', 'PATCH', payload)).status === 400, 'Nested order payload is validated');
  check((await call('module-group', 'POST', { key: 'forbidden_order', sort_order: 100 })).status === 400, 'CRUD cannot assign arbitrary order');
  check((await call('module', 'POST', { key: 'forbidden_order', module_group_id: '30', link: '/', sort_order: 100 })).status === 400, 'Module CRUD cannot assign arbitrary order');

  const initialMax = Math.max(...migratedGroups.map((item) => item.sort_order));
  const appendedGroups = await Promise.all(['new_alpha','new_beta'].map((key) => call('module-group', 'POST', { key })));
  check(appendedGroups.every((item) => item.status === 201), 'Concurrent group creations complete');
  check(JSON.stringify(appendedGroups.map((item) => item.body.sort_order).sort((a,b) => a-b)) === JSON.stringify([initialMax+1,initialMax+2]), 'Concurrent group creation appends distinct values');
  const emptyGroup = appendedGroups[0].body;
  const repeated = await call('module-group', 'POST', { key: emptyGroup.key, is_active: false });
  check(repeated.status === 201 && repeated.body.id === emptyGroup.id && repeated.body.sort_order === emptyGroup.sort_order, 'Group key upsert does not append again');
  const createdModules = await Promise.all(['new_first','new_second'].map((key) => call('module', 'POST', { key, module_group_id: '30', link: `/${key}` })));
  check(createdModules.every((item) => item.status === 201), 'Concurrent module creations complete');
  check(JSON.stringify(createdModules.map((item) => item.body.sort_order).sort((a,b) => a-b)) === JSON.stringify([4,5]), 'Append includes inactive modules and does not race');
  const retained = createdModules[0].body;
  const repeatedModule = await call('module', 'POST', { key: retained.key, module_group_id: '30', link: '/changed' });
  check(repeatedModule.status === 201 && repeatedModule.body.id === retained.id && repeatedModule.body.sort_order === retained.sort_order, 'Module key upsert preserves position');
  const scopedCreations = await Promise.all([
    call('module', 'POST', { key: 'second_scope', module_group_id: emptyGroup.id, link: '/scope', is_active: false }),
    call('module', 'POST', { key: 'parallel_scope', module_group_id: appendedGroups[1].body.id, link: '/parallel' }),
  ]);
  check(scopedCreations.every((item) => item.status === 201 && item.body.sort_order === 0), 'Concurrent creations in distinct empty groups have independent positions');
  const secondScope = scopedCreations[0];
  check(secondScope.status === 201 && secondScope.body.sort_order === 0, 'Empty module group starts at zero, including inactive creation');
  const changedGroup = await call(`module/${retained.id}`, 'PUT', { module_group_id: emptyGroup.id });
  check(changedGroup.status === 200 && changedGroup.body.sort_order === 1 && changedGroup.body.module_group_id === emptyGroup.id, 'Changing group appends at target and preserves origin gaps');
  const reactivated = await call(`module/${secondScope.body.id}`, 'PUT', { is_active: true });
  check(reactivated.status === 200 && reactivated.body.sort_order === 0, 'Reactivation does not move a module');

  const page = await call('modules?ordering=true&page=2&limit=1&includes=false');
  check(page.status === 200 && page.body.data.length === 1, `Ordering page remains bounded without includes: ${JSON.stringify(page)}; last SQL failure: ${JSON.stringify(queryFailures.at(-1))}`);
  const canonical = await db.query('SELECT m.id FROM modules m JOIN module_groups g ON g.id=m.module_group_id ORDER BY g.sort_order,g.id,m.sort_order,m.id');
  check(page.body.data[0].id === canonical[1].id, 'Canonical grouping order is applied before pagination');
  const normalWithoutIncludes = await call('modules?page=2&limit=1&includes=false');
  check(normalWithoutIncludes.status === 200 && normalWithoutIncludes.body.data[0].id === canonical[1].id && normalWithoutIncludes.body.data[0].module_group === undefined, 'Normal paginated includes=false uses the canonical order without relation hydration');
  check(page.body.data[0].module_group === undefined, 'includes=false does not serialize the relation');
  check(page.body.data[0].ordering.previous.id === '100' && page.body.data[0].ordering.next.id === '102', 'Page metadata uses real neighbors beyond page boundaries');
  check(page.body.data[0].group_ordering !== undefined, 'Module page includes group movement metadata by batch');
  const anchor = canonical.at(-1).id;
  const located = await call(`modules?ordering=true&limit=1&locate_id=${anchor}&includes=false`);
  check(located.status === 200 && located.body.meta.page === canonical.length && located.body.data[0].id === anchor && located.body.data[0].module_group === undefined, 'Locate an anchor on its real canonical page within the same ordering snapshot');
  check((await call(`modules?limit=1&locate_id=${anchor}`)).status === 400, 'Anchor lookup requires the complete ordering view');
  check((await call('modules?ordering=true&locate_id=9223372036854775807')).status === 404, 'A deleted or missing anchor is not replaced by a guessed row');
  check((await call('modules?ordering=true&locate_id=9223372036854775808')).status === 400, 'Anchor lookup validates the native bigint range');
  const groupPage = await call('module-groups?ordering=true&page=2&limit=1');
  check(groupPage.status === 200 && groupPage.body.data[0].id === '20' && groupPage.body.data[0].ordering.previous.id === '30' && groupPage.body.data[0].ordering.next.id === '40', 'Group page neighbors are computed before slicing and include inactive groups');
  check((await call('modules?ordering=true&all=true')).status === 400, 'Ordering cannot request unbounded module data');
  check((await call('module-groups?ordering=true&q[is_active_eq]=true')).status === 400, 'Ordering rejects partial filtered groups');
  const filtered = await call('modules?limit=100&q[is_active_eq]=true');
  check(filtered.status === 200 && filtered.body.data.every((item) => item.is_active), 'Normal active filtering remains available');
  const alternate = await call('modules?limit=100&includes=false&q[s]=key%20desc');
  const explicit = await db.query('SELECT id FROM modules ORDER BY key DESC,id ASC');
  check(alternate.status === 200 && JSON.stringify(alternate.body.data.map((item) => item.id)) === JSON.stringify(explicit.map((item) => item.id)), 'Explicit allowed Ransack order remains intact');
  for (const [route, table] of [['modules','modules'],['module-groups','module_groups']]) {
    const sorted = await call(`${route}?limit=100&includes=false&q[s]=%20id%20desc`);
    const expected = await db.query(`SELECT id FROM ${table} ORDER BY id DESC`);
    check(sorted.status === 200 && JSON.stringify(sorted.body.data.map((item) => item.id)) === JSON.stringify(expected.map((item) => item.id)), 'Whitespace around explicit bigint ID order does not replace DESC with a tie-breaker');
  }

  let businessModules = await modules('30');
  const beforeMove = businessModules[0];
  const neighbor = businessModules[1];
  check((await call('module/9223372036854775807/order', 'PATCH', modulePayload(beforeMove, 'down', neighbor))).status === 404, 'A valid absent module identity is not a malformed payload');
  await db.query('UPDATE users SET is_active=false WHERE id=1');
  const revoked = await call(`module/${beforeMove.id}/order`, 'PATCH', modulePayload(beforeMove, 'down', neighbor));
  check(revoked.status === 401 && revoked.body.message === 'auth:session_expired', 'Transaction reauthorizes an actor revoked after the synthetic HTTP boundary');
  await db.query('UPDATE users SET is_active=true WHERE id=1');
  const oldInvalidations = invalidations;
  const payload = modulePayload(beforeMove, 'down', neighbor);
  const moved = await call(`modules/${beforeMove.id}/order`, 'PATCH', payload);
  check(moved.status === 200 && moved.body.status === 'moved', 'Module swap completes using plural alias');
  check(moved.body.sort_order === neighbor.sort_order && moved.body.page === 2 && moved.body.position === 2, 'Move returns persisted position and new page');
  check(invalidations === oldInvalidations + 1, 'Committed swap invalidates context exactly once');
  businessModules = await modules('30');
  check(businessModules[0].id === neighbor.id && businessModules[1].id === beforeMove.id, 'Both neighbor positions are persisted');
  check((await call(`module/${beforeMove.id}/order`, 'PATCH', payload)).status === 409, 'Immediate replay cannot move the row again');
  check((await call(`module/${beforeMove.id}/order`, 'PATCH', { ...modulePayload(businessModules[1], 'down', businessModules[2]), expected_module_group_id: '20' })).status === 409, 'Stale group precondition has no effect');
  const edge = await call(`module/${businessModules[0].id}/order`, 'PATCH', modulePayload(businessModules[0], 'up', null));
  check(edge.status === 200 && edge.body.status === 'unchanged', 'An actual module edge is an explicit no-op');

  let orderedGroups = await groups();
  const groupBefore = orderedGroups[0], groupNeighbor = orderedGroups[1];
  const groupMoveBody = groupPayload(groupBefore, 'down', groupNeighbor);
  const groupMove = await call(`module-groups/${groupBefore.id}/order`, 'PATCH', groupMoveBody);
  check(groupMove.status === 200 && groupMove.body.status === 'moved' && groupMove.body.sort_order === groupNeighbor.sort_order, 'Group swap uses the same atomic semantics');
  check((await call(`module-group/${groupBefore.id}/order`, 'PATCH', groupMoveBody)).status === 409, 'Group immediate replay conflicts');
  orderedGroups = await groups();
  const groupEdge = await call(`module-group/${orderedGroups[0].id}/order`, 'PATCH', groupPayload(orderedGroups[0], 'up', null));
  check(groupEdge.status === 200 && groupEdge.body.status === 'unchanged', 'Group edge is no-op');

  // Relative placement rotates one complete same-group interval, including
  // inactive rows and holes, rather than issuing one PATCH per adjacent swap.
  await db.transaction(async (manager) => {
    await manager.query('SET CONSTRAINTS uq_modules_group_sort_order DEFERRED');
    await manager.query('UPDATE modules SET sort_order=sort_order*7+2 WHERE module_group_id=30');
    await manager.query('SET CONSTRAINTS uq_modules_group_sort_order IMMEDIATE');
  });
  let relativeRows = await modules('30');
  const originalIds = relativeRows.map((item) => item.id);
  const originalRanks = relativeRows.map((item) => item.sort_order);
  const originalActivity = relativeRows.map((item) => [item.id, item.is_active]).sort();
  const source = relativeRows[0], target = relativeRows.at(-1);
  const relativeBody = modulePayload(source, 'after', target, 2);
  const relativeInvalidations = invalidations;
  queryLog.length = 0;
  const relativeMove = await call(`module/${source.id}/order`, 'PATCH', relativeBody);
  check(relativeMove.status === 200 && relativeMove.body.status === 'moved', 'Relative after places the source beyond a distant target');
  check(queryLog.filter((sql) => sql.startsWith('UPDATE modules AS target SET sort_order')).length === 1, 'A distant move performs one set-based UPDATE, not repeated swaps');
  relativeRows = await modules('30');
  check(JSON.stringify(relativeRows.map((item) => item.id)) === JSON.stringify([...originalIds.slice(1), source.id]), 'Relative move persists the entire expected order, including intermediate rows');
  check(JSON.stringify(relativeRows.map((item) => item.sort_order)) === JSON.stringify(originalRanks), 'Relative placement retains the exact gapped rank set');
  check(JSON.stringify(relativeRows.map((item) => [item.id, item.is_active]).sort()) === JSON.stringify(originalActivity), 'Relative rotation includes inactive rows without changing their activity');
  check(relativeMove.body.next === null && relativeMove.body.previous.id === target.id && relativeMove.body.sort_order === originalRanks.at(-1), 'Response describes final neighbors, not the pre-move target position');
  check(invalidations === relativeInvalidations + 1, 'One distant movement invalidates authorization context once');
  check((await call(`module/${source.id}/order`, 'PATCH', relativeBody)).status === 409, 'Repeating a relative command with stale source or target ranks conflicts');
  const adjacentInvalidations = invalidations;
  queryLog.length = 0;
  const adjacent = await call(`module/${source.id}/order`, 'PATCH', modulePayload(relativeRows.at(-1), 'after', relativeRows.at(-2)));
  check(adjacent.status === 200 && adjacent.body.status === 'unchanged' && invalidations === adjacentInvalidations, 'An already-adjacent explicit target is no-op and does not invalidate cache');
  check(!queryLog.some((sql) => sql.startsWith('UPDATE modules')), 'No-op relative placement emits no UPDATE');
  const crossTarget = (await modules('20'))[0];
  check((await call(`module/${source.id}/order`, 'PATCH', modulePayload(relativeRows.at(-1), 'before', crossTarget))).status === 409, 'A target in another group cannot move source membership');
  check((await call(`module/${source.id}/order`, 'PATCH', modulePayload(relativeRows.at(-1), 'before', null))).status === 400, 'Relative placement requires a non-null target at the HTTP boundary');
  check((await call(`module/${source.id}/order`, 'PATCH', modulePayload(relativeRows.at(-1), 'before', relativeRows.at(-1)))).status === 400, 'Relative placement cannot target itself');

  // Both source and target are compared after acquiring the shared Core writer
  // frontier: a concurrent duplicate has one effect and one stale response.
  const relativeConcurrentBody = modulePayload(relativeRows.at(-1), 'before', relativeRows[0]);
  const relativeConcurrent = await Promise.all([
    call(`module/${source.id}/order`, 'PATCH', relativeConcurrentBody),
    call(`module/${source.id}/order`, 'PATCH', relativeConcurrentBody),
  ]);
  check(JSON.stringify(relativeConcurrent.map((item) => item.status).sort()) === JSON.stringify([200,409]), 'Concurrent distant placement commits once and rejects the stale peer');
  relativeRows = await modules('30');
  check(relativeRows[0].id === source.id && JSON.stringify(relativeRows.map((item) => item.sort_order)) === JSON.stringify(originalRanks), 'Concurrent rotation retains the rank set and requested leading source');

  orderedGroups = await groups();
  const farGroup = orderedGroups.at(-1), firstGroup = orderedGroups[0];
  const groupRelative = await call(`module-group/${farGroup.id}/order`, 'PATCH', groupPayload(farGroup, 'before', firstGroup));
  check(groupRelative.status === 200 && groupRelative.body.status === 'moved' && (await groups())[0].id === farGroup.id, 'The same relative interval placement also supports group ordering');

  const relativeRollbackBefore = relativeRows.map(pointer);
  const relativeRollbackInvalidations = invalidations;
  await db.query(`CREATE FUNCTION reject_relative_rotation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=${relativeRows[1].id} AND NEW.sort_order<>OLD.sort_order THEN RAISE EXCEPTION 'synthetic range rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_relative_rotation BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION reject_relative_rotation();`);
  const relativeRollback = await call(`module/${relativeRows[0].id}/order`, 'PATCH', modulePayload(relativeRows[0], 'after', relativeRows.at(-1)));
  check(relativeRollback.status === 500 && JSON.stringify((await modules('30')).map(pointer)) === JSON.stringify(relativeRollbackBefore), 'A failed middle row rolls the whole relative interval back');
  check(invalidations === relativeRollbackInvalidations, 'A rolled-back interval does not invalidate committed context');
  await db.query('DROP TRIGGER reject_relative_rotation ON modules; DROP FUNCTION reject_relative_rotation()');

  // Trigger fails on one row of the swap: no partial move or cache invalidation survives.
  businessModules = await modules('30');
  const rollbackBefore = businessModules.map((item) => ({ id: item.id, sort_order: item.sort_order }));
  const rollbackInvalidations = invalidations;
  await db.query(`CREATE FUNCTION reject_order_swap() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=${businessModules[1].id} AND NEW.sort_order<>OLD.sort_order THEN RAISE EXCEPTION 'synthetic order rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_order_swap BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION reject_order_swap();`);
  const rollback = await call(`module/${businessModules[0].id}/order`, 'PATCH', modulePayload(businessModules[0], 'down', businessModules[1]));
  check(rollback.status === 500, 'Swap failure is not reported as success');
  check(JSON.stringify((await modules('30')).map((item) => ({ id: item.id, sort_order: item.sort_order }))) === JSON.stringify(rollbackBefore), 'Both positions survive rollback unchanged');
  check(invalidations === rollbackInvalidations, 'Rollback does not invalidate committed context');
  await db.query('DROP TRIGGER reject_order_swap ON modules; DROP FUNCTION reject_order_swap()');

  // Two administrators using the same page snapshot cannot both perform the old move.
  const concurrentBody = modulePayload(businessModules[0], 'down', businessModules[1]);
  const concurrentMoves = await Promise.all([
    call(`module/${businessModules[0].id}/order`, 'PATCH', concurrentBody),
    call(`module/${businessModules[0].id}/order`, 'PATCH', concurrentBody),
  ]);
  check(JSON.stringify(concurrentMoves.map((item) => item.status).sort()) === JSON.stringify([200,409]), 'Concurrent equal moves produce one effect and one stale conflict');

  const appDb = app.get(DataSource);
  const inheritedBefore = (await modules('30')).map((item) => ({ id: item.id, sort_order: item.sort_order }));
  const inheritedInvalidations = invalidations;
  const inheritedRows = await modules('30');
  await assert.rejects(appDb.transaction((manager) =>
    withCoreAuthorityLock(manager, undefined, async () => {
      const result = await app.get(MoveModuleOrderUseCase).execute(
        inheritedRows[0].id, modulePayload(inheritedRows[0], 'down', inheritedRows[1]),
        { ...authority.actor(), transaction: manager },
      );
      assert.equal(result.status, 'moved');
      throw new Error('synthetic enclosing checkpoint rollback');
    }),
  ), /synthetic enclosing checkpoint rollback/);
  check(JSON.stringify((await modules('30')).map((item) => ({ id: item.id, sort_order: item.sort_order }))) === JSON.stringify(inheritedBefore), 'An inherited Core transaction can roll the entire move back');
  check(invalidations === inheritedInvalidations, 'Inherited transactions defer invalidation ownership to their caller');
  const translation = app.get(TranslationService);
  await db.query('INSERT INTO user_modules(user_id,module_id) SELECT 1,id FROM modules');
  const authorization = new AuthorizationService(appDb.getRepository(User), appDb.getRepository(ModuleGroup), translation, redis);
  const context = await authorization.getContext('authority1@example.invalid');
  const expectedVisible = await db.query('SELECT g.key AS group_key,m.key AS module_key FROM modules m JOIN module_groups g ON g.id=m.module_group_id WHERE m.is_active AND g.is_active ORDER BY g.sort_order,g.id,m.sort_order,m.id');
  const actualVisible = context.modules.flatMap((group) => group.modules.map((module) => ({ group_key: group.module_group_key, module_key: module.key })));
  check(JSON.stringify(actualVisible) === JSON.stringify(expectedVisible), 'Authorization context is a filtered subsequence of persisted canonical order');

  queryLog.length = 0;
  const oneRow = await call('modules?ordering=true&includes=true&limit=1');
  const oneRowQueries = queryLog.length;
  queryLog.length = 0;
  const manyRows = await call('modules?ordering=true&includes=true&limit=100');
  const manyRowQueries = queryLog.length;
  check(oneRow.status === 200 && manyRows.status === 200 && manyRowQueries <= oneRowQueries + 1, 'Query count does not grow per module or group');

  const overflowInvalidations = invalidations;
  await db.query("INSERT INTO modules(key,link,module_group_id,sort_order) VALUES('max_order_fixture','/',30,2147483647)");
  const exhaustedModule = await call('module', 'POST', { key: 'must_not_be_created', link: '/', module_group_id: '30' });
  check(exhaustedModule.status === 409 && exhaustedModule.body.message === 'modules:order_exhausted', 'Module append detects integer exhaustion before writing');
  check((await db.query("SELECT count(*) FROM modules WHERE key='must_not_be_created'"))[0].count === '0', 'Exhausted append leaves no partial module');
  await db.query("DELETE FROM modules WHERE key='max_order_fixture'");
  await db.query("INSERT INTO module_groups(key,sort_order) VALUES('max_group_order_fixture',2147483647)");
  const exhaustedGroup = await call('module-group', 'POST', { key: 'must_not_be_created' });
  check(exhaustedGroup.status === 409 && exhaustedGroup.body.message === 'modules:order_exhausted', 'Group append detects integer exhaustion before writing');
  check(invalidations === overflowInvalidations, 'Failed append does not invalidate the committed context');
  await db.query("DELETE FROM module_groups WHERE key='max_group_order_fixture'");

  // Real empty installation uses all migrations and the actual bootstrap twice.
  await db.query('CREATE DATABASE order_clean_install');
  cleanDb = await new DataSource({ ...options, database: 'order_clean_install', logging: false,
    migrations: [fileURLToPath(new URL('../dist/migrations/*.js', import.meta.url))],
  }).initialize();
  const executed = await cleanDb.runMigrations();
  check(executed.some((migration) => migration.name === 'AddModuleSortOrder1793200000000'), 'Empty install applies the real order migration');
  check((await cleanDb.runMigrations()).length === 0, 'Migration rerun is inert');
  const { SeedAuthUseCase } = await import('../dist/auth/use-case/seed-auth.use-case.js');
  const { Translation } = await import('../dist/translation/entities/translation.entity.js');
  const cleanTranslation = new TranslationService(cleanDb.getRepository(Translation));
  const seed = new SeedAuthUseCase(cleanDb, cleanTranslation, redis);
  await seed.bootstrap();
  const installedBefore = await cleanDb.query('SELECT id,key,sort_order FROM modules ORDER BY module_group_id,sort_order');
  await seed.bootstrap();
  const installedAfter = await cleanDb.query('SELECT id,key,sort_order FROM modules ORDER BY module_group_id,sort_order');
  check(installedBefore.length > 0 && JSON.stringify(installedAfter) === JSON.stringify(installedBefore), 'Actual bootstrap assigns order without defaults and repeat bootstrap preserves it');
  const { FinanceNavigationService } = await import('../dist/finance-navigation/finance-navigation.service.js');
  const { RentalNavigationService } = await import('../dist/rental-navigation/rental-navigation.service.js');
  const { NodiaAiNavigationService } = await import('../dist/nodia-ai/nodia-ai-navigation.service.js');
  const { SeedFinanceNavigationUseCase } = await import('../dist/finance-navigation/use-case/seed-finance-navigation.use-case.js');
  const { SeedRentalNavigationUseCase } = await import('../dist/rental-navigation/use-case/seed-rental-navigation.use-case.js');
  const { SeedNodiaAiNavigationUseCase } = await import('../dist/nodia-ai/use-case/seed-nodia-ai-navigation.use-case.js');
  const navigationSeeds = [
    new SeedFinanceNavigationUseCase(cleanDb, new FinanceNavigationService()),
    new SeedRentalNavigationUseCase(cleanDb, new RentalNavigationService()),
    new SeedNodiaAiNavigationUseCase(cleanDb, new NodiaAiNavigationService()),
  ];
  for (const navigationSeed of navigationSeeds) await navigationSeed.execute();
  const navigationBefore = await cleanDb.query('SELECT id,key,module_group_id,sort_order FROM modules ORDER BY module_group_id,sort_order');
  const navigationGroupsBefore = await cleanDb.query('SELECT id,key,sort_order FROM module_groups ORDER BY sort_order');
  for (const navigationSeed of navigationSeeds) await navigationSeed.execute();
  check(JSON.stringify(await cleanDb.query('SELECT id,key,module_group_id,sort_order FROM modules ORDER BY module_group_id,sort_order')) === JSON.stringify(navigationBefore), 'All three real navigation seeds preserve module order on repetition');
  check(JSON.stringify(await cleanDb.query('SELECT id,key,sort_order FROM module_groups ORDER BY sort_order')) === JSON.stringify(navigationGroupsBefore), 'Repeated navigation seeds preserve group order');

  await app.close(); app = null;
  const downRunner = db.createQueryRunner();
  try {
    await downRunner.startTransaction();
    try {
      await new AddModuleSortOrder1793200000000().down(downRunner);
      await downRunner.commitTransaction();
    } catch (error) {
      await downRunner.rollbackTransaction();
      throw error;
    }
  }
  finally { await downRunner.release(); }
  const columnsAfterDown = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name IN ('modules','module_groups') AND column_name='sort_order'");
  check(columnsAfterDown.length === 0, 'Down removes order columns and constraints without deleting catalog records');
  check(Number((await db.query('SELECT count(*) FROM modules'))[0].count) > 0, 'Down preserves catalog data');
  console.log(JSON.stringify({ result: 'passed', checks, requests, invalidations,
    query_counts: { one_row: oneRowQueries, many_rows: manyRowQueries },
    scope: 'compiled Nest HTTP/Core + disposable PostgreSQL16 + real migration/bootstrap; synthetic identity/cache only',
    configured_database_used: false, actual_AI_generations: 0,
  }));
} finally {
  if (app) await app.close();
  if (cleanDb?.isInitialized) await cleanDb.destroy();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '--force', '--volumes', container);
}
