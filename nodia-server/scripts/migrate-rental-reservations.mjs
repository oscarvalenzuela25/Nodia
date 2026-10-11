import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DataSource } from 'typeorm';
import configured from '../dist/config/data-source.js';
import { CreateRentalReservations1791146000000 } from '../dist/migrations/1791146000000-CreateRentalReservations.js';
import { OptionalRentalPropertyTimes1791540000000 } from '../dist/migrations/1791540000000-OptionalRentalPropertyTimes.js';

// Explicit rental-only operation. No global migration: the DB has a partial baseline.
const source = new DataSource({
  ...configured.options,
  migrations: [
    CreateRentalReservations1791146000000,
    OptionalRentalPropertyTimes1791540000000,
  ],
});
try {
  await source.initialize();
  const runner = source.createQueryRunner();
  try {
    const userTable = await runner.getTable('users');
    const id = userTable?.columns.find((column) => column.name === 'id');
    if (!id?.isPrimary || id.type !== 'bigint')
      throw new Error('Rental requires the existing users bigint primary key.');
  } finally {
    await runner.release();
  }
  const before = await source.query('SELECT * FROM migrations ORDER BY id');
  const tables = await source.query(
    "SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename LIKE 'rental_%' ORDER BY tablename",
  );
  const baselineApplied = before.some(
    (row) => row.name === 'CreateRentalReservations1791146000000',
  );
  if (baselineApplied ? tables.length !== 11 : tables.length !== 0)
    throw new Error(
      'Inconsistent rental baseline; refusing to alter a partial existing schema.',
    );
  if (await source.showMigrations()) {
    const directory = join(
      process.env.LOCALAPPDATA ?? homedir(),
      'Nodia',
      'backups',
    );
    await mkdir(directory, { recursive: true });
    const backup = join(
      directory,
      `rental-baseline-${new Date().toISOString().replaceAll(':', '-')}.json`,
    );
    const schema = await source.query(
      "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=current_schema() AND (table_name='users' OR table_name LIKE 'rental_%') ORDER BY table_name,ordinal_position",
    );
    const legacyTimes = baselineApplied
      ? await source.query(
          'SELECT id,check_in_time,check_out_time FROM rental_properties ORDER BY id',
        )
      : [];
    await writeFile(
      backup,
      JSON.stringify(
        { migrations: before, tables, schema, legacyTimes },
        null,
        2,
      ),
      { flag: 'wx' },
    );
    console.log(`Rental baseline backup: ${backup}`);
  }
  const applied = await source.runMigrations({ transaction: 'all' });
  const after = await source.query('SELECT * FROM migrations ORDER BY id');
  assert.deepEqual(
    after.filter((row) => before.some((old) => old.id === row.id)),
    before,
  );
  const actual = await source.query(
    "SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename LIKE 'rental_%'",
  );
  assert.equal(actual.length, 11);
  console.log(
    JSON.stringify({
      applied: applied.map((migration) => migration.name),
      rentalTables: actual.length,
    }),
  );
} finally {
  if (source.isInitialized) await source.destroy();
}
