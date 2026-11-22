import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import { teacherBodyParser } from '../dist/teacher/teacher-body-parser.js';
import { TeacherCalendarController } from '../dist/teacher/teacher-calendar.controller.js';
import { TeacherCalendarStore } from '../dist/teacher/teacher-calendar.store.js';
import { TeacherService } from '../dist/teacher/teacher.service.js';
import { TeacherCalendarUseCase } from '../dist/teacher/use-case/teacher-calendar.use-case.js';
import { teacherUpgradeLab } from './helpers/teacher-upgrade-lab.mjs';

function disposableDatabase(raw) {
  if (!raw) return undefined;
  const url = new URL(raw);
  assert.ok(
    url.protocol === 'postgresql:' && url.hostname === '127.0.0.1' &&
      /^\/teacher_calendar_test_[a-z0-9]+$/.test(url.pathname) && !url.search && !url.hash,
    'The test URL must name a disposable local teacher_calendar_test_* database.',
  );
  return new DataSource({ type: 'postgres', url: url.href, synchronize: false });
}

const lab = await teacherUpgradeLab({ database: disposableDatabase(process.env.TEACHER_CALENDAR_TEST_URL) });
const migration = '1793880000000-CreateTeacherStudyCalendar';
const checks = [];
async function check(name, run) {
  await run();
  checks.push(name);
}

let app;
try {
  await check('migration up/down/up preserves adaptive Teacher tables', async () => {
    await lab.migrate(migration);
    await lab.migrate(migration, 'down');
    await lab.migrate(migration);
    const [existing] = await lab.db.query("SELECT to_regclass('teacher_sessions')::text AS name");
    assert.equal(existing.name, 'teacher_sessions');
  });

  class CalendarLabModule {}
  Module({
    controllers: [TeacherCalendarController],
    providers: [
      { provide: TeacherService, useValue: lab.store },
      TeacherCalendarStore,
      TeacherCalendarUseCase,
    ],
  })(CalendarLabModule);
  app = await NestFactory.create(CalendarLabModule, { logger: false, bodyParser: false });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/teacher', teacherBodyParser);
  // Synthetic HTTP identity with real transactional module checks, ownership and SQL.
  app.use((req, _res, next) => {
    const actor = req.headers['x-qa-actor'] === 'other' ? lab.other
      : req.headers['x-qa-actor'] === 'no-module' ? lab.noModule : lab.actor;
    req.auth = {
      user: { id: actor.userId, name: 'Calendar QA', email: 'calendar@example.test', image_url: null },
      sessionId: actor.sessionId,
    };
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const url = (await app.getUrl()) + '/api/v1/teacher/calendar/';

  async function request(path, { method = 'GET', body, actor } = {}) {
    const response = await fetch(url + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(actor ? { 'x-qa-actor': actor } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  }

  function expectStatus(result, status) {
    assert.equal(result.status, status, JSON.stringify(result.body));
    assert.equal(result.cache, 'no-store');
    return result.body;
  }

  const category = expectStatus(await request('categories', {
    method: 'POST', body: { name: 'Idiomas', color: 'violet' },
  }), 201);
  const foreign = expectStatus(await request('categories', {
    method: 'POST', actor: 'other', body: { name: 'Idiomas', color: 'blue' },
  }), 201);
  assert.notEqual(category.id, foreign.id);
  const payload = {
    request_key: randomUUID(),
    plan: {
      version: 1, title: 'Inglés · 30 días', categories: ['  IDIOMAS  ', 'Repaso'],
      schedule: { kind: 'numbered', days: 30 },
      days: [{
        day: 1, title: 'Presentarte', minutes: 30,
        activities: [
          { text: 'Ver la lección', source: { label: 'Clase', url: 'https://example.test/class' } },
          { text: 'Resolver el ejercicio', source: { label: 'Ejercicio', url: 'https://example.test/exercise' } },
          { text: 'Practicar en voz alta' },
        ],
      }],
    },
    new_categories: ['Repaso'],
  };
  const create = (body = payload) => request('plans', { method: 'POST', body });

  let created;
  await check('import validates nested input and a concurrent replay creates one plan with 30 days', async () => {
    const invalid = structuredClone(payload);
    invalid.plan.days[0].activities[0].completed = true;
    expectStatus(await create(invalid), 400);
    expectStatus(await create({ ...payload, new_categories: [] }), 409);
    assert.equal(expectStatus(await request('plans'), 200).meta.total, 0);
    assert.equal(expectStatus(await request('categories'), 200).length, 1);
    const [first, retry] = await Promise.all([create(), create()]);
    created = expectStatus(first, 201);
    assert.equal(expectStatus(retry, 201).id, created.id);
    assert.equal(created.days.length, 30);
    assert.equal(created.completed_count, 0);
    assert.deepEqual(created.days.slice(0, 2).map((day) => [day.activity_count, day.completed]), [[3, false], [0, false]]);
    assert.equal(expectStatus(await request('plans?category_id=' + category.id), 200).meta.total, 1);
    assert.equal(expectStatus(await request('categories'), 200).length, 2);
    expectStatus(await create({ ...payload, plan: { ...payload.plan, title: 'Otro intento' } }), 409);
  });

  const planPath = 'plans/' + created.id;
  const days = created.days.map(({ id }) => planPath + '/days/' + id);
  function saveDay(day, activities = day.activities, path = days[0], actor) {
    const { revision, title, notes, minutes } = day;
    return request(path, { method: 'PATCH', actor, body: { revision, title, notes, minutes, activities } });
  }

  await check('authorization isolates calendars, day writes and categories', async () => {
    expectStatus(await request('plans', { actor: 'no-module' }), 403);
    expectStatus(await request(planPath, { actor: 'other' }), 404);
    expectStatus(await request(days[0], { actor: 'other' }), 404);
    assert.equal(expectStatus(await request('plans', { actor: 'other' }), 200).meta.total, 0);
    expectStatus(await request('categories/' + foreign.id, {
      method: 'PATCH', body: { name: 'Renombrada' },
    }), 404);
    const day = expectStatus(await request(days[0]), 200);
    expectStatus(await saveDay(day, day.activities, days[0], 'other'), 404);
  });

  await check('partial, complete, reopened and empty days project persisted progress and stable activity IDs', async () => {
    let day = expectStatus(await request(days[0]), 200);
    assert.deepEqual(day.activities[1].source, { label: 'Ejercicio', url: 'https://example.test/exercise' });
    assert.equal(day.activities[2].source, undefined);
    const originalIds = day.activities.map(({ id }) => id);
    day = expectStatus(await saveDay(day, day.activities.map((activity, index) => ({
      ...activity, completed: index < 2,
    }))), 200);
    assert.equal(day.completed_activity_count, 2);
    assert.equal(day.completed, false);
    assert.equal(expectStatus(await request(planPath), 200).completed_count, 0);

    const stale = day;
    day = expectStatus(await saveDay(day, day.activities.toReversed().map((activity) => ({
      ...activity, completed: true,
    }))), 200);
    assert.deepEqual(day.activities.map(({ id }) => id), originalIds.toReversed());
    assert.equal(day.completed, true);
    assert.equal(expectStatus(await request(planPath), 200).completed_count, 1);
    expectStatus(await saveDay(stale), 409);

    day = expectStatus(await saveDay(day, day.activities.map((activity, index) => ({
      ...activity, completed: index !== 0,
    }))), 200);
    assert.equal(day.completed, false);
    assert.equal(expectStatus(await request('plans'), 200).data[0].completed_count, 0);
    day = expectStatus(await saveDay(day, []), 200);
    assert.deepEqual([day.activity_count, day.completed_activity_count, day.completed], [0, 0, false]);
  });

  await check('concurrent day editions conflict and activity IDs cannot be moved to another day', async () => {
    const day = expectStatus(await request(days[0]), 200);
    const [first, second] = await Promise.all([
      saveDay(day, [{ text: 'Repasar', completed: true }]),
      saveDay(day, [{ text: 'Leer', completed: false }]),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [200, 409]);
    const saved = expectStatus(await request(days[0]), 200);
    const otherDay = expectStatus(await request(days[1]), 200);
    const transfer = await saveDay(otherDay, saved.activities, days[1]);
    assert.ok([400, 404, 409].includes(transfer.status), JSON.stringify(transfer.body));
    assert.equal(expectStatus(await request(days[1]), 200).activity_count, 0);
    assert.deepEqual(expectStatus(await request(days[0]), 200).activities, saved.activities);
  });

  await check('civil dates include leap day and deactivation preserves existing category assignments', async () => {
    const dated = expectStatus(await create({
      request_key: randomUUID(),
      plan: { version: 1, title: 'Bisiesto', schedule: { kind: 'dated', start: '2028-02-28', end: '2028-03-01' } },
    }), 201);
    assert.deepEqual(dated.days.map(({ date }) => date), ['2028-02-28', '2028-02-29', '2028-03-01']);
    expectStatus(await request('categories/' + category.id, { method: 'PATCH', body: { active: false } }), 200);
    assert.equal(expectStatus(await request('plans?category_id=' + category.id), 200).meta.total, 1);
    assert.equal(expectStatus(await request(planPath), 200).categories.find(({ id }) => id === category.id).active, false);
    expectStatus(await create({ ...payload, request_key: randomUUID(), new_categories: [] }), 409);
  });

  await check('module revocation blocks even a known creation receipt', async () => {
    await lab.db.query('UPDATE user_modules SET is_active=false WHERE user_id=$1', [lab.actor.userId]);
    expectStatus(await request(planPath), 403);
    expectStatus(await create(), 403);
  });
  console.log(JSON.stringify({ suite: 'teacher-study-calendar', checks }, null, 2));
} finally {
  try { await app?.close(); }
  finally { await lab.close(); }
}
