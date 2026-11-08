// Compiled Nest HTTP + disposable PostgreSQL. Native preparation is exercised; no provider or domain writer is invoked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai17');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
};
let app;
try {
  const Module = await loadAi(
    'nodia-ai-proposal/nodia-ai-proposal.module',
    'NodiaAiProposalModule',
  );
  const Prepare = await loadAi(
    'nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case',
    'PrepareNodiaAiProposalUseCase',
  );
  const Observation = await loadAi(
    'nodia-ai-observation/nodia-ai-observation.module',
    'NodiaAiObservationModule',
  );
  const Redis = await loadAi('common/redis/redis.service', 'RedisService');
  const admissionToken = await loadAi(
    'nodia-ai-confirmation/types/execution-admission.types',
    'NODIA_AI_EXECUTION_ADMISSION',
  );
  const Adapter = await loadAi(
    'nodia-ai-adapter/types/nodia-ai-adapter.types',
    'NodiaAiAdapterPort',
  );
  const NativeFinance = await loadAi(
    'nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case',
    'PrepareNodiaAiFinanceMovementUseCase',
  );
  const ProposalStore = await loadAi(
    'nodia-ai-proposal/nodia-ai-proposal.service',
    'NodiaAiProposalService',
  );
  const Registry = await loadAi(
    'nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case',
    'NodiaAiToolRegistryUseCase',
  );
  let providerOperations = 0;
  const { compileNodiaAiToolSchema } =
    await import('../dist/nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js');
  const { knowledgeHash } =
    await import('../dist/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js');
  const schema = readFileSync(
    new URL(
      '../dist/nodia-ai-tools/config/common-schema.json',
      import.meta.url,
    ),
    'utf8',
  );
  const publicSchema = compileNodiaAiToolSchema({
    sourceJson: schema,
    definition: 'PublicProposal',
    sha256: knowledgeHash(schema),
  });
  const preparationSchema = compileNodiaAiToolSchema({
    sourceJson: schema,
    definition: 'PreparationResult',
    sha256: knowledgeHash(schema),
  });
  const errorSchema = compileNodiaAiToolSchema({
    sourceJson: schema,
    definition: 'ApiError',
    sha256: knowledgeHash(schema),
  });
  const builder = Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      Module,
      Observation,
    ],
  });
  // Preserve the historical fail-closed gate after AI-20 enables the native executor.
  builder.overrideProvider(admissionToken).useValue([]);
  builder.overrideProvider(Redis).useValue({
    get: async () => null,
    set: async () => {},
    del: async () => {},
    keys: async () => [],
  });
  builder.overrideProvider(Adapter).useValue({
    async observe() {
      providerOperations++;
      throw Error('No provider observation permitted');
    },
    async execute() {
      providerOperations++;
      throw Error('No provider inference permitted');
    },
    async verifyConfiguration() {
      providerOperations++;
      throw Error('No provider verification permitted');
    },
  });
  const compiled = await builder.compile();
  const prepare = compiled.get(Prepare);
  const PolicyToken = await loadAi(
    'nodia-ai-runtime/config/runtime-policy',
    'NODIA_AI_RUNTIME_POLICY',
  );
  const createBodyParser = await loadAi(
    'nodia-ai-conversation/nodia-ai-conversation-body-parser',
    'createNodiaAiConversationBodyParser',
  );
  const policy = compiled.get(PolicyToken);
  const AllExceptionsFilter = await loadAi(
    'common/filters/all-exceptions.filter',
    'AllExceptionsFilter',
  );
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use(
    '/api/v1/nodia-ai',
    createBodyParser(policy.admission.http_json_bytes),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalGuards({
    canActivate(context) {
      const request = context.switchToHttp().getRequest();
      const identity = identities.get(request.headers['x-fixture-actor']);
      if (!identity) throw new UnauthorizedException();
      request.auth = {
        user: { id: identity.userId },
        sessionId: identity.sessionId,
      };
      return true;
    },
  });
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1/nodia-ai`;
  async function request(
    path,
    {
      actor = '1',
      method = 'GET',
      body,
      rawBody,
      status = 200,
      absentRoute = false,
    } = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
      ...(rawBody === undefined && body === undefined
        ? {}
        : { body: rawBody ?? JSON.stringify(body) }),
    });
    const text = await response.text();
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      if (absentRoute === true) {
        assert.equal(method, 'POST');
        assert.equal(
          path,
          '/proposals',
          'Only deferred public preparation may return framework HTML',
        );
        assert.equal(status, 404);
        assert.equal(response.status, 404);
        assert.match(
          response.headers.get('content-type') ?? '',
          /^text\/html\b/,
        );
        assert.equal(
          text.match(/<pre>([^<]*)<\/pre>/)?.[1],
          `Cannot POST /api/v1/nodia-ai${path}`,
        );
        return { status: 404, value: { route_absent: true } };
      }
      throw new Error(
        `Synthetic AI17 ${method} ${path}: HTTP ${response.status}, content-type=${response.headers.get('content-type')}, non-JSON body=${text.slice(0, 240)}`,
      );
    }
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `${method} ${path}: HTTP ${response.status} ${JSON.stringify(value)}`,
    );
    if (response.status >= 400)
      assert.ok(
        errorSchema.validate(value.error),
        `${method} ${path}: invalid ApiError ${JSON.stringify(value)}`,
      );
    if (response.status === 200)
      assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, value };
  }
  const migrated = await db.query(
    "SELECT name FROM migrations WHERE name='CreateNodiaAiProposalPersistence1792400000000'",
  );
  check(
    'M2 migration runs against disposable PostgreSQL',
    migrated.length === 1,
  );
  const tables = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('nodia_ai_drafts','nodia_ai_proposals','nodia_ai_proposal_revisions','nodia_ai_proposal_steps')",
  );
  check(
    'AI-17 adds exactly the four currently consumed proposal tables',
    tables.length === 4,
  );
  const deferred = await db.query(
    "SELECT conname,condeferrable,condeferred FROM pg_constraint WHERE conname='fk_nodia_ai_proposals_current'",
  );
  check(
    'logical proposal points to a deferred current revision',
    deferred.length === 1 &&
      deferred[0].condeferrable &&
      deferred[0].condeferred,
  );
  let [destination] = await db.query(
    "SELECT id FROM modules WHERE link='/finances-personal'",
  );
  if (!destination)
    [destination] = await db.query(
      "INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/finances-personal','synthetic_ai17_finance' FROM modules WHERE key='nodia_ai' RETURNING id",
    );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',
    [destination.id],
  );
  const [category] = await db.query(
    "INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic AI17 food','synthetic_ai17_food') RETURNING id",
  );
  const [sentinel] = await db.query(
    "INSERT INTO finance_movements(user_id,category_id,name,amount,type,status) VALUES(1,$1,'Existing synthetic record',123,'expense','paid') RETURNING id,amount::text,name",
    [category.id],
  );
  async function chat(owner = '1') {
    const id = randomUUID();
    await db.query(
      "INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI17 only',clock_timestamp()+interval '90 days')",
      [id, owner, randomUUID(), 'a'.repeat(64)],
    );
    return id;
  }
  const conversationId = await chat();
  const [initialChat] = await db.query(
    'SELECT expires_at,last_owner_message_at FROM nodia_ai_conversations WHERE id=$1',
    [conversationId],
  );
  const partial = {
    name: '  Compra comida  ',
    amount: '20000',
    type: 'expense',
    category_id: category.id,
  };
  const toolName = 'nodia_finance_movements_prepare_create';
  const incomplete = await db.transaction((manager) =>
    prepare.execute(manager, identities.get('1'), {
      conversationId,
      toolName,
      partial,
    }),
  );
  check(
    'native missing status produces a valid clarification without a proposal',
    preparationSchema.validate(incomplete) &&
      incomplete.status === 'needs_clarification' &&
      incomplete.proposal === null &&
      incomplete.missing_fields.length === 1 &&
      incomplete.missing_fields[0] === 'status',
  );
  const [draftBefore] = await db.query(
    'SELECT * FROM nodia_ai_drafts WHERE id=$1',
    [incomplete.draft_id],
  );
  check(
    'incomplete draft persists the normalized partial command and clarification',
    draftBefore.state === 'incomplete' &&
      draftBefore.revision === 1 &&
      draftBefore.partial_command.command.name === 'Compra comida' &&
      draftBefore.clarifications.missing_fields[0] === 'status',
  );
  const complete = await db.transaction((manager) =>
    prepare.execute(manager, identities.get('1'), {
      conversationId,
      toolName,
      partial: { status: 'paid' },
      draftId: incomplete.draft_id,
      expectedDraftRevision: 1,
    }),
  );
  check(
    'continuation fills the same draft and creates one ready revision',
    complete.status === 'ready' &&
      complete.draft_id === incomplete.draft_id &&
      preparationSchema.validate(complete),
  );
  const first = complete.proposal,
    path = `/proposals/${first.proposal_id}`;
  check(
    'ready public proposal uses the strict shared schema',
    publicSchema.validate(first),
  );
  const [draftAfter] = await db.query(
    'SELECT revision,state,claimed_proposal_id,partial_command FROM nodia_ai_drafts WHERE id=$1',
    [incomplete.draft_id],
  );
  check(
    'draft continuation advances revision and links its proposal',
    draftAfter.revision === 2 &&
      draftAfter.state === 'ready' &&
      draftAfter.claimed_proposal_id === first.proposal_id,
  );
  check(
    'a status-only continuation retains the complete normalized draft and original field provenance',
    draftAfter.partial_command.command.name === 'Compra comida' &&
      draftAfter.partial_command.command.amount === '20000' &&
      draftAfter.partial_command.command.category_id === category.id &&
      draftAfter.partial_command.command.status === 'paid' &&
      draftAfter.partial_command.origins.name === 'user' &&
      draftAfter.partial_command.origins.is_active === 'contract_default',
  );
  const foreignChat = await chat('2');
  await assert.rejects(
    db.query('UPDATE nodia_ai_drafts SET conversation_id=$2 WHERE id=$1', [
      incomplete.draft_id,
      foreignChat,
    ]),
    /foreign key constraint/,
  );
  check(
    'composite foreign keys prevent moving a claimed draft into another chat',
    true,
  );
  await assert.rejects(
    db.transaction((manager) =>
      prepare.execute(manager, identities.get('1'), {
        conversationId,
        toolName,
        partial: { ...partial, status: 'paid' },
        draftId: incomplete.draft_id,
        expectedDraftRevision: 1,
      }),
    ),
    /nodia_ai:revision_conflict/,
  );
  check(
    'stale continuation cannot produce a second proposal',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_proposals WHERE conversation_id=$1',
        [conversationId],
      )
    )[0].n === 1,
  );
  const exact = (await request(path)).value;
  assert.deepEqual(exact, first);
  check('GET reconstructs exactly the frozen projection and hash', true);
  check(
    'known defaults distinguish absent before, null after and true after',
    first.steps[0].changes.some(
      (field) =>
        field.field_key === 'obligation_id' &&
        !field.before_present &&
        field.after_present &&
        field.after === null &&
        field.origin === 'contract_default',
    ) &&
      first.steps[0].changes.some(
        (field) =>
          field.field_key === 'is_active' &&
          field.after === true &&
          field.origin === 'contract_default',
      ),
  );
  check(
    'proposal expiration uses policy and never exceeds chat retention',
    Date.parse(first.expires_at) - Date.parse(first.created_at) <= 900000 &&
      Date.parse(first.expires_at) <= initialChat.expires_at.getTime(),
  );
  check(
    'public projection excludes internal templates/preconditions/tokens',
    !JSON.stringify(first).includes('command_template') &&
      !JSON.stringify(first).includes('confirmation_token') &&
      !JSON.stringify(first).includes('confirmed_paid'),
  );
  await request(path, { actor: '2', status: 404 });
  await request(path, { actor: '3' });
  check(
    'ordinary users cannot inspect foreign proposals; super_admin can',
    true,
  );
  check(
    'foreign super_admin inspection records the real actor',
    (
      await db.query(
        "SELECT count(*)::int n FROM nodia_ai_audit_events WHERE conversation_id=$1 AND actor_id=3 AND minimal_details->>'operation'='proposal'",
        [conversationId],
      )
    )[0].n > 0,
  );
  const edit = {
    expected_proposal_revision: first.revision,
    expected_hash: first.hash,
    edits: [
      {
        step_id: first.steps[0].step_id,
        field_key: 'name',
        value: 'Updated synthetic expense',
      },
    ],
  };
  await request(path, { actor: '3', method: 'PATCH', body: edit, status: 403 });
  await request(path, { actor: '2', method: 'PATCH', body: edit, status: 404 });
  check(
    'foreign inspection never grants editing as the conversation owner',
    true,
  );
  await request(path + '?revision=01', { status: 400 });
  await request(path + '?revision=2147483648', { status: 400 });
  await request(path + '?unknown=true', { status: 400 });
  check('revision query validates canonical integers and unknown fields', true);
  for (const field_key of ['owner_id', 'command.name', '__proto__'])
    await request(path, {
      method: 'PATCH',
      status: 400,
      body: { ...edit, edits: [{ ...edit.edits[0], field_key }] },
    });
  await request(path, {
    method: 'PATCH',
    status: 400,
    body: {
      ...edit,
      edits: [edit.edits[0], { ...edit.edits[0], value: 'Another value' }],
    },
  });
  check(
    'human edit endpoint rejects managed fields, paths and duplicate semantic edits',
    (await request(path)).value.hash === first.hash,
  );
  const rawEdit = JSON.stringify(edit.edits[0]);
  await request(path.replace('/proposals/', '/PrOpOsAlS/'), {
    method: 'PATCH',
    status: 400,
    rawBody: `{"expected_proposal_revision":1,"expected_hash":"${first.hash}","expected_hash":"${first.hash}","edits":[${rawEdit}]}`,
  });
  check(
    'raw JSON boundary follows Express case-insensitive proposal routing',
    (await request(path)).value.hash === first.hash,
  );
  await request(path, {
    method: 'PATCH',
    status: 400,
    rawBody: `{"expected_proposal_revision":1,"expected_hash":"${first.hash}","expected_hash":"${first.hash}","edits":[${rawEdit}]}`,
  });
  await request(path, {
    method: 'PATCH',
    status: 400,
    rawBody: `{"expected_proposal_revision":1,"expected_hash":"${first.hash}","edits":[{"step_id":"${first.steps[0].step_id}","field_key":"name","value":"First value","value":"Second value"}]}`,
  });
  await request(path, {
    method: 'PATCH',
    status: 400,
    rawBody: `{"expected_proposal_revision":1,"expected_hash":"${first.hash}","edits":[{"step_id":"${first.steps[0].step_id}","field_key":"name","field_key":"name","value":"Duplicate registered key"}]}`,
  });
  check(
    'raw HTTP rejects duplicate top-level and nested JSON keys before they can change a proposal',
    (await request(path)).value.hash === first.hash &&
      (
        await db.query(
          'SELECT count(*)::int n FROM nodia_ai_proposal_revisions WHERE proposal_id=$1',
          [first.proposal_id],
        )
      )[0].n === 1 &&
      (await db.query('SELECT count(*)::int n FROM finance_movements'))[0].n ===
        1,
  );
  await request(path, {
    method: 'PATCH',
    status: 400,
    rawBody: `{"expected_proposal_revision":1,"expected_hash":"${first.hash}","expected_\\u0068ash":"${first.hash}","edits":[${rawEdit}]}`,
  });
  await request(path, {
    method: 'PATCH',
    status: 400,
    rawBody: `{"expected_proposal_revision":1,"expected_hash":"${first.hash}","edits":[{"step_id":"${first.steps[0].step_id}","field_key":"name","value":"\\ud800"}]}`,
  });
  const invalidUtf8 = Buffer.concat([
    Buffer.from(
      `{"expected_proposal_revision":1,"expected_hash":"${first.hash}","edits":[{"step_id":"${first.steps[0].step_id}","field_key":"name","value":"`,
    ),
    Buffer.from([0xc3, 0x28]),
    Buffer.from('"}]}'),
  ]);
  await request(path, { method: 'PATCH', status: 400, rawBody: invalidUtf8 });
  check(
    'raw HTTP rejects escaped duplicate keys, lone surrogates and malformed UTF-8 without revising content',
    (await request(path)).value.hash === first.hash &&
      (
        await db.query(
          'SELECT count(*)::int n FROM nodia_ai_proposal_revisions WHERE proposal_id=$1',
          [first.proposal_id],
        )
      )[0].n === 1,
  );
  const racing = await Promise.all([
    request(path, { method: 'PATCH', body: edit, status: [200, 409] }),
    request(path, {
      method: 'PATCH',
      body: {
        ...edit,
        edits: [{ ...edit.edits[0], value: 'Other device expense' }],
      },
      status: [200, 409],
    }),
  ]);
  check(
    'two-device CAS admits one revision and rejects the stale competitor',
    racing.filter((item) => item.status === 200).length === 1 &&
      racing.filter((item) => item.status === 409).length === 1,
  );
  const current = (await request(path)).value;
  check(
    'editing appends a new revision and changes the exact content hash',
    current.revision === 2 &&
      current.hash !== first.hash &&
      publicSchema.validate(current),
  );
  const old = (await request(path + '?revision=1')).value;
  assert.deepEqual(old.steps, first.steps);
  check(
    'previous revision content/hash stays unchanged and is superseded',
    old.hash === first.hash && old.state === 'superseded',
  );
  check(
    'revising another field preserves default provenance',
    current.steps[0].changes.some(
      (field) =>
        field.field_key === 'is_active' && field.origin === 'contract_default',
    ),
  );
  const [clockAfter] = await db.query(
    'SELECT expires_at,last_owner_message_at FROM nodia_ai_conversations WHERE id=$1',
    [conversationId],
  );
  check(
    'reads and edits do not extend owner-message retention',
    clockAfter.expires_at.getTime() === initialChat.expires_at.getTime() &&
      clockAfter.last_owner_message_at === null,
  );
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [
    destination.id,
  ]);
  await request(path, { status: 403 });
  await request(path + '?revision=1', { status: 403 });
  await request(path, { actor: '3' });
  check(
    'current destination authorization covers old and current proposal projections',
    true,
  );
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
    destination.id,
  ]);
  await db.query('UPDATE finance_categories SET is_active=false WHERE id=$1', [
    category.id,
  ]);
  const unchanged = (await request(path)).value;
  check(
    'observation does not recompute frozen values from newer business state',
    unchanged.hash === current.hash &&
      JSON.stringify(unchanged.steps) === JSON.stringify(current.steps),
  );
  await request(path, {
    method: 'PATCH',
    status: 409,
    body: {
      expected_proposal_revision: current.revision,
      expected_hash: current.hash,
      edits: [
        {
          step_id: current.steps[0].step_id,
          field_key: 'amount',
          value: '30000',
        },
      ],
    },
  });
  check(
    'failed native re-preparation preserves the current revision',
    (await request(path)).value.hash === current.hash,
  );
  await db.query('UPDATE finance_categories SET is_active=true WHERE id=$1', [
    category.id,
  ]);
  const fresh = { userId: '1', sessionId: randomUUID() };
  await db.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,1,'synthetic-ai17-fresh',clock_timestamp()+interval '1 hour')",
    [fresh.sessionId],
  );
  identities.set('fresh', fresh);
  await db.query(
    'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',
    [identities.get('1').sessionId],
  );
  await request(path, { status: 401 });
  await request(path, { actor: 'fresh' });
  check(
    'session revocation applies immediately while another valid session can inspect',
    true,
  );

  // Direct SQL mutability checks catch gaps that readonly TS and HTTP guards cannot prove.
  const [step] = await db.query(
    'SELECT * FROM nodia_ai_proposal_steps WHERE proposal_id=$1 AND proposal_revision=2',
    [first.proposal_id],
  );
  await assert.rejects(
    db.query(
      "UPDATE nodia_ai_proposal_steps SET command_template=jsonb_set(command_template,'{command,amount}','\"999\"') WHERE id=$1",
      [step.id],
    ),
    /immutable_step/,
  );
  check('direct SQL cannot rewrite a frozen command', true);
  await assert.rejects(
    db.query('DELETE FROM nodia_ai_proposal_steps WHERE id=$1', [step.id]),
    /immutable_step/,
  );
  check(
    'direct SQL cannot delete a frozen step while its revision exists',
    true,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO nodia_ai_proposal_steps(id,proposal_id,proposal_revision,position,tool_name,contract_hash,kind,effect_key,scope,command_template,public_step,output_bindings,preconditions)
    SELECT $2,proposal_id,proposal_revision,2,tool_name,contract_hash,kind,effect_key,scope,command_template,public_step,output_bindings,preconditions FROM nodia_ai_proposal_steps WHERE id=$1`,
      [step.id, randomUUID()],
    ),
    /immutable_step/,
  );
  check('direct SQL cannot append hidden steps after ready', true);
  await assert.rejects(
    db.query(
      'UPDATE nodia_ai_proposal_revisions SET hash=$2 WHERE proposal_id=$1 AND revision=2',
      [first.proposal_id, 'f'.repeat(64)],
    ),
    /immutable_revision/,
  );
  await assert.rejects(
    db.query(
      "UPDATE nodia_ai_proposal_revisions SET state='draft' WHERE proposal_id=$1 AND revision=2",
      [first.proposal_id],
    ),
    /immutable_revision/,
  );
  await assert.rejects(
    db.query(
      'DELETE FROM nodia_ai_proposal_revisions WHERE proposal_id=$1 AND revision=2',
      [first.proposal_id],
    ),
    /immutable_revision/,
  );
  check('frozen revision hash/content cannot change or reopen to draft', true);
  await assert.rejects(
    db.query('UPDATE nodia_ai_proposals SET actor_id=2 WHERE id=$1', [
      first.proposal_id,
    ]),
    /immutable_proposal/,
  );
  await assert.rejects(
    db.query('DELETE FROM nodia_ai_proposals WHERE id=$1', [first.proposal_id]),
    /immutable_proposal/,
  );
  check(
    'logical proposal identity cannot be reassigned or individually discarded',
    true,
  );
  await request(path + '/cancel', {
    actor: 'fresh',
    method: 'POST',
    status: 409,
    body: { client_request_id: randomUUID(), expected_proposal_revision: 1 },
  });
  // AI-18 adds a human-only route through ConversationModule. The explicitly
  // empty fixture registry prevents a valid ready proposal from admitting work.
  await request(path + '/confirm', {
    actor: 'fresh',
    method: 'POST',
    body: {
      client_request_id: randomUUID(),
      proposal_revision: current.revision,
      expected_hash: current.hash,
      confirmation_token: 'A'.repeat(43),
    },
    status: 503,
  });
  const cancellation = {
    client_request_id: randomUUID(),
    expected_proposal_revision: current.revision,
  };
  const cancelled = (
    await request(path + '/cancel', {
      actor: 'fresh',
      method: 'POST',
      body: cancellation,
    })
  ).value;
  const repeatedCancel = (
    await request(path + '/cancel', {
      actor: 'fresh',
      method: 'POST',
      body: cancellation,
    })
  ).value;
  check(
    'cancellation changes state without changing frozen content and is repeat-safe',
    cancelled.state === 'cancelled' &&
      cancelled.hash === current.hash &&
      JSON.stringify(cancelled) === JSON.stringify(repeatedCancel),
  );
  await request('/proposals', {
    actor: 'fresh',
    method: 'POST',
    body: {},
    status: 404,
    absentRoute: true,
  });
  check(
    'AI-18 confirmation remains unavailable without an executor and public preparation stays absent',
    (await db.query('SELECT count(*)::int n FROM nodia_ai_executions'))[0].n ===
      0,
  );
  await db.query(
    "UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [conversationId],
  );
  await request(path, { actor: 'fresh', status: 410 });
  await request(path, { actor: '3', status: 404 });
  check(
    'expired chat denies own and foreign proposal access before physical purge',
    true,
  );
  await db.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [
    conversationId,
  ]);
  const [remaining] = await db.query(
    'SELECT (SELECT count(*)::int FROM nodia_ai_drafts) drafts,(SELECT count(*)::int FROM nodia_ai_proposals) proposals,(SELECT count(*)::int FROM nodia_ai_proposal_revisions) revisions,(SELECT count(*)::int FROM nodia_ai_proposal_steps) steps',
  );
  check(
    'chat cascade removes all proposal payload despite immutability triggers',
    Object.values(remaining).every((value) => value === 0),
  );
  await request(path, { actor: 'fresh', status: 404 });
  const [business] = await db.query(
    'SELECT id,amount::text,name FROM finance_movements',
  );
  check(
    'native preparation never creates or edits a business movement',
    JSON.stringify(business) === JSON.stringify(sentinel) &&
      (await db.query('SELECT count(*)::int n FROM finance_movements'))[0].n ===
        1,
  );
  const [activity] = await db.query(
    'SELECT (SELECT count(*)::int FROM nodia_ai_jobs) jobs,(SELECT count(*)::int FROM nodia_ai_runs) runs,(SELECT count(*)::int FROM nodia_ai_tool_calls) calls',
  );
  check(
    'proposal lifecycle schedules no provider work, tool call, or execution',
    Object.values(activity).every((value) => value === 0),
  );
  // A source callback is a synthetic fixture; private preparation remains unpublished and is never invoked via MCP.
  const eventChat = await chat();
  const sourceRun = randomUUID(),
    userMessage = randomUUID(),
    assistantMessage = randomUUID();
  for (const [id, seq, role, author] of [
    [userMessage, '1', 'user', '1'],
    [assistantMessage, '2', 'assistant', null],
  ]) {
    await db.query(
      `INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash)
      VALUES($1,$2,$3,$4,$5,$6,'sealed','{"schema_version":1,"module_routes":[]}',clock_timestamp(),$7)`,
      [
        id,
        eventChat,
        seq,
        role,
        author,
        author ? randomUUID() : null,
        author ? 'd'.repeat(64) : null,
      ],
    );
    await db.query(
      "INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','Synthetic AI17 source only')",
      [id, eventChat],
    );
  }
  const [connection] = await db.query(
    "INSERT INTO ai_providers(catalog_id,name,fields,use_agentic) SELECT id,'Synthetic AI17 no inference','{}',true FROM ai_provider_catalog WHERE key='gemini' RETURNING id",
  );
  const selection = {
    connection_id: connection.id,
    mode: 'agentic',
    model_id: 'synthetic-ai17-no-inference',
    effort_id: null,
  };
  const budget = {
    schema_version: 1,
    tool_calls: policy.budget.tool_calls_per_run,
    mcp_rpc_messages: policy.budget.mcp_rpc_messages_per_run,
    provider_dispatches: policy.budget.provider_dispatches_per_run,
    compactions: policy.budget.compactions_per_run,
    delegations: policy.budget.delegations_per_run,
  };
  const routing = {
    schema_version: 1,
    enabled: false,
    revision: 1,
    target: null,
  };
  await db.query(
    `INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,assistant_message_id,connection_id,selection_snapshot,catalog_version,policy_version,policy_hash,input_through_seq,state,phase,deadline_at,completed_at,retention_epoch,context_manifest,routing_snapshot,budget_snapshot)
    VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,1,'completed','completed',clock_timestamp()+interval '10 minutes',clock_timestamp(),1,'{}',$10,$11)`,
    [
      sourceRun,
      eventChat,
      userMessage,
      assistantMessage,
      connection.id,
      selection,
      compiled.get(Registry).catalogVersion,
      policy.policyVersion,
      policy.policyHash,
      routing,
      budget,
    ],
  );
  await db.query(
    'UPDATE nodia_ai_conversations SET next_message_seq=2 WHERE id=$1',
    [eventChat],
  );
  const native = compiled.get(NativeFinance);
  async function sourceCall() {
    const id = randomUUID();
    await db.query(
      `INSERT INTO nodia_ai_tool_calls(id,conversation_id,run_id,adapter_call_id,tool_name,contract_hash,arguments_hash,arguments,scope_manifest,state)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'validated')`,
      [
        id,
        eventChat,
        sourceRun,
        randomUUID(),
        toolName,
        native.contractHash,
        knowledgeHash(JSON.stringify({ ...partial, status: 'paid' })),
        { ...partial, status: 'paid' },
        { schema_version: 1, module_routes: ['/finances-personal'] },
      ],
    );
    return id;
  }
  const toolCallId = await sourceCall();
  const linked = await db.transaction((manager) =>
    prepare.execute(manager, fresh, {
      conversationId: eventChat,
      toolName,
      partial: { ...partial, status: 'paid' },
      toolCallId,
    }),
  );
  const linkedProposal = linked.proposal;
  await db.query(
    "UPDATE nodia_ai_tool_calls SET state='completed',public_result=$2,completed_at=clock_timestamp() WHERE id=$1",
    [toolCallId, linked],
  );
  const [published] = await db.query(
    'SELECT seq,run_id,public_payload,scope_manifest FROM nodia_ai_events WHERE conversation_id=$1',
    [eventChat],
  );
  assert.deepEqual(published.public_payload, {
    kind: 'proposal_ready',
    payload: {
      proposal_id: linkedProposal.proposal_id,
      revision: linkedProposal.revision,
      hash: linkedProposal.hash,
    },
  });
  check(
    'source-linked preparation commits a bounded exact proposal_ready reference in the same transaction',
    published.run_id === sourceRun &&
      published.seq === '1' &&
      published.scope_manifest.module_routes.includes(
        '/finances-personal',
      ),
  );
  await db.transaction((manager) =>
    compiled.get(ProposalStore).publishReady(
      manager,
      {
        id: linkedProposal.proposal_id,
        conversation_id: eventChat,
        actor_id: '1',
      },
      linkedProposal,
      ['/finances-personal'],
      policy.results.outbox_events_per_activity,
    ),
  );
  check(
    'publisher retries preserve event identity and sequence without duplicates',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_events WHERE conversation_id=$1',
        [eventChat],
      )
    )[0].n === 1 &&
      (
        await db.query(
          'SELECT next_event_seq FROM nodia_ai_conversations WHERE id=$1',
          [eventChat],
        )
      )[0].next_event_seq === '1',
  );
  const rollbackCall = await sourceCall();
  await assert.rejects(
    db.transaction(async (manager) => {
      await prepare.execute(manager, fresh, {
        conversationId: eventChat,
        toolName,
        partial: {
          ...partial,
          name: 'Rollback synthetic only',
          status: 'paid',
        },
        toolCallId: rollbackCall,
      });
      throw Error('synthetic rollback after outbox');
    }),
    /synthetic rollback after outbox/,
  );
  const [afterRollback] = await db.query(
    'SELECT (SELECT count(*)::int FROM nodia_ai_proposals WHERE conversation_id=$1) proposals,(SELECT count(*)::int FROM nodia_ai_drafts WHERE conversation_id=$1) drafts,(SELECT count(*)::int FROM nodia_ai_events WHERE conversation_id=$1) events,(SELECT next_event_seq FROM nodia_ai_conversations WHERE id=$1) seq',
    [eventChat],
  );
  check(
    'rollback after preparation leaves no orphan proposal, draft, event or consumed sequence',
    afterRollback.proposals === 1 &&
      afterRollback.drafts === 1 &&
      afterRollback.events === 1 &&
      afterRollback.seq === '1',
  );
  const eventsPath = `/runs/${sourceRun}/events`;
  const feed = (await request(eventsPath, { actor: 'fresh' })).value;
  check(
    'authorized observation exposes the exact proposal revision and hash',
    feed.items.length === 1 &&
      feed.items[0].kind === 'proposal_ready' &&
      JSON.stringify(feed.items[0].payload) ===
        JSON.stringify(published.public_payload.payload),
  );
  check(
    'private preparer is still absent from published tools and receipt retrieval',
    !compiled.get(Registry).get(toolName),
  );
  await request(`/tool-calls/${toolCallId}/result`, {
    actor: 'fresh',
    status: 404,
  });
  await request(eventsPath, { actor: '2', status: 404 });
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [
    destination.id,
  ]);
  const resetFeed = (
    await request(
      eventsPath + '?cursor=' + encodeURIComponent(feed.next_cursor),
      { actor: 'fresh' },
    )
  ).value;
  const hiddenFeed = (await request(eventsPath, { actor: 'fresh' })).value;
  await request(`/proposals/${linkedProposal.proposal_id}`, {
    actor: 'fresh',
    status: 403,
  });
  check(
    'destination revocation resets cursors, hides proposal refs and denies the exact projection',
    resetFeed.cursor_state === 'reset_required' &&
      resetFeed.items.length === 0 &&
      hiddenFeed.items.length === 0,
  );
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
    destination.id,
  ]);
  const restoredFeed = (await request(eventsPath, { actor: 'fresh' })).value;
  check(
    'restored access recovers the same event without preparing or executing again',
    restoredFeed.items.length === 1 &&
      restoredFeed.items[0].event_id === feed.items[0].event_id &&
      (
        await db.query(
          'SELECT count(*)::int n FROM nodia_ai_proposals WHERE conversation_id=$1',
          [eventChat],
        )
      )[0].n === 1,
  );
  await db.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [eventChat]);
  const [finalRows] = await db.query(
    'SELECT (SELECT count(*)::int FROM nodia_ai_events) events,(SELECT count(*)::int FROM nodia_ai_proposals) proposals,(SELECT count(*)::int FROM nodia_ai_drafts) drafts,(SELECT count(*)::int FROM nodia_ai_jobs) jobs,(SELECT count(*)::int FROM nodia_ai_runs) runs,(SELECT count(*)::int FROM nodia_ai_tool_calls) calls',
  );
  check(
    'linked outbox, source run, receipt and proposal payload all cascade with the chat',
    Object.values(finalRows).every((value) => value === 0),
  );
  check(
    'all source-linked checks retain the business sentinel and never call a provider',
    providerOperations === 0 &&
      (await db.query('SELECT count(*)::int n FROM finance_movements'))[0].n ===
        1 &&
      (
        await db.query(
          'SELECT amount::text FROM finance_movements WHERE id=$1',
          [sentinel.id],
        )
      )[0].amount === sentinel.amount,
  );
  console.log(
    JSON.stringify(
      {
        stage: 'AI-17',
        scope:
          'compiled_http_disposable_postgresql_native_finance_preparation_no_provider_no_domain_writes',
        checks: checks.length,
        passed: checks,
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  await fixture.close();
}
