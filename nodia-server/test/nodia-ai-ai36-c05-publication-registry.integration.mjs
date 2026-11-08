// Actual R09 module composition and publication. PostgreSQL/actors are disposable;
// external services throw on use. No publication override or domain handler runs.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const raw = await readFile(
  new URL('../release-manifest.json', import.meta.url),
);
assert.equal(
  sha(raw),
  'edd279fa5f5f99a7529adcf4cf75b7016505bf6581fc57cb85a3000cf802ff85',
);
const manifestBytes = await readFile(
  new URL('../dist/nodia-ai/knowledge/manifest.json', import.meta.url),
);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.capability_contracts.length, 150);
assert.equal(manifest.fragments.length, 41);
const baselineBytes = await readFile(
  new URL(
    '../../docs/evidence/nodia-ai-ai36-c05-write-publication-r02-baseline.json',
    import.meta.url,
  ),
);
assert.equal(
  sha(baselineBytes),
  'f72f3cbd410d7b8c7cf1d57c4c823840afec7daeeac5398db26db2a9e0ddc957',
);
const prior = JSON.parse(baselineBytes).registry.capabilities;
assert.equal(prior.length, 74);
for (const cap of prior)
  assert.deepEqual(
    manifest.capability_contracts.filter(
      (c) => c.capability_id === cap.capability_id,
    ),
    [cap],
  );
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const fixture = await createNodiaAiIntegrationFixture('ai3609');
let compiled,
  report,
  externalCalls = 0;
const checks = [],
  check = (name, value) => {
    assert.ok(value, name);
    checks.push(name);
  };
try {
  const paths = [
    ['nodia-ai-context/nodia-ai-context.module', 'NodiaAiContextModule'],
    [
      'nodia-ai-tools/nodia-ai-tool-registry.module',
      'NodiaAiToolRegistryModule',
    ],
    [
      'nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case',
      'NodiaAiToolRegistryUseCase',
    ],
    [
      'nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case',
      'LoadNodiaAiKnowledgeUseCase',
    ],
    [
      'nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case',
      'DiscoverNodiaAiToolsUseCase',
    ],
    [
      'nodia-ai/use-case/authorize-nodia-ai.use-case',
      'AuthorizeNodiaAiUseCase',
    ],
    ['common/redis/redis.service', 'RedisService'],
    ['common/ai/gemini.service', 'GeminiService'],
    ['common/ai/api-provider.service', 'ApiProviderService'],
    ['common/ai/codex/codex-runtime.service', 'CodexRuntimeService'],
    ['common/ai/codex/codex-chat-runtime', 'CodexChatRuntime'],
  ];
  const [
    Context,
    RegistryModule,
    Registry,
    Loader,
    Discovery,
    Authorize,
    Redis,
    ...externalTypes
  ] = await Promise.all(paths.map(([p, n]) => loadAi(p, n)));
  const forbidden = () => {
    externalCalls++;
    throw Error('synthetic_registry_external_IO_forbidden');
  };
  const blocked = new Proxy(
    {},
    {
      get: (target, key) =>
        key === 'then' ||
        key === 'beforeApplicationShutdown' ||
        String(key).startsWith('onModule') ||
        String(key).startsWith('onApplication') ||
        typeof key === 'symbol'
          ? undefined
          : Reflect.has(target, key)
            ? Reflect.get(target, key)
            : forbidden,
    },
  );
  const builder = Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => fixture.options,
        dataSourceFactory: async () => fixture.db,
      }),
      RegistryModule,
      Context,
    ],
  });
  builder.overrideProvider(Redis).useValue({
    get: async () => null,
    set: async () => {},
    del: async () => {},
  });
  for (const type of externalTypes)
    builder.overrideProvider(type).useValue(blocked);
  compiled = await builder.compile();
  const registry = compiled.get(Registry),
    loader = compiled.get(Loader),
    discover = compiled.get(Discovery),
    authorize = compiled.get(Authorize);
  const routes = [
    ...new Set([
      '/nodia-ai',
      ...manifest.capability_contracts.flatMap((c) => c.required_module_routes),
    ]),
  ];
  const registered = registry.list(routes),
    contracts = registry.publishedContracts();
  check(
    'actual registry composes exactly all 150 published IDs without a synthetic publication override',
    registered.length === 150 &&
      contracts.length === 150 &&
      registered.every((t) =>
        manifest.capability_contracts.some(
          (c) => c.capability_id === t.toolName,
        ),
      ),
  );
  check(
    'actual pinned knowledge loader agrees with the composed registry for all 150 contracts and 41 fragments',
    loader.manifest.release_id === manifest.release_id &&
      loader.manifest.capability_contracts.length === 150 &&
      loader.manifest.fragments.length === 41,
  );
  const oldIds = new Set(prior.map((c) => c.capability_id)),
    added = registered.filter((t) => !oldIds.has(t.toolName));
  check(
    'exactly 72 change preparations and four secure preparations are added with the analyzer absent',
    added.length === 76 &&
      added.filter((t) => t.kind === 'prepare_change').length === 72 &&
      added.filter((t) => t.kind === 'prepare_secure_flow').length === 4 &&
      !registered.some((t) => t.toolName === 'nodia_invoices_analyze'),
  );
  for (const c of contracts) {
    const p = manifest.capability_contracts.find(
      (m) => m.capability_id === c.capability_id,
    );
    assert.equal(c.input_schema_sha256, p.input_schema.sha256);
    assert.equal(c.output_schema_sha256, p.output_schema.sha256);
    assert.equal(c.revision, p.revision);
    assert.deepEqual(c.required_module_routes, p.required_module_routes);
    assert.equal(c.kind, p.kind);
  }
  check(
    'registered native contract hashes and route/kind metadata agree with the real release manifest',
    true,
  );
  const db = fixture.db;
  const module = async (route, key) => {
    let [row] = await db.query('SELECT id::text FROM modules WHERE link=$1', [
      route,
    ]);
    if (!row)
      [row] = await db.query(
        "INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,$2 FROM modules WHERE key='nodia_ai' RETURNING id::text",
        [route, key],
      );
    assert.ok(row);
    return row.id;
  };
  const users = await module('/users', 'synthetic_registry_users');
  const ai = await module('/ai-providers', 'synthetic_registry_ai');
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
    users,
  ]);
  const view = (id) =>
    db.transaction(async (manager) => {
      const actor = await authorize.execute(
        fixture.identities.get(id),
        {},
        manager,
      );
      assert.equal(actor.isSuperAdmin, false);
      const ownRoutes = actor.modules.map((m) => m.route);
      return {
        tools: (await discover.visible(manager, actor, ownRoutes)).map(
          (t) => t.toolName,
        ),
        knowledge: loader.index(ownRoutes),
      };
    });
  const partial = await view('1');
  check(
    'ordinary actor assigned only users discovers users preparation but no roles/module administration',
    partial.tools.includes('nodia_users_prepare_create') &&
      partial.tools.includes('nodia_users_prepare_update') &&
      !partial.tools.includes('nodia_roles_prepare_create') &&
      !partial.tools.includes('nodia_modules_prepare_create'),
  );
  check(
    'broad Core explanation is excluded unless its complete route union is granted',
    !partial.knowledge.some(
      (k) =>
        k.id.endsWith(':ai36-c05-c01-writes') &&
        k.id.startsWith('general-settings.confirmed-administration:'),
    ),
  );
  const ordinary = await view('2');
  check(
    'own-session logout remains discoverable with NodiaAI alone while credential/login administration is absent',
    ordinary.tools.includes('nodia_secure_flows_prepare_nodia_logout') &&
      !ordinary.tools.includes('nodia_secure_flows_prepare_api_key_create') &&
      !ordinary.tools.includes('nodia_secure_flows_prepare_connection_login'),
  );
  check(
    'own logout knowledge is separate from administrative credential knowledge',
    ordinary.knowledge.some((k) => k.id.endsWith(':ai36-c05-own-logout')) &&
      !ordinary.knowledge.some((k) => k.id.endsWith(':ai36-c05-secure-ai')),
  );
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(2,$1)', [
    ai,
  ]);
  check(
    'provider module assignment alone does not confer ai:manage',
    !(await view('2')).tools.includes(
      'nodia_secure_flows_prepare_api_key_create',
    ),
  );
  const [role] = await db.query(
    "INSERT INTO roles(key) VALUES('synthetic_registry_ai_manager') RETURNING id::text",
  );
  const [action] = await db.query(
    "INSERT INTO actions(key) VALUES('ai:manage') ON CONFLICT(key) DO UPDATE SET is_active=true RETURNING id::text",
  );
  await db.query('INSERT INTO role_actions(role_id,action_id) VALUES($1,$2)', [
    role.id,
    action.id,
  ]);
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES(2,$1)', [
    role.id,
  ]);
  const manager = await view('2');
  check(
    'actual current module plus ai:manage reveals exactly the three administrative secure preparers',
    ['api_key_create', 'api_key_update', 'connection_login'].every((k) =>
      manager.tools.includes('nodia_secure_flows_prepare_' + k),
    ) && manager.knowledge.some((k) => k.id.endsWith(':ai36-c05-secure-ai')),
  );
  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1', [
    ai,
  ]);
  const revoked = await view('2');
  check(
    'revocation removes administrative tools and fragment without removing own-session logout',
    !revoked.tools.includes('nodia_secure_flows_prepare_connection_login') &&
      !revoked.knowledge.some((k) => k.id.endsWith(':ai36-c05-secure-ai')) &&
      revoked.tools.includes('nodia_secure_flows_prepare_nodia_logout'),
  );
  const [effects] = await db.query(
    'SELECT (SELECT count(*) FROM nodia_ai_executions)::int executions,(SELECT count(*) FROM nodia_ai_jobs)::int jobs,(SELECT count(*) FROM ai_api_keys)::int keys,(SELECT count(*) FROM finance_movements)::int movements',
  );
  check(
    'metadata/discovery never invokes external services, execution, login, keys or domain writers',
    externalCalls === 0 && Object.values(effects).every((n) => n === 0),
  );
  report = {
    stage: 'AI36-C05-publication-registry',
    status: 'passed',
    checks: checks.length,
    results: checks,
    published: 150,
    actual_registry_and_knowledge_DI: true,
    original_contracts_exact: 74,
    added_change: 72,
    added_secure: 4,
    synthetic_publication_override: false,
    configured_database_used: false,
    domain_handlers_invoked: false,
    fixture_permission_setup_only: true,
  };
} finally {
  try {
    if (compiled) await compiled.close();
  } finally {
    await fixture.close();
  }
}
assert.equal(
  externalCalls,
  0,
  'external IO remains denied through module and fixture closure',
);
console.log(
  JSON.stringify({
    ...report,
    SDK_requests: externalCalls,
    cleanup_completed_before_report: true,
  }),
);
