// Actual compiled publication, Nest DI and typed projections over disposable PostgreSQL.
// No publication override, configured database, provider credentials or inference.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const saleTools = ['nodia_sales_get', 'nodia_sales_list'];
const retiredSaleTools = ['create', 'update', 'complete', 'cancel', 'discard'].map(operation => `nodia_sales_prepare_${operation}`);
const sourceKeys = ['business_sales', 'business_sale_items'];
const documentId = 'businesses.point-of-sale-and-sales';
const manifest = JSON.parse(await readFile(new URL('../dist/nodia-ai/knowledge/manifest.json', import.meta.url), 'utf8'));
assert.ok(manifest.documents.some(document => document.document_id === documentId && document.revision === 5));
assert.deepEqual(manifest.capability_contracts.filter(cap => saleTools.includes(cap.capability_id))
  .map(cap => cap.capability_id).sort(), [...saleTools].sort(), 'The actual built manifest must publish the exact POS cohort');
assert.ok(!manifest.capability_contracts.some(cap => retiredSaleTools.includes(cap.capability_id)));
const salesFragment = manifest.fragments.find(fragment => fragment.document_id === documentId);
assert.deepEqual(salesFragment.sections, ['Filtros e informes']);
assert.deepEqual(salesFragment.requires.map(requirement => requirement.capability_id).sort(), [...saleTools].sort());
const projectedContext = await readFile(new URL('../dist/nodia-ai/knowledge/' + salesFragment.asset_path, import.meta.url), 'utf8');
assert.doesNotMatch(projectedContext, /nodia_sales_prepare_/);

const fixture = await createNodiaAiIntegrationFixture('ai9402');
const checks = [];
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
let compiled, externalCalls = 0, report;
try {
  const paths = [
    ['nodia-ai-context/nodia-ai-context.module', 'NodiaAiContextModule'],
    ['nodia-ai-tools/nodia-ai-tool-registry.module', 'NodiaAiToolRegistryModule'],
    ['nodia-ai-reports/nodia-ai-reports.module', 'NodiaAiReportsModule'],
    ['nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase'],
    ['nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case', 'LoadNodiaAiKnowledgeUseCase'],
    ['nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case', 'DiscoverNodiaAiToolsUseCase'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['nodia-ai-reports/use-case/nodia-ai-report-registry.use-case', 'NodiaAiReportRegistryUseCase'],
    ['nodia-ai-reports/use-case/describe-nodia-ai-reports.use-case', 'DescribeNodiaAiReportsUseCase'],
    ['nodia-ai-reports/use-case/run-nodia-ai-report.use-case', 'RunNodiaAiReportUseCase'],
    ['sale/use-case/mutate-sale.use-case', 'MutateSaleUseCase'],
    ['common/redis/redis.service', 'RedisService'],
    ['common/storage/storage.service', 'StorageService'],
    ['common/ai/gemini.service', 'GeminiService'],
    ['common/ai/api-provider.service', 'ApiProviderService'],
    ['common/ai/codex/codex-runtime.service', 'CodexRuntimeService'],
    ['common/ai/codex/codex-chat-runtime', 'CodexChatRuntime'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
  ];
  const [Context, RegistryModule, ReportsModule, Registry, Loader, Discovery, Authorize,
    ReportRegistry, DescribeReports, RunReport, MutateSale, Redis, ...externalTypes] =
    await Promise.all(paths.map(([path, name]) => loadAi(path, name)));
  const forbidden = () => { externalCalls++; throw Error('pos_publication_external_IO_forbidden'); };
  const blocked = new Proxy({}, { get(_target, key) {
    return key === 'then' || key === 'beforeApplicationShutdown' || typeof key === 'symbol'
      || String(key).startsWith('onModule') || String(key).startsWith('onApplication') ? undefined : forbidden;
  } });
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => fixture.options, dataSourceFactory: async () => fixture.db }),
    RegistryModule, ReportsModule, Context,
  ] }).overrideProvider(Redis).useValue({
    get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [],
  });
  for (const type of externalTypes) builder.overrideProvider(type).useValue(blocked);
  compiled = await builder.compile();
  const registry = compiled.get(Registry), loader = compiled.get(Loader), discover = compiled.get(Discovery);
  const authorize = compiled.get(Authorize), reports = compiled.get(ReportRegistry), describe = compiled.get(DescribeReports);
  const routes = [...new Set(manifest.capability_contracts.flatMap(cap => cap.required_module_routes))];
  const contracts = registry.publishedContracts();
  assert.deepEqual(contracts.map(cap => cap.capability_id).sort(), manifest.capability_contracts.map(cap => cap.capability_id).sort());
  assert.deepEqual(registry.list(routes).map(tool => tool.capabilityId).sort(), contracts.map(cap => cap.capability_id).sort());
  for (const contract of contracts) {
    const published = manifest.capability_contracts.find(cap => cap.capability_id === contract.capability_id);
    assert.equal(contract.input_schema_sha256, published.input_schema.sha256);
    assert.equal(contract.output_schema_sha256, published.output_schema.sha256);
    assert.equal(contract.revision, published.revision);
    assert.equal(contract.kind, published.kind);
    assert.deepEqual(contract.required_module_routes, published.required_module_routes);
  }
  check('actual Nest registry and pinned loader agree with every published ID, schema hash, kind and route',
    loader.manifest.release_id === manifest.release_id);
  const sales = registry.list(['/business']).filter(tool => saleTools.includes(tool.capabilityId));
  assert.deepEqual(sales.map(tool => tool.capabilityId).sort(), [...saleTools].sort());
  for (const tool of sales) assert.equal(registry.get(tool.toolName), tool);
  check('only sales reads compose under the registered sales resource; retired names resolve to no tool',
    sales.every(tool => tool.resourceKey === 'sales' && tool.moduleKey === 'businesses')
      && sales.filter(tool => tool.kind === 'read').length === 2
      && sales.every(tool => tool.kind !== 'prepare_change')
      && retiredSaleTools.every(name => registry.get(name) === undefined && registry.findCapability(name) === undefined)
      && registry.resources(['/business']).filter(resource => resource.key === 'sales').length === 1);
  check('registry route projection cannot expose POS without Business', !registry.list(['/nodia-ai']).some(tool => saleTools.includes(tool.capabilityId)));
  for (const key of sourceKeys) {
    assert.equal(reports.getPublished(key).publicationDocumentId, documentId);
    assert.ok(reports.isPublished(key));
  }
  check('the real ReportsModule derives both sale sources from the actual published document',
    reports.getPublished(sourceKeys[0]).descriptor.grain !== reports.getPublished(sourceKeys[1]).descriptor.grain);

  const { db, identities } = fixture;
  const [group] = await db.query("SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'");
  let [businessModule] = await db.query("SELECT id::text FROM modules WHERE link='/business'");
  if (!businessModule) [businessModule] = await db.query(
    "INSERT INTO modules(key,link,module_group_id,sort_order) SELECT 'businesses','/business',$1,COALESCE(max(sort_order),-1)+1 FROM modules WHERE module_group_id=$1 RETURNING id::text", [group.id]);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [businessModule.id]);
  const business = randomUUID(), foreign = randomUUID();
  await db.query("INSERT INTO businesses(id,name,owner_id) VALUES($1,'Synthetic POS owner',1),($2,'Synthetic private business',2)", [business, foreign]);
  const [product] = await db.query(`INSERT INTO products(business_id,code,barcode,name,cost_price,cost_price_tax,profit_percentage,sale_price,offer_price,is_offer_enabled,has_stock)
    VALUES($1,'supplier-code','0000123456789','Synthetic publication product',0,0,0,1200,1500,true,true) RETURNING id::text,version`, [business]);
  const identity = identities.get('1');
  const native = await compiled.get(MutateSale).execute(business, 'checkout', {
    request_key: randomUUID(), items: [{product_id: product.id,quantity: 2,expected_product_version: product.version,expected_unit_price: '1500'}],
  }, identity);
  const view = id => db.transaction('READ COMMITTED', async manager => {
    const actor = await authorize.execute(identities.get(id), {}, manager);
    return {actor, tools: await discover.visible(manager, actor, actor.modules.map(module => module.route))};
  });
  const permitted = await view('1'), denied = await view('2');
  assert.deepEqual(permitted.tools.filter(tool => saleTools.includes(tool.capabilityId)).map(tool => tool.capabilityId).sort(), [...saleTools].sort());
  const Selector = await loadAi('nodia-ai-tools/use-case/select-nodia-ai-turn-tools.use-case', 'SelectNodiaAiTurnToolsUseCase');
  const knowledgeTools = await loadAi('nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case', 'NODIA_AI_KNOWLEDGE_TOOLS');
  const {knowledgeHash, canonicalKnowledge} = await import('../dist/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js');
  const technicalTools = [
    ...knowledgeTools.map(descriptor => ({descriptor,contractHash:knowledgeHash(canonicalKnowledge(descriptor))})),
    ...discover.descriptors().map(descriptor => ({descriptor,contractHash:discover.contractHash(descriptor.name)})),
  ];
  // Same transient exact-ID profile produced by automatic selection; no deployment profile is changed.
  const select = visible => compiled.get(Selector).execute({profileId:'selected_capabilities',
    registeredTools:discover.registeredCatalog(),publishedCapabilityIds:contracts.map(cap => cap.capability_id),
    authorizedToolNames:visible.map(tool => tool.toolName),technicalTools}, {
    schema_version:1,default_profile_id:'selected_capabilities',technical_tool_names:technicalTools.map(tool => tool.descriptor.name),
    profiles:[{profile_id:'selected_capabilities',revision:1,capability_ids:saleTools,required_capability_ids:saleTools}],
  });
  assert.deepEqual([...select(permitted.tools).capabilityIds].sort(), [...saleTools].sort());
  assert.throws(() => select(denied.tools), /capability_denied/);
  check('actual selector admits the two discovered sales reads and rejects selection without current Business authority');
  check('an authenticated actor without Business cannot discover POS', !denied.tools.some(tool => saleTools.includes(tool.capabilityId)));
  const visibleSources = (await describe.execute(identity, {module_keys:['businesses']})).sources;
  check('authorized report discovery includes exactly the two published POS sources',
    visibleSources.filter(source => sourceKeys.includes(source.source_key)).length === 2);
  const invoke = (name, input) => db.transaction('READ COMMITTED', async manager => {
    const actor = await authorize.execute(identity, {}, manager);
    const context = {manager,actor,moduleRoutes:actor.modules.map(module => module.route)};
    const tool = registry.get(name), command = registry.validateInput(tool, input);
    await tool.verifyAuthority(command, context);
    const output = registry.validateOutput(tool, await tool.handler(command, context));
    await tool.verifyResultAuthority(command, output, context);
    return output;
  });
  const read = await invoke('nodia_sales_get', {business_id:business,id:native.id});
  const listed = await invoke('nodia_sales_list', {business_id:business,page:1,limit:25});
  assert.deepEqual(listed.data, [read.data]);
  assert.deepEqual(Object.keys(listed.meta).sort(), ['limit','page','total_items','total_pages']);
  check('DI-injected native get/list pass closed schemas and preserve distinct codes and exact enabled prices',
    read.data.total_amount === '3000' && read.data.items[0].unit_price === '1500'
      && read.data.items[0].regular_unit_price === '1200' && read.data.items[0].offer_price_snapshot === '1500'
      && read.data.items[0].price_source === 'offer' && read.data.items[0].product_code_snapshot === 'supplier-code'
      && read.data.items[0].product_barcode_snapshot === '0000123456789');
  const query = (source, measures, extra = {}) => ({ catalog_version: reports.catalogVersion, combine: 'separate', sources: [{
    source_key: source, alias: 'sales_read_only', scope: { business_id: business },
    filters: { all: [{ field_key: 'status', operator: 'eq', value: 'completed' }] }, measures, ...extra,
  }] });
  const salesReport = await compiled.get(RunReport).execute(identity, query('business_sales', [
    { measure_key: 'registered_sale_amount', aggregation: 'sum', output_key: 'amount' },
  ]));
  const productReport = await compiled.get(RunReport).execute(identity, query('business_sale_items', [
    { measure_key: 'sold_units', aggregation: 'sum', output_key: 'units' },
    { measure_key: 'registered_line_amount', aggregation: 'sum', output_key: 'amount' },
  ], { group_by: [{ dimension_key: 'product_id', output_key: 'product' }], order_by: [{ output_key: 'units', direction: 'desc' }] }));
  assert.equal(salesReport.totals.amount, '3000');
  assert.equal(salesReport.basis_key, 'completed_at');
  assert.equal(productReport.totals.units, '2');
  assert.equal(productReport.totals.amount, '3000');
  assert.equal(productReport.matched_records, '1');
  assert.equal(productReport.rows.length, 1);
  assert.ok(productReport.rows[0].includes(product.id));
  check('authorized native reports retain exact frozen sales amounts and the stable-product ranking after writer retirement');
  await assert.rejects(() => invoke('nodia_sales_get', {business_id:foreign,id:native.id}), /resource_not_found|forbidden|capability_denied/);
  check('a published read still rejects foreign business scope');
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [businessModule.id]);
  check('current module revocation removes every POS capability and both report sources',
    !(await view('1')).tools.some(tool => saleTools.includes(tool.capabilityId))
      && !(await describe.execute(identity, {module_keys:['businesses']})).sources.some(source => sourceKeys.includes(source.source_key)));
  await assert.rejects(() => invoke('nodia_sales_get', {business_id:business,id:native.id}), /module_access_denied|forbidden|capability_denied/);
  await db.query('UPDATE auth_sessions SET revoked_at=now() WHERE public_id=$1', [identity.sessionId]);
  await assert.rejects(() => view('1'), /unauthorized|session|capability_denied/i);
  await assert.rejects(() => describe.execute(identity), /unauthorized|session|capability_denied/i);
  check('revoked session cannot discover tools or report metadata');
  const [effects] = await db.query(`SELECT (SELECT count(*) FROM nodia_ai_executions)::text AS executions,
    (SELECT count(*) FROM nodia_ai_jobs)::text AS jobs,(SELECT count(*) FROM ai_api_keys)::text AS api_keys,
    (SELECT count(*) FROM sale_mutation_requests)::text AS sale_mutations`);
  assert.deepEqual(effects, {executions:'0',jobs:'0',api_keys:'0',sale_mutations:'1'});
  check('metadata and read smoke performs no AI work or preparation mutation and no external IO', externalCalls === 0);
  report = {task:'business_pos_published_runtime',status:'passed',checks:checks.length,results:checks,
    release_id:manifest.release_id,published_capabilities:contracts.length,documents:manifest.documents.length,fragments:manifest.fragments.length,
    pos_tools:2,retired_sales_tools:retiredSaleTools,pos_report_sources:2,actual_registry_and_reports_DI:true,synthetic_publication_override:false,
    configured_database_used:false,provider_inference:false,native_fixture_mutations:1};
} finally {
  try { if (compiled) await compiled.close(); } finally { await fixture.close(); }
}
assert.equal(externalCalls, 0);
console.log(JSON.stringify({...report,external_calls:externalCalls,cleanup_completed_before_report:true}));
