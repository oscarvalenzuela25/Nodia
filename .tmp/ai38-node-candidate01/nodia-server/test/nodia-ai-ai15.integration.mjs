// Actual compiled product readers and durable worker against disposable PostgreSQL. Synthetic identities, publication and adapter only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';
import { createAi15PublicationFixture } from './nodia-ai-ai15.fixture.mjs';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';

const checks = [],
  check = (name, condition) => {
    assert.ok(condition, name);
    checks.push(name);
  };
const apps = [],
  publications = [];
let ports, publishedPorts;
const Tools = await loadAi(
  'nodia-ai-tools/nodia-ai-tools.module',
  'NodiaAiToolsModule',
);
const Conversation = await loadAi(
  'nodia-ai-conversation/nodia-ai-conversation.module',
  'NodiaAiConversationModule',
);
const Processing = await loadAi(
  'nodia-ai-context/nodia-ai-processing.module',
  'NodiaAiProcessingModule',
);
const Runtime = await loadAi(
  'nodia-ai-runtime/nodia-ai-runtime.module',
  'NodiaAiRuntimeModule',
);
const Stage = await loadAi(
  'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
  'RunNodiaAiStageUseCase',
);
const Create = await loadAi(
  'nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case',
  'CreateNodiaAiConversationUseCase',
);
const Admit = await loadAi(
  'nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case',
  'AdmitNodiaAiMessageUseCase',
);
const Adapter = await loadAi(
  'nodia-ai-adapter/types/nodia-ai-adapter.types',
  'NodiaAiAdapterPort',
);
const Authorize = await loadAi(
  'nodia-ai/use-case/authorize-nodia-ai.use-case',
  'AuthorizeNodiaAiUseCase',
);
const Registry = await loadAi(
  'nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case',
  'NodiaAiToolRegistryUseCase',
);
const Discovery = await loadAi(
  'nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case',
  'DiscoverNodiaAiToolsUseCase',
);
const KnowledgeDescriptors = await loadAi(
  'nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case',
  'NODIA_AI_KNOWLEDGE_TOOLS',
);
const FinanceModule = await loadAi(
  'nodia-ai-products/finance/finance-read.module',
  'NodiaAiFinanceReadModule',
);
const FinanceToken = await loadAi(
  'nodia-ai-products/finance/finance-read.family',
  'NODIA_AI_FINANCE_READ_FAMILY',
);
const RentalsModule = await loadAi(
  'nodia-ai-products/reservations/nodia-ai-reservations.module',
  'NodiaAiReservationsModule',
);
const RentalsFamily = await loadAi(
  'nodia-ai-products/reservations/use-case/nodia-ai-reservations-family.use-case',
  'NodiaAiReservationsFamilyUseCase',
);
const CoreModule = await loadAi(
  'nodia-ai-products/core-settings/core-settings-read.module',
  'NodiaAiCoreSettingsReadModule',
);
const CoreToken = await loadAi(
  'nodia-ai-products/core-settings/core-settings-read.family',
  'NODIA_AI_CORE_SETTINGS_READ_FAMILY',
);
const Redis = await loadAi('common/redis/redis.service', 'RedisService');
const makeBusiness = await loadAi(
  'nodia-ai-products/business/business-tool-family',
  'createNodiaAiBusinessToolFamily',
);
const makeAi = await loadAi(
  'nodia-ai-products/ai-settings/ai-settings-read.family',
  'createNodiaAiAiSettingsReadFamily',
);
const makeExternal = await loadAi(
  'nodia-ai-products/external/external-read.family',
  'createNodiaAiExternalReadFamily',
);
const makeArtifacts = await loadAi(
  'nodia-ai-products/artifacts/artifacts.family',
  'createNodiaAiArtifactsFamily',
);
const ProductReads = await loadAi(
  'nodia-ai-products/nodia-ai-product-reads.module',
  'NodiaAiProductReadsModule',
);
const CandidateFamilies = await loadAi(
  'nodia-ai-products/nodia-ai-product-reads.module',
  'NODIA_AI_CANDIDATE_READ_FAMILIES',
);
const fixture = await createNodiaAiIntegrationFixture('ai15');
const { db, options, identities } = fixture;

function builder(imports, worker = false) {
  return Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      ...imports,
    ],
    providers: worker ? [Stage] : [],
  })
    .overrideProvider(Redis)
    .useValue({
      get: async () => null,
      set: async () => {},
      del: async () => {},
      keys: async () => [],
    });
}
async function application(build) {
  const compiled = await build.compile();
  const app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalGuards({
    canActivate(context) {
      const request = context.switchToHttp().getRequest(),
        identity = identities.get(request.headers['x-fixture-actor']);
      if (!identity) throw new UnauthorizedException();
      request.auth = {
        user: { id: identity.userId },
        sessionId: identity.sessionId,
      };
      return true;
    },
  });
  await app.listen(0, '127.0.0.1');
  apps.push(app);
  const base = `${await app.getUrl()}/api/v1/nodia-ai/capabilities`;
  return {
    app,
    compiled,
    async request(path = '', actor = '1', status = 200) {
      const response = await fetch(base + path, {
        headers: { 'x-fixture-actor': actor },
      });
      const result = await response.json();
      assert.equal(response.status, status, JSON.stringify(result));
      if (status === 200)
        assert.equal(response.headers.get('cache-control'), 'no-store');
      return result;
    },
  };
}

try {
  // Nest constructs actual domain services/UCS. No fake port implements a read.
  ports = await builder([FinanceModule, RentalsModule, CoreModule]).compile();
  const business = makeBusiness(
    readFileSync(
      new URL(
        '../dist/nodia-ai-products/contracts/business.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const families = [
    business,
    ports.get(FinanceToken),
    ports.get(RentalsFamily).family(),
    ports.get(CoreToken),
    makeAi(),
  ];
  // Real metadata and handlers. One synthetic low-level observation verifies the
  // external Gateway boundary; all five observations and downloads are covered separately.
  const fullFamilies = [
    ...families,
    makeExternal({
      gemini: { getDualEngineStatus: async () => null },
    }),
    makeArtifacts(),
  ];
  const allRoutes = [
    ...new Set(
      fullFamilies.flatMap((family) =>
        family.modules.map((module) => module.route),
      ),
    ),
  ];
  const expectedTools = families.flatMap((family) => family.capabilities);
  const fullExpectedTools = fullFamilies.flatMap(
    (family) => family.capabilities,
  );
  publishedPorts = await builder([
    ProductReads.forPublication(
      fullExpectedTools.map((tool) => tool.capabilityId),
    ),
  ]).compile();
  const composedCandidates = publishedPorts
    .get(CandidateFamilies)
    .flatMap((family) => family.capabilities);
  check(
    'actual publication composition instantiates all 67 typed read/artifact candidate ports',
    composedCandidates.length === 67 &&
      composedCandidates.every((tool) =>
        fullExpectedTools.some(
          (expected) =>
            expected.capabilityId === tool.capabilityId &&
            expected.inputSchema.sha256 === tool.inputSchema.sha256 &&
            expected.outputSchema.sha256 === tool.outputSchema.sha256,
        ),
      ),
  );
  const assetNames = [
    'business',
    'finance',
    'reservations',
    'core-settings',
    'ai-settings',
    'external',
    'artifacts',
  ];
  const handlerFiles = [
    'business/use-case/read-nodia-ai-business.use-case.ts',
    'finance/use-case/execute-nodia-ai-finance-read.use-case.ts',
    'reservations/use-case/nodia-ai-reservations-family.use-case.ts',
    'core-settings/use-case/execute-nodia-ai-core-settings-read.use-case.ts',
    'ai-settings/use-case/read-ai-settings.use-case.ts',
    'external/use-case/read-external.use-case.ts',
    'artifacts/use-case/execute-nodia-ai-artifact.use-case.ts',
  ];
  writeFileSync(
    new URL('../.tmp/ai15-registrations.json', import.meta.url),
    JSON.stringify(
      fullFamilies.flatMap((family, index) =>
        family.capabilities.map((tool) => ({
          toolName: tool.toolName,
          capabilityId: tool.capabilityId,
          revision: tool.revision,
          kind: tool.kind,
          moduleKey: tool.moduleKey,
          resourceKey: tool.resourceKey,
          requiredModuleRoutes: tool.requiredModuleRoutes,
          schemaPath: `nodia-server/src/nodia-ai-products/contracts/${assetNames[index]}.schema.json`,
          inputSchema: {
            definition: tool.inputSchema.definition,
            sha256: tool.inputSchema.sha256,
          },
          outputSchema: {
            definition: tool.outputSchema.definition,
            sha256: tool.outputSchema.sha256,
          },
          handlerSources: [
            `nodia-server/src/nodia-ai-products/${handlerFiles[index]}`,
          ],
        })),
      ),
      null,
      2,
    ),
  );

  check(
    'all local product families expose only read ports with explicit contracts',
    expectedTools.length === 59 &&
      expectedTools.every((tool) => tool.kind === 'read'),
  );
  const publication = await createAi15PublicationFixture(fullFamilies);
  publications.push(publication);
  const live = await application(publication.override(builder([Tools])));
  const authorize = live.compiled.get(Authorize),
    registry = live.compiled.get(Registry);
  writeFileSync(
    new URL('../.tmp/ai15-all-mcp-tools.json', import.meta.url),
    JSON.stringify(
      [
        ...KnowledgeDescriptors,
        ...live.compiled.get(Discovery).descriptors(),
        ...registry.list(allRoutes).map((tool) => ({
          name: tool.toolName,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      ],
      null,
      2,
    ),
  );
  const destinationIds = [];
  for (const family of families)
    for (const module of family.modules) {
      let [row] = await db.query('SELECT id FROM modules WHERE link=$1', [
        module.route,
      ]);
      if (!row)
        [row] = await db.query(
          "INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,$2 FROM modules WHERE key='nodia_ai' RETURNING id",
          [module.route, `ai15_${module.key}`],
        );
      destinationIds.push(row.id);
    }
  check(
    'ordinary actor without destination assignments discovers no product tools',
    (await live.request()).items.length === 0,
  );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) SELECT 1,unnest($1::bigint[]) ON CONFLICT DO NOTHING',
    [destinationIds],
  );
  const [role] = await db.query(
    "INSERT INTO roles(key) VALUES('ai15_reader') RETURNING id",
  );
  await db.query(
    "INSERT INTO actions(key) VALUES('ai:manage') ON CONFLICT(key) DO NOTHING",
  );
  await db.query(
    "INSERT INTO role_actions(role_id,action_id) SELECT $1,id FROM actions WHERE key='ai:manage'",
    [role.id],
  );
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES(1,$1)', [
    role.id,
  ]);
  async function discover(actor) {
    const items = [];
    let cursor;
    do {
      const response = await live.request(
        `?${cursor ? 'cursor=' + encodeURIComponent(cursor) : ''}`,
        actor,
      );
      items.push(...response.items);
      cursor = response.next_cursor;
    } while (cursor);
    return items;
  }
  check(
    'assigned actor discovers all 67 actual read/artifact descriptors through HTTP',
    (await discover('1')).length === 67,
  );
  check(
    'super_admin discovers the same 67 descriptors without destination assignments',
    (await discover('3')).length === 67,
  );
  check(
    'unassigned second ordinary actor cannot discover another actor capabilities',
    (await discover('2')).length === 0,
  );
  const one = expectedTools.find(
    (tool) => tool.toolName === 'nodia_products_list',
  );
  const publicSchema = await live.request(
    `/nodia_products_list/schema?catalog_version=${publication.catalogVersion}`,
  );
  check(
    'HTTP exposes closed product schemas and omits executable/private material',
    publicSchema.input_schema.additionalProperties === false &&
      !JSON.stringify(publicSchema).match(/sourceJson|handler|password/),
  );
  await live.request(
    `/nodia_products_list?catalog_version=${publication.catalogVersion}`,
    '2',
    404,
  );
  check(
    'unassigned actor cannot bypass discovery by naming a real product tool',
    true,
  );

  const [owned] = await db.query(
    "INSERT INTO businesses(name,owner_id) VALUES('AI15 owned',1) RETURNING id",
  );
  const [shared] = await db.query(
    "INSERT INTO businesses(name,owner_id) VALUES('AI15 shared',2) RETURNING id",
  );
  const [hidden] = await db.query(
    "INSERT INTO businesses(name,owner_id) VALUES('AI15 hidden',2) RETURNING id",
  );
  await db.query(
    "INSERT INTO business_collaborators(business_id,user_id,action_ids) VALUES($1,1,'{}')",
    [shared.id],
  );
  const [supplier] = await db.query(
    'INSERT INTO providers(business_id,name,tax,fields) VALUES($1,\'AI15 Supplier\',0,\'{"private":"synthetic-secret"}\') RETURNING id',
    [hidden.id],
  );
  const [product] = await db.query(
    "INSERT INTO products(id,business_id,provider_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock) VALUES(9007199254740993,$1,$2,'AI15-A','Rice',100,119,20,140,0) RETURNING id",
    [hidden.id, supplier.id],
  );
  await db.query(
    "INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active) VALUES($1,'AI15-B','Inactive',100,119,20,140,1,false)",
    [hidden.id],
  );
  const [log] = await db.query(
    "INSERT INTO product_logs(product_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock) VALUES($1,'AI15-A','Rice',90,107,20,130,0) RETURNING id",
    [product.id],
  );
  const [invoice] = await db.query(
    'INSERT INTO invoices(business_id,provider_id,code,total_amount,path_storage,data) VALUES($1,$2,\'INV-15\',0,\'synthetic/private/invoice\',\'{"issue_date":"2026-10-01","private":"synthetic-secret"}\') RETURNING id',
    [hidden.id, supplier.id],
  );
  const [contact] = await db.query(
    "INSERT INTO personal_info_provider(provider_id,name,phone,schedule,creation_key,creation_hash) VALUES($1,'Sales','[{\"number\":\"+56912345678\"}]','{}',$2,$3) RETURNING id",
    [supplier.id, randomUUID(), 'a'.repeat(64)],
  );
  const categories = [];
  for (const owner of ['1', '2']) {
    const [category] = await db.query(
      "INSERT INTO finance_categories(user_id,name,key) VALUES($1,'Food','ai15_food') RETURNING id",
      [owner],
    );
    categories.push(category);
    await db.query(
      "INSERT INTO finance_movements(user_id,category_id,name,amount,type,status) VALUES($1,$2,'AI15 expense','12345','expense','paid')",
      [owner, category.id],
    );
  }
  const [property] = await db.query(
    "INSERT INTO rental_properties(owner_id,name,timezone,max_guests,minimum_turnover_minutes,created_by,updated_by) VALUES(1,'AI15 Cabin','America/Santiago',4,0,1,1) RETURNING id",
  );
  const [reservation] = await db.query(
    "INSERT INTO rental_reservations(property_id,guest_name,guest_contact,guests_count,channel,check_in_on,check_out_on,check_in_time,check_out_time,nightly_rate,total_amount,deposit_amount,status,created_by,updated_by) VALUES($1,'Synthetic guest','synthetic@example.invalid',2,'other','2027-01-10','2027-01-12','15:00','11:00',10000,20000,0,'confirmed',1,1) RETURNING id",
    [property.id],
  );
  check(
    'real product records use UUID businesses/logs and bigint strings above JS safe integer',
    product.id === '9007199254740993' && /^[a-f0-9-]{36}$/.test(log.id),
  );
  const executedTools = new Set();
  async function read(name, input, actor = '1') {
    const tool = registry.get(name);
    assert.ok(tool, name);
    return db.transaction(
      tool.readIsolation ?? 'READ COMMITTED',
      async (manager) => {
        const identity = identities.get(actor),
          authorized = await authorize.execute(
            identity,
            {
              moduleRoutes: tool.requiredModuleRoutes,
              actionKeys: tool.actionKeys,
            },
            manager,
          );
        const context = {
          manager,
          actor: authorized,
          moduleRoutes: allRoutes,
          signal: new AbortController().signal,
          statementTimeoutMs: 3000,
          maxCollectionItems: 128,
        };
        const args = registry.validateInput(tool, input);
        await tool.verifyAuthority(args, context);
        const result = registry.validateOutput(
          tool,
          await tool.handler(args, context),
        );
        if (tool.verifyResultAuthority)
          await tool.verifyResultAuthority(args, result, context);
        if (
          tool.moduleKey === 'personal_finance' ||
          tool.moduleKey === 'rental_reservations'
        ) {
          const [timeout] = await manager.query('SHOW statement_timeout');
          const milliseconds = timeout.statement_timeout.endsWith('ms')
            ? Number(timeout.statement_timeout.slice(0, -2))
            : Number(timeout.statement_timeout.slice(0, -1)) * 1000;
          assert.ok(
            milliseconds > 0 && milliseconds <= 3000,
            `${name} widened the inherited 3000ms deadline: ${timeout.statement_timeout}`,
          );
          const [isolation] = await manager.query('SHOW transaction_isolation');
          assert.equal(
            isolation.transaction_isolation,
            tool.readIsolation === 'REPEATABLE READ'
              ? 'repeatable read'
              : 'read committed',
            name,
          );
        }
        executedTools.add(name);
        return result;
      },
    );
  }
  const activeProducts = await read('nodia_products_list', {
    q: { business_id_eq: hidden.id },
    limit: 1,
  });
  check(
    'actual products list applies active default and bounded page',
    activeProducts.data.length === 1 &&
      activeProducts.data[0].id === product.id &&
      activeProducts.meta.limit === 1 &&
      activeProducts.meta.total_items === 1,
  );
  const allProducts = await read('nodia_products_list', {
    q: { business_id_eq: hidden.id },
    activity: 'all',
  });
  check(
    'explicit all includes active and inactive products without a false activity predicate',
    allProducts.data.length === 2,
  );
  check(
    'product projection preserves zero stock and bigint without business-owner restriction',
    (await read('nodia_products_get', { id: product.id })).data.stock === 0,
  );
  check(
    'snapshot queries execute real SQL and preserve UUID log IDs',
    (await read('nodia_product_logs_query', { product_ids: [product.id] }))
      .data[0].id === log.id,
  );
  const ProductService = await loadAi(
    'product/product.service',
    'ProductService',
  );
  const ProductEntity = await loadAi(
    'product/entities/product.entity',
    'Product',
  );
  const ProductLogEntity = await loadAi(
    'product/entities/product-log.entity',
    'ProductLog',
  );
  const GetLogs = await loadAi(
    'product/use-case/get-all-product-logs.use-case',
    'GetAllProductLogsUseCase',
  );
  const internalLogFilter = await db.transaction(async (manager) =>
    new GetLogs(
      new ProductService(
        manager.getRepository(ProductEntity),
        manager.getRepository(ProductLogEntity),
      ),
    ).execute({ page: 1, limit: 10, includes: false, q: { id_eq: log.id } }),
  );
  check(
    'internal native Ransack log policy accepts UUID identity without adding an HTTP or AI id filter',
    internalLogFilter.data.length === 1 &&
      internalLogFilter.data[0].id === log.id,
  );
  const invoiceResult = await read('nodia_invoices_get', { id: invoice.id });
  check(
    'invoice projection preserves zero total but excludes storage keys and arbitrary extracted JSON',
    invoiceResult.data.total_amount === 0 &&
      invoiceResult.data.has_file === true &&
      !JSON.stringify(invoiceResult).match(
        /path_storage|synthetic-secret|synthetic\/private/,
      ),
  );
  check(
    'provider zero tax and projection exclude arbitrary mapping instructions',
    (await read('nodia_providers_get', { id: supplier.id })).data.tax === 0,
  );
  const contacts = await read('nodia_provider_contacts_list', {
    provider_id: supplier.id,
  });
  check(
    'actual contact reader returns public versioned contacts without creation metadata',
    contacts.data[0].id === contact.id &&
      !JSON.stringify(contacts).match(/creation_key|creation_hash/),
  );
  const businesses = await read('nodia_businesses_list', {});
  check(
    'business list uses current ownership/collaboration and hides unrelated businesses',
    businesses.data.some((row) => row.id === owned.id) &&
      businesses.data.some((row) => row.id === shared.id) &&
      !businesses.data.some((row) => row.id === hidden.id),
  );
  await assert.rejects(
    read('nodia_businesses_get', { id: hidden.id }),
    /access/,
  );
  check(
    'business get enforces native membership even though products are globally accessible',
    true,
  );
  await assert.rejects(
    read('nodia_products_list', {
      q: { provider_id_eq: '9223372036854775808' },
    }),
    /identifier_out_of_range/,
  );
  check('bigint overflow is rejected before the domain SQL predicate', true);
  const financeOwn = await read('nodia_finance_movements_list', {});
  check(
    'finance native scope reads only the current owner ledger',
    financeOwn.data.length === 1 &&
      financeOwn.data[0].user_id === '1' &&
      financeOwn.data[0].amount === '12345',
  );
  await assert.rejects(
    read('nodia_finance_movements_list', { owner_id: '2' }),
    /scope|forbidden/i,
  );
  check('ordinary finance reader cannot select a different owner', true);
  const financeOther = await read(
    'nodia_finance_movements_list',
    { owner_id: '2' },
    '3',
  );
  check(
    'super_admin can select another real finance owner explicitly',
    financeOther.data.length === 1 && financeOther.data[0].user_id === '2',
  );
  const rental = await read('nodia_rental_properties_get', {
    property_id: property.id,
  });
  check(
    'actual rental property reader uses inherited transaction and public data',
    rental.id === property.id && rental.owner_id === '1',
  );
  const stay = await read('nodia_rental_reservations_get', {
    property_id: property.id,
    id: reservation.id,
  });
  check(
    'actual reservation reader preserves the requested property and reservation',
    stay.id === reservation.id && stay.property_id === property.id,
  );
  const users = await read('nodia_users_list', { limit: 2 });
  check(
    'Core users list executes native SQL and excludes authentication identifiers',
    users.data.length === 2 &&
      !JSON.stringify(users).match(/password|refresh_token|auth_session/),
  );
  const aiCatalog = await read('nodia_ai_providers_catalog_list', {});
  check(
    'AI catalog metadata reader executes without live inference or exposing secrets',
    Array.isArray(aiCatalog.items) &&
      !JSON.stringify(aiCatalog).match(/encrypted_key|api_key_value/),
  );

  const [businessAction] = await db.query(
    "INSERT INTO business_actions(key) VALUES('ai15_business_read') RETURNING id",
  );
  const [action] = await db.query(
    "SELECT id FROM actions WHERE key='ai:manage'",
  );
  const [module] = await db.query(
    "SELECT id FROM modules WHERE key='nodia_ai'",
  );
  const [aiProvider] = await db.query(
    'INSERT INTO ai_providers(name,fields) VALUES(\'AI15 metadata\',\'{"private":"synthetic-secret"}\') RETURNING id',
  );
  const [apiKey] = await db.query(
    "INSERT INTO ai_api_keys(provider_id,label,secret_ciphertext,secret_fingerprint,display_hint) VALUES($1,'Synthetic key','synthetic-ciphertext-only',$2,'****test') RETURNING id",
    [aiProvider.id, 'b'.repeat(64)],
  );
  await db.query(
    "INSERT INTO ai_provider_events(provider_id,api_key_id,actor_user_id,event_type,message,metadata) VALUES($1,$2,1,'synthetic_test','synthetic-secret','{\"private\":\"synthetic-secret\"}')",
    [aiProvider.id, apiKey.id],
  );
  const inputs = {
    nodia_businesses_get: { id: owned.id },
    nodia_businesses_list: {},
    nodia_invoices_get: { id: invoice.id },
    nodia_invoices_list: {},
    nodia_products_get: { id: product.id },
    nodia_products_list: {},
    nodia_product_logs_get: { id: log.id },
    nodia_product_logs_list: {},
    nodia_product_logs_query: { product_ids: [product.id] },
    nodia_providers_get: { id: supplier.id },
    nodia_providers_list: {},
    nodia_provider_contacts_list: { provider_id: supplier.id },
    nodia_actions_get: { id: action.id },
    nodia_actions_list: {},
    nodia_business_actions_get: { id: businessAction.id },
    nodia_business_actions_list: {},
    nodia_modules_get: { id: module.id },
    nodia_modules_list: {},
    nodia_module_groups_list: {},
    nodia_roles_get: { id: role.id },
    nodia_roles_list: {},
    nodia_users_list: {},
    nodia_ai_providers_list: {},
    nodia_api_keys_list: {},
    nodia_ai_events_list: {},
    nodia_ai_providers_catalog_list: {},
    nodia_ai_providers_supported_providers: {},
  };
  for (const [name, input] of Object.entries(inputs)) {
    try {
      await read(name, input);
    } catch (error) {
      throw new Error(
        `AI15 actual local read failed for ${name}: ${error.message}`,
        { cause: error },
      );
    }
  }
  const { seedAi15DomainReads } =
    await import('./nodia-ai-ai15-domain-seeds.fixture.mjs');
  const seeded = await seedAi15DomainReads(db, identities, {
    property,
    reservation,
    categories,
    owned,
    shared,
    hidden,
    supplier,
    product,
    log,
    invoice,
    contact,
  });
  Object.assign(inputs, seeded.inputs);
  for (const tool of expectedTools) {
    assert.ok(
      Object.hasOwn(inputs, tool.toolName),
      'Missing actual SQL scenario for ' + tool.toolName,
    );
    try {
      const result = await read(tool.toolName, inputs[tool.toolName]);
      assert.ok(
        !JSON.stringify(result).match(
          /synthetic-secret|synthetic-ciphertext-only|secret_ciphertext|refresh_token_hash/,
        ),
        'Private data leaked from ' + tool.toolName,
      );
    } catch (error) {
      throw new Error(
        `AI15 real SQL output failed for ${tool.toolName}: ${error.message}`,
        { cause: error },
      );
    }
  }
  check(
    'all 59 read ports execute native SQL and validate their exact output contract',
    executedTools.size === 59,
  );
  // Equal primary sort values must still form stable, disjoint pages, including UUID resources.
  const pageBusinesses = await db.query(
    "INSERT INTO businesses(name,owner_id,created_at) SELECT 'AI15-page-business-'||n,1,'2025-01-01T00:00:00' FROM generate_series(1,10) n RETURNING id",
  );
  const pageBusiness = pageBusinesses[0].id;
  const pageProviders = await db.query(
    "INSERT INTO providers(business_id,name,created_at) SELECT $1,'AI15-page-provider-'||n,'2025-01-01T00:00:00' FROM generate_series(1,10) n RETURNING id",
    [pageBusiness],
  );
  const pageProducts = await db.query(
    "INSERT INTO products(business_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,created_at) SELECT $1,'AI15-page-product-'||n,'Paging',10,12,20,15,'2025-01-01T00:00:00' FROM generate_series(1,10) n RETURNING id",
    [pageBusiness],
  );
  const pageInvoices = await db.query(
    "INSERT INTO invoices(business_id,code,created_at) SELECT $1,'AI15-page-invoice-'||n,'2025-01-01T00:00:00' FROM generate_series(1,10) n RETURNING id",
    [pageBusiness],
  );
  const pageLogs = await db.query(
    "INSERT INTO product_logs(product_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,created_at) SELECT $1,'AI15-page-log-'||n,'Paging',10,12,20,15,'2025-01-01T00:00:00' FROM generate_series(1,10) n RETURNING id",
    [pageProducts[0].id],
  );
  for (const [name, q, rows, uuidIds] of [
    [
      'nodia_businesses_list',
      { name_cont: 'AI15-page-business-' },
      pageBusinesses,
      true,
    ],
    [
      'nodia_providers_list',
      { business_id_eq: pageBusiness },
      pageProviders,
      false,
    ],
    [
      'nodia_products_list',
      { business_id_eq: pageBusiness },
      pageProducts,
      false,
    ],
    [
      'nodia_invoices_list',
      { business_id_eq: pageBusiness },
      pageInvoices,
      false,
    ],
    [
      'nodia_product_logs_list',
      { product_id_eq: pageProducts[0].id },
      pageLogs,
      true,
    ],
  ]) {
    const expected = rows
      .map((row) => row.id)
      .sort(
        uuidIds
          ? undefined
          : (a, b) =>
              BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
      );
    const actual = [];
    for (let page = 1; page <= 3; page++) {
      const result = await read(name, {
        page,
        limit: 4,
        q: { ...q, s: 'created_at desc' },
      });
      actual.push(...result.data.map((row) => row.id));
    }
    assert.deepEqual(actual, expected, name);
    assert.equal(new Set(actual).size, 10, name);
  }
  check(
    'all five business resource lists use disjoint stable pages when ten creation timestamps are identical',
    true,
  );

  check(
    'all finance and rental readers preserve the inherited three-second SQL deadline and declared isolation',
    true,
  );
  // Test-only instrumentation observes transaction guarantees without changing domain output or replacing domain handlers.
  const workerTransactions = [];
  const workerFamilies = [
    ...families.map((family) => ({
      ...family,
      capabilities: family.capabilities.map((tool) => ({
        ...tool,
        handler: async (input, context) => {
          const [isolation] = await context.manager.query(
            'SHOW transaction_isolation',
          );
          assert.equal(
            isolation.transaction_isolation,
            tool.readIsolation === 'REPEATABLE READ'
              ? 'repeatable read'
              : 'read committed',
          );
          const output = await tool.handler(input, context);
          if (
            tool.moduleKey === 'personal_finance' ||
            tool.moduleKey === 'rental_reservations'
          ) {
            const [timeout] = await context.manager.query(
              'SHOW statement_timeout',
            );
            const milliseconds = timeout.statement_timeout.endsWith('ms')
              ? Number(timeout.statement_timeout.slice(0, -2))
              : Number(timeout.statement_timeout.slice(0, -1)) * 1000;
            assert.ok(
              milliseconds > 0 && milliseconds <= 3000,
              `${tool.toolName}: ${timeout.statement_timeout}`,
            );
          }
          workerTransactions.push({
            name: tool.toolName,
            isolation: isolation.transaction_isolation,
          });
          return output;
        },
      })),
    })),
    ...fullFamilies.slice(families.length),
  ];
  const workerPublication = await createAi15PublicationFixture(workerFamilies);
  publications.push(workerPublication);
  let callbackError,
    dispatches = 0,
    scenario;
  const resourceKey = 'gemini-profile:' + 'e'.repeat(64);
  const external = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe() {
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_fixture_only',
        resourceKey,
        configurationGeneration: 'f'.repeat(64),
        sessionGeneration: 'e'.repeat(32),
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: true,
        reason: null,
      };
    },
    async verifyConfiguration() {},
    async execute(request, signal) {
      dispatches++;
      try {
        await scenario(request, signal);
      } catch (error) {
        callbackError = error;
        throw error;
      }
      return {
        kind: 'answer',
        text: 'Synthetic AI15 integration completed.',
        terminalProof: {
          engine: 'agentic',
          attemptId: request.attemptId,
          resourceKey: request.resourceKey,
          sessionGeneration: request.sessionGeneration,
          operationRef: request.attemptId,
          terminalProofId: randomUUID(),
          processClosed: true,
          outcome: 'completed',
          observedAt: new Date(),
        },
      };
    },
  };
  const workerBuilder = workerPublication
    .override(builder([Tools, Conversation, Processing, Runtime], true))
    .overrideProvider(Adapter)
    .useValue(external);
  const workerApp = await application(workerBuilder);
  const [provider] = await db.query(
    "INSERT INTO ai_providers(name,fields) VALUES('AI15 synthetic adapter','{}') RETURNING id",
  );
  const selection = {
    connection_id: provider.id,
    mode: 'token_plan_agentic',
    model_id: 'synthetic-fixture-model',
    effort_id: null,
  };
  const create = workerApp.compiled.get(Create),
    admit = workerApp.compiled.get(Admit),
    stage = workerApp.compiled.get(Stage);
  async function workerScenario(callback) {
    scenario = callback;
    callbackError = undefined;
    const identity = identities.get('1'),
      conversation = await create.execute(identity, {
        client_request_id: randomUUID(),
        selection,
      });
    const admitted = await admit.execute(
      identity,
      conversation.conversation_id,
      {
        client_message_id: randomUUID(),
        expected_conversation_revision: conversation.revision,
        parts: [{ kind: 'text', text: 'Synthetic product read.' }],
      },
    );
    const signal = new AbortController().signal,
      worker = randomUUID();
    await stage.execute(worker, signal);
    await stage.execute(worker, signal);
    if (callbackError) throw callbackError;
    const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [
      admitted.run.run_id,
    ]);
    assert.equal(
      run.state,
      'completed',
      JSON.stringify({ state: run.state, error: run.error_code }),
    );
    return run;
  }
  await workerScenario(async (request, signal) => {
    check(
      'durable worker receives actual product read descriptors and infrastructure only',
      request.tools.length === 74 &&
        request.tools.some((tool) => tool.name === one.toolName) &&
        fullExpectedTools.every((tool) =>
          request.tools.some((descriptor) => descriptor.name === tool.toolName),
        ),
    );
    const callId = randomUUID(),
      call = (name, input, id = randomUUID()) =>
        request.onToolCall({ callId: id, name, arguments: input }, signal);
    const result = await call('nodia_products_get', { id: product.id }, callId);
    const replay = await call('nodia_products_get', { id: product.id }, callId);
    assert.deepEqual(replay, result);
    check(
      'worker real SQL result and durable replay preserve public product projection',
      result.data.id === product.id && result.data.stock === 0,
    );
    const listId = randomUUID();
    await call('nodia_businesses_list', {}, listId);
    await db.query(
      'UPDATE business_collaborators SET is_active=false WHERE business_id=$1 AND user_id=1',
      [shared.id],
    );
    await assert.rejects(
      call('nodia_businesses_list', {}, listId),
      /business_scope_not_allowed|capability_denied/,
    );
    check(
      'SQL collaboration revocation blocks previously cached business-list output',
      true,
    );
    await db.query(
      'UPDATE business_collaborators SET is_active=true WHERE business_id=$1 AND user_id=1',
      [shared.id],
    );
    const [module] = await db.query(
      "SELECT id FROM modules WHERE link='/tools/business'",
    );
    await db.query(
      'DELETE FROM user_modules WHERE user_id=1 AND module_id=$1',
      [module.id],
    );
    await assert.rejects(
      call('nodia_products_get', { id: product.id }, callId),
      /capability_denied|module/i,
    );
    check(
      'destination revocation blocks replay despite a previously frozen run grant',
      true,
    );
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
      module.id,
    ]);
    await assert.rejects(
      call('nodia_products_list', { all: true }),
      /invalid_tool_input/,
    );
    check(
      'durable callback rejects unbounded input without creating a result',
      true,
    );
    const overview = await call('nodia_finance_summaries_overview', {});
    const propertyResult = await call('nodia_rental_properties_get', {
      property_id: property.id,
    });
    check(
      'one frozen worker turn reads real Finance and Rentals alongside business records',
      overview && propertyResult.id === property.id,
    );
  });
  await workerScenario(async (request, signal) => {
    check(
      'second durable run preserves the complete current 74-descriptor catalog without truncation',
      request.tools.length === 74,
    );
    const call = (name, input, callId = randomUUID()) =>
      request.onToolCall({ callId, name, arguments: input }, signal);
    await call('nodia_finance_movements_list', {});
    await call('nodia_rental_properties_get', { property_id: property.id });
    await call('nodia_businesses_get', { id: owned.id });
    const externalCallId = randomUUID();
    const engines = await call(
      'nodia_ai_providers_gemini_engines',
      {},
      externalCallId,
    );
    assert.deepEqual(engines, { engines: null });
    assert.deepEqual(
      await call('nodia_ai_providers_gemini_engines', {}, externalCallId),
      engines,
    );
    const [externalReceipt] = await db.query(
      'SELECT state,public_result FROM nodia_ai_tool_calls WHERE adapter_call_id=$1',
      [externalCallId],
    );
    check(
      'worker external read completes SQL reservation and reauthorized receipt with durable replay',
      externalReceipt.state === 'completed' &&
        externalReceipt.public_result.engines === null,
    );
    const exported = await call('nodia_products_export_csv', {
      business_id: owned.id,
    });
    assert.match(exported.artifact.reference, /^[0-9a-f-]{36}$/);
    const [artifactReceipt] = await db.query(
      'SELECT state,public_result FROM nodia_ai_tool_calls WHERE id=$1',
      [exported.artifact.reference],
    );
    check(
      'worker artifact callback stores a private current-on-download reference without CSV or URL',
      artifactReceipt.state === 'completed' &&
        artifactReceipt.public_result.artifact.semantics ===
          'current_on_download' &&
        artifactReceipt.public_result.artifact.access ===
          'authenticated_reauthorized' &&
        !JSON.stringify(artifactReceipt.public_result).match(
          /https?:|data:text|product_name/,
        ),
    );
    check(
      'per-tool transactions keep Finance repeatable-read and Rentals/business read-committed in the same worker run',
      workerTransactions.some(
        (item) =>
          item.name === 'nodia_finance_movements_list' &&
          item.isolation === 'repeatable read',
      ) &&
        workerTransactions.some(
          (item) =>
            item.name === 'nodia_rental_properties_get' &&
            item.isolation === 'read committed',
        ) &&
        workerTransactions.some(
          (item) =>
            item.name === 'nodia_businesses_get' &&
            item.isolation === 'read committed',
        ),
    );
  });
  check(
    'two actual durable worker inference stages use only a synthetic adapter and real product SQL',
    dispatches === 2,
  );
  const evidence = {
    stage: 'AI-15',
    scope:
      'compiled_nest_http_actual_domain_ports_postgresql_worker_synthetic_adapter_only',
    checks: checks.length,
    passed: checks,
    domain_read_candidates: fullExpectedTools.filter(
      (tool) => tool.kind === 'read',
    ).length,
    domain_artifact_candidates: fullExpectedTools.filter(
      (tool) => tool.kind === 'read_artifact',
    ).length,
    domain_reads_executed_and_output_validated: executedTools.size,
    business_worker_tools: 12,
    worker_domain_read_descriptors: 64,
    worker_domain_artifact_descriptors: 3,
    worker_total_mcp_descriptors: 74,
    worker_dispatches: dispatches,
    real_business_tools_published: 0,
    provider_inferences: 0,
    limits: [
      'All 67 read/artifact descriptors discovered; all 59 local SQL read outputs validated here. External/artifact execution is tested separately; no live Gemini',
      'Two worker runs carry all 67 domain capabilities plus five infrastructure tools; the adapter is synthetic and does not prove a real Gemini CLI session',
    ],
  };
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  for (const app of apps.reverse()) await app.close();
  if (ports) await ports.close();
  if (publishedPorts) await publishedPorts.close();
  for (const publication of publications) publication.close();
  await fixture.close();
}
