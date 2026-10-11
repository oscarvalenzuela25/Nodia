// Compiled NestJS + disposable PostgreSQL. No configured DB, Redis or real identity.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import {
  Global,
  Module,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import qs from 'qs';
import { ModuleModule } from '../dist/module/module.module.js';
import { ModuleGroupModule } from '../dist/module-group/module-group.module.js';
import { RedisService } from '../dist/common/redis/redis.service.js';
import { DeleteModuleGroupUseCase } from '../dist/module-group/use-case/delete-module-group.use-case.js';

const container = `template_module_catalog_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let db,
  app,
  started = false,
  requests = 0,
  invalidations = 0;
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
    'POSTGRES_DB=catalog_test',
    '--env',
    'POSTGRES_USER=catalog_test',
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
        'catalog_test',
      );
      break;
    } catch (error) {
      if (attempt === 39) throw error;
      await delay(250);
    }
  }
  const options = {
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'catalog_test',
    password,
    database: 'catalog_test',
    synchronize: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
  };
  db = await new DataSource(options).initialize();
  await db.query(`
    CREATE TABLE module_groups(id bigint PRIMARY KEY, key varchar UNIQUE NOT NULL, icon varchar, is_active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE modules(id bigint PRIMARY KEY, module_group_id bigint NOT NULL REFERENCES module_groups(id), key varchar UNIQUE NOT NULL, link varchar NOT NULL, icon varchar, is_active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE INDEX idx_modules_module_group_id ON modules(module_group_id);
    CREATE TABLE users(id bigint PRIMARY KEY);
    CREATE TABLE user_modules(id bigserial PRIMARY KEY, user_id bigint REFERENCES users(id), module_id bigint REFERENCES modules(id), is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE translations(id bigserial PRIMARY KEY, source_entity varchar NOT NULL, source_id varchar NOT NULL, source_key varchar NOT NULL, locale varchar NOT NULL, value text NOT NULL, is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    INSERT INTO module_groups(id,key,is_active) VALUES (10,'occupied',true),(11,'empty_active',true),(12,'empty_inactive',false),(13,'inactive_children',true);
    INSERT INTO modules(id,module_group_id,key,link,is_active) VALUES (100,10,'active_module','/test/active',true),(101,10,'inactive_module','/test/inactive',false),(102,13,'inactive_child','/test/child',false);
    INSERT INTO users VALUES(1);
    INSERT INTO user_modules(user_id,module_id) VALUES (1,100),(1,101);
    INSERT INTO translations(source_entity,source_id,source_key,locale,value) VALUES ('modules','100','key','es','Módulo de prueba'),('modules','101','key','es','Conservado'),('module_groups','11','key','es','Grupo de prueba'),('modules','11','key','es','Otro namespace');
  `);
  const redis = {
    delByPattern: async (pattern) => {
      assert.equal(pattern, 'auth:context:*');
      invalidations++;
    },
  };
  class FakeCacheModule {}
  Global()(FakeCacheModule);
  Module({
    providers: [{ provide: RedisService, useValue: redis }],
    exports: [RedisService],
  })(FakeCacheModule);
  class SyntheticGuard {
    canActivate(context) {
      if (
        context.switchToHttp().getRequest().headers['x-catalog-test'] !==
        'fixture'
      )
        throw new UnauthorizedException();
      return true;
    }
  }
  class IntegrationModule {}
  Module({
    imports: [
      TypeOrmModuleRoot(),
      FakeCacheModule,
      ModuleModule,
      ModuleGroupModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: SyntheticGuard }],
  })(IntegrationModule);
  function TypeOrmModuleRoot() {
    return TypeOrmModule.forRoot(options);
  }
  app = await NestFactory.create(IntegrationModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app
    .getHttpAdapter()
    .getInstance()
    .set('query parser', (value) => qs.parse(value));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const call = async (path, method = 'GET', authenticated = true) => {
    requests++;
    const response = await fetch(`${base}/api/v1/${path}`, {
      method,
      headers: authenticated ? { 'x-catalog-test': 'fixture' } : {},
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  for (const path of [
    'module/100',
    'modules/100',
    'module-group/11',
    'module-groups/11',
  ])
    assert.equal((await call(path, 'DELETE', false)).status, 401);
  for (const path of ['module', 'modules', 'module-group', 'module-groups']) {
    for (const id of ['0', '-1', '1.5', '01', '9223372036854775808', 'abc'])
      assert.equal((await call(`${path}/${id}`, 'DELETE')).status, 400);
    assert.equal((await call(`${path}/999`, 'DELETE')).status, 404);
  }
  for (const active of ['true', 'false']) {
    for (const path of ['modules', 'module-groups']) {
      const result = await call(
        `${path}?page=1&limit=1&q[is_active_eq]=${active}`,
      );
      assert.equal(result.status, 200);
      assert.ok(
        result.body.data.every(
          (item) => item.is_active === (active === 'true'),
        ),
      );
      assert.equal(result.body.meta.limit, 1);
    }
  }
  assert.equal((await call('module-group/10', 'DELETE')).status, 409);
  const inactiveConflict = await call('module-groups/13', 'DELETE');
  assert.equal(inactiveConflict.status, 409);
  assert.equal(
    inactiveConflict.body.message,
    'modules:groups.delete_has_modules',
  );
  assert.equal(invalidations, 0);
  assert.equal((await call('modules/100', 'DELETE')).status, 204);
  assert.equal(
    (await db.query('SELECT count(*) FROM user_modules WHERE module_id=100'))[0]
      .count,
    '0',
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM translations WHERE source_entity='modules' AND source_id='100'",
      )
    )[0].count,
    '0',
  );
  assert.equal(
    (await db.query('SELECT count(*) FROM user_modules WHERE module_id=101'))[0]
      .count,
    '1',
  );
  assert.equal((await call('module/100', 'DELETE')).status, 404);
  assert.equal((await call('module-group/10', 'DELETE')).status, 409);
  assert.equal((await call('module/101', 'DELETE')).status, 204);
  assert.equal((await call('module-group/10', 'DELETE')).status, 204);
  assert.equal((await call('module-groups/11', 'DELETE')).status, 204);
  assert.equal(
    (
      await db.query("SELECT count(*) FROM translations WHERE source_id='11'")
    )[0].count,
    '1',
  );
  assert.equal(invalidations, 4);
  // Force failure after assignment cleanup: the same transaction must restore it.
  await db.query(
    `INSERT INTO module_groups(id,key) VALUES (20,'rollback'); INSERT INTO modules(id,module_group_id,key,link) VALUES(200,20,'rollback_module','/rollback'); INSERT INTO user_modules(user_id,module_id) VALUES(1,200); INSERT INTO translations(source_entity,source_id,source_key,locale,value) VALUES('modules','200','key','es','Rollback'); CREATE FUNCTION fail_module_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id=200 THEN RAISE EXCEPTION 'synthetic rollback'; END IF; RETURN OLD; END $$; CREATE TRIGGER fail_module_delete BEFORE DELETE ON modules FOR EACH ROW EXECUTE FUNCTION fail_module_delete();`,
  );
  assert.equal((await call('module/200', 'DELETE')).status, 500);
  assert.equal(
    (await db.query('SELECT count(*) FROM user_modules WHERE module_id=200'))[0]
      .count,
    '1',
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM translations WHERE source_entity='modules' AND source_id='200'",
      )
    )[0].count,
    '1',
  );
  assert.equal(invalidations, 4);
  await db.query(
    'DROP TRIGGER fail_module_delete ON modules; DROP FUNCTION fail_module_delete();',
  );
  // A module association committed before deletion must be observed after the lock.
  await db.query("INSERT INTO module_groups(id,key) VALUES(30,'insert_wins')");
  const writer = db.createQueryRunner();
  await writer.startTransaction();
  await writer.query(
    "INSERT INTO modules(id,module_group_id,key,link) VALUES(300,30,'concurrent_child','/concurrent')",
  );
  let completed = false;
  const removing = call('module-group/30', 'DELETE').then((value) => {
    completed = true;
    return value;
  });
  await delay(100);
  assert.equal(completed, false);
  await writer.commitTransaction();
  await writer.release();
  assert.equal((await removing).status, 409);
  // A locked parent being deleted prevents a simultaneous new association.
  await db.query("INSERT INTO module_groups(id,key) VALUES(31,'delete_wins')");
  const appDb = app.get(DataSource),
    originalTransaction = appDb.transaction.bind(appDb);
  let lockedResolve, continueResolve;
  const locked = new Promise((resolve) => {
    lockedResolve = resolve;
  });
  const continued = new Promise((resolve) => {
    continueResolve = resolve;
  });
  appDb.transaction = (work) =>
    originalTransaction(async (manager) => {
      const originalFind = manager.findOne.bind(manager);
      manager.findOne = async (...args) => {
        const value = await originalFind(...args);
        lockedResolve();
        await continued;
        return value;
      };
      return work(manager);
    });
  const deletion = app.get(DeleteModuleGroupUseCase).execute('31');
  await locked;
  const associating = db
    .query(
      "INSERT INTO modules(id,module_group_id,key,link) VALUES(301,31,'blocked_child','/blocked')",
    )
    .then(
      () => 'inserted',
      (error) => error.code,
    );
  await delay(100);
  continueResolve();
  await deletion;
  assert.equal(await associating, '23503');
  appDb.transaction = originalTransaction;
  assert.equal(
    (await db.query('SELECT count(*) FROM modules WHERE module_group_id=31'))[0]
      .count,
    '0',
  );
  console.log(
    JSON.stringify({
      result: 'passed',
      requests,
      invalidations,
      checks: [
        'aliases and auth boundary',
        'bigint IDs',
        'active filters',
        'active and inactive group associations',
        'assignment and translation cleanup',
        'transaction rollback',
        'both concurrent association orders',
      ],
    }),
  );
} finally {
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '--force', container);
}
