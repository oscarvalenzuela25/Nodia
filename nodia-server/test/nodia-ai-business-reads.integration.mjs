// Compiled NodiaAI publication and ToolGateway against disposable PostgreSQL.
// Synthetic claims and a transaction checkpoint isolate tool authorization from worker leases and provider dispatch.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const shopping = {
  list: 'nodia_business_shopping_lists_list',
  get: 'nodia_business_shopping_lists_get',
};
const cash = {
  categories: 'nodia_business_cash_categories_list',
  list: 'nodia_business_cash_movements_list',
  get: 'nodia_business_cash_movements_get',
  monthly: 'nodia_business_cash_monthly_summary',
};
const productList = 'nodia_products_list';
const documents = new Map([
  ['businesses.market-shopping-lists', Object.values(shopping)],
  ['businesses.cash-ledger-and-invoice-expenses', Object.values(cash)],
]);
const businessReadNames = [...Object.values(shopping), ...Object.values(cash)].sort();
const names = [...businessReadNames, productList].sort();
const routes = ['/business', '/nodia-ai'];
const deniedScope = /business:resource_not_found/;
const deniedTool = /nodia_ai:capability_denied/;
const hash = 'a'.repeat(64);

async function seedBusiness(db, owner, label, amount) {
  const id = randomUUID();
  const listId = randomUUID();
  const itemId = randomUUID();
  const movementId = randomUUID();
  await db.query('INSERT INTO businesses(id,name,owner_id) VALUES($1,$2,$3)', [id, label, owner]);
  await db.query('INSERT INTO business_shopping_lists(id,business_id,name) VALUES($1,$2,$3)',
    [listId, id, `${label} list`]);
  await db.query(`INSERT INTO business_shopping_list_items
    (id,list_id,business_id,product_id,product_name,quantity,position,checked,check_version,checked_at,checked_by)
    VALUES($1,$2,$3,987654321,$4,'2.250',0,true,2,now(),$5)`,
    [itemId, listId, id, `${label} item`, owner]);
  const [{ id: categoryId }] = await db.query(`INSERT INTO business_cash_categories
    (business_id,name,normalized_name,description,created_by,updated_by)
    VALUES($1,$2,$3,$4,$5,$5) RETURNING id::text`,
    [id, `${label} category`, `${label.toLowerCase()} category`, `${label} category description`, owner]);
  await db.query(`INSERT INTO business_cash_movements
    (id,business_id,category_id,type,amount,occurred_on,description,created_by,updated_by)
    VALUES($1,$2,$3,'expense',$4,timezone('America/Santiago',now())::date,$5,$6,$6)`,
    [movementId, id, categoryId, amount, `${label} expense`, owner]);
  return { id, listId, itemId, categoryId, movementId };
}

async function createClaim(db, identity, mode, registry, manifest, selectionFlow) {
  const id = randomUUID();
  const conversationId = randomUUID();
  const message = randomUUID();
  const selectionSnapshot = { mode };
  const routingSnapshot = {};
  const granted = selectionFlow ? ['chat:respond', 'nodia_capabilities_select'] : names;
  const toolContracts = selectionFlow
    ? { nodia_capabilities_select: selectionFlow.contractHash() }
    : Object.fromEntries(names.map(name => [name, registry.get(name).contractHash]));
  const contextManifest = {
    module_routes: routes,
    tool_contracts: toolContracts,
    ...(selectionFlow ? { tool_selection: {
      schema_version: 1, phase: 'discovery', catalog_hash: selectionFlow.catalogHash(),
    } } : {}),
    tool_catalog_version: registry.catalogVersion,
    knowledge_release: manifest.release_id,
  };
  const budget = {
    schema_version: 1, tool_calls: 32, mcp_rpc_messages: 96,
    provider_dispatches: 2, compactions: 1, delegations: 0,
  };
  await db.transaction(async manager => {
    await manager.query(`INSERT INTO nodia_ai_conversations
      (id,owner_id,client_request_id,creation_request_hash,expires_at,next_message_seq)
      VALUES($1,$2,$3,$4,now()+interval '1 day',1)`, [conversationId, identity.userId, randomUUID(), hash]);
    await manager.query(`INSERT INTO nodia_ai_messages
      (id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash)
      VALUES($1,$2,1,'user',$3,$4,'sealed','{}',now(),$5)`,
      [message, conversationId, identity.userId, randomUUID(), hash]);
    await manager.query(`INSERT INTO nodia_ai_runs
      (id,conversation_id,actor_id,user_message_id,selection_snapshot,catalog_version,policy_version,policy_hash,
       routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,retention_epoch,context_manifest)
      VALUES($1,$2,$3,$4,$5,$6,'synthetic-read/1',$7,'{}',$8,1,'running','inference',now()+interval '5 minutes',1,$9)`,
      [id, conversationId, identity.userId, message, selectionSnapshot, manifest.catalog_release, hash, budget, contextManifest]);
    await manager.query(`INSERT INTO nodia_ai_execution_grants
      (id,actor_id,session_public_id,run_id,allowed_modules,allowed_operations,allowed_scope,policy_version,expires_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,'{}','synthetic-read/1',now()+interval '5 minutes')`,
      [randomUUID(), identity.userId, identity.sessionId, id, JSON.stringify(routes), JSON.stringify(granted)]);
  });
  return {
    identity,
    job: { stage_key: 'inference' },
    attempt: { id: randomUUID() },
    run: {
      id, conversation_id: conversationId, catalog_version: manifest.catalog_release,
      context_manifest: contextManifest, selection_snapshot: selectionSnapshot, routing_snapshot: routingSnapshot,
    },
  };
}

function inputsFor(business) {
  const scope = { business_id: business.id };
  return {
    [shopping.list]: scope,
    [shopping.get]: { ...scope, id: business.listId },
    [cash.categories]: scope,
    [cash.list]: scope,
    [cash.get]: { ...scope, id: business.movementId },
    [cash.monthly]: scope,
  };
}

process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const fixture = await createNodiaAiIntegrationFixture('ai1101');
const { db, options, identities } = fixture;
let compiled;
try {
  const [Tools, Gateway, Registry, Loader, Discovery, ToolSelection, Authorize, Redis, ...externalPorts] = await Promise.all([
    ['nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'],
    ['nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case', 'ExecuteNodiaAiToolUseCase'],
    ['nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase'],
    ['nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case', 'LoadNodiaAiKnowledgeUseCase'],
    ['nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case', 'DiscoverNodiaAiToolsUseCase'],
    ['nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case', 'NodiaAiToolSelectionFlowUseCase'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['common/redis/redis.service', 'RedisService'],
    ['common/storage/storage.service', 'StorageService'],
    ['common/ai/gemini.service', 'GeminiService'],
    ['common/ai/api-provider.service', 'ApiProviderService'],
    ['common/ai/codex/codex-runtime.service', 'CodexRuntimeService'],
    ['common/ai/codex/codex-chat-runtime', 'CodexChatRuntime'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
  ].map(([path, name]) => loadAi(path, name)));
  const { lockAuthority } = await import('../dist/authorization/authority-transaction.js');
  let externalCalls = 0;
  const blockExternalIO = new Proxy({}, {
    get(_target, key) {
      if (key === 'then' || key === 'beforeApplicationShutdown' || typeof key === 'symbol'
        || key.startsWith('onModule') || key.startsWith('onApplication')) return undefined;
      return () => { externalCalls++; throw new Error('business_reads_external_io_forbidden'); };
    },
  });
  const builder = Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), Tools,
  ] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  for (const port of externalPorts) builder.overrideProvider(port).useValue(blockExternalIO);
  compiled = await builder.compile();
  const gateway = compiled.get(Gateway);
  const registry = compiled.get(Registry);
  const discovery = compiled.get(Discovery);
  const selectionFlow = compiled.get(ToolSelection);
  const authorize = compiled.get(Authorize);
  const { manifest } = compiled.get(Loader);
  const context = {
    signal: new AbortController().signal,
    checkpoint: (work, isolation = 'READ COMMITTED') => db.transaction(isolation, async manager => {
      await lockAuthority(manager);
      return work(manager);
    }),
  };
  let [businessModule] = await db.query("SELECT id::text FROM modules WHERE link='/business'");
  if (!businessModule) {
    [businessModule] = await db.query(`INSERT INTO modules(key,link,module_group_id,sort_order)
      SELECT 'businesses','/business',module_group_id,max(sort_order)+1 FROM modules
      WHERE module_group_id=(SELECT module_group_id FROM modules WHERE key='nodia_ai')
      GROUP BY module_group_id RETURNING id::text`);
  }
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [businessModule.id]);
  const local = await seedBusiness(db, '1', 'Synthetic local', '930');
  const foreign = await seedBusiness(db, '2', 'Synthetic private', '4444');
  await db.query(`INSERT INTO products
    (business_id,name,cost_price,cost_price_tax,sale_price,offer_price,is_offer_enabled,is_active,measurement_unit)
    VALUES ($1,'Arroz',900,1071,1450,1200,true,true,'kg'),
    ($1,'Muestra',0,0,0,NULL,false,true,'unit'),
    ($1,'Retirado',500,595,800,NULL,false,false,'unit'),
    ($2,'Synthetic private product',700,833,900,NULL,false,true,'unit')`,
    [local.id, foreign.id]);

  for (const [document, capabilities] of documents) {
    assert.ok(manifest.documents.some(entry => entry.document_id === document), `${document} must be in the built knowledge release`);
    const published = manifest.fragments.filter(entry => entry.document_id === document)
      .flatMap(entry => entry.requires.map(requirement => requirement.capability_id));
    assert.deepEqual([...new Set(published)].sort(), [...capabilities].sort());
  }
  const contracts = registry.publishedContracts()
    .filter(contract => /^nodia_business_(shopping_lists|cash)_/.test(contract.capability_id));
  assert.deepEqual(contracts.map(contract => contract.capability_id).sort(), businessReadNames);
  assert.ok(manifest.capability_contracts.some(capability =>
    capability.capability_id === productList && capability.kind === 'read'));
  assert.ok(contracts.every(contract => contract.kind === 'read'));

  const owner = await createClaim(db, identities.get('1'), 'agentic', registry, manifest);
  const other = await createClaim(db, identities.get('2'), 'api_key', registry, manifest);
  const planIndex = claim => context.checkpoint(async manager => {
    const index = await selectionFlow.discoveryIndex(manager, claim);
    assert.ok(index.selection_required);
    return index.modules.flatMap(module => module.resources.flatMap(resource => resource.capabilities));
  });
  const ownerPlanning = await createClaim(db, owner.identity, 'agentic', registry, manifest, selectionFlow);
  const otherPlanning = await createClaim(db, other.identity, 'api_key', registry, manifest, selectionFlow);
  for (const planning of [ownerPlanning, otherPlanning]) {
    const capability = (await planIndex(planning)).find(tool => tool.capability_id === productList);
    assert.equal(capability?.kind, 'read');
    assert.match(capability.description, /precio de venta/);
  }
  const discover = (claim, query) => context.checkpoint(async manager => {
    const actor = await authorize.execute(claim.identity, {}, manager);
    const result = await discovery.execute(manager, actor, routes, 'search', { query });
    return result.items.map(item => item.tool_name).sort();
  });
  assert.deepEqual(await discover(owner, 'Listas de Market'), Object.values(shopping).sort());
  assert.deepEqual(await discover(owner, 'Caja de Negocios'), Object.values(cash).sort());
  assert.ok((await discover(owner, 'listado de los productos con su precio')).includes(productList));
  assert.ok((await discover(other, 'precio de venta de productos')).includes(productList));
  const productsInput = businessId => ({ q: { business_id_eq: businessId, s: 'name asc' } });
  const inputs = { ...inputsFor(local), [productList]: productsInput(local.id) };
  const invoke = (claim, name, args = inputs[name], callId = randomUUID()) =>
    gateway.execute(claim, context, { callId, name, arguments: args });
  const descriptors = async claim => (await gateway.descriptors(claim, context)).map(tool => tool.name).sort();
  assert.deepEqual(await descriptors(owner), names);
  assert.deepEqual(await descriptors(other), names, 'The modules and run grant reveal tools without granting access to any arbitrary business');

  const ownerResults = {};
  for (const name of names) ownerResults[name] = await invoke(owner, name);
  assert.deepEqual(ownerResults[shopping.list].data.map(row => row.id), [local.listId]);
  assert.equal(ownerResults[shopping.get].data.id, local.listId);
  assert.deepEqual(ownerResults[shopping.get].data.items.map(({ id, quantity, checked }) => ({ id, quantity, checked })),
    [{ id: local.itemId, quantity: '2.25', checked: true }]);
  assert.deepEqual(ownerResults[cash.categories].data.map(row => row.id), [local.categoryId]);
  assert.deepEqual(ownerResults[cash.list].data.map(row => row.id), [local.movementId]);
  assert.equal(ownerResults[cash.get].data.amount, '930');
  assert.equal(ownerResults[cash.monthly].period.time_zone, 'America/Santiago');
  assert.deepEqual(ownerResults[cash.monthly].summary.expense, { count: 1, total_amount: '930' });
  assert.deepEqual(ownerResults[cash.list].summary, ownerResults[cash.monthly].summary);
  assert.deepEqual(ownerResults[productList].data.map(
    ({name, sale_price, effective_price, price_source, measurement_unit}) =>
      ({name, sale_price, effective_price, price_source, measurement_unit})),
  [
    {name: 'Arroz', sale_price: 1450, effective_price: '1200', price_source: 'offer', measurement_unit: 'kg'},
    {name: 'Muestra', sale_price: 0, effective_price: '0', price_source: 'regular', measurement_unit: 'unit'},
  ]);
  const firstProductPage = await invoke(owner, productList, { ...inputs[productList], limit: 1 });
  assert.equal(firstProductPage.data[0].name, 'Arroz');
  assert.deepEqual(firstProductPage.meta, { page: 1, limit: 1, total_items: 2, total_pages: 2 });
  const allProducts = await invoke(owner, productList, { ...inputs[productList], activity: 'all' });
  assert.deepEqual(allProducts.data.map(row => row.name), ['Arroz', 'Muestra', 'Retirado']);
  assert.doesNotMatch(JSON.stringify(ownerResults), /Synthetic private|check_version|checked_by|created_by|updated_by/);
  const { from, to } = ownerResults[cash.monthly].period;
  const filtered = await invoke(owner, cash.list, { business_id: local.id, category_id: local.categoryId, from, to });
  assert.deepEqual(filtered, ownerResults[cash.list]);
  const foreignCategory = await invoke(owner, cash.list, { business_id: local.id, category_id: foreign.categoryId });
  assert.deepEqual(foreignCategory.data, []);
  assert.deepEqual(foreignCategory.summary.expense, { count: 0, total_amount: '0' });
  await assert.rejects(() => invoke(owner, cash.monthly, {}), /nodia_ai:invalid_tool_input/);
  await assert.rejects(() => invoke(owner, shopping.list, { ...inputs[shopping.list], actor_id: '2' }),
    /nodia_ai:invalid_tool_input/);

  for (const name of businessReadNames) await assert.rejects(() => invoke(other, name), deniedScope);
  const [{ count: outsiderReceipts }] = await db.query('SELECT count(*)::integer AS count FROM nodia_ai_tool_calls WHERE run_id=$1', [other.run.id]);
  assert.equal(outsiderReceipts, 0, 'Denied requests must not create a public result');

  const privateProducts = await invoke(other, productList);
  assert.deepEqual(privateProducts.data, []);
  assert.equal(privateProducts.meta.total_items, 0);
  const ownProducts = await invoke(other, productList, productsInput(foreign.id));
  assert.deepEqual(ownProducts.data.map(row => row.name), ['Synthetic private product']);

  await db.query('INSERT INTO business_collaborators(business_id,user_id) VALUES($1,2)', [local.id]);
  const replayCall = randomUUID();
  const productReplayCall = randomUUID();
  for (const name of names) {
    assert.deepEqual(await invoke(other, name, inputs[name], name === shopping.get ? replayCall : name === productList ? productReplayCall : undefined), ownerResults[name]);
  }
  const foreignInputs = inputsFor(foreign);
  assert.equal((await invoke(other, shopping.get, foreignInputs[shopping.get])).data.id, foreign.listId);
  assert.equal((await invoke(other, cash.get, foreignInputs[cash.get])).data.amount, '4444');
  await assert.rejects(() => invoke(other, shopping.get, { business_id: local.id, id: foreign.listId }), deniedScope);
  await assert.rejects(() => invoke(other, cash.get, { business_id: local.id, id: foreign.movementId }), deniedScope);

  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1', [businessModule.id]);
  assert.deepEqual(await descriptors(other), []);
  assert.deepEqual(await discover(other, 'Caja de Negocios'), []);
  assert.ok(!(await planIndex(otherPlanning)).some(tool => tool.capability_id === productList));
  assert.deepEqual(await discover(other, 'listado de los productos con su precio'), []);
  await assert.rejects(() => invoke(other, productList, inputs[productList], productReplayCall), deniedTool);
  await assert.rejects(() => invoke(other, shopping.get, inputs[shopping.get], replayCall), deniedTool);
  await assert.rejects(() => invoke(other, cash.monthly), deniedTool);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)', [businessModule.id]);
  await db.query('DELETE FROM business_collaborators WHERE business_id=$1 AND user_id=2', [local.id]);
  await assert.rejects(() => invoke(other, productList, inputs[productList], productReplayCall), deniedScope);
  await assert.rejects(() => invoke(other, shopping.get, inputs[shopping.get], replayCall), deniedScope);
  await assert.rejects(() => invoke(other, cash.monthly), deniedScope);

  await db.query('UPDATE nodia_ai_execution_grants SET allowed_operations=$2::jsonb WHERE run_id=$1',
    [owner.run.id, JSON.stringify([shopping.list])]);
  assert.deepEqual(await descriptors(owner), [shopping.list]);
  await assert.rejects(() => invoke(owner, cash.monthly), deniedTool);
  assert.deepEqual(await invoke(owner, shopping.list), ownerResults[shopping.list]);
  assert.equal(externalCalls, 0);
  console.log(JSON.stringify({
    test: 'nodia_ai_business_reads', status: 'passed', source: 'compiled_publication', tools: names,
    checks: ['spanish_discovery', 'owner', 'collaborator', 'other_business_denied', 'cross_business_id_denied',
      'module_revocation', 'collaboration_revocation_before_replay', 'operation_grant',
      'exact_read_results', 'required_scope_and_rejected_actor_override',
      'automatic_selection_index', 'paginated_product_prices_and_current_business_access'],
    provider_calls: externalCalls,
  }));
} finally {
  try {
    if (compiled) await compiled.close();
  } finally {
    await fixture.close();
  }
}
