// Owns one disposable Docker PostgreSQL; never reads app .env/configured DB.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import supertest from 'supertest';
import { NewsModule } from '../dist/news/news.module.js';
import { NewsSource } from '../dist/news/entities/news-source.entity.js';
import { NewsService } from '../dist/news/news.service.js';
import { NewsFeedClient } from '../dist/news/news-feed.client.js';
import { RefreshNewsUseCase } from '../dist/news/use-case/refresh-news.use-case.js';
import { ListNewsUseCase } from '../dist/news/use-case/list-news.use-case.js';
import {
  NewsFeedError,
  NEWS_RETENTION_MS,
  parseNewsFeed,
} from '../dist/news/news.policy.js';
import { PublicNewsCache1793670000000 } from '../dist/migrations/1793670000000-PublicNewsCache.js';
import { NewsNodeSource1793670001000 } from '../dist/migrations/1793670001000-NewsNodeSource.js';
import { newsSource } from '../dist/news/news.sources.js';
import { AuthGuard } from '../dist/auth/auth.guard.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { AuthTokenService } from '../dist/auth/auth-token.service.js';
import { AuthenticateRequestUseCase } from '../dist/auth/use-case/authenticate-request.use-case.js';
import { ModuleAccessGuard } from '../dist/authorization/module-access.guard.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';

const name = 'template_nodia_news_test_' + randomUUID().replaceAll('-', '');
assert.match(name, /^template_nodia_news_test_[a-f0-9]{32}$/);
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  }).trim();
const session = randomUUID();
const ordinarySession = randomUUID();
const actor = { userId: '1', sessionId: session };
const ordinary = { userId: '2', sessionId: ordinarySession };
let source;
let app;
let moduleRef;
let calls = 0;
let liveProviderCalls = 0;
let liveSummary = null;
let nextFetch;
const feed = {
  fetch: async (validators, key) => {
    calls++;
    return nextFetch(validators, key);
  },
};
const xml = (guid = 'news-fixture', suffix = '') =>
  `<rss><channel><item><title>Fixture article</title><link>https://web.dev/blog/fixture${suffix}</link><guid>${guid}</guid><description>Fixture &amp; description</description></item></channel></rss>`;
const result = (guid, suffix = '', key = 'web-dev') => ({
  status: 'updated',
  articles: parseNewsFeed(xml(guid, suffix), new Date(), newsSource(key)),
  etag: '"fixture"',
  lastModified: null,
});
const checks = [];
try {
  docker(
    'run',
    '--detach',
    '--rm',
    '--name',
    name,
    '--label',
    'nodia.disposable.news=true',
    '-e',
    'POSTGRES_USER=news_test',
    '-e',
    'POSTGRES_PASSWORD=news_test_only',
    '-e',
    'POSTGRES_DB=news_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:16-alpine',
  );
  const portLine = docker('port', name, '5432/tcp');
  assert.match(portLine, /^127\.0\.0\.1:\d+$/);
  const port = Number(portLine.split(':')[1]);
  for (let attempt = 0; ; attempt++) {
    try {
      docker('exec', name, 'pg_isready', '-U', 'news_test', '-d', 'news_test');
      break;
    } catch (error) {
      if (attempt >= 60) throw error;
      await delay(500);
    }
  }
  const config = {
    type: 'postgres',
    host: '127.0.0.1',
    port,
    username: 'news_test',
    password: 'news_test_only',
    database: 'news_test',
    entities: [NewsSource],
    synchronize: false,
  };
  source = await new DataSource(config).initialize();
  assert.deepEqual(
    (
      await source.query(
        'SELECT current_database() AS db,current_user AS actor',
      )
    )[0],
    { db: 'news_test', actor: 'news_test' },
  );
  await source.query(`CREATE TABLE users(id bigint PRIMARY KEY,is_active boolean NOT NULL,
      name varchar,email text,image_url text,google_sub varchar,
      created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE roles(id bigint PRIMARY KEY,key text NOT NULL,is_active boolean NOT NULL);
    CREATE TABLE user_roles(user_id bigint,role_id bigint,is_active boolean NOT NULL);
    CREATE TABLE auth_sessions(public_id uuid PRIMARY KEY,user_id bigint,revoked_at timestamptz,expires_at timestamptz NOT NULL,
      id bigserial,image_url text,refresh_token_hash varchar(64),created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE actions(id int); CREATE TABLE module_groups(id int); CREATE TABLE modules(id int);
    CREATE TABLE role_actions(id int); CREATE TABLE user_modules(id int)`);
  await source.query(
    `INSERT INTO users(id,is_active,name,email) VALUES(1,true,'Lab admin','admin@example.invalid'),(2,true,'Lab user','user@example.invalid'); INSERT INTO roles VALUES(1,'super_admin',true); INSERT INTO user_roles VALUES(1,1,true)`,
  );
  await source.query(
    `INSERT INTO auth_sessions(public_id,user_id,expires_at) VALUES($1,1,clock_timestamp()+interval '1 hour'),($2,2,clock_timestamp()+interval '1 hour')`,
    [session, ordinarySession],
  );
  const migration = new PublicNewsCache1793670000000();
  const runner = source.createQueryRunner();
  try {
    await migration.up(runner);
    await migration.down(runner);
    await migration.up(runner);
    const nodeMigration = new NewsNodeSource1793670001000();
    await source.query(
      "INSERT INTO news_sources(source_key,articles,etag) VALUES('web-dev',$1::jsonb,'fixture-web-validator')",
      [JSON.stringify(result('migration-web').articles)],
    );
    const webBeforeMigration = await source.query(
      "SELECT * FROM news_sources WHERE source_key='web-dev'",
    );
    await nodeMigration.up(runner);
    await source.query(
      "INSERT INTO news_sources(source_key) VALUES('node-js')",
    );
    await nodeMigration.down(runner);
    assert.deepEqual(
      await source.query('SELECT source_key FROM news_sources'),
      [{ source_key: 'web-dev' }],
    );
    assert.deepEqual(
      await source.query(
        "SELECT * FROM news_sources WHERE source_key='web-dev'",
      ),
      webBeforeMigration,
    );
    await nodeMigration.up(runner);
    await source.query(
      "UPDATE news_sources SET articles='[]'::jsonb,etag=NULL WHERE source_key='web-dev'",
    );
    await assert.rejects(
      () =>
        source.query(
          "INSERT INTO news_sources(source_key) VALUES('daily-dev')",
        ),
      /check constraint/,
    );
  } finally {
    await runner.release();
  }
  checks.push(
    'migration_up_down_up_only_disposable_cache_and_node_rollback_preserves_web',
  );
  const service = new NewsService(source);
  const refresh = new RefreshNewsUseCase(source, service, feed);
  const refreshOtherProcess = new RefreshNewsUseCase(
    source,
    new NewsService(source),
    feed,
  );
  const list = new ListNewsUseCase(service);
  const allowRefresh = async () =>
    source.query(
      "UPDATE news_sources SET next_refresh_at=clock_timestamp()-interval '1 second',lease_token=NULL,lease_until=NULL",
    );
  assert.equal((await list.execute({})).items.length, 0);
  assert.deepEqual(
    (await list.execute({})).sources.map((entry) => entry.key),
    ['web-dev', 'node-js'],
  );
  assert.equal(calls, 0);
  nextFetch = async () => result('first');
  await assert.rejects(
    () => refresh.execute(ordinary, { source_key: 'web-dev' }),
    /news:super_admin_required/,
  );
  await source.query('UPDATE user_roles SET is_active=false WHERE user_id=1');
  await assert.rejects(
    () => refresh.execute(actor, { source_key: 'web-dev' }),
    /news:super_admin_required/,
  );
  assert.equal(calls, 0);
  await source.query('UPDATE user_roles SET is_active=true WHERE user_id=1');
  assert.equal(
    (await refresh.execute(actor, { source_key: 'web-dev' })).status,
    'updated',
  );
  assert.equal(calls, 1);
  const first = (await list.execute({})).items[0];
  assert.equal(first.excerpt, 'Fixture & description');
  assert.equal(first.published_at, null);
  assert.ok(!Object.hasOwn(first, 'last_seen_at'));
  assert.equal(
    (await refresh.execute(actor, { source_key: 'web-dev' })).status,
    'cached',
  );
  assert.equal(calls, 1);
  checks.push('read_no_network_current_role_inactive_assignment_and_cooldown');

  await allowRefresh();
  let release;
  let started;
  const waitForStart = new Promise((resolve) => {
    started = resolve;
  });
  nextFetch = () => {
    started();
    return new Promise((resolve) => {
      release = () => resolve(result('second'));
    });
  };
  const pending = refresh.execute(actor, { source_key: 'web-dev' });
  await waitForStart;
  await assert.rejects(
    () => refreshOtherProcess.execute(actor, { source_key: 'web-dev' }),
    /news:refresh_in_progress/,
  );
  const callsDuring = calls;
  release();
  await pending;
  assert.equal(calls, callsDuring);
  checks.push('two_service_instances_one_durable_reservation_before_network');

  // Same URL with changed GUID must keep its canonical source ID on subsequent304.
  await allowRefresh();
  nextFetch = async () => result('changed-guid');
  await refresh.execute(actor, { source_key: 'web-dev' });
  assert.equal((await list.execute({})).items[0].id, first.id);
  let snapshot = await service.snapshot();
  assert.deepEqual(snapshot.feed_ids, [first.id]);
  const oldSeen = snapshot.articles[0].last_seen_at;
  await delay(5);
  await allowRefresh();
  nextFetch = async (validators) => {
    assert.equal(validators.etag, '"fixture"');
    return {
      status: 'not_modified',
      articles: [],
      etag: '"fixture"',
      lastModified: null,
    };
  };
  assert.equal(
    (await refresh.execute(actor, { source_key: 'web-dev' })).status,
    'not_modified',
  );
  snapshot = await service.snapshot();
  assert.ok(snapshot.articles[0].last_seen_at > oldSeen);
  checks.push(
    'guid_change_same_url_canonical_id_then_304_revalidates_seen_only',
  );

  await allowRefresh();
  const previousSuccess = snapshot.last_success_at.toISOString();
  nextFetch = async () => {
    throw new NewsFeedError(
      'source_rate_limited',
      new Date(Date.now() + 3600000),
    );
  };
  await assert.rejects(
    () => refresh.execute(actor, { source_key: 'web-dev' }),
    /news:source_rate_limited/,
  );
  snapshot = await service.snapshot();
  assert.equal(snapshot.last_success_at.toISOString(), previousSuccess);
  assert.equal(snapshot.last_error_code, 'news:source_rate_limited');
  assert.ok(snapshot.next_refresh_at.getTime() > Date.now() + 3500000);
  assert.equal((await list.execute({})).items[0].id, first.id);
  checks.push('failed_refresh_keeps_content_success_date_and_retry_after');

  // Revocation after dispatch prevents publishing an already-running external response.
  await allowRefresh();
  const beforeRevocation = (await list.execute({})).items;
  nextFetch = async () => {
    await source.query('UPDATE user_roles SET is_active=false WHERE user_id=1');
    return result('revoked', '?revoked=1');
  };
  await assert.rejects(
    () => refresh.execute(actor, { source_key: 'web-dev' }),
    /news:super_admin_required/,
  );
  assert.deepEqual((await list.execute({})).items, beforeRevocation);
  await source.query('UPDATE user_roles SET is_active=true WHERE user_id=1');
  checks.push('role_revocation_during_network_prevents_publication');

  await allowRefresh();
  nextFetch = async () => {
    await source.query(
      "UPDATE news_sources SET lease_token=$1,lease_until=clock_timestamp()+interval '30 seconds'",
      [randomUUID()],
    );
    return result('stale', '?stale=1');
  };
  await assert.rejects(
    () => refresh.execute(actor, { source_key: 'web-dev' }),
    /news:refresh_superseded/,
  );
  assert.deepEqual((await list.execute({})).items, beforeRevocation);
  assert.notEqual((await service.snapshot()).lease_token, null);
  checks.push('stale_lease_result_and_cleanup_are_fenced');

  snapshot = await service.snapshot();
  snapshot.articles[0].last_seen_at = new Date(
    Date.now() - NEWS_RETENTION_MS - 1000,
  ).toISOString();
  await source.getRepository(NewsSource).save(snapshot);
  assert.equal((await list.execute({})).items.length, 0);
  await allowRefresh();
  nextFetch = async () => ({
    status: 'updated',
    articles: [],
    etag: null,
    lastModified: null,
  });
  await refresh.execute(actor, { source_key: 'web-dev' });
  assert.deepEqual((await service.snapshot()).articles, []);
  checks.push(
    'retention_read_excludes_expired_and_refresh_prunes_physical_cache',
  );

  // Each source owns its reservation, validators, snapshot and failure state.
  await allowRefresh();
  nextFetch = async (_validators, key) => result('shared', '', key);
  await refresh.execute(actor, { source_key: 'web-dev' });
  const webState = await service.snapshot();
  await refresh.execute(actor, { source_key: 'node-js' });
  const nodeState = await service.snapshot(undefined, false, 'node-js');
  assert.ok(nodeState.last_success_at);
  const allSources = await list.execute({});
  assert.equal(allSources.pagination.total, 1);
  assert.deepEqual(
    allSources.items[0].provenances.map((entry) => entry.source_key),
    ['web-dev', 'node-js'],
  );
  const onlyNode = await list.execute({ source_key: 'node-js' });
  assert.equal(onlyNode.items[0].source_key, 'node-js');
  assert.equal(onlyNode.items[0].excerpt, null);
  assert.equal(
    (await list.execute({ source_key: 'web-dev' })).items[0].excerpt,
    'Fixture & description',
  );
  const beforeCached = calls;
  assert.equal(
    (await refresh.execute(actor, { source_key: 'web-dev' })).status,
    'cached',
  );
  assert.equal(calls, beforeCached);
  assert.equal(
    (await service.snapshot()).last_success_at.toISOString(),
    webState.last_success_at.toISOString(),
  );
  await source.query(
    "UPDATE news_sources SET next_refresh_at=clock_timestamp()-interval '1 second' WHERE source_key='node-js'",
  );
  nextFetch = async (validators, key) => {
    assert.equal(key, 'node-js');
    assert.equal(validators.etag, '"fixture"');
    return {
      status: 'not_modified',
      articles: [],
      etag: '"fixture"',
      lastModified: null,
    };
  };
  assert.equal(
    (await refresh.execute(actor, { source_key: 'node-js' })).status,
    'not_modified',
  );
  await source.query(
    "UPDATE news_sources SET next_refresh_at=clock_timestamp()-interval '1 second' WHERE source_key='node-js'",
  );
  nextFetch = async () => {
    throw new NewsFeedError('source_unavailable');
  };
  await assert.rejects(
    () => refresh.execute(actor, { source_key: 'node-js' }),
    /news:source_unavailable/,
  );
  assert.equal((await list.execute({})).pagination.total, 1);
  assert.equal((await list.execute({ source_key: 'node-js' })).items.length, 1);
  assert.equal((await service.snapshot()).last_error_code, null);
  assert.equal(
    (await service.snapshot()).last_success_at.toISOString(),
    webState.last_success_at.toISOString(),
  );
  checks.push(
    'multi_source_independent_cooldown_validators_failure_and_dedupe_provenances',
  );

  // A source in flight must not reserve another source or leak its lease/validators.
  await allowRefresh();
  let finishWeb;
  let webStarted;
  const waitWeb = new Promise((resolve) => {
    webStarted = resolve;
  });
  nextFetch = async (_validators, key) => {
    if (key === 'node-js') return result('separate-node', '?node=1', key);
    webStarted();
    return new Promise((resolve) => {
      finishWeb = () => resolve(result('shared'));
    });
  };
  const pendingWeb = refresh.execute(actor, { source_key: 'web-dev' });
  await waitWeb;
  assert.equal(
    (await refreshOtherProcess.execute(actor, { source_key: 'node-js' }))
      .status,
    'updated',
  );
  finishWeb();
  await pendingWeb;
  assert.equal((await list.execute({})).pagination.total, 2);
  checks.push('different_source_can_refresh_while_other_source_is_in_flight');
  await source.query("DELETE FROM news_sources WHERE source_key='node-js'");
  await source.query(
    "UPDATE news_sources SET articles='[]'::jsonb,feed_ids='{}' WHERE source_key='web-dev'",
  );

  moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        ...config,
        // Real AuthService ORM metadata, with synthetic SQL tables and no synchronize.
        entities: [
          fileURLToPath(
            new URL('../dist/**/*.entity.js', import.meta.url),
          ).replaceAll('\\', '/'),
        ],
      }),
      NewsModule,
    ],
  })
    .overrideProvider(NewsFeedClient)
    .useValue(feed)
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('/api/v1');
  const reflector = new Reflector();
  // Fresh laboratory key per run; never load app config, use Google, or log tokens.
  const labConfig = {
    secret: randomBytes(48).toString('hex'),
    issuer: 'nodia-news-isolated-laboratory',
    accessAudience: 'nodia-news-lab:api',
    refreshAudience: 'nodia-news-lab:refresh',
    accessSeconds: 900,
  };
  const jwt = new JwtService();
  const tokens = new AuthTokenService(jwt, labConfig);
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  const adminSession = await tokens.issue(
    {
      id: '1',
      name: 'Lab admin',
      email: 'admin@example.invalid',
      image_url: null,
    },
    session,
    expires,
  );
  const userSession = await tokens.issue(
    {
      id: '2',
      name: 'Lab user',
      email: 'user@example.invalid',
      image_url: null,
    },
    ordinarySession,
    expires,
  );
  const adminHeader = `Bearer ${adminSession.response.token}`;
  const userHeader = `Bearer ${userSession.response.token}`;
  const authenticate = new AuthenticateRequestUseCase(
    new AuthService(moduleRef.get(DataSource)),
    tokens,
  );
  app.useGlobalGuards(
    new AuthGuard(reflector, authenticate),
    new ModuleAccessGuard(
      reflector,
      new CheckModuleAccessUseCase(moduleRef.get(DataSource)),
    ),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const http = supertest(app.getHttpServer());
  const beforeHttp = calls;
  assert.equal((await http.get('/api/v1/news')).status, 200);
  assert.equal((await http.get('/api/v1/news?source_key=node-js')).status, 200);
  assert.equal((await http.get('/api/v1/news')).body.sources.length, 2);
  assert.equal(
    (await http.get('/api/v1/news').set('Authorization', 'Bearer invalid'))
      .status,
    200,
  );
  assert.equal(calls, beforeHttp);
  const expiredAccess = await jwt.signAsync(
    {
      sub: '1',
      sid: session,
      token_use: 'access',
      exp: Math.floor(Date.now() / 1000) - 60,
    },
    {
      secret: labConfig.secret,
      algorithm: 'HS256',
      issuer: labConfig.issuer,
      audience: labConfig.accessAudience,
    },
  );
  const wrongAudience = await jwt.signAsync(
    {
      sub: '1',
      sid: session,
      token_use: 'access',
      exp: Math.floor(Date.now() / 1000) + 60,
    },
    {
      secret: labConfig.secret,
      algorithm: 'HS256',
      issuer: labConfig.issuer,
      audience: labConfig.refreshAudience,
    },
  );
  const forgedAccess = await new AuthTokenService(jwt, {
    ...labConfig,
    secret: randomBytes(48).toString('hex'),
  }).issue(
    {
      id: '1',
      name: 'Lab admin',
      email: 'admin@example.invalid',
      image_url: null,
    },
    session,
    expires,
  );
  for (const rejectedHeader of [
    'Bearer invalid',
    `Bearer ${expiredAccess}`,
    `Bearer ${wrongAudience}`,
    `Bearer ${adminSession.refreshToken}`,
    `Bearer ${forgedAccess.response.token}`,
  ]) {
    assert.equal(
      (
        await http
          .post('/api/v1/news/refresh')
          .set('Authorization', rejectedHeader)
          .send({ source_key: 'node-js' })
      ).status,
      401,
    );
  }
  assert.equal(calls, beforeHttp);
  checks.push(
    'real_lab_jwt_invalid_expired_audience_refresh_and_forged_rejected_without_consumption',
  );
  assert.equal(
    (await http.post('/api/v1/news/refresh').send({ source_key: 'node-js' }))
      .status,
    401,
  );
  assert.equal(
    (
      await http
        .post('/api/v1/news/refresh')
        .set('Authorization', userHeader)
        .send({ source_key: 'node-js' })
    ).status,
    403,
  );
  assert.equal(calls, beforeHttp);
  // Reuse the same valid signed token while current SQL authority changes.
  await source.query('UPDATE users SET is_active=false WHERE id=1');
  assert.equal(
    (
      await http
        .post('/api/v1/news/refresh')
        .set('Authorization', adminHeader)
        .send({ source_key: 'node-js' })
    ).status,
    401,
  );
  await source.query('UPDATE users SET is_active=true WHERE id=1');
  await source.query(
    "UPDATE auth_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE public_id=$1",
    [session],
  );
  assert.equal(
    (
      await http
        .post('/api/v1/news/refresh')
        .set('Authorization', adminHeader)
        .send({ source_key: 'node-js' })
    ).status,
    401,
  );
  await source.query(
    "UPDATE auth_sessions SET expires_at=clock_timestamp()+interval '1 hour' WHERE public_id=$1",
    [session],
  );
  await source.query('UPDATE roles SET is_active=false WHERE key=$1', [
    'super_admin',
  ]);
  assert.equal(
    (
      await http
        .post('/api/v1/news/refresh')
        .set('Authorization', adminHeader)
        .send({ source_key: 'node-js' })
    ).status,
    403,
  );
  await source.query('UPDATE roles SET is_active=true WHERE key=$1', [
    'super_admin',
  ]);
  assert.equal(calls, beforeHttp);
  checks.push(
    'same_valid_jwt_current_user_session_expiry_and_role_revocation_blocked_without_consumption',
  );
  for (const query of [
    'limit=51',
    'page=0',
    'source_key=daily-dev',
    'order=popular',
    'actor=1',
    'page=',
  ])
    assert.equal((await http.get('/api/v1/news?' + query)).status, 400);
  assert.equal(
    (await http.post('/api/v1/news/refresh').send({ source_key: 'web-dev' }))
      .status,
    401,
  );
  assert.equal(
    (
      await http
        .post('/api/v1/news/refresh')
        .set('Authorization', userHeader)
        .send({ source_key: 'web-dev' })
    ).status,
    403,
  );
  assert.equal(calls, beforeHttp);
  for (const body of [
    { source_key: 'daily-dev' },
    { source_key: 'web-dev', actor: '1' },
    {},
  ])
    assert.equal(
      (
        await http
          .post('/api/v1/news/refresh')
          .set('Authorization', adminHeader)
          .send(body)
      ).status,
      400,
    );
  await allowRefresh();
  nextFetch = async () => result('http');
  const refreshed = await http
    .post('/api/v1/news/refresh')
    .set('Authorization', adminHeader)
    .send({ source_key: 'web-dev' });
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.body.status, 'updated');
  assert.equal(calls, beforeHttp + 1);
  const publicResult = await http.get('/api/v1/news?topic=programming&limit=1');
  assert.equal(publicResult.body.items.length, 1);
  assert.deepEqual(publicResult.body.pagination, {
    page: 1,
    limit: 1,
    total: 1,
    total_pages: 1,
  });
  assert.equal((await http.get('/api/v1/news?topic=ai')).body.items.length, 0);
  nextFetch = async (_validators, key) => {
    assert.equal(key, 'node-js');
    return result('http-node', '', key);
  };
  const nodeRefreshed = await http
    .post('/api/v1/news/refresh')
    .set('Authorization', adminHeader)
    .send({ source_key: 'node-js' });
  assert.equal(nodeRefreshed.status, 200);
  assert.equal(nodeRefreshed.body.source_key, 'node-js');
  const nodePublic = await http.get('/api/v1/news?source_key=node-js');
  assert.equal(nodePublic.body.items[0].source_key, 'node-js');
  assert.equal(nodePublic.body.items[0].excerpt, null);
  assert.equal(nodePublic.body.items[0].provenances.length, 2);
  assert.equal((await http.get('/api/v1/news')).body.pagination.total, 1);
  await source.query(
    'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',
    [session],
  );
  assert.equal(
    (
      await http
        .post('/api/v1/news/refresh')
        .set('Authorization', adminHeader)
        .send({ source_key: 'web-dev' })
    ).status,
    401,
  );
  assert.equal(calls, beforeHttp + 2);
  checks.push(
    'compiled_nest_public_get_private_post_validation_role_session_and_pagination',
  );
  // Explicit opt-in only: actual RSS -> real authorization/SQL -> anonymous reads.
  // These are two bounded upstream GETs, never a retry/fallback or production DB.
  if (process.env.NEWS_TEST_LIVE_RSS === '1') {
    assert.equal(
      (await source.query('SELECT current_database() AS db'))[0].db,
      'news_test',
    );
    await source.query('DELETE FROM news_sources');
    await source.query('UPDATE users SET is_active=true WHERE id=1');
    await source.query(
      "UPDATE roles SET is_active=true WHERE key='super_admin'",
    );
    await source.query(
      "UPDATE auth_sessions SET revoked_at=NULL,expires_at=clock_timestamp()+interval '1 hour' WHERE public_id=$1 AND user_id=1",
      [session],
    );
    const realFeed = new NewsFeedClient();
    const liveBySource = [];
    nextFetch = async (validators, key) => {
      liveProviderCalls++;
      return realFeed.fetch(validators, key);
    };
    for (const key of ['web-dev', 'node-js']) {
      const response = await http
        .post('/api/v1/news/refresh')
        .set('Authorization', adminHeader)
        .send({ source_key: key });
      assert.equal(
        response.status,
        200,
        JSON.stringify({
          source_key: key,
          status: response.status,
          message: response.body.message,
        }),
      );
      assert.equal(response.body.status, 'updated');
      assert.equal(response.body.source_key, key);
      assert.ok(
        response.body.received_count > 0 && response.body.received_count <= 100,
      );
      liveBySource.push({
        source_key: key,
        received_count: response.body.received_count,
        stored_count: response.body.stored_count,
      });
    }
    assert.equal(liveProviderCalls, 2);
    const persisted = await source.query(
      'SELECT source_key,jsonb_array_length(articles)::int AS count FROM news_sources ORDER BY source_key',
    );
    assert.equal(persisted.length, 2);
    for (const row of persisted)
      assert.equal(
        row.count,
        liveBySource.find((item) => item.source_key === row.source_key)
          .stored_count,
      );
    const firstPage = await http.get('/api/v1/news?limit=50');
    assert.equal(firstPage.status, 200);
    assert.deepEqual(
      firstPage.body.sources.map((item) => item.key),
      ['web-dev', 'node-js'],
    );
    assert.ok(
      firstPage.body.sources.every(
        (item) => item.last_success_at && !item.last_error_code,
      ),
    );
    assert.ok(
      firstPage.body.pagination.total > 0 &&
        firstPage.body.pagination.total <= 200,
    );
    const allItems = [...firstPage.body.items];
    for (let page = 2; page <= firstPage.body.pagination.total_pages; page++) {
      const response = await http.get(`/api/v1/news?limit=50&page=${page}`);
      assert.equal(response.status, 200);
      assert.equal(
        response.body.pagination.total,
        firstPage.body.pagination.total,
      );
      allItems.push(...response.body.items);
    }
    assert.equal(allItems.length, firstPage.body.pagination.total);
    assert.equal(
      new Set(allItems.map((item) => item.url)).size,
      allItems.length,
    );
    for (const item of allItems) {
      assert.ok(item.title && item.url.startsWith('https://'));
      assert.ok(item.provenances.length > 0 && item.provenances.length <= 2);
      assert.equal(
        new Set(item.provenances.map((p) => p.source_key)).size,
        item.provenances.length,
      );
      assert.ok(
        item.provenances.some(
          (p) =>
            p.source_key === item.source_key &&
            p.source_name === item.source_name &&
            p.license_url === item.license_url,
        ),
      );
      assert.ok(
        item.provenances.every((p) =>
          ['web-dev', 'node-js'].includes(p.source_key),
        ),
      );
      if (item.source_key === 'node-js') {
        assert.equal(item.excerpt, null);
        assert.equal(item.author, null);
      }
    }
    const nodeOnly = await http.get('/api/v1/news?source_key=node-js&limit=50');
    assert.equal(nodeOnly.status, 200);
    assert.equal(
      nodeOnly.body.pagination.total,
      liveBySource.find((item) => item.source_key === 'node-js').stored_count,
    );
    assert.ok(
      nodeOnly.body.items.length > 0 &&
        nodeOnly.body.items.every(
          (item) =>
            item.source_key === 'node-js' &&
            item.excerpt === null &&
            item.author === null,
        ),
    );
    assert.equal(liveProviderCalls, 2, 'Anonymous reads never consume RSS');
    checks.push(
      'opt_in_real_rss_two_jwt_admin_posts_persisted_then_anonymous_pagination_provenance_and_node_null_fields',
    );
    liveSummary = {
      sources: liveBySource,
      public_total: firstPage.body.pagination.total,
      public_pages: firstPage.body.pagination.total_pages,
      node_public_total: nodeOnly.body.pagination.total,
    };
  }
  console.log(
    JSON.stringify({
      schema: 'news-isolated-integration/1',
      status: 'passed',
      checks,
      provider_calls: liveProviderCalls,
      fixture_feed_dispatches: calls - liveProviderCalls,
      live_rss_opt_in: process.env.NEWS_TEST_LIVE_RSS === '1',
      live_summary: liveSummary,
      configured_database_used: false,
      real_jwt_tested: true,
      jwt_key_scope: 'ephemeral_laboratory_only',
      google_login_tested: false,
      actual_user_session_tested: false,
      upstream_transport_mocked: process.env.NEWS_TEST_LIVE_RSS !== '1',
      fixture_transport_mocked: true,
      live_transport_mocked: liveSummary ? false : null,
    }),
  );
} finally {
  await app?.close();
  if (!app) await moduleRef?.close();
  if (source?.isInitialized) await source.destroy();
  try {
    docker('rm', '--force', name);
  } catch {
    /* Already removed by Docker --rm. */
  }
}
