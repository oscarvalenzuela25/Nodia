// Actual compiled report use cases and PostgreSQL; only identities and records are synthetic.
// No configured database, AI provider, MCP publication or external inference is used.
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { seedAi30Reports } from './nodia-ai-ai30.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai30');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
let compiled, reportQueries = 0, failure;
const started = Date.now();
try {
  db.setOptions({ logging: ['query'], logger: {
    logQuery(query) { if (query.startsWith('WITH filtered AS MATERIALIZED')) reportQueries++; },
    logQueryError() {}, logQuerySlow() {}, logSchemaBuild() {}, logMigration() {}, log() {},
  } });
  const [Module, Run, Describe, Redis] = await Promise.all([
    loadAi('nodia-ai-reports/nodia-ai-reports.module', 'NodiaAiReportsModule'),
    loadAi('nodia-ai-reports/use-case/run-nodia-ai-report.use-case', 'RunNodiaAiReportUseCase'),
    loadAi('nodia-ai-reports/use-case/describe-nodia-ai-reports.use-case', 'DescribeNodiaAiReportsUseCase'),
    loadAi('common/redis/redis.service', 'RedisService'),
  ]);
  compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({
    useFactory: () => options, dataSourceFactory: async () => db,
  }), Module] }).overrideProvider(Redis).useValue({
    get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [],
  }).compile();
  const run = compiled.get(Run), describe = compiled.get(Describe);
  const seed = await seedAi30Reports(db);
  const [group] = await db.query("SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'");
  const moduleIds = new Map();
  for (const [key, route] of [['personal_finance', '/tools/finances-personal'], ['businesses', '/tools/business'], ['rental_reservations', '/tools/reservations']]) {
    let [module] = await db.query('SELECT id::text FROM modules WHERE link=$1', [route]);
    if (!module) [module] = await db.query('INSERT INTO modules(key,link,module_group_id) VALUES($1,$2,$3) RETURNING id::text', [key, route, group.id]);
    moduleIds.set(key, module.id);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [module.id]);
  }
  const catalog = await describe.execute(identities.get('1'));
  const version = catalog.catalog_version;
  check('compiled Nest module describes every registered current source without exposing physical SQL mappings',
    catalog.sources.length === 11 && typeof version === 'string' && !JSON.stringify(catalog).match(/expressionSql|fromSql|correlationSql|basePredicatesSql|idExpressionSql/));
  const instantPeriod = { kind: 'instant', dimension_key: 'created_at', from: '2027-01-01T03:00:00Z', to_exclusive: '2027-02-01T03:00:00Z', timezone: 'America/Santiago' };
  const civilPeriod = { kind: 'civil_date', dimension_key: 'incurred_on', from: '2027-01-01', to_exclusive: '2027-02-01', timezone: 'America/Santiago' };
  const finance = (extra = {}) => Object.fromEntries(Object.entries({ source_key: 'finance_movements', alias: 'personal', scope: {}, period: instantPeriod,
    measures: [{ measure_key: 'confirmed_expense_amount', aggregation: 'sum', output_key: 'amount' }, { measure_key: 'records', aggregation: 'count', output_key: 'count' }],
    filters: { all: [{ field_key: 'status', operator: 'eq', value: 'paid' }] }, ...extra }).filter(([, value]) => value !== undefined));
  const request = (source, extra = {}) => ({ catalog_version: version, combine: 'separate', sources: [source], ...extra });
  const execute = (source, actor = '1', extra = {}) => run.execute(identities.get(actor), request(source, extra));
  const error = async (name, invoke, expected = /invalid_input|unsupported_semantics|capability_denied|scope_denied|not_found|forbidden/) => {
    const before = reportQueries;
    await assert.rejects(invoke, (value) => expected.test(String(value?.message)));
    check(name, reportQueries === before);
  };
  const expectedCounts = { finance_movements: '7', finance_obligations: '0', business_invoices: '3', business_products: '3', business_product_logs: '6', business_providers: '1', rental_reservations: '0', rental_payments: '0', rental_refunds: '0', rental_expenses: '1', rental_blocks: '0' };
  for (const source of catalog.sources) {
    const scope = source.scope_kind === 'personal' ? {} : source.scope_kind === 'business' ? { business_id: seed.business } : { property_id: seed.properties[0] };
    const counted = await execute({ source_key: source.source_key, alias: 'smoke', scope, measures: [{ measure_key: 'records', aggregation: 'count', output_key: 'count' }] });
    check(`registered source ${source.source_key} executes its actual SQL mapping and exact record count`, counted.totals.count === expectedCounts[source.source_key] && counted.matched_records === expectedCounts[source.source_key]);
    for (const field of source.fields.filter(field => field.allowed_operators.includes('is_null'))) {
      const filtered = await execute({ source_key: source.source_key, alias: 'mapping', scope,
        filters: { all: [{ field_key: field.field_key, operator: 'is_null', value: true }] },
        measures: [{ measure_key: 'records', aggregation: 'count', output_key: 'count' }],
      });
      check(`SQL resolves registered field ${source.source_key}.${field.field_key} at its declared relation grain`,
        /^(0|[1-9][0-9]*)$/.test(filtered.matched_records) && filtered.totals.count === filtered.matched_records);
    }
    const allMeasures = source.measures.filter(measure => measure.supported).map((measure, index) => ({
      measure_key: measure.measure_key, aggregation: measure.aggregations[0], output_key: `value_${index}`,
    }));
    const measured = await execute({ source_key: source.source_key, alias: 'measures', scope,
      filters: { all: [{ field_key: 'id', operator: 'is_null', value: true }] }, measures: allMeasures,
    });
    check(`SQL resolves every supported measure of ${source.source_key} and emits genuine zero totals for a known empty population`,
      measured.matched_records === '0' && Object.keys(measured.totals).length === allMeasures.length && Object.values(measured.totals).every(value => value === '0'));
  }
  const result = await execute(finance());
  check('a single authorized SQL snapshot computes exact global amount and count over both January boundaries',
    result.totals.amount === '240' && result.totals.count === '3' && result.matched_records === '3' && result.rows.length === 1 && result.rows[0].includes('240'));
  check('report output carries logical provenance, period, exact string amounts and bounded rows',
    result.source_key === 'finance_movements' && result.source_alias === 'personal' && result.basis_key === 'created_at' && result.period.timezone === 'America/Santiago' && result.group_page_complete && result.next_cursor === null && Number.isFinite(Date.parse(result.observed_at)) && result.rows.every(row => row.length === result.columns.length));

  const related = finance({ filters: { all: [{ field_key: 'status', operator: 'eq', value: 'paid' }, { field_key: 'category_group_id', operator: 'in', values: seed.groups }] } });
  const overlap = await execute(related);
  check('overlapping one-to-many memberships preserve two separate equal amounts without SUM DISTINCT or multiplied records',
    overlap.totals.amount === '200' && overlap.totals.count === '2' && overlap.matched_records === '2');
  await db.query('UPDATE finance_category_group_memberships SET is_active=false WHERE user_id=1');
  const inactive = await execute(related);
  check('inactive related memberships produce real zero totals and zero matches', inactive.totals.amount === '0' && inactive.totals.count === '0' && inactive.matched_records === '0');
  await db.query('UPDATE finance_category_group_memberships SET is_active=true WHERE user_id=1');

  const large = await execute(finance({ period: undefined, filters: { all: [{ field_key: 'category_id', operator: 'eq', value: seed.categories[2] }] } }));
  check('bigint money above MAX SAFE INTEGER reaches the result as its exact decimal string', large.totals.amount === '9007199254740993' && large.rows[0].includes('9007199254740993'));
  const largeFilter = await execute(finance({ period: undefined, filters: { all: [{ field_key: 'recorded_amount', operator: 'gte', value: '9007199254740993' }] } }));
  check('a recorded amount predicate compares exact bigint decimal strings inside PostgreSQL', largeFilter.totals.amount === '9007199254740993' && largeFilter.matched_records === '1');
  const flat = await execute(finance({ filters: { all: [{ field_key: 'status', operator: 'eq', value: 'paid' }], any: [
    { field_key: 'category_id', operator: 'eq', value: seed.categories[0] }, { field_key: 'category_id', operator: 'eq', value: seed.categories[1] },
  ] } }));
  check('flat filter sets evaluate AND all with OR any, without broadening the authorized population', flat.totals.amount === '240' && flat.matched_records === '3');
  const grouped = finance({ group_by: [{ dimension_key: 'category_id', output_key: 'category' }] });
  const first = await execute(grouped, '1', { page_limit: 1 });
  check('the first group page is bounded while totals and matches include the complete filtered population', first.rows.length === 1 && first.totals.amount === '240' && first.matched_records === '3' && !first.group_page_complete && typeof first.next_cursor === 'string');
  const second = await execute(grouped, '1', { page_limit: 1, cursor: first.next_cursor });
  check('keyset pagination visits the remaining group with the same global totals and no duplicate group', second.rows.length === 1 && second.totals.amount === '240' && second.group_page_complete && second.next_cursor === null && first.rows[0][0] !== second.rows[0][0]);
  await error('a cursor bound to other filters cannot execute another report query', () => execute(finance({ ...grouped, filters: { all: [{ field_key: 'status', operator: 'eq', value: 'pending' }] } }), '1', { page_limit: 1, cursor: first.next_cursor }));

  await error('an ordinary actor cannot request another finance owner', () => execute(finance({ scope: { subject_user_id: '2' } })), /scope_denied|capability_denied|forbidden/);
  const global = await execute(finance({ scope: { subject_user_id: '2' } }), '3');
  check('super admin can explicitly inspect another owner without changing attribution', global.totals.amount === '700' && global.matched_records === '1' && global.scope.subject_user_id === '2');
  await error('a cursor from one owner cannot be reused by another owner even by super admin', () => execute({ ...grouped, scope: { subject_user_id: '2' } }, '3', { page_limit: 1, cursor: first.next_cursor }));

  const rental = (property, extra = {}) => ({ source_key: 'rental_expenses', alias: 'lodging', scope: { property_id: property }, period: civilPeriod,
    measures: [{ measure_key: 'amount', aggregation: 'sum', output_key: 'amount' }, { measure_key: 'records', aggregation: 'count', output_key: 'count' }], ...extra });
  check('rental owner reports use native property authority', (await execute(rental(seed.properties[0]))).totals.amount === '100');
  const civilGroup = await execute(rental(seed.properties[0], { group_by: [{ dimension_key: 'incurred_on', output_key: 'day' }, { dimension_key: 'category', output_key: 'category' }] }));
  check('registered date and text dimensions preserve civil dates and scalar string result types', civilGroup.rows[0][0] === '2027-01-15' && civilGroup.rows[0][1] === 'cleaning' && civilGroup.totals.amount === '100');
  const shared = await execute(rental(seed.properties[1], { group_by: [{ dimension_key: 'category', output_key: 'category' }] }));
  check('an active collaborator can report a shared property while a nullable dimension remains null', shared.totals.amount === '200' && shared.rows.length === 1 && shared.rows[0][0] === null);
  await error('a hidden property cannot be read by naming its report scope', () => execute(rental(seed.properties[2])), /not_found|forbidden|scope_denied|capability_denied/);
  check('super admin reports a hidden property with the same native policy', (await execute(rental(seed.properties[2]), '3')).totals.amount === '900');
  const nullDate = await execute(rental(seed.properties[1], { filters: { all: [{ field_key: 'paid_on', operator: 'is_null', value: true }] } }));
  check('nullable effective dates are filtered explicitly rather than coerced into an invented payment date', nullDate.matched_records === '1' && nullDate.totals.amount === '200');
  await db.query('UPDATE rental_collaborators SET is_active=false WHERE property_id=$1 AND user_id=1', [seed.properties[1]]);
  await error('collaborator revocation is reevaluated before a later report', () => execute(rental(seed.properties[1])), /not_found|forbidden|scope_denied|capability_denied/);
  await db.query('UPDATE rental_collaborators SET is_active=true WHERE property_id=$1 AND user_id=1', [seed.properties[1]]);

  const invoice = { source_key: 'business_invoices', alias: 'invoices', scope: { business_id: seed.business }, measures: [{ measure_key: 'records', aggregation: 'count', output_key: 'count' }] };
  check('business reporting preserves the approved global authenticated resource policy', (await execute(invoice)).totals.count === '3');
  const zero = await execute({ ...invoice, filters: { all: [{ field_key: 'code', operator: 'eq', value: 'AI30-zero' }] } });
  check('a zero-value invoice is still a real counted record', zero.totals.count === '1' && zero.matched_records === '1');
  await error('invoice money without a typed currency is unsupported instead of silently assuming CLP', () => execute({ ...invoice, measures: [{ measure_key: 'invoice_amount', aggregation: 'sum', output_key: 'amount' }] }), /unsupported_semantics/);
  await error('a legacy invoice timestamp is not presented as an instant with an invented timezone', () => execute({ ...invoice, period: instantPeriod }), /unsupported_semantics/);
  await error('an omitted rental scope asks for clarification rather than expanding to every property', () => execute(rental(seed.properties[0], { scope: {} })), /needs_clarification/);
  await error('an unknown source fails explicitly without manufacturing a zero total', () => execute({ ...invoice, source_key: 'unknown_source' }), /unsupported_semantics/);
  await error('an obsolete source catalog cannot execute a current mapping', () => execute(finance(), '1', { catalog_version: 'obsolete' }), /invalid_input/);
  await error('multiple separate sources await AI31 instead of pretending to share a snapshot', () => run.execute(identities.get('1'), { ...request(finance()), sources: [finance(), invoice] }), /unsupported_semantics/);
  const products = { source_key: 'business_products', alias: 'stock', scope: { business_id: seed.business }, filters: { all: [{ field_key: 'log_name', operator: 'eq', value: 'AI30 duplicate snapshot' }] }, measures: [{ measure_key: 'stock_units', aggregation: 'sum', output_key: 'stock' }, { measure_key: 'records', aggregation: 'count', output_key: 'count' }] };
  const snapshots = await execute(products);
  check('multiple historical snapshots preserve equal current stock values and a real zero-stock product', snapshots.totals.stock === '14' && snapshots.totals.count === '3');
  const productGroups = { ...products, group_by: [{ dimension_key: 'id', output_key: 'product' }] };
  const productFirst = await execute(productGroups, '1', { page_limit: 1 });
  const productSecond = await execute(productGroups, '1', { page_limit: 1, cursor: productFirst.next_cursor });
  check('bigint group IDs above MAX SAFE INTEGER survive JSON projection and keyset continuation exactly', productFirst.rows[0][0] === '9007199254740993' && productSecond.rows[0][0] === '9007199254740994' && productSecond.totals.stock === '14');

  for (const [name, source, extra] of [
    ['SQL properties', { ...finance(), sql: 'DROP TABLE finance_movements' }],
    ['SQL identifiers', finance({ filters: { all: [{ field_key: 'amount);DROP TABLE users;--', operator: 'eq', value: '1' }] } })],
    ['recursive filter expressions', finance({ filters: { all: [{ any: [{ field_key: 'status', operator: 'eq', value: 'paid' }] }] } })],
    ['unregistered relations', finance({ filters: { all: [{ field_key: 'provider_id', operator: 'eq', value: seed.supplier }] } })],
    ['related dimensions which would multiply rows', finance({ group_by: [{ dimension_key: 'category_group_id', output_key: 'group' }] })],
    ['duplicate output keys', finance({ group_by: [{ dimension_key: 'category_id', output_key: 'amount' }] })],
    ['unknown IANA timezone', finance({ period: { ...instantPeriod, timezone: 'Nodia/Invented' } })],
    ['invalid civil date', rental(seed.properties[0], { period: { ...civilPeriod, from: '2027-02-30' } })],
    ['wrong temporal kind', finance({ period: { ...civilPeriod, dimension_key: 'created_at' } })],
    ['wrong property timezone', rental(seed.properties[0], { period: { ...civilPeriod, timezone: 'Europe/Madrid' } })],
    ['unbounded page', finance(), { page_limit: 1000000 }],
    ['incompatible cross-source combination reserved for AI31', finance(), { combine: 'compare_compatible' }],
  ]) await error(`invalid ${name} never reaches the report SQL executor`, () => execute(source, '1', extra));
  const injection = await execute(finance({ filters: { all: [{ field_key: 'name', operator: 'contains', value: "' OR TRUE --" }] } }));
  check('a SQL-shaped string remains a bound literal and cannot broaden the result', injection.matched_records === '0' && injection.totals.amount === '0');

  await db.query('UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id=$1', [moduleIds.get('personal_finance')]);
  await error('revoking the destination module stops a previously admitted source before report execution', () => execute(finance()), /capability_denied/);
  const revoked = await describe.execute(identities.get('1'));
  check('source discovery removes every source from a revoked destination module', !revoked.sources.some(source => source.scope_kind === 'personal'));
  check('super admin discovery retains current sources without destination assignments', (await describe.execute(identities.get('3'))).sources.length === 11);
  await db.query('UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id IN (SELECT id FROM modules WHERE key=\'nodia_ai\')');
  await error('revoking NodiaAI blocks all reports independently of target modules', () => execute(rental(seed.properties[0])), /capability_denied/);
  await db.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1', [identities.get('2').sessionId]);
  await error('a revoked authenticated session cannot describe report sources', () => describe.execute(identities.get('2')), /session_expired|session_revoked/);
} catch (error) {
  failure = error;
} finally {
  await compiled?.close();
  await fixture.close();
}
if (failure) {
  console.error(JSON.stringify({ stage: 'AI-30', completed_checks: checks.length, last_checks: checks.slice(-3) }));
  throw failure;
}
console.log(JSON.stringify({ stage: 'AI-30', scope: 'compiled_report_use_cases_real_disposable_postgresql_synthetic_records', checks: checks.length,
  report_sql_queries: reportQueries, passed: checks, cleanup_completed: true, configured_database_used: false, provider_inference: false,
  elapsed_seconds: Math.round((Date.now() - started) / 10) / 100,
  limitations: ['Single-source restricted reports only. Cross-source composition and presentation remain AI-31.', 'No provider generation, MCP publication or production database is exercised.'],
}, null, 2));
