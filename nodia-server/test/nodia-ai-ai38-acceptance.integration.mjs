// Long-lived isolated acceptance API for the real UI, never AppModule/configured DB.
// Synthetic identity transport and Redis; native authorization/confirmation/effects.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

if (!/^[a-f0-9]{64}$/.test(process.env.AI38_PACKAGE_MANIFEST_SHA256 ?? ''))
  throw Error('AI38 requires the actual candidate manifest digest');
const fixture = await createNodiaAiIntegrationFixture('ai38');
const { db, options, identities } = fixture;
let app, compiled, closed = false, providerCalls = 0, storageCalls = 0, controlBusy = false;
const checks = [], requests = [];
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
const context = { environment_id: 'ai38-isolated-ui-api-sql', package_manifest_sha256: process.env.AI38_PACKAGE_MANIFEST_SHA256 };
const cleanup = async () => {
  if (closed) return;
  closed = true;
  if (app) await app.close(); else if (compiled) await compiled.close();
  await fixture.close();
};
const signal = () => { void cleanup().then(() => process.exit(0), () => process.exit(1)); };
process.once('SIGTERM', signal);
process.once('SIGINT', signal);
try {
  const names = [
    ['nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'],
    ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-proposal-review/nodia-ai-proposal-review.module', 'NodiaAiProposalReviewModule'],
    ['finance-movement/finance-movement.module', 'FinanceMovementModule'],
    ['finance-category/finance-category.module', 'FinanceCategoryModule'],
  ];
  const modules = await Promise.all(names.map(([file, name]) => loadAi(file, name)));
  const [Prepare, Claim, Execute, Redis, Adapter, Storage] = await Promise.all([
    ['nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'],
    ['nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase'],
    ['nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case', 'ExecuteNodiaAiLocalExecutionUseCase'],
    ['common/redis/redis.service', 'RedisService'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentStorage'],
  ].map(([file, name]) => loadAi(file, name)));
  const builder = Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), ...modules] });
  builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
  builder.overrideProvider(Adapter).useValue(Object.fromEntries(['observe', 'execute', 'verifyConfiguration'].map(name => [name, async () => { providerCalls++; throw Error('AI38 forbids provider access'); }])));
  builder.overrideProvider(Storage).useValue(Object.fromEntries(['put', 'get', 'delete'].map(name => [name, async () => { storageCalls++; throw Error('AI38 forbids storage access'); }])));
  compiled = await builder.compile();
  const prepare = compiled.get(Prepare), claim = compiled.get(Claim), execute = compiled.get(Execute);
  const [Policy, parser, Filter] = await Promise.all([
    loadAi('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY'),
    loadAi('nodia-ai-conversation/nodia-ai-conversation-body-parser', 'createNodiaAiConversationBodyParser'),
    loadAi('common/filters/all-exceptions.filter', 'AllExceptionsFilter'),
  ]);
  const migrations = await db.query('SELECT name FROM migrations ORDER BY timestamp,id');
  check('clean installation applies the 29 existing migrations', migrations.length === 29);
  let [financeModule] = await db.query("SELECT id::text FROM modules WHERE link='/tools/finances-personal'");
  if (!financeModule) [financeModule] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/finances-personal','personal_finance' FROM modules WHERE key='nodia_ai' RETURNING id::text");
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [financeModule.id]);
  const [category] = await db.query("INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic AI38 food','ai38_food') RETURNING id::text");
  const conversationId = randomUUID();
  await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,1,$2,$3,'Synthetic AI38 acceptance',clock_timestamp()+interval '90 days')", [conversationId, randomUUID(), 'a'.repeat(64)]);
  const [message] = await db.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',1,$3,'sealed',$4,clock_timestamp(),$5) RETURNING id", [randomUUID(), conversationId, randomUUID(), { schema_version: 1, module_routes: ['/tools/finances-personal'] }, 'b'.repeat(64)]);
  await db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','Synthetic AI38 earlier owner message')", [message.id, conversationId]);
  const partial = { name: 'Synthetic AI38 visible expense', amount: '20000', category_id: category.id, type: 'expense', status: 'paid' };
  const prepared = await db.transaction(manager => prepare.execute(manager, identities.get('1'), { conversationId, toolName: 'nodia_finance_movements_prepare_create', partial }));
  assert.equal(prepared.status, 'ready');
  let currentProposal = prepared.proposal;
  const count = async table => (await db.query(`SELECT count(*)::int n FROM ${table}`))[0].n;
  check('native preparation creates an exact preview and no financial effect', await count('finance_movements') === 0 && currentProposal.steps.length === 1);
  const manifest = async () => {
    const [proposal] = await db.query('SELECT p.id AS proposal_id,r.revision,r.hash FROM nodia_ai_proposals p JOIN nodia_ai_proposal_revisions r ON r.proposal_id=p.id AND r.revision=p.current_revision WHERE p.id=$1', [currentProposal.proposal_id]);
    return { context, conversation_id: conversationId, proposal, migrations: migrations.length };
  };
  const snapshot = async () => ({
    finance_count: await count('finance_movements'),
    movements: await db.query('SELECT id::text,name,amount::text FROM finance_movements ORDER BY id'),
    executions: await db.query('SELECT id,state,revision FROM nodia_ai_executions ORDER BY created_at,id'),
    receipts: await db.query('SELECT execution_id,position,state,minimal_receipt FROM nodia_ai_execution_steps ORDER BY execution_id,position'),
    pending_jobs: (await db.query("SELECT count(*)::int n FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')"))[0].n,
    provider_calls: providerCalls, storage_calls: storageCalls,
  });
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/nodia-ai', parser(compiled.get(Policy).admission.http_json_bytes));
  app.useGlobalFilters(new Filter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards({ canActivate(ctx) {
    const request = ctx.switchToHttp().getRequest(), identity = identities.get(request.headers['x-fixture-actor']);
    if (!identity) throw new UnauthorizedException();
    request.auth = { user: { id: identity.userId }, sessionId: identity.sessionId };
    return true;
  } });
  const express = app.getHttpAdapter().getInstance();
  express.use('/api/v1', (req, res, next) => {
    res.on('finish', () => requests.push({ method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode }));
    next();
  });
  express.get('/__ai38/manifest', (_req, res, next) => { manifest().then(value => res.json(value), next); });
  express.get('/__ai38/snapshot', (_req, res, next) => { snapshot().then(value => res.json(value), next); });
  // Closed private fixture controls. These are not application endpoints/tools.
  express.post('/__ai38/control/:action', async (req, res) => {
    if (controlBusy) return res.status(409).json({ error: 'fixture_busy' });
    controlBusy = true;
    try {
      switch (req.params.action) {
        case 'execute': {
          const lease = await claim.execute(randomUUID());
          if (!lease) return res.status(409).json({ error: 'no_owned_execution' });
          await execute.execute(identities.get('1'), lease.executionId, lease);
          break;
        }
        case 'revoke-finance':
          await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [financeModule.id]);
          break;
        case 'restore-finance':
          await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [financeModule.id]);
          break;
        case 'new-cancellable-preview': {
          const next = await db.transaction(manager => prepare.execute(manager, identities.get('1'), { conversationId, toolName: 'nodia_finance_movements_prepare_create', partial: { ...partial, name: 'Synthetic AI38 cancelled expense' } }));
          assert.equal(next.status, 'ready');
          currentProposal = next.proposal;
          break;
        }
        default: return res.status(404).json({ error: 'unsupported_fixture_action' });
      }
      res.json(await snapshot());
    } catch (error) { res.status(500).json({ error: error.message }); }
    finally { controlBusy = false; }
  });
  express.get('/__ai38/report', async (_req, res) => res.json({ stage: 'AI-38', scope: 'isolated_real_ui_http_sql_synthetic_auth_and_redis', context, checks, requests, ...(await snapshot()), configured_database_used: false, provider_inference: false, storage_used: false, production_acceptance: false }));
  await app.listen(47838, '127.0.0.1');
  console.log(JSON.stringify({ stage: 'AI-38', ready: true, url: await app.getUrl(), ...await manifest() }));
} catch (error) {
  await cleanup();
  throw error;
}
