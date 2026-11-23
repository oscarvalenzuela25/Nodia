// Actual catalog publication, authorization and Teacher effects in disposable PostgreSQL.
// No provider inference or configured application database.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture } from './nodia-ai.integration.fixture.mjs';

process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const path = '../dist/';
const fixture = await createNodiaAiIntegrationFixture(
  'ai112',
  process.env.NODIA_AI_TEACHER_TEST_DATABASE_URL,
);
const { db, options, identities } = fixture;
let module;
try {
  const [
    { NodiaAiExecutionModule },
    { NodiaAiConfirmationModule },
    { NodiaAiContextModule },
    { NodiaAiToolRegistryModule },
    { loadTeacherToolContracts },
    { NodiaAiToolRegistryUseCase },
    { LoadNodiaAiKnowledgeUseCase },
    { DiscoverNodiaAiToolsUseCase },
    { AuthorizeNodiaAiUseCase },
    { CreateNodiaAiConfirmationChallengeUseCase },
    { ConfirmNodiaAiProposalUseCase },
    { ClaimNodiaAiExecutionUseCase },
    { ExecuteNodiaAiLocalExecutionUseCase },
    { RedisService },
    { lockAuthority },
    { canonicalModuleRoutes },
  ] = await Promise.all(
    [
      'nodia-ai-execution/nodia-ai-execution.module',
      'nodia-ai-confirmation/nodia-ai-confirmation.module',
      'nodia-ai-context/nodia-ai-context.module',
      'nodia-ai-tools/nodia-ai-tool-registry.module',
      'nodia-ai-teacher-operations/teacher-contracts',
      'nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case',
      'nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case',
      'nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case',
      'nodia-ai/use-case/authorize-nodia-ai.use-case',
      'nodia-ai-confirmation/use-case/create-nodia-ai-confirmation-challenge.use-case',
      'nodia-ai-confirmation/use-case/confirm-nodia-ai-proposal.use-case',
      'nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case',
      'nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case',
      'common/redis/redis.service',
      'authorization/authority-transaction',
      'authorization/canonical-module-route',
    ].map((file) => import(path + file + '.js')),
  );
  const contracts = loadTeacherToolContracts();
  const names = [...contracts.keys()].sort();
  const teacherNames = (tools) =>
    tools
      .filter((tool) => contracts.has(tool.capabilityId))
      .map((tool) => tool.capabilityId)
      .sort();
  const testing = Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      NodiaAiConfirmationModule,
      NodiaAiExecutionModule,
      NodiaAiContextModule,
      NodiaAiToolRegistryModule,
    ],
  });
  testing.overrideProvider(RedisService).useValue({
    get: async () => null,
    set: async () => {},
    del: async () => {},
    keys: async () => [],
  });
  module = await testing.compile();
  const registry = module.get(NodiaAiToolRegistryUseCase);
  const { manifest } = module.get(LoadNodiaAiKnowledgeUseCase);
  const discovery = module.get(DiscoverNodiaAiToolsUseCase);
  const authorize = module.get(AuthorizeNodiaAiUseCase);
  assert.equal(registry.catalogVersion, manifest.catalog_release);
  assert.deepEqual(teacherNames(registry.list(['/nodia-teacher'])), names);
  assert.deepEqual(teacherNames(registry.list(['/nodia-ai'])), []);
  const registered = new Map(
    registry
      .publishedContracts()
      .map((contract) => [contract.capability_id, contract]),
  );
  assert.deepEqual(
    [...registered.keys()].sort(),
    manifest.capability_contracts
      .map((contract) => contract.capability_id)
      .sort(),
  );
  for (const contract of manifest.capability_contracts) {
    const runtime = registered.get(contract.capability_id);
    assert.deepEqual(
      {
        ...runtime,
        required_module_routes: canonicalModuleRoutes(
          runtime.required_module_routes,
        ).sort(),
      },
      {
        capability_id: contract.capability_id,
        kind: contract.kind,
        revision: contract.revision,
        required_module_routes: canonicalModuleRoutes(
          contract.required_module_routes,
        ).sort(),
        input_schema_sha256: contract.input_schema.sha256,
        output_schema_sha256: contract.output_schema.sha256,
      },
    );
  }

  let [teacher] = await db.query(
    "SELECT id::text FROM modules WHERE link='/nodia-teacher'",
  );
  if (!teacher) {
    [teacher] = await db.query(
      "INSERT INTO modules(key,link,module_group_id,sort_order) SELECT 'nodia_teacher','/nodia-teacher',module_group_id, (SELECT COALESCE(MAX(sort_order),-1)+1 FROM modules m WHERE m.module_group_id=ai.module_group_id) FROM modules ai WHERE ai.key='nodia_ai' RETURNING id::text",
    );
  }
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',
    [teacher.id],
  );
  const discover = (ownerId) =>
    db.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await authorize.execute(
        identities.get(ownerId),
        {},
        manager,
      );
      return teacherNames(
        await discovery.visible(
          manager,
          actor,
          actor.modules.map((value) => value.route),
        ),
      );
    });
  assert.deepEqual(await discover('1'), names);
  const hash = 'a'.repeat(64);
  const budget = {
    schema_version: 1,
    tool_calls: 12,
    mcp_rpc_messages: 128,
    provider_dispatches: 3,
    compactions: 1,
    delegations: 1,
  };
  async function conversation(ownerId) {
    const chat = randomUUID();
    const message = randomUUID();
    const run = randomUUID();
    await db.transaction(async (manager) => {
      await manager.query(
        "INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,expires_at,next_message_seq) VALUES($1,$2,$3,$4,now()+interval '1 day',1)",
        [chat, ownerId, randomUUID(), hash],
      );
      await manager.query(
        "INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',$3,$4,'sealed','{}',now(),$5)",
        [message, chat, ownerId, randomUUID(), hash],
      );
      await manager.query(
        "INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,selection_snapshot,catalog_version,policy_version,policy_hash,routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,retention_epoch,context_manifest) VALUES($1,$2,$3,$4,'{}',$5,'synthetic-teacher/1',$6,'{}',$7,1,'running','inference',now()+interval '5 minutes',1,'{}')",
        [run, chat, ownerId, message, registry.catalogVersion, hash, budget],
      );
    });
    return { chat, run, ownerId };
  }
  const owner = await conversation('1');
  const other = await conversation('2');
  async function invoke(session, name, args) {
    const tool = registry.get(name);
    assert.ok(tool, name);
    const input = registry.validateInput(tool, args);
    return db.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await authorize.execute(
        identities.get(session.ownerId),
        {},
        manager,
      );
      const context = {
        manager,
        moduleRoutes: actor.modules.map((value) => value.route),
        actor,
        conversationId: session.chat,
      };
      if (tool.kind === 'prepare_change') {
        const id = randomUUID();
        await manager.query(
          "INSERT INTO nodia_ai_tool_calls(id,conversation_id,run_id,adapter_call_id,tool_name,contract_hash,arguments_hash,arguments,scope_manifest,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'{}','validated')",
          [
            id,
            session.chat,
            session.run,
            id,
            name,
            tool.contractHash,
            hash,
            input,
          ],
        );
        context.toolCallId = id;
      }
      await tool.verifyAuthority(input, context);
      const result = registry.validateOutput(
        tool,
        await tool.handler(input, context),
      );
      await tool.verifyResultAuthority(input, result, context);
      return result;
    });
  }
  const challenge = module.get(CreateNodiaAiConfirmationChallengeUseCase);
  const confirm = module.get(ConfirmNodiaAiProposalUseCase);
  const claim = module.get(ClaimNodiaAiExecutionUseCase);
  const execute = module.get(ExecuteNodiaAiLocalExecutionUseCase);
  const identity = identities.get('1');
  async function confirmAndRun({ status, proposal }) {
    assert.equal(status, 'ready');
    const frozen = {
      proposal_revision: proposal.revision,
      expected_hash: proposal.hash,
    };
    const { confirmation_token } = await challenge.execute(
      identity,
      proposal.proposal_id,
      frozen,
    );
    const admission = await confirm.execute(identity, proposal.proposal_id, {
      ...frozen,
      client_request_id: randomUUID(),
      confirmation_token,
    });
    const lease = await claim.execute(randomUUID());
    assert.equal(lease.executionId, admission.execution.execution_id);
    const done = await execute.execute(identity, lease.executionId, lease);
    assert.equal(done.state, 'completed');
    const [step] = await db.query(
      'SELECT minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1',
      [lease.executionId],
    );
    assert.equal(step.minimal_receipt.owner_id, identity.userId);
    assert.equal(
      done.steps[0].result_refs[0].id,
      step.minimal_receipt.resource_id,
    );
    await execute.execute(identity, lease.executionId, lease);
    return step.minimal_receipt;
  }
  const plan = {
    version: 1,
    title: 'Synthetic four weeks',
    schedule: { kind: 'numbered', days: 28 },
    days: Array.from({ length: 28 }, (_, index) => ({
      day: index + 1,
      title: 'Practice',
      activities: [
        {
          text: 'Read and repeat',
          source: { label: 'Guide', url: 'https://example.invalid/guide' },
        },
      ],
    })),
  };
  const calendar = await invoke(
    owner,
    'nodia_teacher_calendars_prepare_create',
    { plan },
  );
  assert.equal(
    (await invoke(owner, 'nodia_teacher_calendars_list', {})).data.length,
    0,
  );
  const { resource_id: planId } = await confirmAndRun(calendar);
  const detail = await invoke(owner, 'nodia_teacher_calendars_get', {
    id: planId,
  });
  const dayId = detail.days[0].id;
  assert.equal(detail.meta.total, 28);
  await assert.rejects(
    invoke(other, 'nodia_teacher_calendars_get', { id: planId }),
    /teacher:not_found/,
  );
  const day = await invoke(owner, 'nodia_teacher_calendar_days_get', {
    plan_id: planId,
    id: dayId,
  });
  const completion = await invoke(
    owner,
    'nodia_teacher_calendar_activities_prepare_set_completion',
    {
      plan_id: planId,
      id: dayId,
      activity_id: day.activities[0].id,
      completed: true,
    },
  );
  assert.equal(
    (await confirmAndRun(completion)).resource_id,
    day.activities[0].id,
  );
  assert.equal(
    (await invoke(owner, 'nodia_teacher_calendars_get', { id: planId }))
      .completed_count,
    1,
  );

  const flashcard = await invoke(
    owner,
    'nodia_teacher_flashcards_prepare_create',
    {
      question: 'Synthetic question',
      answer: 'Synthetic answer',
      source: 'Test notes',
    },
  );
  const { resource_id: cardId } = await confirmAndRun(flashcard);
  const saved = await invoke(owner, 'nodia_teacher_flashcards_get', {
    id: cardId,
  });
  assert.deepEqual(saved.source, { label: 'Test notes' });
  assert.equal(saved.answer, 'Synthetic answer');
  assert.equal(
    (await invoke(owner, 'nodia_teacher_flashcards_list', {})).data.length,
    1,
  );
  await assert.rejects(
    invoke(other, 'nodia_teacher_flashcards_get', { id: cardId }),
    /teacher:not_found/,
  );
  const deletion = await invoke(
    owner,
    'nodia_teacher_flashcards_prepare_delete',
    { id: cardId },
  );
  assert.equal((await confirmAndRun(deletion)).resource_id, cardId);
  assert.equal(
    (await invoke(owner, 'nodia_teacher_flashcards_list', {})).data.length,
    0,
  );
  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1', [
    teacher.id,
  ]);
  assert.deepEqual(await discover('2'), []);
  await assert.rejects(
    invoke(other, 'nodia_teacher_calendars_list', {}),
    /capability_denied/,
  );
  console.log(
    'Passed the published Teacher registry, discovery, confirmation, durable execution and owner isolation in PostgreSQL',
  );
} finally {
  try {
    await module?.close();
  } finally {
    await fixture.close();
  }
}
