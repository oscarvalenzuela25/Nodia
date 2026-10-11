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
import { ActionModule } from '../dist/action/action.module.js';
import { BusinessActionModule } from '../dist/business-action/business-action.module.js';
import { RedisService } from '../dist/common/redis/redis.service.js';
import { DeleteActionUseCase } from '../dist/action/use-case/delete-action.use-case.js';

const container = `template_action_catalog_${process.pid}_${randomBytes(4).toString('hex')}`;
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
    CREATE TABLE actions(id bigint PRIMARY KEY, key varchar UNIQUE NOT NULL, description text, is_active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE business_actions(id bigint PRIMARY KEY, key varchar UNIQUE NOT NULL, has_description boolean DEFAULT false, is_active boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE roles(id bigint PRIMARY KEY);
    CREATE TABLE role_actions(id bigserial PRIMARY KEY, role_id bigint REFERENCES roles(id), action_id bigint REFERENCES actions(id), is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE INDEX idx_role_actions_action_id ON role_actions(action_id);
    CREATE TABLE translations(id bigserial PRIMARY KEY, source_entity varchar NOT NULL, source_id varchar NOT NULL, source_key varchar NOT NULL, locale varchar NOT NULL, value text NOT NULL, is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    INSERT INTO actions(id,key,is_active) VALUES (9007199254740993,'synthetic.active',true),(101,'synthetic.inactive',false),(102,'synthetic.unassigned',true);
    INSERT INTO business_actions(id,key,is_active) VALUES (10,'synthetic.business.active',true),(11,'synthetic.business.inactive',false);
    INSERT INTO roles VALUES(1);
    INSERT INTO role_actions(role_id,action_id,is_active) VALUES (1,9007199254740993,true),(1,9007199254740993,false),(1,101,false);
    INSERT INTO translations(source_entity,source_id,source_key,locale,value) VALUES ('actions','9007199254740993','key','es','Prueba sintética'),('business_actions','9007199254740993','key','es','Otro namespace'),('actions','101','key','es','Conservar');
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
      ActionModule,
      BusinessActionModule,
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
  for (const alias of ['action', 'actions']) {
    assert.equal(
      (await call(`${alias}/9007199254740993`, 'DELETE', false)).status,
      401,
    );
    for (const id of ['0', '-1', '01', '1.5', '9223372036854775808', 'bad'])
      assert.equal((await call(`${alias}/${id}`, 'DELETE')).status, 400);
    assert.equal((await call(`${alias}/999999`, 'DELETE')).status, 404);
  }
  for (const resource of ['actions', 'business-actions']) {
    for (const active of [true, false]) {
      const result = await call(
        `${resource}?q[is_active_eq]=${active}&page=1&limit=1`,
      );
      assert.equal(result.status, 200);
      assert.equal(result.body.data.length, 1);
      assert.equal(result.body.data[0].is_active, active);
    }
    assert.equal(
      (await call(`${resource}?q[is_active_eq]=invalid`)).status,
      400,
    );
  }
  assert.equal((await call('action/9007199254740993', 'DELETE')).status, 204);
  assert.equal(
    (
      await db.query(
        'SELECT count(*) FROM role_actions WHERE action_id=9007199254740993',
      )
    )[0].count,
    '0',
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM translations WHERE source_entity='actions' AND source_id='9007199254740993'",
      )
    )[0].count,
    '0',
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM translations WHERE source_entity='business_actions' AND source_id='9007199254740993'",
      )
    )[0].count,
    '1',
  );
  assert.equal(
    (await db.query('SELECT count(*) FROM role_actions WHERE action_id=101'))[0]
      .count,
    '1',
  );
  assert.equal((await call('actions/102', 'DELETE')).status, 204);
  assert.equal(invalidations, 2);
  await db.query(
    `INSERT INTO actions(id,key) VALUES(200,'synthetic.rollback'); INSERT INTO role_actions(role_id,action_id) VALUES(1,200); INSERT INTO translations(source_entity,source_id,source_key,locale,value) VALUES('actions','200','key','es','Rollback'); CREATE FUNCTION fail_action_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id=200 THEN RAISE EXCEPTION 'synthetic rollback'; END IF; RETURN OLD; END $$; CREATE TRIGGER fail_action_delete BEFORE DELETE ON actions FOR EACH ROW EXECUTE FUNCTION fail_action_delete();`,
  );
  assert.equal((await call('actions/200', 'DELETE')).status, 500);
  assert.equal(
    (await db.query('SELECT count(*) FROM role_actions WHERE action_id=200'))[0]
      .count,
    '1',
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM translations WHERE source_entity='actions' AND source_id='200'",
      )
    )[0].count,
    '1',
  );
  assert.equal(invalidations, 2);
  await db.query(
    'DROP TRIGGER fail_action_delete ON actions; DROP FUNCTION fail_action_delete();',
  );
  // A committed association holds its FK lock; deletion waits and cleans it after commit.
  await db.query(
    "INSERT INTO actions(id,key) VALUES(300,'synthetic.insert_first')",
  );
  const writer = db.createQueryRunner();
  await writer.startTransaction();
  await writer.query(
    'INSERT INTO role_actions(role_id,action_id) VALUES(1,300)',
  );
  let completed = false;
  const removing = call('actions/300', 'DELETE').then((result) => {
    completed = true;
    return result;
  });
  await delay(100);
  assert.equal(completed, false);
  await writer.commitTransaction();
  await writer.release();
  assert.equal((await removing).status, 204);
  assert.equal(
    (await db.query('SELECT count(*) FROM role_actions WHERE action_id=300'))[0]
      .count,
    '0',
  );
  // An association arriving after the delete lock cannot leave an orphan.
  await db.query(
    "INSERT INTO actions(id,key) VALUES(301,'synthetic.delete_first')",
  );
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
        const result = await originalFind(...args);
        lockedResolve();
        await continued;
        return result;
      };
      return work(manager);
    });
  const deletion = app.get(DeleteActionUseCase).execute('301');
  await locked;
  const associating = db
    .query('INSERT INTO role_actions(role_id,action_id) VALUES(1,301)')
    .then(
      () => 'inserted',
      (error) => error.code,
    );
  await delay(100);
  continueResolve();
  await deletion;
  assert.equal(await associating, '23503');
  appDb.transaction = originalTransaction;
  console.log(
    JSON.stringify({
      result: 'passed',
      requests,
      invalidations,
      checks: [
        'compiled DI and aliases',
        'synthetic auth boundary',
        'exact bigint IDs',
        'both active filters',
        'assignment and translation cleanup',
        'rollback',
        'both concurrent association orders',
      ],
    }),
  );
} finally {
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '--force', container);
}
