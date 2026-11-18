import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { DataSource } from 'typeorm';
import {
  migrationInventory,
  persistedEntitySchemaPresent,
  quiescenceSql,
  quiescentCounters,
  validateHistory,
} from '../../../ops/production/update-backend-action.mjs';

const migrationTimestamp = '1793730000000';
const migrationName = `CreateBusinessShoppingLists${migrationTimestamp}`;
const tables = [
  'business_shopping_lists',
  'business_shopping_list_items',
  'business_shopping_list_create_requests',
];

export async function verifyMarketListsUpgrade(cleanDb, options, check) {
  const migrationsDirectory = new URL(
    '../../dist/migrations/',
    import.meta.url,
  );
  const manifest = { schema_version: 1, files: [] };
  for (const filename of (await readdir(migrationsDirectory)).filter((name) =>
    name.endsWith('.js'),
  )) {
    const bytes = await readFile(new URL(filename, migrationsDirectory));
    manifest.files.push({
      path: `dist/migrations/${filename}`,
      type: 'file',
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  const inventory = migrationInventory(manifest);
  const previous = inventory.filter(
    (entry) => entry.timestamp < migrationTimestamp,
  );
  const listRelease = inventory.filter(
    (entry) => entry.timestamp <= migrationTimestamp,
  );
  assert.equal(
    previous.length,
    56,
    'Previous production release migration count',
  );
  assert.equal(listRelease.at(-1)?.name, migrationName);
  const historicalPaths = new Set(previous.map((entry) => entry.path));
  const oldManifest = {
    ...manifest,
    files: manifest.files.filter((file) => historicalPaths.has(file.path)),
  };

  await cleanDb.query('CREATE DATABASE market_lists_upgrade');
  const upgradeOptions = {
    ...options,
    database: 'market_lists_upgrade',
    migrationsTransactionMode: 'all',
  };
  const previousMigrations = await Promise.all(
    previous.map(async (entry) => {
      const compiled = await import(
        new URL(entry.path.split('/').at(-1), migrationsDirectory).href
      );
      return compiled[entry.name];
    }),
  );
  const baseline = new DataSource({
    ...upgradeOptions,
    entities: [],
    migrations: previousMigrations,
  });
  const listMigration = await import(
    new URL(listRelease.at(-1).path.split('/').at(-1), migrationsDirectory).href
  );
  const listsOnly = new DataSource({
    ...upgradeOptions,
    entities: [],
    migrations: [...previousMigrations, listMigration[migrationName]],
  });
  const candidate = new DataSource(upgradeOptions);
  try {
    await baseline.initialize();
    assert.equal(
      (await baseline.runMigrations({ transaction: 'all' })).length,
      previous.length,
    );
    const [{ id: ownerId }] =
      await baseline.query(`INSERT INTO users(email,name)
      VALUES('market-upgrade@example.invalid','Market upgrade') RETURNING id`);
    const [{ id: businessId }] = await baseline.query(
      `INSERT INTO businesses(name,owner_id)
      VALUES('Preserved business',$1) RETURNING id`,
      [ownerId],
    );
    await baseline.query(
      `INSERT INTO products(business_id,name,cost_price,cost_price_tax,sale_price)
      VALUES($1,'Preserved product',100,119,150)`,
      [businessId],
    );
    await baseline.query(
      `INSERT INTO business_cash_categories(business_id,name,normalized_name,description,created_by,updated_by)
      VALUES($1,'Preserved category','preserved category','Existing category',$2,$2)`,
      [businessId, ownerId],
    );
    const existingRows = (connection) =>
      connection.query(
        `SELECT to_jsonb(u) AS owner,
      to_jsonb(b) AS business,to_jsonb(p) AS product,to_jsonb(c) AS category FROM businesses b
      JOIN users u ON u.id=b.owner_id JOIN products p ON p.business_id=b.id
      JOIN business_cash_categories c ON c.business_id=b.id WHERE b.id=$1`,
        [businessId],
      );
    const rowsBefore = await existingRows(baseline);
    assert.equal(rowsBefore.length, 1);
    await baseline.destroy();

    await candidate.initialize();
    const ledger = () =>
      candidate.query(
        'SELECT timestamp::text AS timestamp,name FROM public.migrations ORDER BY id',
      );
    const before = await ledger();
    const pending = inventory.slice(previous.length).map((entry) => entry.name);
    check(
      validateHistory(oldManifest, manifest, before).pending ===
        pending.length &&
        quiescentCounters((await candidate.query(quiescenceSql))[0]).quiescent,
      'Production precheck accepts the appended migration inventory against the previous ledger',
    );

    // A late schema conflict must leave both the previously valid ledger and SQL intact.
    await candidate.query(
      'CREATE TABLE business_shopping_list_create_requests (marker text PRIMARY KEY)',
    );
    await candidate.query(
      "INSERT INTO business_shopping_list_create_requests VALUES ('preserve')",
    );
    await assert.rejects(
      candidate.runMigrations({ transaction: 'all' }),
      (error) => error.code === '42P07',
    );
    assert.deepEqual(await ledger(), before);
    const [{ lists, items }] =
      await candidate.query(`SELECT to_regclass('public.business_shopping_lists') AS lists,
      to_regclass('public.business_shopping_list_items') AS items`);
    check(
      lists === null &&
        items === null &&
        (
          await candidate.query(
            'SELECT marker FROM business_shopping_list_create_requests',
          )
        )[0].marker === 'preserve',
      'Late DDL conflict preserves the old ledger, previous tables and the conflicting fixture',
    );
    assert.deepEqual(await existingRows(candidate), rowsBefore);
    await candidate.query('DROP TABLE business_shopping_list_create_requests');

    await listsOnly.initialize();
    assert.deepEqual(
      (await listsOnly.runMigrations({ transaction: 'all' })).map(
        (migration) => migration.name,
      ),
      [migrationName],
    );
    const listLedger = await ledger();
    const listId = randomUUID();
    await listsOnly.query(
      'INSERT INTO business_shopping_lists(id,business_id,name) VALUES ($1,$2,$3)',
      [listId, businessId, 'Preserved list'],
    );
    await assert.rejects(
      listsOnly.undoLastMigration({ transaction: 'all' }),
      /rollback.*(lose_data|has_data)/,
    );
    assert.deepEqual(await ledger(), listLedger);
    const retained = await listsOnly.query(
      'SELECT id FROM business_shopping_lists WHERE id=$1',
      [listId],
    );
    check(
      retained[0]?.id === listId,
      'Populated rollback preserves the list and ledger',
    );
    await listsOnly.query('DELETE FROM business_shopping_lists WHERE id=$1', [
      listId,
    ]);
    await listsOnly.undoLastMigration({ transaction: 'all' });
    assert.deepEqual(await ledger(), before);
    const schemaTables = await listsOnly.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
    );
    check(
      tables.every(
        (table) => !schemaTables.some((row) => row.table_name === table),
      ),
      'Empty rollback removes only the Market Lists migration',
    );
    assert.deepEqual(await existingRows(candidate), rowsBefore);
    await listsOnly.destroy();

    assert.deepEqual(
      (await candidate.runMigrations({ transaction: 'all' })).map(
        (migration) => migration.name,
      ),
      pending,
    );
    const after = await ledger();
    check(
      validateHistory(oldManifest, manifest, after, { after: true }).pending ===
        0 &&
        (await candidate.runMigrations({ transaction: 'all' })).length === 0,
      'Production postcheck accepts the exact applied ledger and a second ORM run makes no changes',
    );
    assert.deepEqual(await existingRows(candidate), rowsBefore);
    const columns = (connection) =>
      connection.query(`SELECT table_name,column_name,data_type,is_nullable,
      character_maximum_length,numeric_precision,numeric_scale,column_default FROM information_schema.columns
      WHERE table_schema='public' ORDER BY table_name,ordinal_position`);
    const upgradeColumns = await columns(candidate);
    check(
      persistedEntitySchemaPresent(candidate.entityMetadatas, upgradeColumns),
      'Production schema verifier finds every persisted column of existing and Market Lists entities',
    );
    const newColumns = (source) =>
      source.filter((column) => tables.includes(column.table_name));
    const marketColumns = newColumns(upgradeColumns);
    assert.deepEqual(marketColumns, newColumns(await columns(cleanDb)));
    const marketEntities = candidate.entityMetadatas.filter((entity) =>
      tables.includes(entity.tableName),
    );
    assert.equal(marketEntities.length, tables.length);
    for (const entity of marketEntities) {
      const metadata = entity.columns.filter(
        (column) => !column.isVirtualProperty,
      );
      const persisted = marketColumns.filter(
        (column) => column.table_name === entity.tableName,
      );
      assert.equal(metadata.length, persisted.length);
      for (const column of metadata) {
        const actual = persisted.find(
          (value) => value.column_name === column.databaseName,
        );
        assert.ok(actual, `${entity.tableName}.${column.databaseName}`);
        assert.equal(actual.data_type, candidate.driver.normalizeType(column));
        assert.equal(actual.is_nullable, column.isNullable ? 'YES' : 'NO');
        if (column.length)
          assert.equal(actual.character_maximum_length, Number(column.length));
        if (column.precision !== undefined)
          assert.equal(actual.numeric_precision, column.precision);
        if (column.scale !== undefined)
          assert.equal(actual.numeric_scale, column.scale);
      }
    }
    check(
      true,
      'Clean and upgraded Market Lists schema match, including ORM types, nullability and quantity precision',
    );
  } finally {
    if (candidate.isInitialized) await candidate.destroy();
    if (listsOnly.isInitialized) await listsOnly.destroy();
    if (baseline.isInitialized) await baseline.destroy();
  }
}
