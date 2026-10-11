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
import { RoleModule } from '../dist/role/role.module.js';
import { RedisService } from '../dist/common/redis/redis.service.js';
import { DeleteRoleUseCase } from '../dist/role/use-case/delete-role.use-case.js';

const container = `template_role_catalog_${process.pid}_${randomBytes(4).toString('hex')}`;
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
    CREATE TABLE roles(id bigserial PRIMARY KEY, key varchar UNIQUE NOT NULL, is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE users(id bigint PRIMARY KEY);
    CREATE TABLE actions(id bigint PRIMARY KEY, key varchar UNIQUE NOT NULL, description text, is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE user_roles(id bigserial PRIMARY KEY, user_id bigint REFERENCES users(id), role_id bigint REFERENCES roles(id), is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE role_actions(id bigserial PRIMARY KEY, role_id bigint REFERENCES roles(id), action_id bigint REFERENCES actions(id), is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    CREATE TABLE translations(id bigserial PRIMARY KEY, source_entity varchar NOT NULL, source_id varchar NOT NULL, source_key varchar NOT NULL, locale varchar NOT NULL, value text NOT NULL, is_active boolean DEFAULT true, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
    INSERT INTO roles(id,key,is_active) VALUES (9007199254740993,'synthetic.editor',true),(101,'synthetic.inactive',false),(102,'synthetic.unassigned',true),(7,'super_admin',true);
    INSERT INTO users VALUES(1);
    INSERT INTO actions(id,key) VALUES(1,'synthetic.read'),(2,'synthetic.write');
    INSERT INTO role_actions(role_id,action_id,is_active) VALUES(9007199254740993,1,true),(9007199254740993,2,false),(101,1,false);
    INSERT INTO user_roles(user_id,role_id,is_active) VALUES(1,9007199254740993,true),(1,9007199254740993,false),(1,101,true);
    INSERT INTO translations(source_entity,source_id,source_key,locale,value) VALUES ('roles','9007199254740993','key','es','Synthetic role'),('actions','9007199254740993','key','es','Other namespace'),('roles','101','key','es','Preserve');
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
    imports: [TypeOrmModuleRoot(), FakeCacheModule, RoleModule],
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
  const call = async (path, method = 'GET', authenticated = true, payload) => {
    requests++;
    const response = await fetch(`${base}/api/v1/${path}`, {
      method,
      headers: {
        ...(authenticated ? { 'x-catalog-test': 'fixture' } : {}),
        ...(payload ? { 'content-type': 'application/json' } : {}),
      },
      ...(method !== 'GET' && payload ? { body: JSON.stringify(payload) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  for (const alias of ['role', 'roles']) {
    assert.equal(
      (await call(`${alias}/9007199254740993`, 'DELETE', false)).status,
      401,
    );
    for (const id of ['0', '-1', '01', '1.5', '9223372036854775808', 'bad'])
      assert.equal((await call(`${alias}/${id}`, 'DELETE')).status, 400);
    assert.equal((await call(`${alias}/999999`, 'DELETE')).status, 404);
    for (const active of [true, false]) {
      await db.query('UPDATE roles SET is_active=$1 WHERE id=7', [active]);
      const protectedResult = await call(`${alias}/7`, 'DELETE');
      assert.equal(protectedResult.status, 403);
      assert.equal(protectedResult.body.message, 'roles:protected_role');
    }
  }
  assert.equal(invalidations, 0);
  for (const method of ['PUT', 'PATCH']) {
    const rename = await call('roles/7', method, true, {
      key: 'synthetic.renamed',
    });
    assert.equal(rename.status, 403);
    assert.equal(rename.body.message, 'roles:protected_key');
  }
  assert.equal(
    (await db.query('SELECT key FROM roles WHERE id=7'))[0].key,
    'super_admin',
  );
  assert.equal(
    (
      await call('roles/7', 'PATCH', true, {
        key: 'super_admin',
        translates: [{ key: 'key', es: 'Prueba', en: 'Test' }],
      })
    ).status,
    200,
  );
  for (const active of [true, false]) {
    const filtered = await call(
      `roles?q[is_active_eq]=${active}&page=1&limit=1`,
    );
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.data.length, 1);
    assert.equal(filtered.body.data[0].is_active, active);
  }
  assert.equal((await call('roles?q[is_active_eq]=invalid')).status, 400);
  const filtered = await call(
    'roles?q[key_in][]=synthetic.editor&q[actions_key_in][]=synthetic.read&limit=1',
  );
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.meta.total_items, 1);
  assert.equal(filtered.body.data[0].id, '9007199254740993');
  assert.equal(filtered.body.data[0].actions.length, 2); // Preserve all included actions.
  const byId = await call('roles?q[actions_id_in][]=1&includes=false');
  assert.equal(byId.status, 200);
  assert.equal(byId.body.meta.total_items, 2);
  assert.ok(byId.body.data.every((role) => role.actions.length === 0));
  const byKey = await call('roles?q[actions_key_cont]=write');
  assert.equal(byKey.status, 200);
  assert.equal(byKey.body.data.length, 1);
  assert.equal(byKey.body.data[0].actions.length, 2);
  assert.equal((await call('role/9007199254740993', 'DELETE')).status, 204);
  for (const table of ['user_roles', 'role_actions'])
    assert.equal(
      (
        await db.query(
          `SELECT count(*) FROM ${table} WHERE role_id=9007199254740993`,
        )
      )[0].count,
      '0',
    );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM translations WHERE source_entity='roles' AND source_id='9007199254740993'",
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
    '1',
  );
  for (const table of ['user_roles', 'role_actions'])
    assert.equal(
      (await db.query(`SELECT count(*) FROM ${table} WHERE role_id=101`))[0]
        .count,
      '1',
    );
  assert.equal((await call('roles/102', 'DELETE')).status, 204);
  const committedInvalidations = invalidations;
  await db.query(
    `INSERT INTO roles(id,key) VALUES(200,'synthetic.rollback'); INSERT INTO user_roles(user_id,role_id) VALUES(1,200); INSERT INTO role_actions(role_id,action_id) VALUES(200,1); INSERT INTO translations(source_entity,source_id,source_key,locale,value) VALUES('roles','200','key','es','Rollback'); CREATE FUNCTION fail_role_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id=200 THEN RAISE EXCEPTION 'synthetic rollback'; END IF; RETURN OLD; END $$; CREATE TRIGGER fail_role_delete BEFORE DELETE ON roles FOR EACH ROW EXECUTE FUNCTION fail_role_delete();`,
  );
  assert.equal((await call('roles/200', 'DELETE')).status, 500);
  for (const table of ['user_roles', 'role_actions'])
    assert.equal(
      (await db.query(`SELECT count(*) FROM ${table} WHERE role_id=200`))[0]
        .count,
      '1',
    );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM translations WHERE source_entity='roles' AND source_id='200'",
      )
    )[0].count,
    '1',
  );
  assert.equal(invalidations, committedInvalidations);
  assert.equal(
    (
      await call('roles/200', 'PATCH', true, {
        key: 'synthetic.update.rollback',
        actions: ['999999'],
      })
    ).status,
    500,
  );
  assert.equal(
    (await db.query('SELECT key FROM roles WHERE id=200'))[0].key,
    'synthetic.rollback',
  );
  assert.equal(
    (await db.query('SELECT count(*) FROM role_actions WHERE role_id=200'))[0]
      .count,
    '1',
  );
  assert.equal(invalidations, committedInvalidations);
  await db.query(
    'DROP TRIGGER fail_role_delete ON roles; DROP FUNCTION fail_role_delete();',
  );

  for (const [table, id, column] of [
    ['user_roles', 300, 'user_id'],
    ['role_actions', 301, 'action_id'],
  ]) {
    await db.query('INSERT INTO roles(id,key) VALUES($1,$2)', [
      id,
      `synthetic.insert_first.${table}`,
    ]);
    const writer = db.createQueryRunner();
    await writer.startTransaction();
    await writer.query(`INSERT INTO ${table}(${column},role_id) VALUES(1,$1)`, [
      id,
    ]);
    let completed = false;
    const deleting = call(`roles/${id}`, 'DELETE').then((result) => {
      completed = true;
      return result;
    });
    await delay(100);
    assert.equal(completed, false);
    await writer.commitTransaction();
    await writer.release();
    assert.equal((await deleting).status, 204);
    assert.equal(
      (
        await db.query(`SELECT count(*) FROM ${table} WHERE role_id=$1`, [id])
      )[0].count,
      '0',
    );
  }
  for (const [table, id, column] of [
    ['user_roles', 400, 'user_id'],
    ['role_actions', 401, 'action_id'],
  ]) {
    await db.query('INSERT INTO roles(id,key) VALUES($1,$2)', [
      id,
      `synthetic.delete_first.${table}`,
    ]);
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
        const find = manager.findOne.bind(manager);
        manager.findOne = async (...args) => {
          const role = await find(...args);
          lockedResolve();
          await continued;
          return role;
        };
        return work(manager);
      });
    try {
      const deletion = app.get(DeleteRoleUseCase).execute(String(id));
      await locked;
      const associating = db
        .query(`INSERT INTO ${table}(${column},role_id) VALUES(1,$1)`, [id])
        .then(
          () => 'inserted',
          (error) => error.code,
        );
      await delay(100);
      continueResolve();
      await deletion;
      assert.equal(await associating, '23503');
    } finally {
      appDb.transaction = originalTransaction;
    }
  }
  console.log(
    JSON.stringify({
      result: 'passed',
      requests,
      invalidations,
      checks: [
        'compiled aliases and synthetic auth',
        'reserved role active/inactive',
        'rename protection',
        'exact bigint',
        'server filters without narrowing assignments',
        'selective cleanup',
        'delete and update rollback',
        'both FK race orders for users and actions',
      ],
    }),
  );
} finally {
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '--force', container);
}
