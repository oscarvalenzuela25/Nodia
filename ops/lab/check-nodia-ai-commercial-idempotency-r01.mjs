// Laboratory verifier: only EXISTING completed fixture executions. No challenge issuance or first confirmation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const SOURCE = '/opt/nodia/releases/nodia-server-image-generation-r03';
export const SOURCE_SHA = '5acd9f042b8cf8d617d5985eb10735687aaeccdac05d46973c9687f0d37848fe';
const BUSINESS = '5af15373-3638-4a02-a015-4e72c433fc11';
const IDS = ['1', '2', '3', '4', '5', '6'];
const TOOL = 'nodia_products_prepare_update';
const TOKEN = 'B'.repeat(42) + 'A'; // Syntactically valid, NOT a real nonce. Existing duplicate branch never uses it.
const sha = value => createHash('sha256').update(value).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fail = code => { throw new Error(code); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
export const INPUT_SCHEMA = { type: 'object', additionalProperties: false,
  required: ['schema_version', 'source_run_id', 'actor', 'execution_ids'], properties: {
    schema_version: { const: 1 }, source_run_id: { type: 'string', format: 'uuid' },
    actor: { type: 'object', additionalProperties: false, required: ['userId', 'sessionId'], properties: {
      userId: { type: 'string', pattern: '^[1-9][0-9]{0,18}$' }, sessionId: { type: 'string', format: 'uuid' },
    } }, execution_ids: { type: 'array', minItems: 1, maxItems: 4, uniqueItems: true, items: { type: 'string', format: 'uuid' } },
  } };
export function validateInput(v) {
  if (!exact(v, ['schema_version', 'source_run_id', 'actor', 'execution_ids']) || v.schema_version !== 1
      || typeof v.source_run_id !== 'string' || !uuid.test(v.source_run_id)
      || !exact(v.actor, ['userId', 'sessionId']) || typeof v.actor.userId !== 'string'
      || !/^[1-9][0-9]{0,18}$/.test(v.actor.userId) || BigInt(v.actor.userId) > 9223372036854775807n
      || typeof v.actor.sessionId !== 'string' || !uuid.test(v.actor.sessionId)
      || !Array.isArray(v.execution_ids) || v.execution_ids.length < 1 || v.execution_ids.length > 4
      || v.execution_ids.some(id => typeof id !== 'string' || !uuid.test(id))
      || new Set(v.execution_ids).size !== v.execution_ids.length) fail('commercial_check_input_invalid');
  return structuredClone(v);
}
export function assertReadOrLockSQL(sql) {
  if (typeof sql !== 'string') fail('commercial_check_SQL_denied');
  const text = sql.trim();
  // Production sources are manifest-pinned; no SQL comes from model/input. Allow actual authority/row locks.
  if (!/^(SELECT\b|LOCK TABLE\b|SET (?:LOCAL|TRANSACTION)\b|START TRANSACTION\b|COMMIT\b|ROLLBACK\b)/i.test(text)
      || /;\s*\S/.test(text) || /\b(?:nextval|setval|dblink_exec|lo_import|lo_export|pg_write_file)\s*\(/i.test(text))
    fail('commercial_check_SQL_denied');
}
export function assertFixtureStep(step) {
  const template = step.command_template;
  const command = template?.command;
  if (step.tool_name !== TOOL || step.output_bindings?.length !== 0 || !IDS.includes(template?.id)
      || template.business_id !== BUSINESS || template.schema_version !== 1
      || !exact(step.scope, ['business_id']) || step.scope.business_id !== BUSINESS
      || !exact(command, ['cost_price', 'cost_price_tax'])) fail('commercial_check_not_fixture_update');
  const isUp = ['1', '4'].includes(template.id), isDown = ['2', '5'].includes(template.id);
  if ((!isUp && !isDown) || command.cost_price !== (isUp ? 1200 : 800)
      || command.cost_price_tax !== (isUp ? 1428 : 952)) fail('commercial_check_not_fixture_update');
  return template.id;
}
function verifySource() {
  if (fs.realpathSync(process.cwd()) !== SOURCE || fs.realpathSync(SOURCE) !== SOURCE) fail('commercial_check_source_cwd_mismatch');
  const raw = fs.readFileSync(path.join(SOURCE, 'release-manifest.json'));
  if (sha(raw) !== SOURCE_SHA) fail('commercial_check_source_manifest_mismatch');
  const manifest = JSON.parse(raw.toString('utf8'));
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) fail('commercial_check_manifest_invalid');
  for (const [relative, pin] of Object.entries(manifest.files)) {
    if (path.posix.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..')) fail('commercial_check_path_invalid');
    const file = path.join(SOURCE, relative), stat = fs.lstatSync(file);
    const expected = typeof pin === 'string' ? pin : exact(pin, ['sha256', 'bytes']) ? pin.sha256 : null;
    if (!stat.isFile() || stat.isSymbolicLink() || !/^[a-f0-9]{64}$/.test(expected ?? '')
        || sha(fs.readFileSync(file)) !== expected || (typeof pin === 'object' && pin.bytes !== stat.size)) fail('commercial_check_source_file_mismatch');
  }
}

async function execute(input) {
  verifySource();
  if (['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'].some(k => !process.env[k])) fail('commercial_check_private_environment_missing');
  const require = createRequire(path.join(SOURCE, 'package.json'));
  require('reflect-metadata');
  const load = async (relative, name) => (await import(pathToFileURL(path.join(SOURCE, 'dist', relative + '.js')).href))[name];
  const specs = {
    DataSource: ['config/data-source', 'default'],
    Product: ['product/entities/product.entity', 'Product'], ProductLog: ['product/entities/product-log.entity', 'ProductLog'],
    Business: ['business/entities/business.entity', 'Business'], Collaborator: ['business/entities/business-collaborator.entity', 'BusinessCollaborator'],
    BusinessAction: ['business-action/entities/business-action.entity', 'BusinessAction'], Provider: ['provider/entities/provider.entity', 'Provider'],
    UserRole: ['user/entities/user-role.entity', 'UserRole'], Translation: ['translation/entities/translation.entity', 'Translation'],
    ProductService: ['product/product.service', 'ProductService'], BusinessService: ['business/business.service', 'BusinessService'],
    TranslationService: ['translation/translation.service', 'TranslationService'],
    CreateBusiness: ['business/use-case/create-business.use-case', 'CreateBusinessUseCase'], UpdateBusiness: ['business/use-case/update-business.use-case', 'UpdateBusinessUseCase'],
    AssignCollaborators: ['business/use-case/assign-business-collaborators.use-case', 'AssignBusinessCollaboratorsUseCase'],
    CreateProduct: ['product/use-case/create-product.use-case', 'CreateProductUseCase'], UpdateProduct: ['product/use-case/update-product.use-case', 'UpdateProductUseCase'],
    CreateLog: ['product/use-case/create-product-log.use-case', 'CreateProductLogUseCase'], UpdateLog: ['product/use-case/update-product-log.use-case', 'UpdateProductLogUseCase'],
    BusinessStore: ['nodia-ai-business-catalog/nodia-ai-business-catalog.service', 'NodiaAiBusinessCatalogService'],
    BusinessBuilder: ['nodia-ai-business-catalog/use-case/build-nodia-ai-business-catalog-operations.use-case', 'BuildNodiaAiBusinessCatalogOperationsUseCase'],
    AuthorizationStore: ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'],
    Authorize: ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ConversationStore: ['nodia-ai-conversation/nodia-ai-conversation.service', 'NodiaAiConversationService'],
    AuthorizeChat: ['nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case', 'AuthorizeNodiaAiConversationUseCase'],
    ProposalStore: ['nodia-ai-proposal/nodia-ai-proposal.service', 'NodiaAiProposalService'],
    Canonical: ['nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case', 'CanonicalizeNodiaAiProposalUseCase'],
    ProposalValidator: ['nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case', 'ValidateNodiaAiProposalUseCase'],
    GetProposal: ['nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case', 'GetNodiaAiProposalUseCase'],
    ConfirmationStore: ['nodia-ai-confirmation/nodia-ai-confirmation.service', 'NodiaAiConfirmationService'],
    ConfirmationValidator: ['nodia-ai-confirmation/use-case/validate-nodia-ai-confirmation.use-case', 'ValidateNodiaAiConfirmationUseCase'],
    Availability: ['nodia-ai-confirmation/use-case/nodia-ai-confirmation-availability.use-case', 'NodiaAiConfirmationAvailabilityUseCase'],
    GetExecution: ['nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case', 'GetNodiaAiExecutionUseCase'],
    Confirm: ['nodia-ai-confirmation/use-case/confirm-nodia-ai-proposal.use-case', 'ConfirmNodiaAiProposalUseCase'],
    ValidatePolicy: ['nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase'],
    LockAuthority: ['authorization/authority-transaction', 'lockAuthority'],
    BusinessAccess: ['business-access/business-access', 'assertBusinessesAccess'],
  };
  const classes = Object.fromEntries(await Promise.all(Object.entries(specs).map(async ([key, spec]) => [key, await load(...spec)])));
  const c = classes, db = c.DataSource;
  // No schema installation or synchronization, even during connection initialization.
  db.setOptions({ installExtensions: false, synchronize: false, migrationsRun: false, logging: false });
  let statements = 0, deniedSQL = 0;
  const createRunner = db.createQueryRunner.bind(db);
  db.createQueryRunner = (...args) => {
    const runner = createRunner(...args), query = runner.query.bind(runner);
    runner.query = async (sql, ...rest) => {
      try { assertReadOrLockSQL(sql); } catch (e) { deniedSQL++; throw e; }
      statements++;
      return query(sql, ...rest);
    };
    return runner;
  };
  await db.initialize();
  try {
    const repo = Entity => db.getRepository(Entity);
    const productService = new c.ProductService(repo(c.Product), repo(c.ProductLog));
    const translationService = new c.TranslationService(repo(c.Translation));
    const businessService = new c.BusinessService(repo(c.Business), repo(c.Collaborator), repo(c.BusinessAction), repo(c.Product), repo(c.Provider), repo(c.UserRole), translationService);
    const ports = new c.BusinessBuilder(new c.BusinessStore(), new c.CreateBusiness(businessService), new c.UpdateBusiness(businessService), new c.AssignCollaborators(businessService),
      new c.CreateProduct(productService), new c.UpdateProduct(productService), new c.CreateLog(productService), new c.UpdateLog(productService)).operations.filter(port => port.toolName === TOOL);
    if (ports.length !== 1) fail('commercial_check_product_port_missing');
    const policy = new c.ValidatePolicy().execute(JSON.parse(fs.readFileSync(path.join(SOURCE, 'dist/nodia-ai-runtime/config/runtime-policy.json'), 'utf8')));
    const common = fs.readFileSync(path.join(SOURCE, 'dist/nodia-ai-tools/config/common-schema.json'), 'utf8');
    const canonical = new c.Canonical(policy), authorize = new c.Authorize(new c.AuthorizationStore(db));
    const authorizeChat = new c.AuthorizeChat(new c.ConversationStore(db), authorize);
    const proposalValidator = new c.ProposalValidator(ports, common, policy, canonical);
    const get = new c.GetProposal(new c.ProposalStore(db), authorize, authorizeChat, proposalValidator, policy);
    const store = new c.ConfirmationStore(db), validator = new c.ConfirmationValidator(common, canonical);
    const availability = new c.Availability(ports.map(port => ({ toolName: port.toolName, contractHash: port.contractHash,
      catalogVersion: port.catalogVersion, bindableFields: port.bindableFields, outputKeys: port.outputKeys })));
    const status = new c.GetExecution(store, get, validator, policy, availability);
    const confirm = new c.Confirm(store, get, validator, proposalValidator, availability, status, policy);
    let challengeReads = 0;
    const originalChallenge = store.challenge.bind(store);
    store.challenge = (...args) => { challengeReads++; return originalChallenge(...args); };
    async function inspect() {
      return db.transaction(async manager => {
        await c.LockAuthority(manager);
        await authorize.execute(input.actor, {}, manager);
        await c.BusinessAccess(manager, input.actor, [BUSINESS], { lock: true });
        const owned = await manager.query(`SELECT r.id FROM nodia_ai_runs r JOIN nodia_ai_conversations chat ON chat.id=r.conversation_id
          JOIN auth_sessions s ON s.user_id=r.actor_id AND s.public_id=$3 WHERE r.id=$1 AND r.actor_id=$2 AND chat.owner_id=$2
          AND r.created_at>=s.created_at AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
          AND chat.lifecycle='active' AND chat.expires_at>clock_timestamp()`, [input.source_run_id, input.actor.userId, input.actor.sessionId]);
        if (owned.length !== 1) fail('commercial_check_fresh_owned_session_run_required');
        const [quiet] = await manager.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN('ready','leased','waiting','unknown') OR (kind='reconcile' AND state<>'done')) jobs,
          (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) attempts,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') slots`);
        if (Object.values(quiet).some(count => count !== 0)) fail('commercial_check_runtime_not_quiet');
        const products = await manager.query('SELECT to_jsonb(p) row FROM products p WHERE id=ANY($1::bigint[]) AND business_id=$2 ORDER BY id', [IDS, BUSINESS]);
        if (products.length !== 6) fail('commercial_check_fixture_products_missing');
        for (const { row } of products) {
          const id = String(row.id), n = Number(id) - 1, lane = n < 3 ? 'CDX' : 'AGY', direction = ['UP', 'DOWN', 'SAME'][n % 3];
          if (!IDS.includes(id) || row.code !== `QA-NODIA-CLOSE-${lane}-${direction}-20261026` || String(row.provider_id) !== '1'
              || row.stock !== 0 || row.profit_percentage !== 30 || row.sale_price !== 1547 || row.is_active !== true) fail('commercial_check_fixture_product_changed');
        }
        const executions = [];
        for (const id of input.execution_ids) {
          const execution = await store.execution(manager, id);
          if (!execution || execution.state !== 'completed' || execution.actor_id !== input.actor.userId
              || execution.chat_owner_id !== input.actor.userId || !execution.proposal_id || execution.proposal_id !== execution.origin_proposal_id) fail('commercial_check_existing_completed_execution_required');
          const loaded = await get.load(manager, input.actor, execution.proposal_id, 'read', execution.origin_proposal_revision);
          if (loaded.revision.state !== 'confirmed' || loaded.steps.length !== 1 || loaded.revision.hash !== execution.proposal_hash) fail('commercial_check_confirmed_single_step_required');
          const targetId = assertFixtureStep(loaded.steps[0]);
          const read = await status.load(manager, input.actor, id);
          if (read.execution_id !== id || read.state !== 'completed') fail('commercial_check_status_not_completed');
          executions.push({ id, proposal_id: execution.proposal_id, client_request_id: execution.client_request_id,
            proposal_revision: execution.origin_proposal_revision, expected_hash: execution.proposal_hash, product_id: targetId });
        }
        const proposalIds = executions.map(row => row.proposal_id);
        const snapshots = {
          products,
          logs: await manager.query('SELECT to_jsonb(l) row FROM product_logs l WHERE product_id=ANY($1::bigint[]) ORDER BY id', [IDS]),
          executions: await manager.query('SELECT to_jsonb(e) row FROM nodia_ai_executions e WHERE origin_proposal_id=ANY($1::uuid[]) ORDER BY id', [proposalIds]),
          execution_steps: await manager.query('SELECT to_jsonb(s) row FROM nodia_ai_execution_steps s WHERE execution_id=ANY($1::uuid[]) ORDER BY id', [input.execution_ids]),
          proposals: await manager.query('SELECT to_jsonb(p) row FROM nodia_ai_proposals p WHERE id=ANY($1::uuid[]) ORDER BY id', [proposalIds]),
          revisions: await manager.query('SELECT to_jsonb(r) row FROM nodia_ai_proposal_revisions r WHERE proposal_id=ANY($1::uuid[]) ORDER BY proposal_id,revision', [proposalIds]),
          proposal_steps: await manager.query('SELECT to_jsonb(s) row FROM nodia_ai_proposal_steps s WHERE proposal_id=ANY($1::uuid[]) ORDER BY id', [proposalIds]),
          challenges: await manager.query('SELECT to_jsonb(c) row FROM nodia_ai_confirmation_challenges c WHERE proposal_id=ANY($1::uuid[]) ORDER BY id', [proposalIds]),
        };
        return { executions, snapshots: Object.fromEntries(Object.entries(snapshots).map(([key, rows]) => [key, { count: rows.length, sha256: sha(JSON.stringify(rows)) }])) };
      });
    }
    const before = await inspect(), results = [];
    for (const row of before.executions) {
      const request = { client_request_id: row.client_request_id, proposal_revision: row.proposal_revision,
        expected_hash: row.expected_hash, confirmation_token: TOKEN };
      const duplicate = await confirm.execute(input.actor, row.proposal_id, request);
      if (duplicate.execution.execution_id !== row.id || duplicate.execution.state !== 'completed') fail('commercial_check_duplicate_result_changed');
      let rejected = false;
      try { await confirm.execute(input.actor, row.proposal_id, { ...request, client_request_id: randomUUID() }); }
      catch (error) { rejected = error.getStatus?.() === 409 && error.message === 'nodia_ai:proposal_already_confirmed'; if (!rejected) throw error; }
      if (!rejected) fail('commercial_check_new_request_not_rejected');
      results.push({ execution_id: row.id, proposal_id: row.proposal_id, product_id: row.product_id,
        original_request_same_execution: true, new_request_rejected: 'nodia_ai:proposal_already_confirmed' });
    }
    const after = await inspect();
    if (JSON.stringify(before) !== JSON.stringify(after) || challengeReads !== 0 || deniedSQL !== 0) fail('commercial_check_snapshot_or_branch_changed');
    return { status: 'real_confirmation_duplicate_verified_no_effect', source_manifest_sha256: SOURCE_SHA,
      results, before: before.snapshots, after: after.snapshots, snapshots_identical: true,
      actual_authorization_and_Get_load_used: true, actual_product_preparer_authority_used: true,
      synthetic_unused_token_only: true, challenge_reads: challengeReads, newly_issued_challenges: 0,
      SQL_mutation_statements_allowed: false, rejected_SQL_statements: deniedSQL, observed_read_or_lock_statements: statements,
      provider_generations: 0, SDK_calls: 0, new_business_effects: 0 };
  } finally { await db.destroy(); }
}

function selfTest() {
  assertReadOrLockSQL('SELECT * FROM products WHERE id=$1 FOR UPDATE');
  assertReadOrLockSQL('LOCK TABLE auth_sessions IN SHARE MODE');
  assert.throws(() => assertReadOrLockSQL('INSERT INTO products(id) VALUES(1)'), /SQL_denied/);
  assert.throws(() => assertReadOrLockSQL('WITH x AS (DELETE FROM products RETURNING *) SELECT * FROM x'), /SQL_denied/);
  assert.throws(() => assertReadOrLockSQL('SELECT 1; DELETE FROM products'), /SQL_denied/);
  const step = { tool_name: TOOL, output_bindings: [], scope: { business_id: BUSINESS },
    command_template: { schema_version: 1, business_id: BUSINESS, id: '1', command: { cost_price: 1200, cost_price_tax: 1428 } } };
  assert.equal(assertFixtureStep(step), '1');
  assert.throws(() => assertFixtureStep({ ...step, command_template: { ...step.command_template, id: '7' } }), /not_fixture_update/);
  assert.throws(() => assertFixtureStep({ ...step, command_template: { ...step.command_template, command: { cost_price: 1200, cost_price_tax: 1428, stock: 1 } } }), /not_fixture_update/);
  assert.throws(() => validateInput({ actor: { userId: '1', sessionId: 'old' } }), /input_invalid/);
  return { status: 'offline_policy_self_test_passed', no_DB_or_SDK: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1) fail('commercial_check_mode_required');
    if (args[0] === '--schema') console.log(JSON.stringify(INPUT_SCHEMA));
    else if (args[0] === '--self-test') console.log(JSON.stringify(selfTest()));
    else if (args[0] === '--execute') {
      const raw = fs.readFileSync(0); if (raw.length > 8192) fail('commercial_check_input_too_large');
      console.log(JSON.stringify(await execute(validateInput(JSON.parse(raw.toString('utf8'))))));
    } else fail('commercial_check_mode_invalid');
  } catch (error) {
    const code = error instanceof Error && /^commercial_check_[A-Za-z_]+$/.test(error.message) ? error.message : 'commercial_check_failed';
    console.error(JSON.stringify({ status: 'failed', code, SDK_calls: 0, action: 'No automatic retry; inspect exact fixture executions.' }));
    process.exitCode = 1;
  }
}
