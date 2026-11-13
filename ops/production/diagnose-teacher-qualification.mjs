#!/usr/bin/env node
// Metadata-only operator diagnostic. Never bootstrap the app, observe a provider or qualify a selection.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const releasePath = '/opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc';
export const postgresHelperPath = '/usr/local/lib/nodia/inspect-postgres-installation-d720a261ddb9d414949b395c6a10fcb05faccf67b57ac48bbaf3072f189d05d3.mjs';
export const pins = Object.freeze({
  'release-manifest.json': 'cf9fe8f3ac74522a60c9438ad54ebca21c2bafb2189107e15eeae7a460fc4ceb',
  'dist/nodia-ai-conversation/use-case/nodia-ai-configured-selection.js': 'd0aec01156121bfe85f09569c31620faac1ae5a3a46adb3d4c90c5987f08a72e',
  'dist/ai-generation/agentic-text-contract.js': 'd199eab41c3b6ff7c6329cfa1350793c0741b254204dbf2c5a9bcee9b9377ed4',
  'dist/ai-generation/teacher-agentic-text.service.js': '919b80f1af9e5b0083e151a372986562b1431d1b7afab7b4bba436af32e90faf',
});
const fail = code => { throw Object.assign(new Error('Teacher diagnostic rejected'), { code }); };
const ensure = (condition, code = 'metadata_invalid') => { if (!condition) fail(code); };
const integer = value => {
  ensure(/^(?:0|[1-9][0-9]*)$/.test(String(value)));
  const result = Number(value); ensure(Number.isSafeInteger(result)); return result;
};
const flags = Object.freeze({ read_only_requested: true, live_runtime_observed: false, inference_requested: false,
  qualification_requested: false, migrations_requested: false, application_services_changed: false });
export const tableNames = Object.freeze(['ai_generation_agentic_qualifications', 'teacher_purpose_qualifications']);
export const tablesSql = `SELECT to_regclass('public.ai_generation_agentic_qualifications') IS NOT NULL AS agentic,
  to_regclass('public.teacher_purpose_qualifications') IS NOT NULL AS purpose,
  to_regclass('public.ai_providers') IS NOT NULL AS providers,
  to_regclass('public.ai_provider_catalog') IS NOT NULL AS catalogs`;
export const connectionsSql = `SELECT p.id::text,c.key AS provider_key,p.fields,p.updated_at
  FROM public.ai_providers p JOIN public.ai_provider_catalog c ON c.id=p.catalog_id
  WHERE p.is_active=true AND c.is_active=true AND p.use_agentic=true AND c.can_use_agentic=true
    AND c.key IN ('openai','gemini') ORDER BY p.id LIMIT 101`;

export function qualificationCountsSql(table) {
  ensure(tableNames.includes(table), 'table_invalid');
  const exact = table === tableNames[0] ? 'selection_hash=$1' : 'selection_snapshot=$1::jsonb';
  return `SELECT count(*) FILTER (WHERE ${exact})::text AS exact_selection,
    count(*) FILTER (WHERE ${exact} AND configuration_generation=$2)::text AS current_configuration
    FROM public.${table}`;
}
export function deriveSelectionReport(row, selection, generation, counts) {
  ensure(typeof row.id === 'string' && /^[1-9][0-9]{0,18}$/.test(row.id));
  ensure(['openai', 'gemini'].includes(row.provider_key));
  ensure(selection === null || (selection.connection_id === row.id && selection.mode === 'agentic'
    && typeof selection.model_id === 'string' && Buffer.byteLength(selection.model_id) <= 1024
    && (selection.effort_id === null || (typeof selection.effort_id === 'string' && Buffer.byteLength(selection.effort_id) <= 256))));
  ensure(/^[a-f0-9]{64}$/.test(generation));
  const parsed = Object.fromEntries(tableNames.map(name => {
    const value = counts[name];
    if (value === null) return [name, null];
    const exact = integer(value.exact_selection), current = integer(value.current_configuration);
    ensure(current <= exact);
    return [name, { exact_selection: exact, current_configuration: current }];
  }));
  const transport = parsed[tableNames[0]];
  return { connection_id: row.id, provider_key: row.provider_key, configured_selection: selection === null ? null : {
    connection_id: selection.connection_id, mode: 'agentic', model_id: selection.model_id, effort_id: selection.effort_id },
  counts: parsed, finding: selection === null ? 'no_configured_selection' : transport === null ? 'qualification_table_missing'
    : transport.exact_selection === 0 ? 'no_receipt_for_configured_selection'
      : transport.current_configuration === 0 ? 'no_receipt_for_current_configuration'
        : 'stored_receipt_exists_live_epoch_not_checked' };
}

/** Only SELECT plus transaction-local limits. No provider ports or application runtime are constructed. */
export async function inspectQualificationMetadata(client, { configuredSelection, agenticHash, database }) {
  let transaction = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); transaction = true;
    await client.query("SET LOCAL statement_timeout='5000ms'");
    await client.query("SET LOCAL lock_timeout='1000ms'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout='15000ms'");
    const metadata = await client.query(`SELECT current_setting('transaction_read_only') AS read_only,
      current_database()=$1 AS database_matched`, [database]);
    const stream = client.connection?.stream;
    ensure(stream?.encrypted === true && stream?.authorized === true
      && ['TLSv1.2', 'TLSv1.3'].includes(stream.getProtocol?.()), 'tls_invalid');
    ensure(metadata.rowCount === 1 && metadata.rows[0].read_only === 'on' && metadata.rows[0].database_matched === true,
      'read_only_not_confirmed');
    const tablesResult = await client.query(tablesSql);
    ensure(tablesResult.rowCount === 1 && ['agentic', 'purpose', 'providers', 'catalogs']
      .every(key => typeof tablesResult.rows[0][key] === 'boolean'));
    const tables = tablesResult.rows[0];
    const totals = {};
    for (const [index, name] of tableNames.entries()) {
      const present = index === 0 ? tables.agentic : tables.purpose;
      totals[name] = { present, total: null };
      if (present) {
        const result = await client.query(`SELECT count(*)::text AS total FROM public.${name}`);
        ensure(result.rowCount === 1); totals[name].total = integer(result.rows[0].total);
      }
    }
    const reports = [];
    if (tables.providers && tables.catalogs) {
      const rows = await client.query(connectionsSql);
      ensure(rows.rows.length <= 100, 'active_connection_limit_exceeded');
      for (const row of rows.rows) {
        const selection = configuredSelection(row, 'agentic');
        // Formula is pinned to TeacherAgenticTextService.selected() in the installed f01 release.
        const generation = agenticHash({ connection_id: row.id, provider_key: row.provider_key, mode: 'agentic',
          fields: row.fields !== null && typeof row.fields === 'object' && !Array.isArray(row.fields)
            ? row.fields.agentic ?? null : null, updated_at: row.updated_at, enabled: true });
        const counts = Object.fromEntries(tableNames.map(name => [name, null]));
        for (const name of tableNames) {
          if (!totals[name].present || selection === null) continue;
          const parameter = name === tableNames[0] ? agenticHash(selection) : JSON.stringify(selection);
          const counted = await client.query(qualificationCountsSql(name), [parameter, generation]);
          ensure(counted.rowCount === 1); counts[name] = counted.rows[0];
          ensure(integer(counted.rows[0].exact_selection) <= totals[name].total);
        }
        reports.push(deriveSelectionReport(row, selection, generation, counts));
      }
    }
    return { schema_version: 1, status: 'inspected', release_id: releasePath.split('/').at(-1), ...flags, read_only: true,
      client_tls_authorized: true, client_tls_protocol: stream.getProtocol(), tables: {
        ai_providers: tables.providers, ai_provider_catalog: tables.catalogs, ...totals },
      active_connection_count: reports.length, connections: reports,
      limits: ['Configured selections only; a Teacher session may select another tuple.',
        'Counts do not validate receipts, live session/runtime epochs or purpose eligibility.',
        'Authentication, inference and qualification were not requested.'] };
  } finally {
    if (transaction) await client.query('ROLLBACK');
  }
}

async function protectedFile(path, expected) {
  ensure(await realpath(path) === path, 'unsafe_code_path');
  const info = await lstat(path);
  ensure(info.isFile() && info.uid === 0 && info.nlink === 1 && !(info.mode & 0o022)
    && info.size <= 8 * 1024 * 1024, 'unsafe_code_file');
  for (let directory = dirname(path);;) {
    const parent = await lstat(directory);
    ensure(parent.isDirectory() && !parent.isSymbolicLink() && parent.uid === 0 && !(parent.mode & 0o022), 'unsafe_code_parent');
    if (directory === '/') break; directory = dirname(directory);
  }
  ensure(createHash('sha256').update(await readFile(path)).digest('hex') === expected, 'installed_code_digest_mismatch');
}

export async function runDiagnostic() {
  ensure(process.platform === 'linux' && process.getuid() !== 0 && process.argv.length === 2, 'execution_context_invalid');
  ensure(await realpath('/opt/nodia/current') === releasePath && await realpath(process.cwd()) === releasePath, 'release_changed');
  for (const [relative, digest] of Object.entries(pins)) await protectedFile(`${releasePath}/${relative}`, digest);
  await protectedFile(postgresHelperPath, 'd720a261ddb9d414949b395c6a10fcb05faccf67b57ac48bbaf3072f189d05d3');
  const { validatePostgresEnvironment } = await import(pathToFileURL(postgresHelperPath));
  const configuration = validatePostgresEnvironment(process.env);
  const { configuredNodiaAiSelection } = await import(pathToFileURL(`${releasePath}/dist/nodia-ai-conversation/use-case/nodia-ai-configured-selection.js`));
  const { agenticHash } = await import(pathToFileURL(`${releasePath}/dist/ai-generation/agentic-text-contract.js`));
  const require = createRequire(`${releasePath}/package.json`);
  const { Client } = require('pg');
  const client = new Client({ ...configuration, sslnegotiation: 'postgres',
    ssl: { rejectUnauthorized: true, servername: configuration.host, ca: await readFile('/etc/ssl/certs/ca-certificates.crt', 'utf8') },
    application_name: 'nodia-teacher-qualification-read-only', connectionTimeoutMillis: 10000,
    query_timeout: 10000, statement_timeout: 5000,
    options: '-c default_transaction_read_only=on -c lock_timeout=1000' });
  client.on('error', () => {});
  try {
    await client.connect();
    return await inspectQualificationMetadata(client, { configuredSelection: configuredNodiaAiSelection, agenticHash, database: configuration.database });
  } finally {
    let timer;
    await Promise.race([client.end().catch(() => {}), new Promise(resolveEnd => { timer = setTimeout(resolveEnd, 2000); })]);
    clearTimeout(timer); client.connection?.stream?.destroy();
  }
}
export function safeDiagnosticFailure(error) {
  const ownCodes = ['metadata_invalid', 'table_invalid', 'tls_invalid', 'read_only_not_confirmed', 'active_connection_limit_exceeded',
    'unsafe_code_path', 'unsafe_code_file', 'unsafe_code_parent', 'installed_code_digest_mismatch', 'execution_context_invalid', 'release_changed'];
  return { schema_version: 1, status: 'failed', error_code: ownCodes.includes(error?.code) ? error.code : 'diagnostic_failed', ...flags };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try { result = await runDiagnostic(); } catch (error) { result = safeDiagnosticFailure(error); }
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'inspected' ? 0 : 1;
}
