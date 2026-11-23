import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { lockAuthority } from '../dist/authorization/authority-transaction.js';
import { AllExceptionsFilter } from '../dist/common/filters/all-exceptions.filter.js';
import { calendarReadCandidates, calendarWriteCandidates } from '../dist/nodia-ai-teacher-operations/calendar-operations.js';
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
const managementMigration = '1793890000000-ManageTeacherStudyCalendars';
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

  await check('management migration treats old calendars as active and safely reverts on a compatible state', async () => {
    const [legacy] = await lab.db.query(
      `INSERT INTO teacher_calendar_plans (owner_user_id, request_key, request_hash, title, schedule_kind, day_count)
       VALUES ($1, $2, $3, 'Anterior', 'numbered', 1) RETURNING id`,
      [lab.actor.userId, randomUUID(), '0'.repeat(64)],
    );
    await lab.migrate(managementMigration);
    assert.deepEqual(await lab.db.query('SELECT active FROM teacher_calendar_plans WHERE id=$1', [legacy.id]), [{ active: true }]);
    await lab.migrate(managementMigration, 'down');
    assert.deepEqual(await lab.db.query('SELECT title FROM teacher_calendar_plans WHERE id=$1', [legacy.id]), [{ title: 'Anterior' }]);
    await lab.migrate(managementMigration);
    await lab.db.query('DELETE FROM teacher_calendar_plans WHERE id=$1', [legacy.id]);
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
    return { status: response.status, body: response.status === 204 ? null : await response.json(), cache: response.headers.get('cache-control') };
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
    assert.equal(created.active, true);
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

  await check('plan editing preserves jornadas and permits retaining but not adding inactive categories', async () => {
    const before = expectStatus(await request(planPath), 200);
    const day = expectStatus(await request(days[0]), 200);
    const inactive = expectStatus(await request('categories', {
      method: 'POST', body: { name: 'Inactiva sin vínculo', color: 'blue' },
    }), 201);
    expectStatus(await request('categories/' + inactive.id, {
      method: 'PATCH', body: { active: false },
    }), 200);
    const edit = (body, actor) => request(planPath, { method: 'PATCH', body, actor });
    expectStatus(await edit({}), 400);
    expectStatus(await edit({ schedule: before.schedule }), 400);
    expectStatus(await edit({ category_ids: [category.id, category.id.toUpperCase()] }), 400);
    expectStatus(await edit({ category_ids: [foreign.id], title: 'Nombre inválido' }), 404);
    assert.equal(expectStatus(await edit({ category_ids: [inactive.id] }), 409).code, 'calendar_category_inactive');
    expectStatus(await edit({ title: 'Ajeno' }, 'other'), 404);
    expectStatus(await edit({ title: 'Sin módulo' }, 'no-module'), 403);
    assert.deepEqual(expectStatus(await request(planPath), 200), before);
    const edited = expectStatus(await edit({ title: ' Inglés revisado ', category_ids: [category.id] }), 200);
    assert.equal(edited.title, 'Inglés revisado');
    assert.deepEqual(edited.schedule, before.schedule);
    assert.deepEqual(edited.days, before.days);
    assert.equal(edited.completed_count, before.completed_count);
    assert.deepEqual(edited.categories.map(({ id, active }) => ({ id, active })), [{ id: category.id, active: false }]);
    assert.deepEqual(expectStatus(await request(days[0]), 200), day);
  });

  await check('activity filters compose with categories and changing status retains the editable calendar', async () => {
    const before = expectStatus(await request(planPath), 200);
    const inactive = expectStatus(await request(planPath, {
      method: 'PATCH', body: { active: false },
    }), 200);
    assert.deepEqual(inactive, { ...before, active: false });
    assert.equal(expectStatus(await request('plans?category_id=' + category.id), 200).meta.total, 0);
    const inactiveFilter = 'plans?status=inactive&category_id=' + category.id;
    const allFilter = 'plans?status=all&category_id=' + category.id;
    assert.deepEqual(expectStatus(await request(inactiveFilter), 200).data.map(({ id, active }) => [id, active]), [[before.id, false]]);
    assert.equal(expectStatus(await request(allFilter), 200).meta.total, 1);
    assert.equal(expectStatus(await request('plans?status=inactive&category_id=' + foreign.id), 200).meta.total, 0);
    expectStatus(await request('plans?status=unknown'), 400);
    assert.equal(expectStatus(await request(planPath), 200).active, false);
    assert.equal(expectStatus(await request(days[0]), 200).id, before.days[0].id);
    const editedWhileInactive = expectStatus(await request(planPath, {
      method: 'PATCH', body: { title: 'Revisado mientras está inactivo' },
    }), 200);
    assert.equal(editedWhileInactive.title, 'Revisado mientras está inactivo');
    assert.equal(editedWhileInactive.active, false);
    await assert.rejects(lab.migrate(managementMigration, 'down'), /Preserve calendar states/);
    const reinstated = expectStatus(await request(planPath, {
      method: 'PATCH', body: { title: before.title, active: true },
    }), 200);
    assert.deepEqual(reinstated, before);
    assert.equal(expectStatus(await request(inactiveFilter), 200).meta.total, 0);
  });

  await check('deletion and create retry serialize, cascade, and remain recoverable only by their owner', async () => {
    const planId = created.id;
    const knownDayId = created.days[0].id;
    const remove = (path = planPath, actor) => request(path, { method: 'DELETE', actor });
    expectStatus(await remove(planPath, 'other'), 404);
    expectStatus(await remove(planPath, 'no-module'), 403);
    expectStatus(await remove('plans/' + randomUUID()), 404);
    assert.ok(expectStatus(await request(days[0]), 200).activities.length > 0);
    const [removed, replay, repeated] = await Promise.all([remove(), create(), remove()]);
    expectStatus(removed, 204);
    expectStatus(repeated, 204);
    if (replay.status === 201) assert.equal(expectStatus(replay, 201).id, planId);
    else assert.equal(expectStatus(replay, 410).code, 'calendar_plan_deleted');
    const deleted = expectStatus(await create(), 410);
    assert.equal(deleted.code, 'calendar_plan_deleted');
    assert.equal(expectStatus(await create({ ...payload, plan: { ...payload.plan, title: 'Otra intención' } }), 410).code, deleted.code);
    expectStatus(await remove(), 204);
    expectStatus(await remove(planPath, 'other'), 404);
    expectStatus(await request(planPath), 404);
    expectStatus(await request(days[0]), 404);
    expectStatus(await request(planPath, { method: 'PATCH', body: { active: true } }), 404);
    const [counts] = await lab.db.query(`SELECT
      (SELECT count(*)::int FROM teacher_calendar_days WHERE plan_id=$1) AS days,
      (SELECT count(*)::int FROM teacher_calendar_activities WHERE day_id=$2) AS activities,
      (SELECT count(*)::int FROM teacher_calendar_plan_categories WHERE plan_id=$1) AS categories`,
    [planId, knownDayId]);
    assert.deepEqual(counts, { days: 0, activities: 0, categories: 0 });
    assert.ok(expectStatus(await request('categories'), 200).some(({ id }) => id === category.id));
    assert.equal(expectStatus(await request('plans?status=all&category_id=' + category.id), 200).meta.total, 0);
    await assert.rejects(lab.migrate(managementMigration, 'down'), /Preserve calendar states/);
  });

  const calendars = app.get(TeacherCalendarUseCase);
  const reader = (name) => calendarReadCandidates(calendars).find(({ toolName }) => toolName === `nodia_teacher_${name}`);
  const writer = (name) => calendarWriteCandidates(calendars).find(({ toolName }) => toolName === `nodia_teacher_${name}`);
  const actorContext = (nativeActor, work, requestKey = randomUUID()) =>
    lab.db.transaction(async (manager) => {
      await lockAuthority(manager);
      return work({
        actorId: nativeActor.userId, sessionId: nativeActor.sessionId, manager, requestKey,
      });
    });
  const confirmed = (operation, prepared, requestKey = randomUUID()) => actorContext(lab.actor, async (context) => {
    await operation.verify(prepared, context);
    return operation.execute(prepared, context);
  }, requestKey);
  const statusIs = (status) => (error) => error.getStatus() === status;
  const stale = (error) => error.getStatus() === 409 && error.message === 'nodia_ai:preconditions_changed';
  let aiPlanId;
  let aiDayId;
  await check('catalog creation remains a draft until confirmed, honors category changes, and bounds personal reads', async () => {
    const operation = writer('calendars_prepare_create');
    const input = {
      plan: {
        version: 1, title: '  NodiaAI calendar  ', categories: [' NodiaAI '],
        schedule: { kind: 'dated', start: '2026-11-23', end: '2026-12-14' },
        days: [{ date: '2026-11-23', notes: 'Not a public resource', activities: [
          { text: ' Read ', source: { label: ' Source ', url: 'https://example.test/study' } },
          { text: 'Write' }, { text: 'Listen' }, { text: 'Speak' },
        ] }],
      },
      new_categories: ['NodiaAI'],
    };
    const baseline = (await calendars.listPlans(lab.actor, 1)).meta.total;
    const prepare = () => actorContext(lab.actor, (context) => operation.prepare(input, context));
    const first = await prepare();
    assert.equal(first.command.plan.title, 'NodiaAI calendar');
    assert.equal(first.command.plan.days[0].activities[0].source.label, 'Source');
    assert.deepEqual(first.command.new_categories, ['NodiaAI']);
    assert.equal((await calendars.listPlans(lab.actor, 1)).meta.total, baseline);
    assert.ok(!(await calendars.categories(lab.actor)).some(({ name }) => name === 'NodiaAI'));
    await calendars.createCategory(lab.actor, { name: 'NodiaAI', color: 'blue' });
    await assert.rejects(confirmed(operation, first), stale);

    const prepared = await prepare();
    assert.deepEqual(prepared.command.new_categories, []);
    const key = randomUUID();
    ({ id: aiPlanId } = await confirmed(operation, prepared, key));
    const repeat = await actorContext(lab.actor, (context) => operation.execute(prepared, context), key);
    assert.equal(repeat.id, aiPlanId);
    assert.equal((await calendars.listPlans(lab.actor, 1)).meta.total, baseline + 1);
    const get = reader('calendars_get');
    const pageOne = await actorContext(lab.actor, (context) => get.execute({ id: aiPlanId }, context));
    const pageTwo = await actorContext(lab.actor, (context) => get.execute({ id: aiPlanId, page: 2 }, context));
    assert.equal(pageOne.days.length, 20);
    assert.deepEqual(pageTwo.days.map(({ ordinal }) => ordinal), [21, 22]);
    assert.deepEqual(pageTwo.meta, { page: 2, total: 22, total_pages: 2 });
    aiDayId = pageOne.days[0].id;
    const dayPage = await actorContext(lab.actor, (context) => reader('calendar_days_get').execute({ plan_id: aiPlanId, id: aiDayId }, context));
    assert.equal(dayPage.activities.length, 3);
    assert.deepEqual(dayPage.meta, { page: 1, total: 4, total_pages: 2 });
    await assert.rejects(actorContext(lab.other, (context) => get.execute({ id: aiPlanId }, context)), statusIs(404));
    await assert.rejects(actorContext(lab.noModule, (context) => get.execute({ id: aiPlanId }, context)), statusIs(403));
    const list = await actorContext(lab.other, (context) => reader('calendars_list').execute({}, context));
    assert.deepEqual(list.data, []);
  });

  await check('catalog completion uses the native revision and derives jornada progress from all its activities', async () => {
    const operation = writer('calendar_activities_prepare_set_completion');
    const day = await calendars.day(lab.actor, aiPlanId, aiDayId);
    const activityId = day.activities[0].id;
    const prepare = () => actorContext(lab.actor, (context) => operation.prepare(
      { plan_id: aiPlanId, id: aiDayId, activity_id: activityId, completed: true }, context,
    ));
    const before = await prepare();
    assert.equal(before.id, activityId);
    const patch = { revision: day.revision, title: 'Nueva jornada', notes: day.notes, minutes: day.minutes, activities: day.activities };
    await calendars.patchDay(lab.actor, aiPlanId, aiDayId, patch);
    await assert.rejects(confirmed(operation, before), stale);
    assert.equal((await calendars.day(lab.actor, aiPlanId, aiDayId)).activities[0].completed, false);
    const completed = await confirmed(operation, await prepare());
    assert.equal(completed.id, activityId);
    const partial = await calendars.day(lab.actor, aiPlanId, aiDayId);
    assert.equal(partial.completed, false);
    assert.equal(partial.notes, day.notes);
    assert.deepEqual(partial.activities[0].source, day.activities[0].source);
    await confirmed(operation, await prepare());
    assert.equal((await calendars.day(lab.actor, aiPlanId, aiDayId)).revision, partial.revision);
    const update = writer('calendar_days_prepare_update');
    const full = await actorContext(lab.actor, (context) => update.prepare({
      plan_id: aiPlanId, id: aiDayId, title: partial.title, notes: partial.notes,
      minutes: partial.minutes, activities: partial.activities.map((activity) => ({ ...activity, completed: true })),
    }, context));
    await confirmed(update, full);
    assert.equal((await calendars.day(lab.actor, aiPlanId, aiDayId)).completed, true);
    assert.equal((await calendars.plan(lab.actor, aiPlanId)).completed_count, 1);
  });

  await check('catalog changes preserve native plan and category status rules and reject stale category edits', async () => {
    const create = writer('calendar_categories_prepare_create');
    const patch = writer('calendar_categories_prepare_update');
    const update = writer('calendars_prepare_update');
    const candidate = await actorContext(lab.actor, (context) => create.prepare({ name: 'AI target', color: 'green' }, context));
    const { id } = await confirmed(create, candidate);
    const preview = await actorContext(lab.actor, (context) => update.prepare({
      id: aiPlanId, title: '   Calendario actualizado   ', active: false, category_ids: [id],
    }, context));
    assert.deepEqual(preview.preview.categories, ['AI target']);
    const before = await calendars.plan(lab.actor, aiPlanId);
    await confirmed(update, preview);
    const inactive = await actorContext(lab.actor, (context) => reader('calendars_list').execute({
      category_id: id, status: 'inactive',
    }, context));
    assert.deepEqual(inactive.data.map((plan) => plan.id), [aiPlanId]);
    const after = await calendars.plan(lab.actor, aiPlanId);
    assert.equal(after.title, 'Calendario actualizado');
    assert.equal(after.active, false);
    assert.deepEqual(after.days, before.days);
    const preparePatch = () => actorContext(lab.actor, (context) => patch.prepare({ id, active: false }, context));
    const first = await preparePatch();
    await calendars.patchCategory(lab.actor, id, { name: 'Nombre cambiado' });
    await assert.rejects(confirmed(patch, first), stale);
    await confirmed(patch, await preparePatch());
    const categories = await actorContext(lab.actor, (context) => reader('calendar_categories_list').execute({}, context));
    assert.deepEqual(categories.data.find((category) => category.id === id), {
      id, name: 'Nombre cambiado', color: 'green', active: false,
    });
  });

  await check('confirmed calendar deletion rejects a stale edit and keeps its compare lock through deletion', async () => {
    const operation = writer('calendars_prepare_delete');
    const prepare = () => actorContext(lab.actor, (context) => operation.prepare({ id: aiPlanId }, context));
    const before = await prepare();
    assert.equal(before.preview.activity_count, 4);
    const { revision, title, notes, minutes, activities } = await calendars.day(lab.actor, aiPlanId, aiDayId);
    await calendars.patchDay(lab.actor, aiPlanId, aiDayId, { revision, title, notes: 'Updated', minutes, activities });
    await assert.rejects(confirmed(operation, before), stale);
    const accepted = await prepare();
    await actorContext(lab.actor, async (context) => {
      await operation.verify(accepted, context);
      await assert.rejects(
        actorContext(lab.actor, async ({ manager }) => {
          await manager.query("SET LOCAL lock_timeout = '100ms'");
          await calendars.patchDay({ ...lab.actor, transaction: manager }, aiPlanId, aiDayId, {
            revision: revision + 1, title, notes, minutes, activities,
          });
        }),
        (error) => error.code === '55P03',
      );
      await operation.execute(accepted, context);
    });
    await assert.rejects(calendars.plan(lab.actor, aiPlanId), statusIs(404));
  });

  await check('module revocation blocks even a known creation receipt', async () => {
    await lab.db.query('UPDATE user_modules SET is_active=false WHERE user_id=$1', [lab.actor.userId]);
    expectStatus(await request(planPath), 403);
    expectStatus(await create(), 403);
    expectStatus(await request(planPath, { method: 'DELETE' }), 403);
  });
  console.log(JSON.stringify({ suite: 'teacher-study-calendar', checks }, null, 2));
} finally {
  try { await app?.close(); }
  finally { await lab.close(); }
}
