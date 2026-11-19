// Executed as an unprivileged user with both release trees mounted read-only.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { migrationInventory, persistedEntitySchemaPresent } from './update-backend-action.mjs';
import { verifyReleaseStartup } from './migration-release-smoke.mjs';

const ids = process.argv.slice(2);
assert.equal(ids.length, 2);
assert.ok(ids.every(id => /^backend-[a-f0-9]{12}-[a-f0-9]{12}$/.test(id)));
assert.equal(process.env.POSTGRES_HOST, 'update-pg');
assert.equal(process.env.POSTGRES_USER, 'fixture_user');
assert.equal(process.env.PGSSLMODE, 'verify-full');
const runtimeDigest = createHash('sha256').update(readFileSync(process.execPath)).digest('hex');
const [baseline, candidate] = ids.map(id => {
  const directory = join('/opt/nodia/releases', id);
  const manifest = JSON.parse(readFileSync(join(directory, 'release-manifest.json'), 'utf8'));
  assert.equal(manifest.runtime.executable_sha256, runtimeDigest, `Linux runtime for ${id}`);
  return { directory, manifest };
});
const require = createRequire(join(candidate.directory, 'package.json'));
require('reflect-metadata');
const { Client } = require('pg');
const upgradeDb = 'fixture_upgrade';
const cleanDb = 'fixture_clean';
const identity = ({ manifest }) => ({ source_sha: manifest.source_sha, release_id: manifest.release_id,
  package_tree_sha256: manifest.package_tree_sha256 });

async function install(release, database) {
  process.env.POSTGRES_DB = database;
  const { default: source } = await import(pathToFileURL(join(release.directory, 'dist/config/data-source.js')));
  assert.equal(source.options.synchronize, false);
  assert.notEqual(source.options.migrationsRun, true);
  assert.equal(source.options.database, database);
  await source.initialize();
  try {
    assert.ok(source.migrations.every(migration => migration.transaction !== false));
    const applied = await source.runMigrations({ transaction: 'all' });
    const expected = migrationInventory(release.manifest).map(({ timestamp, name }) => ({ timestamp, name }));
    const rows = await source.query('SELECT timestamp::text AS timestamp,name FROM public.migrations ORDER BY id');
    assert.deepEqual(rows, expected, `Clean ledger for ${release.manifest.release_id}`);
    assert.equal(applied.length, expected.length);
    const columns = await source.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'");
    assert.ok(persistedEntitySchemaPresent(source.entityMetadatas, columns));
    return { migrations: expected.length, entities: source.entityMetadatas.length };
  } finally {
    await source.destroy();
  }
}

function action(mode, { error, sqlstate } = {}) {
  const result = spawnSync(process.execPath, ['/input/update-backend-action.mjs', mode, baseline.directory, candidate.directory], {
    env: { ...process.env, POSTGRES_DB: upgradeDb }, encoding: 'utf8', timeout: 90_000,
  });
  assert.ifError(result.error);
  const body = JSON.parse(result.stdout.trim());
  assert.equal(result.status, error ? 1 : 0, `${mode}: ${JSON.stringify(body)}`);
  if (error) {
    assert.equal(body.error_code, error);
    assert.equal(body.database_sqlstate, sqlstate);
    assert.equal(body.automatic_retry_allowed, false);
  } else {
    assert.equal(body.client_tls_authorized, true);
  }
  return body;
}

async function representativeRows(db) {
  return (await db.query(`SELECT u.id AS owner_id,u.email,b.id AS business_id,b.name AS business,
    p.id AS product_id,p.name AS product,p.cost_price,p.cost_price_tax,p.sale_price,
    i.id AS invoice_id,i.code,i.total_amount,i.provider_id,s.name AS supplier
    FROM users u JOIN businesses b ON b.owner_id=u.id JOIN products p ON p.business_id=b.id
    JOIN invoices i ON i.business_id=b.id JOIN providers s ON s.id=i.provider_id AND s.business_id=b.id
    WHERE u.email='migration-owner@example.invalid' ORDER BY p.id,i.id`)).rows;
}

async function schemaSnapshot(db) {
  const { rows } = await db.query(`SELECT c.relkind,c.relname,a.attnum,a.attname,a.atttypid,a.atttypmod,
    a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_value
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' ORDER BY c.relkind,c.relname,a.attnum`);
  return rows;
}

async function checkFailedCommit(db, before, rowsBefore) {
  // A deferred ledger trigger fails at commit, after the real DDL and inserts.
  // The release trees and compiled migration files are untouched.
  await db.query(`CREATE FUNCTION fixture_reject_migration_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION USING ERRCODE='P7101', MESSAGE='synthetic commit rejection'; END $$;
    CREATE CONSTRAINT TRIGGER fixture_reject_migration_commit AFTER INSERT ON public.migrations
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fixture_reject_migration_commit()`);
  try {
    const schemaBefore = await schemaSnapshot(db);
    action('migrate', { error: 'database_update_action_failed', sqlstate: 'P7101' });
    const observed = action('inspect');
    assert.equal(observed.read_only, true);
    assert.equal(observed.ledger_sha256, before.ledger_sha256);
    assert.equal(observed.pending, before.pending);
    action('verify', { error: 'migration_ledger_mismatch' });
    assert.deepEqual(await schemaSnapshot(db), schemaBefore);
    assert.deepEqual(await representativeRows(db), rowsBefore);
  } finally {
    await db.query(`DROP TRIGGER fixture_reject_migration_commit ON public.migrations;
      DROP FUNCTION fixture_reject_migration_commit()`);
  }
}

const clean = await install(candidate, cleanDb);
const previous = await install(baseline, upgradeDb);
const db = new Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: upgradeDb,
  connectionTimeoutMillis: 10_000, statement_timeout: 15_000 });
await db.connect();
try {
  assert.equal(db.connection.stream.authorized, true);
  const { rows: [connection] } = await db.query(`SELECT current_user,current_database() AS database,
    current_setting('server_version_num')::int AS postgres_version,rolsuper,rolcreatedb,rolcreaterole
    FROM pg_roles WHERE rolname=current_user`);
  assert.equal(connection.database, upgradeDb);
  assert.equal(connection.current_user, 'fixture_user');
  assert.equal(Math.trunc(connection.postgres_version / 10_000), 16);
  assert.ok(!connection.rolsuper && !connection.rolcreatedb && !connection.rolcreaterole);
  const { rows: [owner] } = await db.query("INSERT INTO users(email,name) VALUES('migration-owner@example.invalid','Migration fixture') RETURNING id");
  const { rows: [business] } = await db.query("INSERT INTO businesses(name,owner_id) VALUES('Migration fixture',$1) RETURNING id", [owner.id]);
  await db.query("INSERT INTO products(business_id,name,cost_price,cost_price_tax,sale_price) VALUES($1,'Preserved product',100,119,150)", [business.id]);
  const { rows: [supplier] } = await db.query("INSERT INTO providers(business_id,name) VALUES($1,'Migration fixture supplier') RETURNING id", [business.id]);
  await db.query("INSERT INTO invoices(business_id,provider_id,code,total_amount) VALUES($1,$2,'MIGRATION-FIXTURE',119)",
    [business.id, supplier.id]);
  const rowsBefore = await representativeRows(db);
  assert.equal(rowsBefore.length, 1);

  const before = action('inspect');
  assert.ok(before.read_only && before.quiescent);
  assert.equal(before.before, previous.migrations);
  assert.equal(before.target, clean.migrations);
  if (before.pending > 0) await checkFailedCommit(db, before, rowsBefore);

  const migrated = action('migrate');
  assert.equal(migrated.applied, before.pending);
  assert.equal(migrated.entity_tables_checked, clean.entities);
  assert.equal(migrated.entity_columns_present, true);
  // A fresh read proves the outcome independently of the mutation response.
  const verified = action('verify');
  assert.ok(verified.read_only && verified.quiescent);
  assert.equal(verified.target, clean.migrations);
  assert.equal(verified.pending, 0);
  if (before.pending > 0) action('migrate', { error: 'migration_ledger_mismatch' });
  assert.deepEqual(await representativeRows(db), rowsBefore);
  const startup = await verifyReleaseStartup(candidate.directory, upgradeDb);
  console.log(JSON.stringify({ schema_version: 1, status: 'passed', baseline: identity(baseline), candidate: identity(candidate),
    postgres: connection.postgres_version,
    clean, upgraded: { from: previous.migrations, to: verified.target, applied: migrated.applied, ledger_sha256: verified.ledger_sha256 },
    failed_commit_rolled_back: before.pending > 0 ? true : null, representative_rows_preserved: true, ...startup }));
} finally {
  await db.end();
}
