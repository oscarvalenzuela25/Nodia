// Compiled Nest HTTP and PostgreSQL 16. The provider and credentials are synthetic.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import supertest from 'supertest';

process.env.DOTENV_CONFIG_PATH =
  process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.NEWS_PERSONAL_ENCRYPTION_KEY = randomBytes(32).toString('hex');
delete process.env.NEWS_DAILY_DEV_LOCAL_OWNER_ID;

const { NewsModule } = await import('../dist/news/news.module.js');
const { DevCommunityNewsClient } =
  await import('../dist/news/personal/dev-community-news.client.js');
const { DailyDevNewsClient } =
  await import('../dist/news/personal/daily-dev-news.client.js');
const { PersonalNewsProviderError } =
  await import('../dist/news/personal/personal-news.types.js');
const { AuthGuard } = await import('../dist/auth/auth.guard.js');
const { AuthService } = await import('../dist/auth/auth.service.js');
const { AuthTokenService } = await import('../dist/auth/auth-token.service.js');
const { AuthenticateRequestUseCase } =
  await import('../dist/auth/use-case/authenticate-request.use-case.js');
const { ModuleAccessGuard } =
  await import('../dist/authorization/module-access.guard.js');
const { CheckModuleAccessUseCase } =
  await import('../dist/authorization/use-case/check-module-access.use-case.js');
const { AllExceptionsFilter } =
  await import('../dist/common/filters/all-exceptions.filter.js');
const { PublicNewsCache1793670000000 } =
  await import('../dist/migrations/1793670000000-PublicNewsCache.js');
const { NewsNodeSource1793670001000 } =
  await import('../dist/migrations/1793670001000-NewsNodeSource.js');
const { PersonalNewsConnections1793760000000 } =
  await import('../dist/migrations/1793760000000-PersonalNewsConnections.js');
const { AllowDailyDevPersonalPilot1793770000000 } =
  await import('../dist/migrations/1793770000000-AllowDailyDevPersonalPilot.js');

const database = 'personal_news_test';
const container = `nodia_personal_news_${randomUUID().replaceAll('-', '')}`;
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  }).trim();

async function startDatabase() {
  docker(
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    `POSTGRES_USER=${database}`,
    '--env',
    `POSTGRES_DB=${database}`,
    '--env',
    `POSTGRES_PASSWORD=${container}`,
    'postgres:16-alpine',
  );
  const mapping = docker('port', container, '5432/tcp');
  assert.match(mapping, /^127\.0\.0\.1:\d+$/);
  for (let attempt = 0; ; attempt++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        database,
        '-d',
        database,
      );
      return Number(mapping.split(':')[1]);
    } catch (error) {
      if (attempt >= 60) throw error;
      await delay(250);
    }
  }
}

const sessions = ['1', '2', '3'].map((id) => ({ id, sid: randomUUID() }));

async function installAuthFixture(source) {
  await source.query(`CREATE TABLE users(id bigint PRIMARY KEY,is_active boolean NOT NULL,
      name varchar,email text,image_url text,google_sub varchar,
      created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE roles(id bigint PRIMARY KEY,key text NOT NULL,is_active boolean NOT NULL);
    CREATE TABLE user_roles(user_id bigint,role_id bigint,is_active boolean NOT NULL);
    CREATE TABLE auth_sessions(public_id uuid PRIMARY KEY,user_id bigint,revoked_at timestamptz,
      expires_at timestamptz NOT NULL,id bigserial,image_url text,refresh_token_hash varchar(64),
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE actions(id int); CREATE TABLE module_groups(id int); CREATE TABLE modules(id int);
    CREATE TABLE role_actions(id int); CREATE TABLE user_modules(id int);
    INSERT INTO roles VALUES(1,'super_admin',true); INSERT INTO user_roles VALUES(1,1,true)`);
  for (const { id, sid } of sessions) {
    await source.query('INSERT INTO users VALUES ($1,true,$2,$3)', [
      id,
      `Lab ${id}`,
      `${id}@example.invalid`,
    ]);
    await source.query(
      `INSERT INTO auth_sessions(public_id,user_id,expires_at)
      VALUES($1,$2,clock_timestamp()+interval '1 hour')`,
      [sid, id],
    );
  }
}

async function verifyUpgrade(settings) {
  const base = await new DataSource({
    ...settings,
    migrations: historicalNewsMigrations.slice(0, 2),
  }).initialize();
  try {
    await installAuthFixture(base);
    assert.equal((await base.runMigrations()).length, 2);
    await base.query(`INSERT INTO news_sources(source_key,articles,etag) VALUES
      ('web-dev','[{"title":"Historical web.dev"}]','web-etag'),
      ('node-js','[{"title":"Historical Node.js"}]','node-etag')`);
  } finally {
    await base.destroy();
  }
  const upgraded = await new DataSource({
    ...settings,
    migrations: historicalNewsMigrations,
  }).initialize();
  try {
    const priorRows = await upgraded.query(
      'SELECT * FROM news_sources ORDER BY source_key',
    );
    assert.deepEqual(
      (await upgraded.runMigrations()).map(({ name }) => name),
      ['PersonalNewsConnections1793760000000'],
    );
    assert.deepEqual(
      await upgraded.query('SELECT * FROM news_personal_connections'),
      [],
    );
    assert.deepEqual(
      await upgraded.query('SELECT * FROM news_sources ORDER BY source_key'),
      priorRows,
    );
    assert.deepEqual(await upgraded.runMigrations(), []);
    await upgraded.undoLastMigration();
    assert.equal(
      (
        await upgraded.query(
          "SELECT to_regclass('news_personal_connections') AS table_name",
        )
      )[0].table_name,
      null,
    );
    assert.deepEqual(
      await upgraded.query('SELECT * FROM news_sources ORDER BY source_key'),
      priorRows,
    );
    assert.equal((await upgraded.runMigrations()).length, 1);
  } finally {
    await upgraded.destroy();
  }
}

const historicalNewsMigrations = [
  PublicNewsCache1793670000000,
  NewsNodeSource1793670001000,
  PersonalNewsConnections1793760000000,
];

async function verifyDailyDevUpgrade(settings) {
  const upgraded = await new DataSource({
    ...settings,
    migrations: [
      ...historicalNewsMigrations,
      AllowDailyDevPersonalPilot1793770000000,
    ],
  }).initialize();
  try {
    const addRow = (provider) =>
      upgraded.query(
        'INSERT INTO news_personal_connections(user_id, provider, credential_version) VALUES (1, $1, $2)',
        [provider, randomUUID()],
      );
    await addRow('dev-community');
    await assert.rejects(addRow('daily-dev'), { code: '23514' });
    const rows = () =>
      upgraded.query(
        'SELECT * FROM news_personal_connections ORDER BY provider',
      );
    const legacy = await rows();
    assert.deepEqual(
      (await upgraded.runMigrations()).map(({ name }) => name),
      ['AllowDailyDevPersonalPilot1793770000000'],
    );
    assert.deepEqual(await rows(), legacy);
    await addRow('daily-dev');
    await assert.rejects(upgraded.undoLastMigration());
    assert.deepEqual(
      (await rows()).map(({ provider }) => provider),
      ['daily-dev', 'dev-community'],
    );
    await upgraded.query(
      "DELETE FROM news_personal_connections WHERE provider = 'daily-dev'",
    );
    await upgraded.undoLastMigration();
    assert.deepEqual(await rows(), legacy);
    await assert.rejects(addRow('daily-dev'), { code: '23514' });
    await upgraded.runMigrations();
    await upgraded.query(
      'DELETE FROM news_personal_connections WHERE user_id = 1',
    );
  } finally {
    await upgraded.destroy();
  }
}

const api = '/api/v1/news';
const personal = `${api}/personal`;
const dev = 'dev-community';
const daily = 'daily-dev';
const connection = `${personal}/connections/${dev}`;
const dailyConnection = `${personal}/connections/${daily}`;
const token1 = `fixture-account-alpha-${randomUUID()}`;
const token2 = `fixture-account-beta-${randomUUID()}`;
const dailyToken = `dda_local-fixture-${randomUUID()}`;
const ownerFlag = new Map([
  [token1, 'Alpha'],
  [token2, 'Beta'],
]);
const articlesFor = (key) => [
  {
    id: `article-${ownerFlag.get(key)}`,
    provider: dev,
    title: `Article for ${ownerFlag.get(key)}`,
    url: 'https://dev.to/lab/fixture',
    ...(key === token2
      ? {
          cover_image_url: 'https://media2.dev.to/lab/fixture.jpg',
          tags: ['backend', 'nodejs'],
        }
      : {}),
    published_at: null,
  },
];

let calls = 0;
let onTest = async (key) => ({ account_name: ownerFlag.get(key) });
let onRefresh = async (key) => ({
  articles: articlesFor(key),
  hasFollowedTags: true,
});
const provider = {
  test(key) {
    calls++;
    return onTest(key);
  },
  refresh(key) {
    calls++;
    return onRefresh(key);
  },
};

const dailyArticles = [
  {
    id: 'daily-fixture-personal-post',
    provider: daily,
    title: 'Private daily item',
    url: 'https://example.invalid/private-daily-item',
    published_at: null,
    tags: ['backend'],
  },
];
let dailyCalls = 0;
let dailyRevoked = false;
const dailyProvider = {
  async test(key) {
    assert.equal(key, dailyToken);
    dailyCalls++;
    if (dailyRevoked)
      throw new PersonalNewsProviderError('news:provider_credentials_invalid');
    return { account_name: 'DailyFixture' };
  },
  async refresh(key) {
    assert.equal(key, dailyToken);
    dailyCalls++;
    return { articles: dailyArticles };
  },
};

function expectStatus(response, status, message) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  if (message) assert.equal(response.body.message, message);
  return response.body;
}

async function openHttp(settings) {
  const module = await Test.createTestingModule({
    imports: [TypeOrmModule.forRoot(settings), NewsModule],
  })
    .overrideProvider(DevCommunityNewsClient)
    .useValue(provider)
    .overrideProvider(DailyDevNewsClient)
    .useValue(dailyProvider)
    .compile();
  const source = module.get(DataSource);
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('/api/v1');
  const reflector = new Reflector();
  const config = {
    secret: randomBytes(48).toString('hex'),
    issuer: 'nodia-personal-news-lab',
    accessAudience: 'nodia-news-lab:api',
    refreshAudience: 'nodia-news-lab:refresh',
    accessSeconds: 900,
  };
  const tokens = new AuthTokenService(new JwtService(), config);
  app.useGlobalGuards(
    new AuthGuard(
      reflector,
      new AuthenticateRequestUseCase(new AuthService(source), tokens),
    ),
    new ModuleAccessGuard(reflector, new CheckModuleAccessUseCase(source)),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  const client = supertest(app.getHttpServer());
  const headers = new Map();
  for (const { id, sid } of sessions) {
    const issued = await tokens.issue(
      {
        id,
        name: `Lab ${id}`,
        email: `${id}@example.invalid`,
        image_url: null,
      },
      sid,
      new Date(Date.now() + 60 * 60 * 1000),
    );
    headers.set(id, `Bearer ${issued.response.token}`);
  }
  function send(method, path, owner, body) {
    const request = client[method](path);
    if (owner) request.set('Authorization', headers.get(owner));
    if (body !== undefined) request.send(body);
    return request;
  }
  return { app, source, send };
}

async function verifyRetiredPublicRoutes(send) {
  const expected = {
    items: [],
    sources: [],
    pagination: { page: 2, limit: 10, total: 0, total_pages: 0 },
  };
  for (const query of [
    'source_key=web-dev',
    'catalog=2&source_key=rust-blog',
  ]) {
    const response = await send('get', `${api}?page=2&limit=10&${query}`);
    assert.deepEqual(expectStatus(response, 200), expected);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  expectStatus(await send('get', `${api}?limit=51`), 400);
  expectStatus(
    await send('post', `${api}/refresh`, null, { source_key: 'web-dev' }),
    401,
  );
  expectStatus(
    await send('post', `${api}/refresh`, '2', { source_key: 'web-dev' }),
    403,
    'news:super_admin_required',
  );
  expectStatus(
    await send('post', `${api}/refresh`, '1', { source_key: 'node-js' }),
    410,
    'news:source_retired',
  );
  assert.equal(calls, 0);
}

async function verifyPersonalOwnership({ send, source }) {
  for (const route of ['connections', 'articles']) {
    const response = await send('get', `${personal}/${route}`);
    expectStatus(response, 401);
    assert.match(response.headers['cache-control'], /no-store/);
  }
  const opening = await send('get', `${personal}/connections`, '2');
  assert.match(opening.headers['cache-control'], /private.*no-store/);
  assert.deepEqual(
    expectStatus(opening, 200).connections.map(({ provider, state }) => [
      provider,
      state,
    ]),
    [
      [dev, 'disconnected'],
      [daily, 'pending'],
    ],
  );
  assert.deepEqual(
    expectStatus(await send('get', `${personal}/articles`, '2'), 200).items,
    [],
  );
  expectStatus(await send('get', `${personal}/articles?user_id=1`, '2'), 400);
  expectStatus(
    await send('post', connection, '2', { api_key: token1, user_id: '1' }),
    400,
  );
  expectStatus(
    await send('post', `${personal}/connections/${daily}`, '2', {
      api_key: token1,
    }),
    503,
    'news:provider_pending',
  );
  assert.equal(calls, 0);

  const stored = expectStatus(
    await send('post', connection, '2', { api_key: token1 }),
    200,
  ).connection;
  assert.equal(stored.state, 'connected');
  assert.equal(stored.account_name, 'Alpha');
  assert.doesNotMatch(JSON.stringify(stored), new RegExp(token1));
  const [persisted] = await source.query(
    'SELECT * FROM news_personal_connections WHERE user_id = $1',
    ['2'],
  );
  assert.equal(persisted.provider, dev);
  assert.ok(persisted.credential_ciphertext);
  assert.doesNotMatch(JSON.stringify(persisted), new RegExp(token1));
  assert.deepEqual(
    expectStatus(await send('get', `${personal}/articles`, '2'), 200).items,
    [],
  );
  assert.equal(calls, 1);

  expectStatus(await send('post', `${connection}/test`, '2'), 200);
  const updated = expectStatus(
    await send('post', `${connection}/refresh`, '2'),
    200,
  );
  assert.equal(updated.status, 'updated');
  assert.deepEqual(
    expectStatus(
      await send('get', `${personal}/articles?provider=${dev}`, '2'),
      200,
    ).items,
    articlesFor(token1),
  );
  assert.deepEqual(
    expectStatus(await send('get', `${personal}/articles`, '1'), 200).items,
    [],
  );
  const other = expectStatus(
    await send('post', connection, '3', { api_key: token2 }),
    200,
  ).connection;
  assert.equal(other.account_name, 'Beta');
  assert.equal(
    expectStatus(await send('post', `${connection}/refresh`, '3'), 200).status,
    'updated',
  );
  assert.deepEqual(
    expectStatus(await send('get', `${personal}/articles`, '3'), 200).items,
    articlesFor(token2),
  );
  const beforeCooldown = calls;
  assert.equal(
    expectStatus(await send('post', `${connection}/refresh`, '2'), 200).status,
    'cached',
  );
  assert.equal(calls, beforeCooldown);
}

async function verifyDailyDevPilot({ send, source }) {
  const previousMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  process.env.NEWS_DAILY_DEV_LOCAL_OWNER_ID = '2';
  try {
    const dailyStatus = async (user) =>
      expectStatus(
        await send('get', `${personal}/connections`, user),
        200,
      ).connections.find(({ provider }) => provider === daily);
    const articles = async (user, provider) =>
      expectStatus(
        await send(
          'get',
          `${personal}/articles${provider ? `?provider=${provider}` : ''}`,
          user,
        ),
        200,
      ).items;

    assert.equal((await dailyStatus('2')).state, 'disconnected');
    assert.equal((await dailyStatus('1')).state, 'pending');
    assert.equal((await dailyStatus('3')).state, 'pending');
    expectStatus(
      await send('post', dailyConnection, '3', { api_key: dailyToken }),
      503,
      'news:provider_pending',
    );
    expectStatus(
      await send('post', dailyConnection, '2', {
        api_key: 'invalid-pat-format',
      }),
      400,
    );
    assert.equal(dailyCalls, 0);

    const connected = expectStatus(
      await send('post', dailyConnection, '2', { api_key: dailyToken }),
      200,
    ).connection;
    assert.equal(connected.state, 'connected');
    assert.equal(connected.provider, daily);
    assert.equal(connected.account_name, 'DailyFixture');
    assert.doesNotMatch(JSON.stringify(connected), new RegExp(dailyToken));
    assert.deepEqual(await articles('2', daily), []);
    assert.equal(dailyCalls, 1);

    assert.equal(
      expectStatus(await send('post', `${dailyConnection}/refresh`, '2'), 200)
        .status,
      'updated',
    );
    assert.deepEqual(await articles('2', daily), dailyArticles);
    assert.deepEqual(await articles('2'), articlesFor(token1));
    assert.deepEqual(await articles('3'), articlesFor(token2));
    assert.deepEqual(await articles('3', daily), []);
    expectStatus(await send('delete', dailyConnection, '3'), 204);
    assert.deepEqual(await articles('2', daily), dailyArticles);
    assert.equal(
      expectStatus(await send('post', `${dailyConnection}/refresh`, '2'), 200)
        .status,
      'cached',
    );
    assert.equal(dailyCalls, 2);

    const [row] = await source.query(
      `SELECT snapshot_expires_at, last_refresh_success_at, credential_ciphertext
      FROM news_personal_connections WHERE provider = $1 AND user_id = 2`,
      [daily],
    );
    assert.ok(row.credential_ciphertext);
    assert.doesNotMatch(row.credential_ciphertext, new RegExp(dailyToken));
    assert.equal(
      row.snapshot_expires_at - row.last_refresh_success_at,
      60 * 60_000,
    );

    process.env.NODE_ENV = 'production';
    assert.equal((await dailyStatus('2')).state, 'pending');
    assert.deepEqual(await articles('2', daily), []);
    expectStatus(
      await send('post', `${dailyConnection}/test`, '2'),
      503,
      'news:provider_pending',
    );
    assert.equal(dailyCalls, 2);
    process.env.NODE_ENV = 'development';

    dailyRevoked = true;
    expectStatus(
      await send('post', `${dailyConnection}/test`, '2'),
      400,
      'news:provider_credentials_invalid',
    );
    assert.equal((await dailyStatus('2')).state, 'reconnect_required');
    assert.deepEqual(await articles('2', daily), []);
    assert.deepEqual(await articles('2'), articlesFor(token1));
    const [revoked] = await source.query(
      `SELECT credential_ciphertext, articles
      FROM news_personal_connections WHERE provider = $1 AND user_id = 2`,
      [daily],
    );
    assert.equal(revoked.credential_ciphertext, null);
    assert.deepEqual(revoked.articles, []);
    expectStatus(await send('delete', dailyConnection, '2'), 204);
    assert.equal((await dailyStatus('2')).state, 'disconnected');
  } finally {
    process.env.NODE_ENV = previousMode;
    delete process.env.NEWS_DAILY_DEV_LOCAL_OWNER_ID;
  }
}

async function verifyFailuresAndRaces({ send, source }) {
  const allowRefresh = (owner) =>
    source.query(
      `UPDATE news_personal_connections
    SET next_refresh_at = clock_timestamp() - interval '1 second',
        retry_until = NULL, retry_source = NULL WHERE user_id = $1`,
      [owner],
    );
  await allowRefresh('2');
  onRefresh = async () => {
    throw new PersonalNewsProviderError(
      'news:provider_rate_limited',
      new Date(Date.now() + 60_000),
    );
  };
  const throttled = await send('post', `${connection}/refresh`, '2');
  expectStatus(throttled, 429, 'news:provider_rate_limited');
  assert.match(throttled.headers['retry-after'], /^\d+$/);
  assert.deepEqual(
    expectStatus(await send('get', `${personal}/articles`, '2'), 200).items,
    articlesFor(token1),
  );

  await allowRefresh('2');
  const validTest = onTest;
  onTest = async () => {
    throw new PersonalNewsProviderError('news:provider_credentials_invalid');
  };
  expectStatus(
    await send('post', connection, '2', { api_key: token2 }),
    400,
    'news:provider_credentials_invalid',
  );
  onTest = validTest;
  const original = expectStatus(
    await send('get', `${personal}/connections`, '2'),
    200,
  ).connections[0];
  assert.equal(original.account_name, 'Alpha');
  assert.deepEqual(
    expectStatus(await send('get', `${personal}/articles`, '2'), 200).items,
    articlesFor(token1),
  );

  await allowRefresh('2');
  const started = Promise.withResolvers();
  const complete = Promise.withResolvers();
  onRefresh = async (key) => {
    started.resolve();
    await complete.promise;
    return { articles: articlesFor(key), hasFollowedTags: true };
  };
  const inFlight = send('post', `${connection}/refresh`, '2').then(
    (response) => response,
  );
  try {
    await Promise.race([
      started.promise,
      inFlight.then(() => assert.fail('Provider did not start')),
    ]);
    expectStatus(await send('post', `${connection}/refresh`, '2'), 409);
    expectStatus(await send('delete', connection, '2'), 204);
  } finally {
    complete.resolve();
  }
  expectStatus(await inFlight, 409);
  assert.deepEqual(
    await source.query(
      'SELECT * FROM news_personal_connections WHERE user_id=$1',
      ['2'],
    ),
    [],
  );
  assert.deepEqual(
    expectStatus(await send('get', `${personal}/articles`, '2'), 200).items,
    [],
  );
  assert.deepEqual(
    expectStatus(await send('get', `${personal}/articles`, '3'), 200).items,
    articlesFor(token2),
  );

  onTest = async () => {
    throw new PersonalNewsProviderError('news:provider_credentials_invalid');
  };
  const invalid = await send('post', `${connection}/test`, '3');
  expectStatus(invalid, 400, 'news:provider_credentials_invalid');
  assert.doesNotMatch(JSON.stringify(invalid.body), new RegExp(token2));
  const revoked = expectStatus(
    await send('get', `${personal}/connections`, '3'),
    200,
  ).connections[0];
  assert.equal(revoked.state, 'reconnect_required');
  assert.deepEqual(
    expectStatus(await send('get', `${personal}/articles`, '3'), 200).items,
    [],
  );

  await source.query(
    'UPDATE auth_sessions SET expires_at=clock_timestamp() WHERE public_id=$1',
    [sessions[2].sid],
  );
  expectStatus(await send('post', connection, '3', { api_key: token2 }), 401);
  expectStatus(await send('get', `${personal}/articles`, '3'), 401);
}

async function verifyDisabledPilotAndPopulatedRollback({ send, source }) {
  const key = process.env.NEWS_PERSONAL_ENCRYPTION_KEY;
  try {
    delete process.env.NEWS_PERSONAL_ENCRYPTION_KEY;
    const before = calls;
    const result = expectStatus(
      await send('get', `${personal}/connections`, '2'),
      200,
    );
    assert.deepEqual(
      result.connections.map(({ state }) => state),
      ['pending', 'pending'],
    );
    expectStatus(
      await send('post', connection, '2', { api_key: token1 }),
      503,
      'news:provider_pending',
    );
    assert.equal(calls, before);
  } finally {
    process.env.NEWS_PERSONAL_ENCRYPTION_KEY = key;
  }

  const runner = source.createQueryRunner();
  try {
    await runner.startTransaction();
    await assert.rejects(
      new PersonalNewsConnections1793760000000().down(runner),
      /Personal News data must be preserved/,
    );
  } finally {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await runner.release();
  }
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS count FROM news_personal_connections',
      )
    )[0].count,
    1,
  );
}

let lab;
try {
  const settings = {
    type: 'postgres',
    host: '127.0.0.1',
    port: await startDatabase(),
    username: database,
    database,
    password: container,
    synchronize: false,
    entities: [
      fileURLToPath(
        new URL('../dist/**/*.entity.js', import.meta.url),
      ).replaceAll('\\', '/'),
    ],
  };
  await verifyUpgrade(settings);
  await verifyDailyDevUpgrade(settings);
  lab = await openHttp(settings);
  await verifyRetiredPublicRoutes(lab.send);
  await verifyPersonalOwnership(lab);
  await verifyDailyDevPilot(lab);
  await verifyFailuresAndRaces(lab);
  await verifyDisabledPilotAndPopulatedRollback(lab);
  console.log(
    JSON.stringify({
      postgres: '16-alpine',
      checks: [
        'upgrade and rollback',
        'legacy compatibility',
        'private HTTP and encryption',
        'provider isolation and cooldown',
        'daily.dev migration, local owner fence, separate reads, expiry and revocation',
        'error, revocation and refresh fencing',
        'disabled pilot and populated rollback protection',
      ],
      provider_transport: 'synthetic',
    }),
  );
} finally {
  await lab?.app.close();
  const names = docker('ps', '-aq', '--filter', `name=^/${container}$`);
  if (names) docker('rm', '--force', container);
}
