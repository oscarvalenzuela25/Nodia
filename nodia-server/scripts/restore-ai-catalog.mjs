import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DataSource } from 'typeorm';
import configuredDataSource from '../dist/config/data-source.js';
import { RestoreAiApiCatalog1791320000000 } from '../dist/migrations/1791320000000-RestoreAiApiCatalog.js';

// Explicit target command; never run other pending migrations or remove historical records.
const source = new DataSource({ ...configuredDataSource.options, migrations: [RestoreAiApiCatalog1791320000000] });
try {
  await source.initialize();
  const runner = source.createQueryRunner();
  try {
    const table = await runner.getTable('ai_provider_catalog');
    if (!table?.columns.some((column) => column.name === 'key' && column.isUnique)
      && !table?.uniques.some((unique) => unique.columnNames.length === 1 && unique.columnNames[0] === 'key')) {
      throw new Error('An existing catalog with a unique canonical key is required.');
    }
    const previous = await runner.query('SELECT * FROM ai_provider_catalog ORDER BY id');
    const directory = join(process.env.LOCALAPPDATA ?? homedir(), 'Nodia', 'backups');
    await mkdir(directory, { recursive: true });
    const backup = join(directory, `ai-catalog-${new Date().toISOString().replaceAll(':', '-')}.json`);
    await writeFile(backup, JSON.stringify(previous, null, 2), { flag: 'wx' });
    console.log(`Catalog backup: ${backup}`);
  } finally { await runner.release(); }
  await source.runMigrations({ transaction: 'all' });
  const rows = await source.query('SELECT id, key, name, can_use_api_key, can_use_token_plan_web, can_use_token_plan_agentic, is_active FROM ai_provider_catalog ORDER BY id');
  console.log(JSON.stringify(rows, null, 2));
} finally { if (source.isInitialized) await source.destroy(); }
