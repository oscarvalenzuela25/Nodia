// Operator-only external journal control. Never imported by API/MCP.
import 'reflect-metadata';
import { mkdir, open } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { loadNodiaAiExternalRecoveryConfig, createNodiaAiExternalRecovery } from '../dist/nodia-ai-recovery/nodia-ai-external-recovery.factory.js';
import { ReconcileNodiaAiDeletionJournalUseCase } from '../dist/nodia-ai-recovery/use-case/reconcile-nodia-ai-deletion-journal.use-case.js';
import { loadNodiaAiBackupConfiguration } from './nodia-ai-backups.mjs';

const fail = code => { throw Error(`nodia_ai:recovery_${code}`); };
function assertStopped() {
  for (const unit of ['nodia-api', 'nodia-ai-worker']) {
    const result = spawnSync('/usr/bin/systemctl', ['show', unit, '--property=ActiveState', '--property=MainPID', '--no-pager'], { encoding: 'utf8', timeout: 5000 });
    const values = Object.fromEntries((result.stdout ?? '').trim().split('\n').map(line => line.split('=')));
    if (result.status !== 0 || !['inactive', 'failed'].includes(values.ActiveState) || values.MainPID !== '0') fail('writers_not_quiescent');
  }
}
async function reconcile(store, configFile) {
  const config = await loadNodiaAiBackupConfiguration(configFile);
  const current = await store.snapshot();
  const pending = current.state.entries.filter(entry => entry.confirmed_at === null);
  if (!pending.length) return { confirmed: 0, pending: 0 };
  const db = new pg.Client({ host: config.database.host, port: config.database.port,
    user: config.database.username, password: config.database.password, database: config.database.database,
    connectionTimeoutMillis: 5000, query_timeout: 5000, application_name: 'nodia-ai-journal-reconcile-readonly' });
  let result;
  try {
    await db.connect();
    await db.query('BEGIN TRANSACTION READ ONLY');
    await db.query("SET LOCAL statement_timeout='5s'");
    const tables = { conversation: 'nodia_ai_conversations', attachment: 'nodia_ai_attachments', preference: 'nodia_ai_preferences' };
    result = await new ReconcileNodiaAiDeletionJournalUseCase().execute(pending, {
      async findExisting(kind, ids) {
        // Three closed table choices, at most 10,000 IDs total, one set read per
        // nonempty kind. No leading unresolved witness starves later entries.
        const found = await db.query(`SELECT id::text AS id FROM ${tables[kind]} WHERE id=ANY($1::uuid[])`, [ids]);
        return found.rows.map(row => row.id);
      },
    });
    await db.query('COMMIT');
  } finally { await db.end(); }
  if (result.confirmed.length) await store.confirmResources(result.confirmed);
  return { confirmed: result.confirmed.length, pending: result.pending };
}

let external;
try {
  if (process.platform !== 'linux') fail('linux_required');
  const [command, file, ...args] = process.argv.slice(2);
  if (!file || !['bootstrap', 'close', 'status', 'reconcile', 'export'].includes(command)) fail('arguments_invalid');
  external = createNodiaAiExternalRecovery(loadNodiaAiExternalRecoveryConfig(file));
  if (command === 'bootstrap') {
    if (args.length) fail('arguments_invalid');
    assertStopped();
    await external.store.initialize();
    process.stdout.write(JSON.stringify({ operation: command, initialized_new_era: true, historical_coverage_claimed: false }) + '\n');
  } else if (command === 'close') {
    if (args.length) fail('arguments_invalid');
    assertStopped(); await external.store.closeEra();
    process.stdout.write(JSON.stringify({ operation: command, closed: true, release_authorized: false }) + '\n');
  } else if (command === 'status') {
    if (args.length) fail('arguments_invalid');
    const { state } = await external.store.snapshot();
    process.stdout.write(JSON.stringify({ operation: command, coverage_from: state.coverage_from, updated_at: state.updated_at,
      first_sequence: state.first_sequence, last_sequence: state.last_sequence, entries: state.entries.length,
      unconfirmed: state.entries.filter(entry => entry.confirmed_at === null).length,
      coverage_closed_at: state.closed_at, backups: state.backups.length, expired_backups: state.backups.filter(entry => Date.parse(entry.expires_at) <= Date.now()).length,
      release_authorized: false }) + '\n');
  } else if (command === 'reconcile') {
    if (args.length !== 1) fail('arguments_invalid');
    const config = await loadNodiaAiBackupConfiguration(args[0]);
    if (resolve(config.recovery_config) !== resolve(file)) fail('configuration_invalid');
    const result = await reconcile(external.store, args[0]);
    process.stdout.write(JSON.stringify({ operation: command, ...result, SQL_writes: 0, release_authorized: false }) + '\n');
  } else {
    if (args.length !== 3) fail('arguments_invalid');
    assertStopped();
    const [backup, quarantinedAt, directory] = args;
    const output = await external.store.exportManifest(backup, quarantinedAt);
    if (!directory.startsWith('/')) fail('arguments_invalid');
    await mkdir(directory, { mode: 0o700 });
    for (const [name, value] of [['manifest.json', output.manifest], ['external-head.json', JSON.stringify(output.head)], ['metadata.json', JSON.stringify(output.metadata)]]) {
      const handle = await open(join(directory, name), 'wx', 0o600);
      try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
    }
    assertStopped();
    process.stdout.write(JSON.stringify({ operation: command, exported: true, last_sequence: output.head.last_sequence,
      release_authorized: false, historical_coverage_claimed: false }) + '\n');
  }
} catch (error) {
  const code = error instanceof Error && /^nodia_ai:[a-z0-9_]{1,100}$/u.test(error.message) ? error.message : 'nodia_ai:recovery_failed';
  process.stderr.write(code + '\n'); process.exitCode = 1;
} finally { external?.client.destroy(); }
