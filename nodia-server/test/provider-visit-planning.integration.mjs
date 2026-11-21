import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { CreateProviderContacts1791220000000 } from '../dist/migrations/1791220000000-CreateProviderContacts.js';
import { PlanProviderVisits1793860000000 } from '../dist/migrations/1793860000000-PlanProviderVisits.js';
import { ReconcileProviderVisitPlanningUseCase } from '../dist/provider-visit-planning/use-case/reconcile-provider-visit-planning.use-case.js';

const container = `nodia_visit_planning_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const days = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
const weekly = JSON.stringify(
  Object.fromEntries(days.map((day) => [day, [{ from: null, to: null }]])),
);
const businessA = randomUUID();
const businessB = randomUUID();
let source;
let started = false;
let locked;

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
    'POSTGRES_USER=planning_test',
    '--env',
    'POSTGRES_DB=planning_test',
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:16-alpine',
  );
  started = true;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'planning_test',
      );
      break;
    } catch (error) {
      if (attempt === 29) throw error;
      await delay(250);
    }
  }
  source = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'planning_test',
    password,
    database: 'planning_test',
    synchronize: false,
  });
  await source.initialize();
  await source.query(`CREATE TABLE businesses(id uuid PRIMARY KEY, is_active boolean NOT NULL DEFAULT true);
    CREATE TABLE providers(id bigserial PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id),
      is_active boolean NOT NULL DEFAULT true, visit_alarm_time varchar(5));`);
  const migrations = source.createQueryRunner();
  const planning = new PlanProviderVisits1793860000000();
  try {
    await new CreateProviderContacts1791220000000().up(migrations);
    await source.query(`INSERT INTO businesses(id) VALUES ($1), ($2)`, [
      businessA,
      businessB,
    ]);
    await source.query(`INSERT INTO providers(business_id) VALUES ($1)`, [
      businessA,
    ]);
    await source.query(
      `INSERT INTO personal_info_provider(provider_id, name, schedule, creation_key, creation_hash)
      VALUES (1, 'Legacy Wednesday', '{"wednesday":[{"from":"10:30","to":"12:00"}]}', $1, repeat('a',64))`,
      [randomUUID()],
    );
    await planning.up(migrations);
    assert.equal(
      (
        await source.query(
          `SELECT provider_id FROM provider_visit_planning_queue`,
        )
      )[0].provider_id,
      '1',
    );
    await planning.down(migrations);
    assert.equal(
      (
        await source.query(
          `SELECT to_regclass('provider_visit_planning_queue') AS found`,
        )
      )[0].found,
      null,
    );
    await planning.up(migrations);
  } finally {
    await migrations.release();
  }

  const planner = new ReconcileProviderVisitPlanningUseCase(source);
  const otherPlanner = new ReconcileProviderVisitPlanningUseCase(source);
  const [{ now }] = await source.query(
    `SELECT date_trunc('day', clock_timestamp()) + interval '2 days 11 hours' AS now`,
  );
  const queue = async (provider) =>
    (
      await source.query(
        `SELECT source_revision, contact_cursor, run_at FROM provider_visit_planning_queue WHERE provider_id=$1`,
        [provider],
      )
    )[0];
  const occurrences = (provider, state = 'planned') =>
    source.query(
      `SELECT business_id, contact_id, visit_date::text, start_at, send_at, expires_at, alarm_basis, source_revision
       FROM provider_visit_occurrences WHERE provider_id=$1 AND status=$2 ORDER BY contact_id, visit_date`,
      [provider, state],
    );
  const insertContact = async (provider, schedule = weekly) =>
    (
      await source.query(
        `INSERT INTO personal_info_provider(provider_id, name, schedule, creation_key, creation_hash)
     VALUES ($1, 'Synthetic', $2::jsonb, $3, repeat('a',64)) RETURNING id`,
        [provider, schedule, randomUUID()],
      )
    )[0].id;
  const drain = async (at = now) => {
    for (let page = 0; page < 20; page++)
      if (!(await planner.executeNext(at))) return;
    assert.fail('planning work did not reach its next horizon');
  };

  // A stuck transaction owns supplier 1. Two consumers skip it and plan different suppliers.
  await source.query(`INSERT INTO providers(business_id) VALUES ($1), ($2)`, [
    businessA,
    businessB,
  ]);
  const contactB = await insertContact(2);
  await insertContact(3);
  locked = source.createQueryRunner();
  await locked.startTransaction();
  await locked.query(
    `SELECT provider_id FROM provider_visit_planning_queue WHERE provider_id=1 FOR UPDATE`,
  );
  assert.deepEqual(
    await Promise.all([
      planner.executeNext(now),
      otherPlanner.executeNext(now),
    ]),
    [true, true],
  );
  assert.equal((await occurrences(1)).length, 0);
  const firstOccurrences = await occurrences(2);
  assert.equal(firstOccurrences.length, 8);
  assert.equal((await occurrences(3)).length, 8);
  assert(
    firstOccurrences.every(
      (row) => row.start_at === null && row.alarm_basis === 'default_hour',
    ),
  );
  await locked.rollbackTransaction();
  await locked.release();
  locked = undefined;
  await drain();
  assert(
    (await occurrences(1)).every(
      (row) => row.alarm_basis === 'visit_start' && row.start_at,
    ),
  );
  assert.equal((await queue(2)).run_at.getTime(), now.getTime() + 86_400_000);

  // Persistently due work survives a failed transaction, even after trying to materialize rows.
  await source.query(
    `UPDATE providers SET visit_alarm_time='08:45' WHERE id=2`,
  );
  const changed = await queue(2);
  assert.notEqual(changed.source_revision, firstOccurrences[0].source_revision);
  await source.query(`CREATE FUNCTION simulate_failed_plan() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'planner_injected_failure'; END $$;
    CREATE TRIGGER fail_planning BEFORE INSERT OR UPDATE ON provider_visit_occurrences
    FOR EACH ROW EXECUTE FUNCTION simulate_failed_plan();`);
  await assert.rejects(planner.executeNext(now), /planner_injected_failure/);
  assert.deepEqual(await queue(2), changed);
  assert.deepEqual(await occurrences(2), firstOccurrences);
  await source.query(
    `DROP TRIGGER fail_planning ON provider_visit_occurrences; DROP FUNCTION simulate_failed_plan()`,
  );
  assert.equal(await otherPlanner.executeNext(now), true);
  assert(
    (await occurrences(2)).every(
      (row) =>
        row.alarm_basis === 'provider_alarm' &&
        row.source_revision === changed.source_revision,
    ),
  );

  // A CSV-style native mutation rolls back its trigger writes with the edited data.
  const originalQueue = await queue(2);
  await assert.rejects(
    source.transaction(async (manager) => {
      await manager.query(
        `UPDATE personal_info_provider SET schedule='{}' WHERE id=$1`,
        [contactB],
      );
      throw new Error('synthetic_csv_rollback');
    }),
    /synthetic_csv_rollback/,
  );
  assert.deepEqual(await queue(2), originalQueue);
  await source.query(
    `UPDATE personal_info_provider SET schedule='{}' WHERE id=$1`,
    [contactB],
  );
  await drain();
  assert.equal((await occurrences(2)).length, 0);
  assert.equal((await occurrences(2, 'cancelled')).length, 8);
  assert.equal((await queue(2)).run_at, null);

  // Enabling the business after a period of inactivity schedules only its current dates.
  assert((await occurrences(3)).every((row) => row.business_id === businessB));
  await source.query(`UPDATE businesses SET is_active=false WHERE id=$1`, [
    businessB,
  ]);
  await drain();
  assert.equal((await occurrences(3)).length, 0);
  assert.equal((await queue(3)).run_at, null);
  await source.query(`UPDATE businesses SET is_active=true WHERE id=$1`, [
    businessB,
  ]);
  await drain();
  assert.equal((await occurrences(3)).length, 8);

  // One supplier with a large list advances by keyset and survives another edit between pages.
  const [{ id: largeProvider }] = await source.query(
    `INSERT INTO providers(business_id) VALUES ($1) RETURNING id`,
    [businessA],
  );
  await source.query(
    `INSERT INTO personal_info_provider(provider_id, name, schedule, creation_key, creation_hash)
    SELECT $1, 'Synthetic ' || n, $2::jsonb, gen_random_uuid(), repeat('b',64) FROM generate_series(1,49) n`,
    [largeProvider, weekly],
  );
  await planner.executeNext(now);
  assert.notEqual((await queue(largeProvider)).contact_cursor, '0');
  assert.equal(
    new Set((await occurrences(largeProvider)).map((row) => row.contact_id))
      .size,
    48,
  );
  await source.query(
    `UPDATE providers SET visit_alarm_time='08:45' WHERE id=$1`,
    [largeProvider],
  );
  assert.equal((await queue(largeProvider)).contact_cursor, '0');
  await drain();
  const large = await occurrences(largeProvider);
  assert.equal(new Set(large.map((row) => row.contact_id)).size, 49);
  assert(large.every((row) => row.alarm_basis === 'provider_alarm'));

  const later = new Date(now.getTime() + 86_400_000);
  const initialWindow = await occurrences(3);
  await drain(later);
  assert.notEqual(
    (await occurrences(3)).at(-1).visit_date,
    initialWindow.at(-1).visit_date,
  );
  assert((await occurrences(3, 'expired')).length > 0);

  // Removed contacts/provider cannot leave planned metadata eligible for dispatch.
  await source.query(`DELETE FROM personal_info_provider WHERE provider_id=3`);
  await source.query(`DELETE FROM providers WHERE id=3`);
  await drain(later);
  assert.equal(await queue(3), undefined);
  assert.equal((await occurrences(3)).length, 0);
  assert((await occurrences(3, 'cancelled')).length > 0);

  await planner.sweepOccurrences(new Date(later.getTime() + 40 * 86_400_000));
  assert.equal(
    (
      await source.query(
        `SELECT count(*)::int AS count FROM provider_visit_occurrences`,
      )
    )[0].count,
    0,
  );
  console.log(
    'PASS: PG16 migration up/down/up, legacy backfill, two concurrent claimers, failure recovery, native/CSV writes, scoped rescheduling, horizon rollover and retention.',
  );
} finally {
  if (locked?.isTransactionActive) await locked.rollbackTransaction();
  if (locked) await locked.release();
  if (source?.isInitialized) await source.destroy();
  if (started) docker('stop', container);
}
