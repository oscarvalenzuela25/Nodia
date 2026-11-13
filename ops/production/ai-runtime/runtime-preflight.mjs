// Read-only bounded inventory in the installed release, as nodia. No AppModule,
// provider call, migration, seed, admission change, or recovery operation.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { quiescenceSql, quiescentCounters } from '../update-backend-action.mjs';

async function main() {
  if (process.getuid() === 0 || process.env.PGSSLMODE !== 'verify-full') throw new Error('private_identity_required');
  const require = createRequire('/opt/nodia/current/package.json');
  const { Client } = require('pg');
  const db = new Client({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
    connectionTimeoutMillis: 10000, query_timeout: 15000, statement_timeout: 15000,
    application_name: 'nodia-ai-runtime-preflight' });
  db.on('error', () => {});
  try {
    await db.connect();
    if (!db.connection.stream.authorized || !['TLSv1.2', 'TLSv1.3'].includes(db.connection.stream.getProtocol?.())) {
      throw new Error('tls_not_verified');
    }
    await db.query('BEGIN READ ONLY');
    // Reuse the installed CD quiescence contract exactly, including Teacher.
    // Missing tables or columns fail closed; no legacy-schema bypass.
    const runtime = quiescentCounters((await db.query(quiescenceSql)).rows[0]);
    await db.query('ROLLBACK');
    console.log(JSON.stringify({ schema_version: 1, status: 'inspected', ...runtime,
      client_tls_authorized: true, read_only: true, provider_calls: 0 }));
    if (!runtime.quiescent) process.exitCode = 2;
  } finally { await db.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); }
  catch { console.log(JSON.stringify({ status: 'failed', error_code: 'runtime_preflight_failed', read_only: true })); process.exitCode = 1; }
}
