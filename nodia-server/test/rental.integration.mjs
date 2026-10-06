import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { rentalErrorCatalog } from '../dist/rental-common/rental-error-catalog.js';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { Module, UnauthorizedException } from '@nestjs/common';
import { RentalValidationPipe } from '../dist/rental-common/rental-validation.pipe.js';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { rentalBodyParser } from '../dist/rental-common/rental-body-parser.js';
import qs from 'qs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { RentalModule } from '../dist/rental-common/rental.module.js';
import { RentalTransactionService } from '../dist/rental-common/rental-transaction.service.js';
import { RentalClock } from '../dist/rental-common/rental-clock.js';
import { RentalNavigationService } from '../dist/rental-navigation/rental-navigation.service.js';
import { SeedRentalNavigationUseCase } from '../dist/rental-navigation/use-case/seed-rental-navigation.use-case.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import {
  localInstant,
  formatLocalOn,
} from '../dist/rental-common/rental-time.js';
import { CreateRentalReservations1791146000000 } from '../dist/migrations/1791146000000-CreateRentalReservations.js';

// Owns an ephemeral database; never imports configured DataSource or reads .env.
const container = `template_rental_integration_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let db,
  app,
  started = false;
const checks = [];
let queryCount = 0;
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
    'POSTGRES_DB=rental_test',
    '--env',
    'POSTGRES_USER=rental_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  const options = {
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'rental_test',
    password,
    database: 'rental_test',
    synchronize: false,
    logging: ['query'],
    logger: {
      logQueryError() {},
      logQuery() {
        queryCount++;
      },
      logQuerySlow() {},
      logSchemaBuild() {},
      logMigration() {},
      log() {},
    },
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
    migrations: [CreateRentalReservations1791146000000],
  };
  for (let attempt = 0; attempt < 80; attempt++) {
    db = new DataSource(options);
    try {
      await db.initialize();
      break;
    } catch (error) {
      if (attempt === 79) throw error;
      await delay(250);
    }
  }
  await db.query(`CREATE TABLE users (id BIGSERIAL PRIMARY KEY,name VARCHAR(255),email TEXT NOT NULL UNIQUE,image_url TEXT,google_sub VARCHAR(255),is_active BOOLEAN DEFAULT true,created_at TIMESTAMP DEFAULT now(),updated_at TIMESTAMP DEFAULT now());
    INSERT INTO users(name,email) VALUES ('Synthetic Owner','owner@example.invalid'),('Synthetic Member','member@example.invalid'),('Synthetic Stranger','stranger@example.invalid');
    CREATE TABLE legacy_probe(id INTEGER PRIMARY KEY,value TEXT NOT NULL); INSERT INTO legacy_probe VALUES(1,'preserved');
    CREATE TABLE module_groups(id BIGSERIAL PRIMARY KEY,key VARCHAR(255) UNIQUE NOT NULL,icon VARCHAR(255),is_active BOOLEAN DEFAULT true,created_at TIMESTAMP DEFAULT now(),updated_at TIMESTAMP DEFAULT now());
    CREATE TABLE modules(id BIGSERIAL PRIMARY KEY,module_group_id BIGINT REFERENCES module_groups(id),key VARCHAR(255) UNIQUE NOT NULL,link VARCHAR(255) NOT NULL,icon VARCHAR(255),is_active BOOLEAN DEFAULT true,created_at TIMESTAMP DEFAULT now(),updated_at TIMESTAMP DEFAULT now());
    CREATE TABLE translations(id BIGSERIAL PRIMARY KEY,source_entity VARCHAR(255),source_id VARCHAR(255),source_key VARCHAR(255),locale VARCHAR(10),value TEXT,is_active BOOLEAN DEFAULT true,created_at TIMESTAMP DEFAULT now(),updated_at TIMESTAMP DEFAULT now(),UNIQUE(source_entity,source_id,source_key,locale));
    CREATE TABLE user_modules(id BIGSERIAL PRIMARY KEY,user_id BIGINT,module_id BIGINT);`);
  await db.runMigrations();
  await db.undoLastMigration();
  await db.runMigrations();
  assert.deepEqual(await db.query('SELECT * FROM legacy_probe'), [
    { id: 1, value: 'preserved' },
  ]);
  checks.push('Migration up/down/up preserves existing synthetic data.');
  const difference = await db.driver.createSchemaBuilder().log();
  const changes = difference.upQueries.filter((entry) =>
    /(?:ALTER TABLE|DROP TABLE|CREATE TABLE|(?:CREATE|DROP) (?:UNIQUE )?INDEX).*rental_/i.test(
      entry.query,
    ),
  );
  assert.deepEqual(
    changes.map((entry) => entry.query),
    [],
    'Rental metadata must match its incremental migration',
  );
  checks.push('Eleven entities match migration metadata without synchronize.');
  const seed = new SeedRentalNavigationUseCase(
    db,
    new RentalNavigationService(),
  );
  assert.deepEqual(await seed.execute(), await seed.execute());
  assert.equal(
    (await db.query('SELECT count(*)::int count FROM user_modules'))[0].count,
    0,
  );
  checks.push(
    'Navigation seed is idempotent and does not assign modules to users.',
  );
  class SyntheticIdentityGuard {
    canActivate(context) {
      const request = context.switchToHttp().getRequest();
      const id = request.headers['x-test-actor'];
      if (!['1', '2', '3'].includes(id))
        throw new UnauthorizedException('auth:unauthorized');
      request.auth = {
        user: {
          id,
          name: 'Synthetic',
          email: 'synthetic@example.invalid',
          image_url: null,
          roles: id === '3' ? ['superadmin'] : [],
        },
        sessionId: 'synthetic-session',
      };
      return true;
    }
  }
  class IntegrationModule {}
  Module({
    imports: [TypeOrmModule.forRoot(options), RentalModule],
    providers: [{ provide: APP_GUARD, useClass: SyntheticIdentityGuard }],
  })(IntegrationModule);
  app = await NestFactory.create(IntegrationModule, { logger: false });
  app.setGlobalPrefix('/api/v1');
  app.use('/api/v1/rental', rentalBodyParser);
  app.set('query parser', (str) =>
    qs.parse(str, { allowDots: true, comma: true }),
  );
  app.useGlobalPipes(
    new RentalValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  if (process.argv.includes('--client')) {
    // Opt-in browser harness uses this same temporary DB and synthetic guard.
    // Production AppModule, credentials and configured DataSource are untouched.
    const { runRentalClientHarness } =
      await import('../../nodia-client/scripts/rental-qa-server.mjs');
    await runRentalClientHarness({ base, db });
  } else {
    const api = '/api/v1/rental/properties';
    let requests = 0;
    const observed = new Set();
    const exchanges = [];
    async function request(method, url, body, actor = '1', key = randomUUID()) {
      requests++;
      const response = await fetch(base + url, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(actor ? { 'x-test-actor': actor } : {}),
          'idempotency-key': key,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(response.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
      const data = await response.json();
      if (response.ok) {
        observed.add(method + ' ' + url.split('?')[0]);
        exchanges.push({
          method,
          url,
          request: body,
          status: response.status,
          response: data,
        });
      }
      return { status: response.status, data };
    }
    const expectStatus = (response, status) => {
      assert.equal(response.status, status, JSON.stringify(response.data));
      return response.data;
    };
    const create = async (url, body, actor = '1') =>
      expectStatus(await request('POST', url, body, actor), 201);
    const get = async (url, actor = '1') =>
      expectStatus(await request('GET', url, undefined, actor), 200);
    const command = async (url, body = {}, actor = '1') =>
      expectStatus(await request('POST', url, body, actor), 200);
    const update = async (url, body, actor = '1') =>
      expectStatus(await request('PUT', url, body, actor), 200);
    const today = formatLocalOn(new Date(), 'America/Santiago');
    const day = (offset) =>
      new Date(Date.parse(today + 'T00:00:00Z') + offset * 86400000)
        .toISOString()
        .slice(0, 10);
    const occurredOn = day(-1);
    const propertyInput = {
      name: 'Synthetic house',
      timezone: 'America/Santiago',
      max_guests: 6,
      check_in_time: '15:00',
      check_out_time: '11:00',
      minimum_turnover_minutes: 120,
    };
    assert.equal((await request('GET', api, undefined, null)).status, 401);
    requests++;
    const malformed = await fetch(base + api, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-actor': '1',
        'idempotency-key': randomUUID(),
      },
      body: '{',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).message, 'rental:invalid_input');
    assert.equal(
      (await request('POST', api, { ...propertyInput, owner_id: '3' })).status,
      400,
    );
    assert.equal(
      (await request('POST', api, { ...propertyInput, max_guests: '6' }))
        .status,
      400,
    );
    assert.equal(
      (await request('POST', api, propertyInput, '1', 'invalid')).status,
      400,
    );
    assert.equal(
      (
        await request('POST', api, {
          ...propertyInput,
          notes: 'x'.repeat(70000),
        })
      ).status,
      413,
    );
    const initialKey = randomUUID();
    const duplicateCreates = await Promise.all([
      request('POST', api, propertyInput, '1', initialKey),
      request('POST', api, { ...propertyInput }, '1', initialKey),
    ]);
    duplicateCreates.forEach((response) => expectStatus(response, 201));
    assert.deepEqual(duplicateCreates[0].data, duplicateCreates[1].data);
    const propertyId = duplicateCreates[0].data.resource_id;
    const house = `${api}/${propertyId}`;
    assert.equal(
      (
        await request(
          'POST',
          api,
          { ...propertyInput, name: 'different' },
          '1',
          initialKey,
        )
      ).status,
      409,
    );
    assert.equal((await get(api)).meta.total_items, 1);
    assert.equal((await get(api + '?page=100')).data.length, 0);
    assert.equal((await request('GET', house, undefined, '3')).status, 404);
    assert.equal((await request('GET', api + '?all=true')).status, 400);
    assert.equal((await request('GET', house + '?owner_id=1')).status, 400);
    assert.equal((await request('GET', api + '?q[owner_id_eq]=1')).status, 400);
    const collaborator = await create(house + '/collaborators', {
      user_id: '2',
      position: 'Operations',
    });
    assert.equal((await get(house, '2')).membership.type, 'collaborator');
    assert.equal(
      (await request('PUT', house, { name: 'unauthorized' }, '2')).status,
      403,
    );
    assert.equal(
      (
        await request(
          'GET',
          house + '/collaborator-candidates?search=Syn',
          undefined,
          '2',
        )
      ).status,
      403,
    );
    assert.equal(
      (await request('GET', house + '/collaborator-candidates?search=x'))
        .status,
      400,
    );
    const candidates = await get(house + '/collaborator-candidates?search=Syn');
    assert(candidates.data.every((row) => !('email' in row)));
    const policy = await create(house + '/cancellation-policies', {
      name: 'Synthetic policy',
      rules: [
        { min_days_before: 0, refund_percent: '50' },
        { min_days_before: 20, refund_percent: '100' },
      ],
    });
    await update(house, { default_cancellation_policy_id: policy.resource_id });
    assert.equal(
      (
        await request(
          'PUT',
          house + '/cancellation-policies/' + policy.resource_id,
          { is_active: false },
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request('POST', house + '/cancellation-policies', {
          name: 'bad',
          rules: [{ min_days_before: 7, refund_percent: '50' }],
        })
      ).status,
      400,
    );
    const reservationInput = (from, to, extra = {}) => ({
      guest_name: 'Synthetic guest',
      guest_contact: 'CONTACT-MARKER-private',
      guests_count: 2,
      channel: 'whatsapp',
      check_in_on: day(from),
      check_out_on: day(to),
      check_in_time: '15:00',
      check_out_time: '11:00',
      nightly_rate: '100000',
      deposit_amount: '40000',
      cancellation_policy_id: policy.resource_id,
      ...extra,
    });
    const draftKey = randomUUID();
    const draftInput = reservationInput(10, 12);
    const draft = expectStatus(
      await request('POST', house + '/reservations', draftInput, '2', draftKey),
      201,
    );
    const replayWithDefaults = expectStatus(
      await request(
        'POST',
        house + '/reservations',
        { ...draftInput, cleaning_fee: '0', is_active: true },
        '2',
        draftKey,
      ),
      201,
    );
    assert.deepEqual(draft, replayWithDefaults);
    const reservationId = draft.resource_id,
      reservationUrl = `${house}/reservations/${reservationId}`;
    assert.equal(
      (
        await get(
          house +
            `/availability?check_in_on=${day(10)}&check_out_on=${day(12)}&check_in_time=15:00&check_out_time=11:00`,
        )
      ).available,
      true,
    );
    assert.equal(
      (await request('POST', reservationUrl + '/confirm', {}, '2')).status,
      409,
    );
    const paymentInput = {
      reservation_id: reservationId,
      type: 'payment',
      amount: '40000',
      occurred_on: occurredOn,
    };
    const paymentKey = randomUUID();
    const paymentRace = await Promise.all([
      request('POST', house + '/payments', paymentInput, '2', paymentKey),
      request('POST', house + '/payments', paymentInput, '2', paymentKey),
    ]);
    paymentRace.forEach((response) => expectStatus(response, 201));
    assert.deepEqual(paymentRace[0].data, paymentRace[1].data);
    assert.equal((await get(reservationUrl)).received_amount, '40000');
    const frozen = (await get(reservationUrl)).policy_snapshot;
    await update(house + '/cancellation-policies/' + policy.resource_id, {
      rules: [{ min_days_before: 0, refund_percent: '0' }],
    });
    assert.deepEqual((await get(reservationUrl)).policy_snapshot, frozen);
    assert.equal(
      (await request('PUT', reservationUrl, { nightly_rate: '90000' })).status,
      409,
    );
    const confirmKey = randomUUID();
    const confirmed = expectStatus(
      await request('POST', reservationUrl + '/confirm', {}, '2', confirmKey),
      200,
    );
    assert.deepEqual(
      expectStatus(
        await request(
          'POST',
          reservationUrl + '/confirm',
          { same_day_approvals: [] },
          '2',
          confirmKey,
        ),
        200,
      ),
      confirmed,
    );
    assert.equal(
      (
        await get(
          house +
            `/availability?check_in_on=${day(10)}&check_out_on=${day(12)}&check_in_time=15:00&check_out_time=11:00`,
        )
      ).available,
      false,
    );
    await update(reservationUrl, { is_active: false });
    assert.equal(
      (
        await get(
          house +
            `/availability?check_in_on=${day(10)}&check_out_on=${day(12)}&check_in_time=15:00&check_out_time=11:00`,
        )
      ).available,
      false,
    );
    const cancelledAt = new Date(Date.now() - 60000).toISOString();
    const preview = await command(reservationUrl + '/cancellation-preview', {
      cancelled_at: cancelledAt,
    });
    assert.equal(preview.refund_amount, '20000');
    assert.equal(
      (
        await request('POST', reservationUrl + '/cancel', {
          cancelled_at: cancelledAt,
          expected_refund_amount: '1',
        })
      ).status,
      409,
    );
    await command(
      reservationUrl + '/cancel',
      {
        cancelled_at: cancelledAt,
        expected_refund_amount: preview.refund_amount,
      },
      '2',
    );
    assert.equal((await get(reservationUrl)).balance_due_amount, '0');
    const refundRace = await Promise.all([
      request(
        'POST',
        house + '/payments',
        {
          reservation_id: reservationId,
          type: 'refund',
          amount: '12000',
          occurred_on: today,
        },
        '2',
      ),
      request(
        'POST',
        house + '/payments',
        {
          reservation_id: reservationId,
          type: 'refund',
          amount: '12000',
          occurred_on: today,
        },
        '2',
      ),
    ]);
    assert.deepEqual(
      refundRace.map((response) => response.status).sort(),
      [201, 409],
    );
    assert.equal((await get(reservationUrl)).refund_due_amount, '8000');
    assert.equal(
      (await request('POST', house + '/payments', paymentInput)).status,
      409,
    );
    const expense = await create(house + '/expenses', {
      name: 'Synthetic cleaning',
      amount: '5000',
      incurred_on: occurredOn,
      status: 'pending',
    });
    await command(`${house}/expenses/${expense.resource_id}/pay`, {
      paid_on: today,
    });
    const overview = await get(
      house + `/overview?from_on=${day(-5)}&to_on=${day(5)}`,
    );
    assert.equal(overview.cash.net_amount, '23000');
    assert.equal(overview.pending.refund_amount, '8000');
    const platformPolicy = {
      reference: 'POLICY-SYNTHETIC',
      description: 'Synthetic external terms',
    };
    const airbnbInput = (from, to, reference) =>
      reservationInput(from, to, {
        channel: 'airbnb',
        external_reference: reference,
        deposit_amount: '0',
        cancellation_policy_id: null,
        commission_amount: '6000',
      });
    const airbnb = await create(
      house + '/reservations',
      airbnbInput(30, 32, 'EXTERNAL-1'),
    );
    await command(`${house}/reservations/${airbnb.resource_id}/confirm`, {
      platform_policy: platformPolicy,
    });
    await create(house + '/payments', {
      reservation_id: airbnb.resource_id,
      type: 'payment',
      amount: '194000',
      occurred_on: occurredOn,
    });
    assert.equal(
      (await get(`${house}/reservations/${airbnb.resource_id}`))
        .balance_due_amount,
      '0',
    );
    assert.equal(
      (await get(house + `/overview?from_on=${day(-5)}&to_on=${day(5)}`)).cash
        .net_amount,
      '217000',
    );
    const r1 = await create(
      house + '/reservations',
      airbnbInput(40, 42, 'EXTERNAL-RACE-1'),
    );
    const r2 = await create(
      house + '/reservations',
      airbnbInput(40, 42, 'EXTERNAL-RACE-2'),
    );
    const reservationRace = await Promise.all([
      request('POST', `${house}/reservations/${r1.resource_id}/confirm`, {
        platform_policy: platformPolicy,
      }),
      request('POST', `${house}/reservations/${r2.resource_id}/confirm`, {
        platform_policy: platformPolicy,
      }),
    ]);
    assert.deepEqual(
      reservationRace.map((response) => response.status).sort(),
      [200, 409],
    );
    const r3 = await create(
      house + '/reservations',
      airbnbInput(50, 52, 'EXTERNAL-BLOCK-RACE'),
    );
    const blockRace = await Promise.all([
      request('POST', `${house}/reservations/${r3.resource_id}/confirm`, {
        platform_policy: platformPolicy,
      }),
      request('POST', house + '/blocks', {
        starts_at: localInstant(
          day(50),
          '15:00',
          'America/Santiago',
        ).toISOString(),
        ends_at: localInstant(
          day(52),
          '11:00',
          'America/Santiago',
        ).toISOString(),
        reason: 'Synthetic maintenance',
      }),
    ]);
    assert.equal(
      blockRace.filter((response) => [200, 201].includes(response.status))
        .length,
      1,
    );
    assert.equal(
      blockRace.filter((response) => response.status === 409).length,
      1,
    );
    const calendar = await get(
      house + `/calendar?from_on=${today}&to_on=${day(70)}`,
    );
    assert(!JSON.stringify(calendar).includes('CONTACT-MARKER-private'));
    const audit = await get(house + '/audit-events?limit=100');
    assert(!JSON.stringify(audit).includes('CONTACT-MARKER-private'));
    assert(
      !JSON.stringify(
        await get(house + '/operations/' + paymentKey, '2'),
      ).includes('CONTACT-MARKER-private'),
    );
    await update(`${house}/collaborators/${collaborator.resource_id}`, {
      is_active: false,
    });
    assert.equal(
      (
        await request(
          'GET',
          house + '/operations/' + paymentKey,
          undefined,
          '2',
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          'POST',
          house + '/payments',
          paymentInput,
          '2',
          paymentKey,
        )
      ).status,
      404,
    );
    assert.equal((await request('GET', house, undefined, '2')).status, 404);
    await update(`${house}/collaborators/${collaborator.resource_id}`, {
      is_active: true,
    });
    for (const path of [
      '/collaborators',
      '/cancellation-policies',
      '/reservations',
      '/payments',
      '/expenses',
      '/blocks',
      '/turnovers',
    ])
      await get(house + path + '?limit=2');
    await get(house + '/cancellation-policies/' + policy.resource_id);
    await get(house + '/payments/' + paymentRace[0].data.resource_id);
    await get(house + '/expenses/' + expense.resource_id);
    // Same-day turnover: the current previous guest and preparation plan matter.
    const outgoing = await create(
      house + '/reservations',
      airbnbInput(60, 62, 'SAME-DAY-OUT'),
    );
    await command(`${house}/reservations/${outgoing.resource_id}/confirm`, {
      platform_policy: platformPolicy,
    });
    const incoming = await create(
      house + '/reservations',
      airbnbInput(62, 64, 'SAME-DAY-IN'),
    );
    const incomingUrl = `${house}/reservations/${incoming.resource_id}`;
    const turnoverId = (await get(incomingUrl)).turnover_id;
    const turnoverUrl = `${house}/turnovers/${turnoverId}`;
    await update(turnoverUrl, {
      linen_ready: true,
      planned_ready_at: localInstant(
        day(62),
        '14:00',
        'America/Santiago',
      ).toISOString(),
    });
    assert.equal(
      (
        await request('POST', incomingUrl + '/confirm', {
          platform_policy: platformPolicy,
        })
      ).status,
      409,
    );
    await command(turnoverUrl + '/approve-same-day');
    await command(incomingUrl + '/confirm', {
      platform_policy: platformPolicy,
    });
    assert.equal(
      (await request('PUT', house, { minimum_turnover_minutes: 300 })).status,
      409,
    );
    assert.equal((await request('PUT', house, { max_guests: 1 })).status, 409);
    assert.equal(
      (await request('PUT', house, { timezone: 'UTC' })).status,
      409,
    );
    assert.notEqual((await get(turnoverUrl)).same_day_approved_at, null);
    await update(turnoverUrl, {
      planned_ready_at: localInstant(
        day(62),
        '14:30',
        'America/Santiago',
      ).toISOString(),
    });
    assert.equal((await get(turnoverUrl)).same_day_approved_at, null);
    await command(turnoverUrl + '/approve-same-day');
    await command(`${house}/reservations/${outgoing.resource_id}/cancel`, {
      cancelled_at: cancelledAt,
      refund_amount: '0',
      expected_refund_amount: '0',
      resolution_note: 'Synthetic external cancellation',
    });
    assert.equal((await get(turnoverUrl)).same_day_approved_at, null);
    assert.notEqual(
      (await get(turnoverUrl)).previous_reservation_id,
      outgoing.resource_id,
    );
    // A controllable application clock advances this synthetic stay without
    // rewriting immutable agreements or changing the OS/PostgreSQL clock.
    const stay = await create(
      house + '/reservations',
      airbnbInput(75, 77, 'LIFECYCLE'),
    );
    const stayUrl = `${house}/reservations/${stay.resource_id}`;
    await command(stayUrl + '/confirm', { platform_policy: platformPolicy });
    const clock = app.get(RentalClock),
      realNow = clock.now.bind(clock);
    clock.now = () => localInstant(day(75), '15:00', 'America/Santiago');
    const stayTurnover = `${house}/turnovers/${(await get(stayUrl)).turnover_id}`;
    await update(stayTurnover, {
      linen_ready: true,
      cleaning_status: 'completed',
      ready_at: localInstant(
        day(75),
        '14:30',
        'America/Santiago',
      ).toISOString(),
    });
    await command(stayUrl + '/start');
    assert.equal(
      (await request('POST', stayUrl + '/complete', {})).status,
      409,
    );
    clock.now = () => localInstant(day(77), '11:00', 'America/Santiago');
    await command(stayUrl + '/complete');
    assert.equal((await get(stayUrl)).status, 'completed');
    clock.now = realNow;
    assert.equal(
      (
        await request('POST', house + '/payments', {
          reservation_id: airbnb.resource_id,
          type: 'payment',
          amount: '1',
          occurred_on: occurredOn,
        })
      ).status,
      409,
    );
    const refund = refundRace.find((response) => response.status === 201).data;
    await command(`${house}/payments/${refund.resource_id}/void`, {
      reason: 'Synthetic correction',
    });
    const anotherExpense = await create(house + '/expenses', {
      name: 'Synthetic adjustment',
      amount: '100',
      incurred_on: occurredOn,
      status: 'pending',
    });
    await update(`${house}/expenses/${anotherExpense.resource_id}`, {
      amount: '200',
      notes: null,
    });
    const payRace = await Promise.all([
      request('POST', `${house}/expenses/${anotherExpense.resource_id}/pay`, {
        paid_on: today,
      }),
      request('POST', `${house}/expenses/${anotherExpense.resource_id}/pay`, {
        paid_on: today,
      }),
    ]);
    assert.deepEqual(
      payRace.map((response) => response.status).sort(),
      [200, 409],
    );
    await command(`${house}/expenses/${anotherExpense.resource_id}/void`, {
      reason: 'Synthetic correction',
    });
    const extraBlock = await create(house + '/blocks', {
      starts_at: localInstant(
        day(90),
        '15:00',
        'America/Santiago',
      ).toISOString(),
      ends_at: localInstant(day(92), '11:00', 'America/Santiago').toISOString(),
      reason: 'Synthetic repair',
    });
    await get(`${house}/blocks/${extraBlock.resource_id}`);
    await update(`${house}/blocks/${extraBlock.resource_id}`, {
      is_active: false,
    });
    await update(`${house}/blocks/${extraBlock.resource_id}`, {
      is_active: true,
    });
    // Real SQL faults after an effect must roll back effect/audit/operation together.
    const tx = app.get(RentalTransactionService),
      rollbackKey = randomUUID();
    const beforeRollback = (
      await db.query('SELECT count(*)::int count FROM rental_audit_events')
    )[0].count;
    await assert.rejects(
      tx.mutate(
        {
          actorId: '1',
          propertyId,
          requestKey: rollbackKey,
          operation: 'property.update',
          resourceId: propertyId,
          command: { name: 'rollback' },
        },
        async (ctx) => {
          await ctx.manager.query(
            'UPDATE rental_properties SET name=$1 WHERE id=$2',
            ['rollback', propertyId],
          );
          await ctx.manager.query(
            "INSERT INTO rental_expenses(property_id,name,amount,incurred_on,status,created_by,updated_by) VALUES($1,'invalid',-1,CURRENT_DATE,'pending',1,1)",
            [propertyId],
          );
          throw new Error('Unreachable');
        },
      ),
      /rental:conflict/,
    );
    assert.equal((await get(house)).name, propertyInput.name);
    assert.equal(
      (await db.query('SELECT count(*)::int count FROM rental_audit_events'))[0]
        .count,
      beforeRollback,
    );
    assert.equal(
      (await request('GET', house + '/operations/' + rollbackKey)).status,
      404,
    );
    const persistFaultKey = randomUUID();
    await db.query(`CREATE FUNCTION rental_fail_operation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_key='${persistFaultKey}'::uuid THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Synthetic operation failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER rental_fail_operation BEFORE INSERT ON rental_operations FOR EACH ROW EXECUTE FUNCTION rental_fail_operation()`);
    try {
      assert.equal(
        (
          await request(
            'PUT',
            house,
            { name: 'Synthetic failed commit' },
            '1',
            persistFaultKey,
          )
        ).status,
        409,
      );
      assert.equal((await get(house)).name, propertyInput.name);
      assert.equal(
        (
          await db.query('SELECT count(*)::int count FROM rental_audit_events')
        )[0].count,
        beforeRollback,
      );
      assert.equal(
        (await request('GET', house + '/operations/' + persistFaultKey)).status,
        404,
      );
    } finally {
      await db.query(
        'DROP TRIGGER rental_fail_operation ON rental_operations; DROP FUNCTION rental_fail_operation()',
      );
    }
    const crashKey = randomUUID(),
      crashProbe = 'rental_crash_' + randomUUID();
    const crashCounts = await db.query(
      'SELECT (SELECT count(*)::int FROM rental_audit_events) audits,(SELECT count(*)::int FROM rental_operations) operations',
    );
    const child = spawn(
      'docker',
      [
        'exec',
        container,
        'psql',
        '-U',
        'rental_test',
        '-d',
        'rental_test',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        `SET application_name='${crashProbe}'; BEGIN;
    SELECT id FROM rental_properties WHERE id=${propertyId} FOR UPDATE;
    UPDATE rental_properties SET name='Synthetic crash rollback' WHERE id=${propertyId};
    INSERT INTO rental_audit_events(property_id,actor_id,action,resource_type,resource_id,changes) SELECT property_id,actor_id,action,resource_type,resource_id,changes FROM rental_audit_events LIMIT 1;
    INSERT INTO rental_operations(property_id,actor_id,request_key,operation,request_hash,response) SELECT property_id,actor_id,'${crashKey}'::uuid,operation,request_hash,response FROM rental_operations LIMIT 1;
    SELECT pg_sleep(30); COMMIT;`,
      ],
      { stdio: 'ignore' },
    );
    const exited = new Promise((resolve, reject) => {
      child.once('close', resolve);
      child.once('error', reject);
    });
    let crashPid;
    for (let i = 0; i < 200; i++) {
      const rows = await db.query(
        "SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event='PgSleep'",
        [crashProbe],
      );
      if (rows.length) {
        crashPid = rows[0].pid;
        break;
      }
      await delay(10);
    }
    assert(
      crashPid,
      'Crash probe must have written within an uncommitted transaction',
    );
    await db.query('SELECT pg_terminate_backend($1)', [crashPid]);
    assert.notEqual(await exited, 0);
    assert.equal((await get(house)).name, propertyInput.name);
    assert.deepEqual(
      await db.query(
        'SELECT (SELECT count(*)::int FROM rental_audit_events) audits,(SELECT count(*)::int FROM rental_operations) operations',
      ),
      crashCounts,
    );
    assert.equal(
      (await request('GET', house + '/operations/' + crashKey)).status,
      404,
    );
    checks.push(
      'Failure while persisting the intent and backend termination before commit leave no effect/audit/operation.',
    );
    const capStay = await create(
      house + '/reservations',
      airbnbInput(100, 102, 'PAYMENT-CAP-RACE'),
    );
    await command(`${house}/reservations/${capStay.resource_id}/confirm`, {
      platform_policy: platformPolicy,
    });
    const capRace = await Promise.all([
      request('POST', house + '/payments', {
        reservation_id: capStay.resource_id,
        type: 'payment',
        amount: '120000',
        occurred_on: occurredOn,
      }),
      request('POST', house + '/payments', {
        reservation_id: capStay.resource_id,
        type: 'payment',
        amount: '120000',
        occurred_on: occurredOn,
      }),
    ]);
    assert.deepEqual(
      capRace.map((response) => response.status).sort(),
      [201, 409],
    );
    const paidWinner = capRace.find((response) => response.status === 201).data;
    const cancelAgainstPayment = await Promise.all([
      request('POST', `${house}/reservations/${capStay.resource_id}/cancel`, {
        cancelled_at: cancelledAt,
        refund_amount: '120000',
        expected_refund_amount: '120000',
        resolution_note: 'Synthetic full refund',
      }),
      request('POST', house + '/payments', {
        reservation_id: capStay.resource_id,
        type: 'payment',
        amount: '10000',
        occurred_on: occurredOn,
      }),
    ]);
    expectStatus(cancelAgainstPayment[0], 200);
    assert([201, 409].includes(cancelAgainstPayment[1].status));
    const voidAgainstRefund = await Promise.all([
      request('POST', `${house}/payments/${paidWinner.resource_id}/void`, {
        reason: 'Synthetic correction',
      }),
      request('POST', house + '/payments', {
        reservation_id: capStay.resource_id,
        type: 'refund',
        amount: '120000',
        occurred_on: today,
      }),
    ]);
    assert.deepEqual(
      voidAgainstRefund.map((response) => response.status),
      [409, 201],
    );
    assert.equal(
      (await get(`${house}/reservations/${capStay.resource_id}`))
        .refund_due_amount,
      '0',
    );
    const inactiveBlock = await create(house + '/blocks', {
      starts_at: localInstant(
        day(110),
        '15:00',
        'America/Santiago',
      ).toISOString(),
      ends_at: localInstant(
        day(112),
        '11:00',
        'America/Santiago',
      ).toISOString(),
      reason: 'Synthetic inactive repair',
      is_active: false,
    });
    const blockStay = await create(
      house + '/reservations',
      airbnbInput(110, 112, 'REACTIVATE-BLOCK-RACE'),
    );
    const reactivateRace = await Promise.all([
      request('PUT', `${house}/blocks/${inactiveBlock.resource_id}`, {
        is_active: true,
      }),
      request(
        'POST',
        `${house}/reservations/${blockStay.resource_id}/confirm`,
        {
          platform_policy: platformPolicy,
        },
      ),
    ]);
    assert.deepEqual(
      reactivateRace.map((response) => response.status).sort(),
      [200, 409],
    );
    assert.deepEqual(
      (await get(house + '/operations/' + paymentKey, '2')).body,
      paymentRace[0].data,
    );
    // Row constraints and composite foreign keys are database guarantees.
    async function sqlReject(sql, params, code) {
      await assert.rejects(
        db.query(sql, params),
        (error) => error.driverError?.code === code,
      );
    }
    await sqlReject(
      'INSERT INTO rental_operations(property_id,actor_id,request_key,operation,request_hash,response) SELECT property_id,actor_id,request_key,operation,request_hash,response FROM rental_operations LIMIT 1',
      [],
      '23505',
    );
    await sqlReject(
      "UPDATE rental_expenses SET status='unknown' WHERE id=$1",
      [expense.resource_id],
      '23514',
    );
    await sqlReject(
      'UPDATE rental_reservations SET total_amount=total_amount+1 WHERE id=$1',
      [airbnb.resource_id],
      '23514',
    );
    await sqlReject(
      'UPDATE rental_expenses SET paid_on=NULL WHERE id=$1',
      [expense.resource_id],
      '23514',
    );
    await sqlReject(
      'UPDATE rental_turnovers SET linen_ready=false WHERE id=$1',
      [(await get(stayUrl)).turnover_id],
      '23514',
    );
    await sqlReject(
      'INSERT INTO rental_collaborators(property_id,user_id,created_by,updated_by) VALUES($1,2,1,1)',
      [propertyId],
      '23505',
    );
    await sqlReject(
      'INSERT INTO rental_cancellation_rules(policy_id,min_days_before,refund_percent,created_by,updated_by) VALUES($1,0,50,1,1)',
      [policy.resource_id],
      '23505',
    );
    await sqlReject(
      'UPDATE rental_reservations SET external_reference=$1 WHERE id=$2',
      ['EXTERNAL-1', r1.resource_id],
      '23505',
    );
    await sqlReject(
      "INSERT INTO rental_turnovers(property_id,incoming_reservation_id,cleaning_status,created_by,updated_by) VALUES($1,$2,'pending',1,1)",
      [propertyId, airbnb.resource_id],
      '23505',
    );
    const secondHouse = await create(api, {
      ...propertyInput,
      name: 'Synthetic exact sums',
    });
    await sqlReject(
      'UPDATE rental_payments SET property_id=$1 WHERE id=$2',
      [secondHouse.resource_id, paymentRace[0].data.resource_id],
      '23503',
    );
    await sqlReject(
      'UPDATE rental_properties SET default_cancellation_policy_id=$1 WHERE id=$2',
      [policy.resource_id, secondHouse.resource_id],
      '23503',
    );
    // SUM(bigint) must remain exact beyond the individual-row bigint range.
    for (let i = 0; i < 2; i++)
      await create(`${api}/${secondHouse.resource_id}/expenses`, {
        name: 'Synthetic large amount',
        amount: '9223372036854775807',
        incurred_on: occurredOn,
        paid_on: today,
        status: 'paid',
      });
    assert.equal(
      (
        await get(
          `${api}/${secondHouse.resource_id}/overview?from_on=${day(-5)}&to_on=${day(5)}`,
        )
      ).cash.net_amount,
      '-18446744073709551614',
    );
    // A committed revocation queued ahead of payment must defeat the old member.
    const barrier = db.createQueryRunner();
    await barrier.connect();
    await barrier.startTransaction();
    await barrier.query(
      'SELECT id FROM rental_properties WHERE id=$1 FOR UPDATE',
      [propertyId],
    );
    await barrier.query(
      'UPDATE rental_collaborators SET is_active=false WHERE id=$1',
      [collaborator.resource_id],
    );
    const blockedPayment = request(
      'POST',
      house + '/payments',
      paymentInput,
      '2',
      paymentKey,
    );
    for (let i = 0; i < 100; i++) {
      const waiting = await db.query(
        "SELECT count(*)::int count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
      );
      if (waiting[0].count > 0) break;
      if (i === 99) throw new Error('Expected payment to wait on house lock');
      await delay(10);
    }
    await barrier.commitTransaction();
    await barrier.release();
    assert.equal((await blockedPayment).status, 404);
    await update(`${house}/collaborators/${collaborator.resource_id}`, {
      is_active: true,
    });
    const timeoutStarted = Date.now();
    await assert.rejects(
      tx.mutate(
        {
          actorId: '1',
          propertyId,
          requestKey: randomUUID(),
          operation: 'property.update',
          resourceId: propertyId,
          command: { name: 'timeout rollback' },
        },
        async (ctx) => {
          await ctx.manager.query(
            'UPDATE rental_properties SET name=$1 WHERE id=$2',
            ['timeout rollback', propertyId],
          );
          await ctx.manager.query('SELECT pg_sleep(6)');
          throw new Error('Unreachable');
        },
      ),
      /rental:temporarily_busy/,
    );
    assert(Date.now() - timeoutStarted < 15_000);
    assert.equal((await get(house)).name, propertyInput.name);
    const deadlineStarted = Date.now();
    await assert.rejects(
      tx.read('1', propertyId, async (ctx) => {
        for (let i = 0; i < 3; i++)
          await ctx.manager.query('SELECT pg_sleep(3.6)');
      }),
      /rental:temporarily_busy/,
    );
    assert(Date.now() - deadlineStarted < 15_000);
    checks.push(
      'Statement cancellation and total transaction deadline return safe failures only after rollback.',
    );
    await db.query(
      "INSERT INTO rental_expenses(property_id,name,amount,incurred_on,status,created_by,updated_by) SELECT $1,'Synthetic volume '||n,1,$2::date,'pending',1,1 FROM generate_series(1,1001) n",
      [secondHouse.resource_id, occurredOn],
    );
    const querySamples = [];
    for (const limit of [1, 100]) {
      const before = queryCount;
      const result = await get(
        `${api}/${secondHouse.resource_id}/expenses?limit=${limit}`,
      );
      assert.equal(result.data.length, limit);
      assert.equal(result.meta.total_items, 1003);
      querySamples.push({ limit, statements: queryCount - before });
    }
    assert.equal(
      querySamples[0].statements,
      querySamples[1].statements,
      'Pagination must not issue one query per row',
    );
    assert.equal(
      (
        await get(
          `${api}/${secondHouse.resource_id}/overview?from_on=${day(-5)}&to_on=${day(5)}`,
        )
      ).pending.expense_amount,
      '1001',
    );
    const queryPlan = await db.query(
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM rental_expenses WHERE property_id=$1 AND status=$2 ORDER BY incurred_on DESC,id DESC LIMIT 100',
      [secondHouse.resource_id, 'pending'],
    );
    await db.query(
      `INSERT INTO rental_reservations(property_id,guest_name,guest_contact,guests_count,channel,check_in_on,check_out_on,check_in_time,check_out_time,nightly_rate,total_amount,deposit_amount,status,created_by,updated_by)
    SELECT $1,'Synthetic volume '||n,'Synthetic contact',1,'other',$2::date,$3::date,'15:00','11:00',1,1,1,'draft',1,1 FROM generate_series(1,1001) n`,
      [secondHouse.resource_id, day(1), day(2)],
    );
    await db.query(
      "INSERT INTO rental_turnovers(property_id,incoming_reservation_id,cleaning_status,created_by,updated_by) SELECT property_id,id,'pending',1,1 FROM rental_reservations WHERE property_id=$1",
      [secondHouse.resource_id],
    );
    const reservationQuerySamples = [];
    for (const limit of [1, 100]) {
      const before = queryCount;
      const result = await get(
        `${api}/${secondHouse.resource_id}/reservations?limit=${limit}`,
      );
      assert.equal(result.meta.total_items, 1001);
      assert.equal(result.data.length, limit);
      reservationQuerySamples.push({ limit, statements: queryCount - before });
    }
    assert.equal(
      reservationQuerySamples[0].statements,
      reservationQuerySamples[1].statements,
    );
    const tooWide = await request(
      'GET',
      `${api}/${secondHouse.resource_id}/calendar?from_on=${today}&to_on=${day(5)}&include_non_occupying=true`,
    );
    assert.equal(tooWide.status, 400);
    assert.equal(tooWide.data.message, 'rental:window_too_large');
    assert.equal(
      (
        await get(
          `${api}/${secondHouse.resource_id}/availability?check_in_on=${day(1)}&check_out_on=${day(2)}&check_in_time=15:00&check_out_time=11:00`,
        )
      ).available,
      true,
    );
    // Restore a real pg_dump into a second isolated database and compare every
    // rental row, including immutable snapshots and operation acknowledgements.
    const dump = execFileSync('docker', [
      'exec',
      container,
      'pg_dump',
      '-U',
      'rental_test',
      '--no-owner',
      '--no-privileges',
      '-Fc',
      'rental_test',
    ]);
    docker(
      'exec',
      container,
      'psql',
      '-U',
      'rental_test',
      '-d',
      'postgres',
      '-c',
      'CREATE DATABASE rental_restore',
    );
    execFileSync(
      'docker',
      [
        'exec',
        '-i',
        container,
        'pg_restore',
        '-U',
        'rental_test',
        '-d',
        'rental_restore',
        '--no-owner',
        '--no-privileges',
      ],
      { input: dump, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const restored = await new DataSource({
      ...options,
      database: 'rental_restore',
    }).initialize();
    try {
      const tables = (
        await db.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'rental_%' ORDER BY tablename",
        )
      ).map((row) => row.tablename);
      assert.equal(tables.length, 11);
      for (const table of tables) {
        const digestSql = `SELECT count(*)::int count,md5(COALESCE(string_agg(to_jsonb(t)::text,',' ORDER BY id),'')) digest FROM ${table} t`;
        assert.deepEqual(
          await restored.query(digestSql),
          await db.query(digestSql),
        );
      }
      assert.deepEqual(await restored.query('SELECT * FROM legacy_probe'), [
        { id: 1, value: 'preserved' },
      ]);
    } finally {
      await restored.destroy();
    }
    checks.push(
      '1003-row pagination keeps SQL statement count constant; numeric sums, EXPLAIN and pg_dump restoration verified.',
    );
    checks.push(
      'Turnover approvals invalidate after plan/neighbor changes; actual readiness gates start; controlled clock verifies complete.',
    );
    checks.push(
      'SQL faults roll back effects/history; composite FKs, UNIQUE and CHECK reject invalid rows; aggregate CLP exceeds bigint exactly.',
    );
    checks.push(
      'A PostgreSQL lock barrier verifies membership again after committed revocation.',
    );
    checks.push(
      'HTTP workflow: authority, drafts, payments, snapshots, confirmation, cancellation, refund budget, expenses and Airbnb net cash.',
    );
    checks.push(
      'Concurrent same-key house/payment writes, overlapping confirmations and reservation-block races preserve invariants.',
    );
    const swagger = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Rental integration')
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    const actualRoutes = Object.entries(swagger.paths)
      .flatMap(([url, value]) =>
        Object.keys(value)
          .filter((method) =>
            ['get', 'post', 'put', 'patch', 'delete'].includes(method),
          )
          .map((method) => method.toUpperCase() + ' ' + url),
      )
      .sort();
    const contract = await readFile(
      new URL(
        '../../docs/mvp/28-rental-reservations-contracts.md',
        import.meta.url,
      ),
      'utf8',
    );
    const expectedRoutes = [
      ...contract.matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) `([^`]+)`/gm),
    ]
      .map(
        (match) => match[1] + ' ' + match[2].replace(/:([A-Za-z]+)/g, '{$1}'),
      )
      .sort();
    assert.deepEqual(actualRoutes, expectedRoutes);
    const fixtures = [];
    await update(`${house}/collaborators/${collaborator.resource_id}`, {
      is_active: false,
    });
    function verifySchema(value, source, location = '$') {
      const schema = source.$ref
        ? swagger.components.schemas[source.$ref.split('/').at(-1)]
        : source;
      if (value === null && schema.nullable) return;
      if (schema.oneOf) {
        const matches = schema.oneOf.filter((option) => {
          try {
            verifySchema(value, option, location);
            return true;
          } catch {
            return false;
          }
        });
        assert.equal(matches.length, 1, `Snapshot alternatives: ${location}`);
        return;
      }
      if (schema.enum) assert(schema.enum.includes(value), `Enum: ${location}`);
      if (schema.type === 'object') {
        assert(
          value && typeof value === 'object' && !Array.isArray(value),
          `Object: ${location}`,
        );
        for (const key of schema.required ?? [])
          assert(key in value, `Required: ${location}.${key}`);
        for (const [key, entry] of Object.entries(value)) {
          if (schema.additionalProperties === false)
            assert(key in schema.properties, `Unexpected: ${location}.${key}`);
          if (schema.properties?.[key])
            verifySchema(entry, schema.properties[key], location + '.' + key);
        }
      } else if (schema.type === 'array') {
        assert(Array.isArray(value), `Array: ${location}`);
        value.forEach((entry, index) =>
          verifySchema(entry, schema.items, `${location}[${index}]`),
        );
      } else if (schema.type === 'integer')
        assert(Number.isSafeInteger(value), `Integer: ${location}`);
      else if (schema.type)
        assert.equal(typeof value, schema.type, `Type: ${location}`);
      if (schema.pattern)
        assert(new RegExp(schema.pattern).test(value), `Pattern: ${location}`);
    }
    for (const route of actualRoutes) {
      const pattern = new RegExp(
        '^' + route.replace(/\{[^}]+\}/g, '[^/]+') + '$',
      );
      assert(
        [...observed].some((value) => pattern.test(value)),
        `Missing successful HTTP route: ${route}`,
      );
      const sample = exchanges.find((entry) =>
        pattern.test(entry.method + ' ' + entry.url.split('?')[0]),
      );
      const [method, path] = route.split(' ');
      const schema =
        swagger.paths[path][method.toLowerCase()].responses[sample.status]
          .content['application/json'].schema;
      verifySchema(sample.response, schema, route);
      fixtures.push({ route, ...sample });
      if (path.includes('{propertyId}')) {
        assert.equal(
          (await request(method, sample.url, sample.request, '3')).status,
          404,
          `External actor: ${route}`,
        );
        assert.equal(
          (await request(method, sample.url, sample.request, '2')).status,
          404,
          `Revoked member: ${route}`,
        );
        assert.equal(
          (await request(method, sample.url, sample.request, null)).status,
          401,
          `No identity: ${route}`,
        );
      }
    }
    checks.push(
      'Every successful HTTP operation matches its response schema; all 42 house routes reject outsiders, revoked members and anonymous callers.',
    );
    await mkdir(new URL('./fixtures/rental/', import.meta.url), {
      recursive: true,
    });
    await writeFile(
      new URL('./fixtures/rental/swagger.json', import.meta.url),
      JSON.stringify(swagger, null, 2) + '\n',
    );
    await writeFile(
      new URL('./fixtures/rental/api.json', import.meta.url),
      JSON.stringify(fixtures, null, 2) + '\n',
    );
    await writeFile(
      new URL('./fixtures/rental/messages.json', import.meta.url),
      JSON.stringify(rentalErrorCatalog, null, 2) + '\n',
    );
    checks.push(
      'Compiled ESM/Nest dependency injection and 44 Swagger operations match the contract.',
    );
    const report = {
      postgres_version: (await db.query('SHOW server_version'))[0]
        .server_version,
      isolation: 'READ COMMITTED',
      property_write_lock: 'FOR UPDATE',
      lock_timeout_ms: 2000,
      statement_timeout_ms: 5000,
      transaction_deadline_ms: 10000,
      requests,
      operations: actualRoutes.length,
      checks,
      query_samples: querySamples,
      reservation_query_samples: reservationQuerySamples,
      query_plan: queryPlan[0]['QUERY PLAN'],
    };
    await writeFile(
      new URL('./fixtures/rental/report.json', import.meta.url),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(JSON.stringify({ requests, checks }, null, 2));
  }
} finally {
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('stop', container);
}
