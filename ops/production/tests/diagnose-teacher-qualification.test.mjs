import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deriveSelectionReport, inspectQualificationMetadata, qualificationCountsSql, connectionsSql,
  tableNames, tablesSql, safeDiagnosticFailure } from '../diagnose-teacher-qualification.mjs';

const row = { id: '7', provider_key: 'openai', fields: { agentic: { selected_model: 'synthetic-model',
  thinking_level: 'reported-effort', private_value: 'synthetic-never-publish' } }, updated_at: new Date('2026-11-13T01:00:00Z') };
const selection = { connection_id: '7', mode: 'agentic', model_id: 'synthetic-model', effort_id: 'reported-effort' };
const digest = 'a'.repeat(64);
const counted = (exact, current) => ({ exact_selection: String(exact), current_configuration: String(current) });
const counts = (exact, current) => ({ [tableNames[0]]: counted(exact, current), [tableNames[1]]: null });
test('distinguishes missing receipts from stale configuration without claiming eligibility', () => {
  assert.equal(deriveSelectionReport(row, selection, digest, counts(0, 0)).finding, 'no_receipt_for_configured_selection');
  assert.equal(deriveSelectionReport(row, selection, digest, counts(4, 0)).finding, 'no_receipt_for_current_configuration');
  const current = deriveSelectionReport(row, selection, digest, counts(4, 2));
  assert.equal(current.finding, 'stored_receipt_exists_live_epoch_not_checked');
  assert.equal('eligible' in current, false);
  assert.equal(JSON.stringify(current).includes('synthetic-never-publish'), false);
  assert.equal(JSON.stringify(current).includes(digest), false);
  assert.equal(deriveSelectionReport(row, selection, digest, Object.fromEntries(tableNames.map(n => [n, null]))).finding, 'qualification_table_missing');
  assert.equal(deriveSelectionReport(row, null, digest, Object.fromEntries(tableNames.map(n => [n, null]))).finding, 'no_configured_selection');
});
test('rejects impossible or unbounded metadata and table injection', () => {
  for (const value of [counts(-1, 0), counts(0, 1), counts('9007199254740992', 0)])
    assert.throws(() => deriveSelectionReport(row, selection, digest, value));
  assert.throws(() => deriveSelectionReport(row, { ...selection, connection_id: '8' }, digest, counts(0, 0)));
  assert.throws(() => qualificationCountsSql('ai_providers; DELETE FROM x'));
});
function fixture({ missing = false, empty = false, failCounts = false, readonly = true, authorized = true, many = false } = {}) {
  const queries = [], hashes = [];
  const client = { connection: { stream: { encrypted: true, authorized, getProtocol: () => 'TLSv1.3' } },
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('BEGIN') || sql.startsWith('SET LOCAL') || sql === 'ROLLBACK') return {};
      if (sql.includes("current_setting('transaction_read_only')")) return { rowCount: 1, rows: [{ read_only: readonly ? 'on' : 'off', database_matched: true }] };
      if (sql === tablesSql) return { rowCount: 1, rows: [{ agentic: !missing, purpose: !missing, providers: true, catalogs: true }] };
      if (sql === connectionsSql) return { rows: empty ? [] : many ? Array(101).fill(row) : [row] };
      if (sql.startsWith('SELECT count(*)::text')) return { rowCount: 1, rows: [{ total: '5' }] };
      if (sql.startsWith('SELECT count(*) FILTER')) {
        if (failCounts) throw Object.assign(new Error('synthetic password must never appear'), { code: '42501' });
        return { rowCount: 1, rows: [counted(3, 0)] };
      }
      throw Error('Unexpected SQL');
    } };
  return { client, queries, hashes, dependencies: {
    database: 'synthetic-db', configuredSelection: (data, mode) => { assert.equal(data, row); assert.equal(mode, 'agentic'); return selection; },
    agenticHash: value => { hashes.push(value); return createHash('sha256').update(JSON.stringify(value)).digest('hex'); } } };
}
test('queries exact selection and current generation in a bounded read-only transaction, redacts private fields', async () => {
  const f = fixture(); const report = await inspectQualificationMetadata(f.client, f.dependencies);
  assert.equal(f.queries[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(f.queries.at(-1).sql, 'ROLLBACK');
  assert.ok(f.queries.every(q => /^(SELECT|BEGIN|SET LOCAL|ROLLBACK)\b/.test(q.sql)));
  assert.ok(f.queries.some(q => q.sql.includes("statement_timeout='5000ms'")));
  assert.match(connectionsSql, /LIMIT 101/);
  const formula = f.hashes.find(value => value.updated_at);
  assert.deepEqual(formula, { connection_id: row.id, provider_key: row.provider_key, mode: 'agentic',
    fields: row.fields.agentic, updated_at: row.updated_at, enabled: true });
  const queries = f.queries.filter(q => q.sql.startsWith('SELECT count(*) FILTER'));
  assert.match(queries[0].sql, /selection_hash=\$1/);
  assert.match(queries[1].sql, /selection_snapshot=\$1::jsonb/);
  assert.equal(queries[1].params[0], JSON.stringify(selection));
  assert.equal(queries[0].params[1], queries[1].params[1]);
  assert.equal(report.tables[tableNames[0]].total, 5);
  assert.equal(report.connections[0].finding, 'no_receipt_for_current_configuration');
  assert.equal(report.read_only, true); assert.equal(report.inference_requested, false);
  assert.equal(JSON.stringify(report).includes('synthetic-never-publish'), false);
  assert.equal(JSON.stringify(report).includes('synthetic-db'), false);
});
test('missing tables are facts and never trigger qualification queries or schema repair', async () => {
  const f = fixture({ missing: true }); const report = await inspectQualificationMetadata(f.client, f.dependencies);
  assert.deepEqual(report.tables[tableNames[0]], { present: false, total: null });
  assert.equal(report.connections[0].finding, 'qualification_table_missing');
  assert.equal(f.queries.some(q => q.sql.startsWith('SELECT count(*)')), false);
});
test('no active connections produces an explicit empty inventory', async () => {
  const f = fixture({ empty: true }); const report = await inspectQualificationMetadata(f.client, f.dependencies);
  assert.equal(report.active_connection_count, 0); assert.deepEqual(report.connections, []);
});
test('query failure, nonreadonly transaction, unverified TLS and overflow always rollback', async () => {
  for (const options of [{ failCounts: true }, { readonly: false }, { authorized: false }, { many: true }]) {
    const f = fixture(options);
    await assert.rejects(inspectQualificationMetadata(f.client, f.dependencies));
    assert.equal(f.queries.at(-1).sql, 'ROLLBACK');
  }
  const redacted = safeDiagnosticFailure({ code: '42501', message: 'synthetic-secret', query: 'private-query' });
  assert.equal(redacted.error_code, 'diagnostic_failed'); assert.equal(JSON.stringify(redacted).includes('synthetic-secret'), false);
  assert.equal('read_only' in redacted, false);
});
