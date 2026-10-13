import 'dotenv/config';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Explicit, one-off reset after the bucket change. No storage calls or CASCADE.
const db = new pg.Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT), database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD });
const deleted = ['invoice_items', 'product_logs', 'products', 'invoices', 'invoice_uploads'];
const preserved = ['providers', 'personal_info_provider'];
const snapshot = async (table) => (await db.query(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).rows.map(({ row }) => row);
const hash = (rows) => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
if (!process.argv.includes('--apply')) throw new Error('Destructive reset requires --apply. Use only after an explicit user request and review the table scope.');
try {
  await db.connect();
  await db.query('BEGIN');
  await db.query("SET LOCAL lock_timeout = '10s'");
  await db.query(`LOCK TABLE ${[...deleted, ...preserved].map((t) => `public.${t}`).join(', ')} IN ACCESS EXCLUSIVE MODE`);
  const tables = {};
  for (const table of [...deleted, ...preserved]) tables[table] = await snapshot(table);
  const directory = join(process.env.LOCALAPPDATA, 'Nodia', 'backups');
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `before-business-inventory-reset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(path, JSON.stringify({ format: 1, reason: 'User-requested reset after bucket replacement', tables }, null, 2), { flag: 'wx' });
  // Exact scoped backup and preservation checks happen before commit.
  for (const table of deleted) await db.query(`DELETE FROM public.${table}`);
  for (const table of preserved) if (hash(await snapshot(table)) !== hash(tables[table])) throw new Error(`Preservation check failed: ${table}`);
  for (const table of deleted) if ((await snapshot(table)).length !== 0) throw new Error(`Reset check failed: ${table}`);
  await db.query('COMMIT');
  console.log(JSON.stringify({ backup: path, deleted: Object.fromEntries(deleted.map((t) => [t, tables[t].length])), preserved: Object.fromEntries(preserved.map((t) => [t, { count: tables[t].length, sha256: hash(tables[t]) }])) }, null, 2));
} catch (error) { await db.query('ROLLBACK'); throw error; }
finally { await db.end(); }
