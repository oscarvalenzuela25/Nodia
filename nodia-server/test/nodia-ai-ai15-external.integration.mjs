// Disposable SQL snapshots + actual native use cases. Remote adapters are synthetic; no account or inference.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const Read = await loadAi(
  'nodia-ai-products/external/use-case/read-external.use-case',
  'ReadNodiaAiExternalUseCase',
);
const makeFamily = await loadAi(
  'nodia-ai-products/external/external-read.family',
  'createNodiaAiExternalReadFamily',
);
const Registry = await loadAi(
  'nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case',
  'NodiaAiToolRegistryUseCase',
);
const Authorization = await loadAi(
  'nodia-ai/nodia-ai-authorization.service',
  'NodiaAiAuthorizationService',
);
const Authorize = await loadAi(
  'nodia-ai/use-case/authorize-nodia-ai.use-case',
  'AuthorizeNodiaAiUseCase',
);
const lockAuthority = await loadAi(
  'authorization/authority-transaction',
  'lockAuthority',
);
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const encryptSecret = await loadAi(
  'ai-provider/helpers/ai-key-crypto.helper',
  'encryptSecret',
);
const generateFingerprint = await loadAi(
  'ai-provider/helpers/ai-key-crypto.helper',
  'generateFingerprint',
);
const fixture = await createNodiaAiIntegrationFixture('ai1502');
const { db, identities } = fixture;
const checks = [];
const check = (name, ok) => {
  assert.ok(ok, name);
  checks.push(name);
};
let queries = 0;
const previousLogQuery = db.logger.logQuery.bind(db.logger);
db.logger.logQuery = (...args) => {
  queries++;
  previousLogQuery(...args);
};
const authorize = new Authorize(new Authorization(db));
const controller = new AbortController();
const session = {
  available: true,
  authenticated: true,
  planType: null,
  checkedAt: null,
  reason: null,
  quotas: [
    {
      id: 'zero',
      name: null,
      primary: { usedPercent: 0, windowDurationMins: null, resetsAt: 0 },
      secondary: null,
    },
  ],
  lastInferenceAt: null,
  usageAllowed: false,
};
let cancelOnObservation = false;
let apiCalls = 0;
const ports = {
  gemini: {
    getDualEngineStatus: async (signal) => {
      signal.throwIfAborted();
      if (cancelOnObservation) controller.abort();
      return {
        active_engine: 'agentic',
        agentic: { available: true, authenticated: true },
        private: 'synthetic-private',
      };
    },
    getModelsAndQuota: async (_engine, signal) => {
      signal.throwIfAborted();
      return {
        available: true,
        authenticated: true,
        models: [
          { id: 'synthetic-discovered', name: 'Synthetic', capabilities: [] },
        ],
        supported_options: {},
      };
    },
  },
  codex: {
    observe: async (_id, signal) => {
      signal.throwIfAborted();
      return session;
    },
    snapshot: async (_id, signal) => {
      signal.throwIfAborted();
      return session;
    },
    listModels: async (_id, signal) => {
      signal.throwIfAborted();
      return [
        {
          id: 'synthetic-discovered',
          name: 'Synthetic',
          capabilities: ['vision'],
          supportedReasoningEfforts: [],
        },
      ];
    },
  },
  api: {
    listModels: async (_key, secret, signal) => {
      signal.throwIfAborted();
      assert.match(secret, /^synthetic-secret-[12]$/);
      apiCalls++;
      return [
        { id: 'synthetic-discovered', name: 'Synthetic', capabilities: [] },
      ];
    },
  },
};
const family = makeFamily(ports);
const registry = new Registry([family], 'synthetic-external');
const reads = new Read(ports);
async function phase(operation, input, actorId = '3') {
  return db.transaction(async (manager) => {
    await lockAuthority(manager);
    const tool = family.capabilities.find(
      (tool) => tool.external && tool.resourceKey === `external_${operation}`,
    );
    const actor = await authorize.execute(
      identities.get(actorId),
      { moduleRoutes: tool.requiredModuleRoutes, actionKeys: tool.actionKeys },
      manager,
    );
    const context = {
      manager,
      actor,
      moduleRoutes: tool.requiredModuleRoutes,
      maxRows: 100,
      maxCollectionItems: 128,
    };
    await tool.verifyAuthority(input, context);
    return { prepared: await reads.prepare(operation, input, context), tool };
  });
}
async function verify(prepared, tool, actorId = '3') {
  return db.transaction(async (manager) => {
    await lockAuthority(manager);
    const actor = await authorize.execute(
      identities.get(actorId),
      { moduleRoutes: tool.requiredModuleRoutes, actionKeys: tool.actionKeys },
      manager,
    );
    await prepared.verify({
      manager,
      actor,
      moduleRoutes: tool.requiredModuleRoutes,
      maxRows: 100,
      maxCollectionItems: 128,
    });
  });
}
try {
  for (const module of family.modules) {
    const rows = await db.query('SELECT id FROM modules WHERE link=$1', [
      module.route,
    ]);
    if (!rows.length)
      await db.query(
        "INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,$2 FROM modules WHERE key='nodia_ai'",
        [module.route, module.key],
      );
  }
  const [geminiCatalog] = await db.query(
    "SELECT id FROM ai_provider_catalog WHERE key='gemini'",
  );
  const [openaiCatalog] = await db.query(
    "SELECT id FROM ai_provider_catalog WHERE key='openai'",
  );
  assert.ok(geminiCatalog && openaiCatalog);
  const [gemini] = await db.query(
    "INSERT INTO ai_providers(catalog_id,name,use_agentic,default_mode,fields) VALUES($1,'Synthetic Agentic',true,'agentic',$2) RETURNING id",
    [
      geminiCatalog.id,
      JSON.stringify({
        agentic: {
          selected_model: 'synthetic-discovered',
          ocr_model: 'synthetic-discovered',
          private: 'synthetic-private',
        },
      }),
    ],
  );
  const [openai] = await db.query(
    "INSERT INTO ai_providers(catalog_id,name,use_agentic,default_mode,fields) VALUES($1,'Synthetic Agentic',true,'agentic',$2) RETURNING id",
    [
      openaiCatalog.id,
      JSON.stringify({
        agentic: {
          selected_model: 'synthetic-discovered',
          ocr_model: 'synthetic-discovered',
        },
      }),
    ],
  );
  for (const [operation, input, name] of [
    ['health', {}, 'nodia_ai_providers_health'],
    ['engines', {}, 'nodia_ai_providers_gemini_engines'],
    ['models', { provider_id: gemini.id }, 'nodia_ai_providers_models'],
    ['codex', { provider_id: openai.id }, 'nodia_ai_providers_codex_session'],
    ['eligible', {}, 'nodia_invoices_eligible_invoice_connections'],
  ]) {
    const { prepared, tool } = await phase(operation, input);
    const before = queries;
    const output = await prepared.execute(new AbortController().signal);
    check(
      `${name}: remote observation runs with zero SQL after the snapshot transaction commits`,
      queries === before,
    );
    registry.validateOutput(registry.get(name), output);
    check(
      `${name}: closed public output excludes arbitrary fields and credentials`,
      !JSON.stringify(output).includes('synthetic-private'),
    );
    await verify(prepared, tool);
    const replay = await phase(operation, input);
    check(
      `${name}: fresh authorized snapshot has the same replay fingerprint without redispatch`,
      prepared.fingerprint === replay.prepared.fingerprint,
    );
    await prepared.discard();
    await replay.prepared.discard();
  }
  for (let index = 1; index <= 2; index++) {
    const [provider] = await db.query(
      "INSERT INTO ai_providers(catalog_id,name,use_api_key,default_mode,fields) VALUES($1,$2,true,'api_key',$3) RETURNING id",
      [
        geminiCatalog.id,
        `Synthetic API ${index}`,
        JSON.stringify({ api_key: { selected_model: 'synthetic-discovered' } }),
      ],
    );
    const secret = `synthetic-secret-${index}`;
    await db.query(
      "INSERT INTO ai_api_keys(provider_id,label,display_hint,is_selected,secret_ciphertext,secret_fingerprint) VALUES($1,'Synthetic key','...test',true,$2,$3)",
      [provider.id, encryptSecret(secret), generateFingerprint(secret)],
    );
  }
  let beforePrepare = queries;
  const healthCount = await phase('health', {});
  const healthQueries = queries - beforePrepare;
  beforePrepare = queries;
  const eligibleCount = await phase('eligible', {});
  check(
    'multiple API connections resolve selected encrypted keys from the batched snapshot without N+1 SQL',
    queries - beforePrepare === healthQueries,
  );
  const eligibleOutput = await eligibleCount.prepared.execute(
    new AbortController().signal,
  );
  registry.validateOutput(
    registry.get('nodia_invoices_eligible_invoice_connections'),
    eligibleOutput,
  );
  check(
    'native API eligibility reads only synthetic selected secrets without exposing them',
    apiCalls === 2 &&
      !JSON.stringify(eligibleOutput).includes('synthetic-secret'),
  );
  await healthCount.prepared.discard();
  await eligibleCount.prepared.discard();
  const keyChange = await phase('eligible', {});
  await db.query(
    'UPDATE ai_api_keys SET secret_ciphertext=$1 WHERE id=(SELECT min(id) FROM ai_api_keys)',
    [encryptSecret('synthetic-secret-rotated')],
  );
  await assert.rejects(
    verify(keyChange.prepared, keyChange.tool),
    /capability_denied/,
  );
  check(
    'ciphertext rotation invalidates a pending snapshot even without a timestamp change',
    true,
  );
  await keyChange.prepared.discard();
  const changed = await phase('models', { provider_id: gemini.id });
  await db.query("UPDATE ai_providers SET fields='{}' WHERE id=$1", [
    gemini.id,
  ]);
  await assert.rejects(
    verify(changed.prepared, changed.tool),
    /capability_denied/,
  );
  check(
    'configuration changed during observation is rejected by fresh SQL verification',
    true,
  );
  await changed.prepared.discard();
  await db.query(
    "INSERT INTO user_modules(user_id,module_id) SELECT 1,id FROM modules WHERE link='/business'",
  );
  const ordinary = await phase('eligible', {}, '1');
  await db.query(
    "DELETE FROM user_modules WHERE user_id=1 AND module_id IN(SELECT id FROM modules WHERE link='/business')",
  );
  await assert.rejects(
    verify(ordinary.prepared, ordinary.tool, '1'),
    /capability_denied/,
  );
  check(
    'ordinary target-module revocation wins before final result publication',
    true,
  );
  await ordinary.prepared.discard();
  const cancelled = await phase('engines', {});
  cancelOnObservation = true;
  await assert.rejects(cancelled.prepared.execute(controller.signal));
  check('a late adapter response after cancellation is discarded', true);
  await cancelled.prepared.discard();
  const revokedSession = await phase('health', {});
  await db.query(
    'UPDATE auth_sessions SET revoked_at=now() WHERE public_id=$1',
    [identities.get('3').sessionId],
  );
  await assert.rejects(
    verify(revokedSession.prepared, revokedSession.tool),
    /session_expired/,
  );
  check('session revocation wins before final result publication', true);
  await revokedSession.prepared.discard();
  console.log(
    JSON.stringify(
      {
        stage: 'AI-15',
        scope: 'native_sql_snapshots_external_synthetic_adapters_no_inference',
        checks: checks.length,
        passed: checks,
        domain_external_reads: 5,
        provider_inferences: 0,
        configured_database_changes: 0,
      },
      null,
      2,
    ),
  );
} finally {
  await fixture.close();
}
