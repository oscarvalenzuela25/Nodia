import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DataSource } from 'typeorm';
import configuredDataSource from '../dist/config/data-source.js';
import { SelectSoleAiApiKey1791330000000 } from '../dist/migrations/1791330000000-SelectSoleAiApiKey.js';

// Targeted repair only; do not run unrelated pending migrations or read credentials.
const source = new DataSource({ ...configuredDataSource.options, migrations: [SelectSoleAiApiKey1791330000000] });
try {
  await source.initialize();
  const previous = await source.query('SELECT id, provider_id, is_selected, is_active, updated_at FROM ai_api_keys ORDER BY id');
  const directory = join(process.env.LOCALAPPDATA ?? homedir(), 'Nodia', 'backups');
  await mkdir(directory, { recursive: true });
  const backup = join(directory, `ai-key-selection-${new Date().toISOString().replaceAll(':', '-')}.json`);
  await writeFile(backup, JSON.stringify(previous, null, 2), { flag: 'wx' });
  await source.runMigrations({ transaction: 'all' });
  const invalid = await source.query(`SELECT COUNT(*) AS count FROM ai_api_keys k WHERE k.is_active AND NOT k.is_selected
    AND (SELECT COUNT(*) FROM ai_api_keys pool WHERE pool.provider_id = k.provider_id) = 1`);
  if (Number(invalid[0].count) !== 0) throw new Error('Sole active key repair did not preserve the invariant.');
  const columns = await source.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'ai_providers' ORDER BY ordinal_position`);
  console.log(`Selection backup: ${backup}; ${previous.length} key rows preserved.`);
  console.log(`Provider columns: ${columns.map(row => row.column_name).join(', ')}`);
} finally { if (source.isInitialized) await source.destroy(); }
