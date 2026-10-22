// AI-31 executes compiled report composition against disposable PostgreSQL only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';
import { seedAi30Reports } from './nodia-ai-ai30.fixture.mjs';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai31');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, condition = true) => {
  assert.ok(condition, name);
  checks.push(name);
};
let compiled,
  reportQueries = 0,
  failure;
const started = Date.now();
try {
  db.setOptions({
    logging: ['query'],
    logger: {
      logQuery(query) {
        if (query.startsWith('WITH filtered AS MATERIALIZED')) reportQueries++;
      },
      logQueryError() {},
      logQuerySlow() {},
      logSchemaBuild() {},
      logMigration() {},
      log() {},
    },
  });
  const [
    Module,
    Compose,
    Describe,
    Redis,
    Context,
    ReportTools,
    Tools,
    Conversation,
    Processing,
    Runtime,
    Observation,
    Stage,
    Create,
    Admit,
    Adapter,
    GetResult,
  ] = await Promise.all([
    loadAi('nodia-ai-reports/nodia-ai-reports.module', 'NodiaAiReportsModule'),
    loadAi(
      'nodia-ai-reports/use-case/compose-nodia-ai-report.use-case',
      'ComposeNodiaAiReportUseCase',
    ),
    loadAi(
      'nodia-ai-reports/use-case/describe-nodia-ai-reports.use-case',
      'DescribeNodiaAiReportsUseCase',
    ),
    loadAi('common/redis/redis.service', 'RedisService'),
    loadAi('nodia-ai-context/nodia-ai-context.module', 'NodiaAiContextModule'),
    loadAi(
      'nodia-ai-tools/use-case/nodia-ai-report-tools.use-case',
      'NodiaAiReportToolsUseCase',
    ),
    loadAi('nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'),
    loadAi(
      'nodia-ai-conversation/nodia-ai-conversation.module',
      'NodiaAiConversationModule',
    ),
    loadAi(
      'nodia-ai-context/nodia-ai-processing.module',
      'NodiaAiProcessingModule',
    ),
    loadAi('nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'),
    loadAi(
      'nodia-ai-observation/nodia-ai-observation.module',
      'NodiaAiObservationModule',
    ),
    loadAi(
      'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
      'RunNodiaAiStageUseCase',
    ),
    loadAi(
      'nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case',
      'CreateNodiaAiConversationUseCase',
    ),
    loadAi(
      'nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case',
      'AdmitNodiaAiMessageUseCase',
    ),
    loadAi(
      'nodia-ai-adapter/types/nodia-ai-adapter.types',
      'NodiaAiAdapterPort',
    ),
    loadAi(
      'nodia-ai-observation/use-case/get-nodia-ai-tool-result.use-case',
      'GetNodiaAiToolResultUseCase',
    ),
  ]);
  let callbackScenario = async () => {},
    callbackError,
    adapterExecutions = 0;
  const resourceKey = 'gemini-profile:' + 'd'.repeat(64);
  const syntheticAdapter = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe() {
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_fixture_only',
        resourceKey,
        configurationGeneration: 'c'.repeat(64),
        sessionGeneration: 'd'.repeat(32),
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: true,
        reason: null,
      };
    },
    async verifyConfiguration() {},
    async execute(request, signal) {
      adapterExecutions++;
      try {
        await callbackScenario(request, signal);
      } catch (error) {
        callbackError = error;
        throw error;
      }
      return {
        kind: 'answer',
        text: 'Synthetic AI31 report completed.',
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
  compiled = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      Module,
      Context,
      Tools,
      Conversation,
      Processing,
      Runtime,
      Observation,
    ],
    providers: [Stage],
  })
    .overrideProvider(Redis)
    .useValue({
      get: async () => null,
      set: async () => {},
      del: async () => {},
      keys: async () => [],
    })
    .overrideProvider(Adapter)
    .useValue(syntheticAdapter)
    .compile();
  const compose = compiled.get(Compose),
    describe = compiled.get(Describe);
  const reportTools = compiled.get(ReportTools);
  const seed = await seedAi30Reports(db);
  const [group] = await db.query(
    "SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'",
  );
  const moduleIds = new Map();
  for (const [key, route] of [
    ['personal_finance', '/tools/finances-personal'],
    ['businesses', '/tools/business'],
    ['rental_reservations', '/tools/reservations'],
  ]) {
    let [module] = await db.query(
      'SELECT id::text FROM modules WHERE link=$1',
      [route],
    );
    if (!module)
      [module] = await db.query(
        'INSERT INTO modules(key,link,module_group_id) VALUES($1,$2,$3) RETURNING id::text',
        [key, route, group.id],
      );
    moduleIds.set(key, module.id);
    await db.query(
      'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',
      [module.id],
    );
  }
  // Same-valued facts and boundary/zero/null categories exercise comparisons without a new domain schema.
  for (const [property, owner, amount, category, date] of [
    [seed.properties[0], '1', '100', 'cleaning', '2027-01-20'],
    [seed.properties[0], '1', '0', null, '2027-01-31'],
    [seed.properties[0], '1', '13', 'outside', '2027-02-01'],
    [seed.properties[1], '2', '0', 'cleaning', '2027-01-20'],
    [seed.properties[1], '2', '0', 'taxes', '2027-01-20'],
  ])
    await db.query(
      "INSERT INTO rental_expenses(property_id,name,category,amount,incurred_on,status,created_by,updated_by) VALUES($1,'AI31 synthetic expense',$2,$3,$4,$6,$5,$5)",
      // Native expenses require amount > 0; a voided fact contributes a genuine aggregate zero.
      [
        property,
        category,
        amount === '0' ? '1' : amount,
        date,
        owner,
        amount === '0' ? 'voided' : 'pending',
      ],
    );
  const version = (await describe.execute(identities.get('1'))).catalog_version;
  const moduleRoutes = [
    '/tools/finances-personal',
    '/tools/business',
    '/tools/reservations',
  ];
  const technical = reportTools.descriptors();
  check(
    'compiled Context and Reports modules expose two versioned strict technical read ports',
    technical.length === 2 &&
      technical.some((tool) => tool.name === 'nodia_reports_run') &&
      technical.every((tool) =>
        /^[a-f0-9]{64}$/.test(reportTools.contractHash(tool.name)),
      ),
  );
  const description = await reportTools.execute(
    identities.get('1'),
    'nodia_reports_describe',
    {},
    { allowedModuleRoutes: moduleRoutes },
  );
  check(
    'technical report discovery exposes exactly the currently authorized logical sources',
    description.catalog_version === version &&
      description.sources.length === 11,
  );
  const frozenDescription = await reportTools.execute(
    identities.get('1'),
    'nodia_reports_describe',
    {},
    { allowedModuleRoutes: ['/tools/finances-personal'] },
  );
  check(
    'technical discovery also honors frozen run modules instead of expanding to all current assignments',
    frozenDescription.sources.length === 2 &&
      frozenDescription.sources.every(
        (source) => source.scope_kind === 'personal',
      ),
  );
  const instantPeriod = {
    kind: 'instant',
    dimension_key: 'created_at',
    from: '2027-01-01T03:00:00Z',
    to_exclusive: '2027-02-01T03:00:00Z',
    timezone: 'America/Santiago',
  };
  const civilPeriod = {
    kind: 'civil_date',
    dimension_key: 'incurred_on',
    from: '2027-01-01',
    to_exclusive: '2027-02-01',
    timezone: 'America/Santiago',
  };
  const finance = (extra = {}) =>
    Object.fromEntries(
      Object.entries({
        source_key: 'finance_movements',
        alias: 'personal',
        scope: {},
        period: instantPeriod,
        measures: [
          {
            measure_key: 'confirmed_expense_amount',
            aggregation: 'sum',
            output_key: 'amount',
          },
          { measure_key: 'records', aggregation: 'count', output_key: 'count' },
        ],
        filters: {
          all: [{ field_key: 'status', operator: 'eq', value: 'paid' }],
        },
        ...extra,
      }).filter(([, value]) => value !== undefined),
    );
  const rental = (property, alias = 'lodging', extra = {}) => ({
    source_key: 'rental_expenses',
    alias,
    scope: { property_id: property },
    period: civilPeriod,
    measures: [
      { measure_key: 'amount', aggregation: 'sum', output_key: 'amount' },
      { measure_key: 'records', aggregation: 'count', output_key: 'count' },
    ],
    ...extra,
  });
  const request = (sources, extra = {}) => ({
    catalog_version: version,
    combine: 'separate',
    sources,
    ...extra,
  });
  const run = (sources, extra = {}, actor = '1') =>
    compose.execute(identities.get(actor), request(sources, extra));
  const block = (result, alias) =>
    result.source_results.find((source) => source.source_alias === alias);
  const rejectBeforeSql = async (
    name,
    invoke,
    expected = /invalid_input|unsupported_semantics|needs_clarification|capability_denied|session_expired|session_revoked/,
  ) => {
    const before = reportQueries;
    await assert.rejects(invoke, (value) =>
      expected.test(String(value?.message)),
    );
    check(name, before === reportQueries);
  };
  const sources = [finance(), rental(seed.properties[0])];
  const cancelled = new AbortController();
  cancelled.abort();
  await rejectBeforeSql(
    'a cancelled report does not begin any source aggregate',
    () =>
      compose.execute(identities.get('1'), request(sources), {
        signal: cancelled.signal,
      }),
    /report_cancelled/,
  );
  await rejectBeforeSql(
    'a report whose deadline already expired does not begin any source aggregate',
    () =>
      compose.execute(identities.get('1'), request(sources), {
        deadlineAt: new Date(Date.now() - 1000),
      }),
    /report_cancelled/,
  );
  const authorityQueryCount = reportQueries;
  await compose.verifyAuthority(identities.get('1'), request(sources));
  check(
    'stored report authority can be rechecked with native scope checks without recomputing aggregates',
    reportQueries === authorityQueryCount,
  );
  const separate = await run(sources);
  check(
    'separate cross-product report preserves exact full-filter totals for personal and property expenses',
    separate.status === 'ok' &&
      block(separate, 'personal').totals.amount === '240' &&
      block(separate, 'lodging').totals.amount === '200',
  );
  check(
    'cross-source provenance explicitly declares independent SQL observations instead of a simultaneous snapshot',
    separate.snapshot_consistency === 'independent_source_snapshots' &&
      separate.provenance.length === 2 &&
      separate.provenance.every((source) =>
        Number.isFinite(Date.parse(source.observed_at)),
      ),
  );
  check(
    'no combined grand total is inferred across personal pesos and property CLP',
    !Object.hasOwn(separate, 'totals') &&
      !separate.columns.some((column) =>
        /grand_total|combined_total/.test(column.key),
      ) &&
      separate.source_errors.length === 0,
  );
  check(
    'source blocks retain source-specific temporal basis and zone with no invented economic date',
    block(separate, 'personal').basis_key === 'created_at' &&
      block(separate, 'personal').period.kind === 'instant' &&
      block(separate, 'lodging').basis_key === 'incurred_on' &&
      block(separate, 'lodging').period.kind === 'civil_date',
  );
  check(
    'table projection has closed scalar rows whose width matches declared columns',
    separate.rows.every(
      (row) =>
        Array.isArray(row) &&
        row.length === separate.columns.length &&
        row.every(
          (value) =>
            value === null ||
            ['string', 'number', 'boolean'].includes(typeof value),
        ),
    ),
  );
  const beforeInspection = reportQueries;
  await db.transaction('READ COMMITTED', (manager) =>
    reportTools.verifyResult(
      identities.get('3'),
      'nodia_reports_run',
      request(sources),
      separate,
      manager,
      moduleRoutes,
      '1',
    ),
  );
  check(
    'super admin inspects another owner report with original attribution and current authority without recomputing it',
    reportQueries === beforeInspection,
  );
  const [provider] = await db.query(
    "INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI31 adapter','{}') RETURNING id",
  );
  const create = compiled.get(Create),
    admit = compiled.get(Admit),
    stage = compiled.get(Stage),
    getResult = compiled.get(GetResult);
  const chat = await create.execute(identities.get('1'), {
    client_request_id: randomUUID(),
    selection: {
      connection_id: provider.id,
      mode: 'token_plan_agentic',
      model_id: 'synthetic-ai31-model',
      effort_id: null,
    },
  });
  const admitted = await admit.execute(
    identities.get('1'),
    chat.conversation_id,
    {
      client_message_id: randomUUID(),
      expected_conversation_revision: chat.revision,
      parts: [{ kind: 'text', text: 'Synthetic cross-product report.' }],
    },
  );
  let workerResult;
  const reportCallId = randomUUID();
  callbackScenario = async (request, signal) => {
    check(
      'actual durable worker exposes the report ports frozen into its Agentic tool grant',
      request.tools.some((tool) => tool.name === 'nodia_reports_describe') &&
        request.tools.some((tool) => tool.name === 'nodia_reports_run'),
    );
    const catalog = await request.onToolCall(
      { callId: randomUUID(), name: 'nodia_reports_describe', arguments: {} },
      signal,
    );
    check(
      'actual report callback describes the authorized catalog through checkpoint admission',
      catalog.catalog_version === version && catalog.sources.length === 11,
    );
    workerResult = await request.onToolCall(
      {
        callId: reportCallId,
        name: 'nodia_reports_run',
        arguments: requestReport(),
      },
      signal,
    );
    const beforeReplay = reportQueries;
    const replay = await request.onToolCall(
      {
        callId: reportCallId,
        name: 'nodia_reports_run',
        arguments: requestReport(),
      },
      signal,
    );
    assert.deepEqual(replay, workerResult);
    check(
      'actual duplicate report callback recovers the immutable receipt without repeating source aggregates',
      reportQueries === beforeReplay,
    );
  };
  const requestReport = () => request(sources);
  const worker = randomUUID(),
    signal = new AbortController().signal;
  await stage.execute(worker, signal);
  await stage.execute(worker, signal);
  if (callbackError) throw callbackError;
  const [finishedRun] = await db.query(
    'SELECT state,error_code FROM nodia_ai_runs WHERE id=$1',
    [admitted.run.run_id],
  );
  assert.equal(finishedRun.state, 'completed', JSON.stringify(finishedRun));
  check(
    'actual durable inference stage completes with one synthetic adapter dispatch and real report SQL',
    adapterExecutions === 1 &&
      block(workerResult, 'personal').totals.amount === '240' &&
      block(workerResult, 'lodging').totals.amount === '200',
  );
  const receipts = await db.query(
    "SELECT id,state,public_result,arguments_hash FROM nodia_ai_tool_calls WHERE run_id=$1 AND tool_name='nodia_reports_run'",
    [admitted.run.run_id],
  );
  check(
    'report callback commits exactly one completed durable receipt despite callback replay',
    receipts.length === 1 &&
      receipts[0].state === 'completed' &&
      /^[a-f0-9]{64}$/.test(receipts[0].arguments_hash),
  );
  const beforeObserve = reportQueries;
  const ownerResult = await getResult.execute(
    identities.get('1'),
    receipts[0].id,
  );
  const adminResult = await getResult.execute(
    identities.get('3'),
    receipts[0].id,
  );
  const observation = await getResult.observe(
    identities.get('1'),
    receipts[0].id,
  );
  assert.deepEqual(ownerResult, workerResult);
  assert.deepEqual(adminResult, workerResult);
  check(
    'owner and super admin recover the exact report via the chat observation boundary without executing SQL aggregates',
    reportQueries === beforeObserve,
  );
  check(
    'report observation emits typed report metadata for the client result reference',
    observation.result_ref.tool_name === 'nodia_reports_run' &&
      observation.source.resource_key === 'reports',
  );
  await assert.rejects(
    () => getResult.execute(identities.get('2'), receipts[0].id),
    /conversation_not_found|not_found|access_denied|capability_denied/,
  );
  check(
    'another ordinary user cannot inspect the report receipt from a foreign chat',
  );
  await db.query(
    'UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id=$1',
    [moduleIds.get('personal_finance')],
  );
  await assert.rejects(
    () => getResult.execute(identities.get('1'), receipts[0].id),
    /capability_denied/,
  );
  check(
    'chat report observation rejects newly revoked destination access without replaying report SQL',
    reportQueries === beforeObserve,
  );
  await db.query(
    'UPDATE user_modules SET is_active=true WHERE user_id=1 AND module_id=$1',
    [moduleIds.get('personal_finance')],
  );
  const equal = await run([
    finance({
      filters: {
        all: [
          {
            field_key: 'category_group_id',
            operator: 'in',
            values: seed.groups,
          },
          { field_key: 'status', operator: 'eq', value: 'paid' },
        ],
      },
    }),
    rental(seed.properties[0]),
  ]);
  check(
    'equal financial amounts and overlapping category memberships keep two facts without fan-out',
    block(equal, 'personal').totals.amount === '200' &&
      block(equal, 'personal').matched_records === '2',
  );
  const large = await run([
    finance({
      period: undefined,
      filters: {
        all: [
          {
            field_key: 'category_id',
            operator: 'eq',
            value: seed.categories[2],
          },
        ],
      },
    }),
    rental(seed.properties[0]),
  ]);
  check(
    'cross-source composition preserves money beyond MAX SAFE INTEGER as an exact decimal string',
    block(large, 'personal').totals.amount === '9007199254740993' &&
      JSON.stringify(large).includes('9007199254740993'),
  );
  await rejectBeforeSql(
    'incompatible currency/unit comparison fails before any source aggregate is executed',
    () => run(sources, { combine: 'compare_compatible' }),
  );
  const category = {
    group_by: [{ dimension_key: 'category', output_key: 'category' }],
  };
  const comparedSources = [
    rental(seed.properties[0], 'first_house', category),
    rental(seed.properties[1], 'second_house', category),
  ];
  const compared = await run(comparedSources, {
    combine: 'compare_compatible',
  });
  await assert.rejects(
    () =>
      run(comparedSources, { combine: 'compare_compatible', page_limit: 2 }),
    /unsupported_semantics/,
  );
  check(
    'comparison refuses independently truncated source pages that would fabricate missing groups or split alignment',
  );
  check(
    'compatible property measures compare independently across the same civil month without summing houses',
    compared.status === 'ok' &&
      compared.combine === 'compare_compatible' &&
      block(compared, 'first_house').totals.amount === '200' &&
      block(compared, 'second_house').totals.amount === '200',
  );
  check(
    'a known zero group remains zero and an actual nullable grouping remains null',
    block(compared, 'first_house').rows.some(
      (row) => row[0] === null && row.includes('0'),
    ) &&
      block(compared, 'second_house').rows.some(
        (row) => row[0] === 'cleaning' && row.includes('0'),
      ),
  );
  const groupColumn = compared.columns.findIndex(
    (column) => column.key === 'group.0',
  );
  const firstAmount = compared.columns.findIndex(
    (column) => column.key === 'first_house.amount',
  );
  const secondAmount = compared.columns.findIndex(
    (column) => column.key === 'second_house.amount',
  );
  const unmatched = compared.rows.find((row) => row[groupColumn] === 'taxes');
  check(
    'comparison preserves an absent source group as null alongside a known zero from the other source',
    unmatched &&
      unmatched[firstAmount] === null &&
      unmatched[secondAmount] === '0',
  );
  for (const [name, mutate] of [
    [
      'row width',
      (value) => {
        value.rows[0].push('unregistered');
      },
    ],
    [
      'scalar type',
      (value) => {
        block(value, 'personal').rows[0][0] = 240;
      },
    ],
    [
      'duplicate provenance',
      (value) => {
        value.provenance[1].source_alias = 'personal';
      },
    ],
    [
      'status inconsistent with source errors',
      (value) => {
        value.status = 'partial';
      },
    ],
    [
      'unknown top-level fields',
      (value) => {
        value.sql = 'SELECT * FROM users';
      },
    ],
    [
      'invented monetary unit',
      (value) => {
        block(value, 'personal').columns[0].unit = 'money';
        value.columns.find((column) => column.key === 'personal.amount').unit =
          'money';
      },
    ],
    [
      'unknown amount in successful source',
      (value) => {
        block(value, 'personal').rows[0][0] = null;
        value.rows.find((row) => row[0] === 'personal')[1] = null;
      },
    ],
  ]) {
    const invalid = structuredClone(separate);
    mutate(invalid);
    await assert.rejects(
      async () => compose.validateResult(invalid, request(sources)),
      /invalid_input/,
    );
    check(
      `runtime result validation rejects ${name} instead of trusting a static wire type`,
    );
  }
  await rejectBeforeSql(
    'incompatible periods cannot be compared as the same month',
    () =>
      run(
        [
          comparedSources[0],
          {
            ...comparedSources[1],
            period: { ...civilPeriod, from: '2027-01-02' },
          },
        ],
        { combine: 'compare_compatible' },
      ),
  );
  await rejectBeforeSql(
    'paid and incurred expense measures are not silently treated as the same economic meaning',
    () =>
      run(
        [
          rental(seed.properties[0], 'first_house'),
          rental(seed.properties[1], 'second_house', {
            measures: [
              {
                measure_key: 'paid_amount',
                aggregation: 'sum',
                output_key: 'amount',
              },
              {
                measure_key: 'records',
                aggregation: 'count',
                output_key: 'count',
              },
            ],
          }),
        ],
        { combine: 'compare_compatible' },
      ),
  );
  await rejectBeforeSql(
    'duplicate aliases cannot collapse source provenance',
    () => run([finance(), rental(seed.properties[0], 'personal')]),
  );
  await rejectBeforeSql(
    'an invalid logical field in the second source is rejected before executing the valid first source',
    () =>
      run([
        finance(),
        rental(seed.properties[0], 'lodging', {
          filters: {
            all: [
              {
                field_key: 'amount); DROP TABLE users;--',
                operator: 'eq',
                value: '1',
              },
            ],
          },
        }),
      ]),
  );
  await rejectBeforeSql(
    'a global row limit smaller than the number of sources is rejected before SQL',
    () => run(sources, { page_limit: 1 }),
  );
  await rejectBeforeSql('an obsolete catalog never reaches source SQL', () =>
    compose.execute(identities.get('1'), {
      ...request(sources),
      catalog_version: 'obsolete',
    }),
  );
  const zeroSources = sources.map((source) => ({
    ...source,
    filters: { all: [{ field_key: 'id', operator: 'is_null', value: true }] },
  }));
  const empty = await run(zeroSources);
  check(
    'all known empty populations produce genuine zero totals and status empty without errors',
    empty.status === 'empty' &&
      empty.source_errors.length === 0 &&
      empty.source_results.every(
        (source) =>
          source.matched_records === '0' &&
          Object.values(source.totals).every((value) => value === '0'),
      ),
  );
  const groupSources = [
    finance({
      group_by: [{ dimension_key: 'category_id', output_key: 'category' }],
    }),
    rental(seed.properties[0], 'lodging', category),
  ];
  const first = await run(groupSources, { page_limit: 2 });
  check(
    'cross-source pages respect the global bound while retaining totals of every filtered record',
    first.rows.length <= 2 &&
      !first.group_page_complete &&
      typeof first.next_cursor === 'string' &&
      block(first, 'personal').totals.amount === '240' &&
      block(first, 'lodging').totals.amount === '200',
  );
  const second = await run(groupSources, {
    page_limit: 2,
    cursor: first.next_cursor,
  });
  check(
    'composite cursors continue each source without repeating any returned source group',
    second.rows.length <= 2 &&
      second.source_results.every(
        (source) =>
          !source.rows.some((row) =>
            block(first, source.source_alias)?.rows.some(
              (previous) => previous[0] === row[0],
            ),
          ),
      ),
  );
  await rejectBeforeSql(
    'a cursor cannot be transferred to different source filters',
    () =>
      run(
        [
          {
            ...groupSources[0],
            filters: {
              all: [{ field_key: 'status', operator: 'eq', value: 'pending' }],
            },
          },
          groupSources[1],
        ],
        { page_limit: 2, cursor: first.next_cursor },
      ),
  );
  await rejectBeforeSql(
    'a cursor cannot be transferred to another actor/session',
    () => run(groupSources, { page_limit: 2, cursor: first.next_cursor }, '2'),
  );
  await rejectBeforeSql('a cursor cannot change the global page size', () =>
    run(groupSources, { page_limit: 4, cursor: first.next_cursor }),
  );
  const missing = await run([finance(), rental(seed.properties[2])]);
  check(
    'an inaccessible property becomes an explicit failed source without fabricated totals or matched records',
    missing.status === 'partial' &&
      block(missing, 'personal').totals.amount === '240' &&
      !block(missing, 'lodging') &&
      missing.source_errors.length === 1,
  );
  await db.query(
    'UPDATE rental_collaborators SET is_active=false WHERE property_id=$1 AND user_id=1',
    [seed.properties[1]],
  );
  const collaboratorRevoked = await run([
    finance(),
    rental(seed.properties[1]),
  ]);
  check(
    'property access is reauthorized on every cross-source invocation and revoked data is not replayed',
    collaboratorRevoked.status === 'partial' &&
      !block(collaboratorRevoked, 'lodging') &&
      collaboratorRevoked.source_errors.length === 1,
  );
  await db.query(
    'UPDATE rental_collaborators SET is_active=true WHERE property_id=$1 AND user_id=1',
    [seed.properties[1]],
  );
  await db.query(
    'UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id=$1',
    [moduleIds.get('personal_finance')],
  );
  await rejectBeforeSql(
    'stored report recovery rejects a revoked destination before returning recorded results',
    () => compose.verifyAuthority(identities.get('1'), request(sources)),
    /capability_denied/,
  );
  const revoked = await run(sources);
  check(
    'destination module revocation preserves other authorized sources but removes the revoked population',
    revoked.status === 'partial' &&
      !block(revoked, 'personal') &&
      block(revoked, 'lodging').totals.amount === '200' &&
      revoked.source_errors.length === 1,
  );
  const revokedFirstPage = await run(groupSources, { page_limit: 2 });
  const revokedNextPage = await run(groupSources, {
    page_limit: 2,
    cursor: revokedFirstPage.next_cursor,
  });
  check(
    'an unavailable source stays explicit on subsequent pages instead of becoming a false complete report',
    revokedFirstPage.status === 'partial' &&
      revokedFirstPage.next_cursor &&
      revokedNextPage.status === 'partial' &&
      revokedNextPage.source_errors.some(
        (error) => error.source_alias === 'personal',
      ) &&
      !block(revokedNextPage, 'personal'),
  );
  await db.query(
    'UPDATE user_modules SET is_active=true WHERE user_id=1 AND module_id=$1',
    [moduleIds.get('personal_finance')],
  );
  const NativeRun = await loadAi(
    'nodia-ai-reports/use-case/run-nodia-ai-report.use-case',
    'RunNodiaAiReportUseCase',
  );
  const nativeRun = compiled.get(NativeRun);
  const originalExecute = nativeRun.execute;
  let revokedBetweenSources = false;
  // Intercept only scheduling after an actual committed source read; authorization and aggregates remain real.
  nativeRun.execute = async function (identity, query, manager) {
    const result = await originalExecute.call(this, identity, query, manager);
    if (!revokedBetweenSources && query.sources[0].alias === 'personal') {
      revokedBetweenSources = true;
      await db.query(
        'UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id=$1',
        [moduleIds.get('personal_finance')],
      );
    }
    return result;
  };
  try {
    await assert.rejects(() => run(sources), /capability_denied/);
    check(
      'revocation after the first source committed prevents its data from escaping after the second source',
      revokedBetweenSources,
    );
  } finally {
    nativeRun.execute = originalExecute;
    await db.query(
      'UPDATE user_modules SET is_active=true WHERE user_id=1 AND module_id=$1',
      [moduleIds.get('personal_finance')],
    );
  }
  await db.query(
    'ALTER TABLE rental_expenses RENAME TO ai31_temporarily_unavailable_expenses',
  );
  try {
    const unavailable = await run([rental(seed.properties[0]), finance()]);
    check(
      'a genuine first-source SQL failure does not poison the following independent source transaction',
      unavailable.status === 'partial' &&
        !block(unavailable, 'lodging') &&
        block(unavailable, 'personal').totals.amount === '240',
    );
    check(
      'failed source diagnostics contain no SQL, table names, credential details or invented zero amount',
      unavailable.source_errors.length === 1 &&
        !JSON.stringify(unavailable.source_errors).match(
          /rental_expenses|ai31_temporarily|\bSELECT\b|\brelation\b|password/i,
        ),
    );
  } finally {
    await db.query(
      'ALTER TABLE ai31_temporarily_unavailable_expenses RENAME TO rental_expenses',
    );
  }
  await db.query(
    "UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id IN (SELECT id FROM modules WHERE key='nodia_ai')",
  );
  await rejectBeforeSql(
    'NodiaAI module revocation blocks the entire report rather than returning misleading partial success',
    () => run(sources),
  );
  await db.query(
    'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',
    [identities.get('2').sessionId],
  );
  await rejectBeforeSql(
    'revoked sessions cannot obtain even partial report data',
    () => run(sources, {}, '2'),
  );
} catch (error) {
  failure = error;
} finally {
  await compiled?.close();
  await fixture.close();
}
if (failure) {
  console.error(
    JSON.stringify({
      stage: 'AI-31',
      completed_checks: checks.length,
      last_checks: checks.slice(-3),
    }),
  );
  throw failure;
}
console.log(
  JSON.stringify(
    {
      stage: 'AI-31',
      scope:
        'compiled_cross_source_report_use_cases_real_disposable_postgresql_synthetic_records',
      checks: checks.length,
      report_sql_queries: reportQueries,
      passed: checks,
      cleanup_completed: true,
      configured_database_used: false,
      provider_inference: false,
      elapsed_seconds: Math.round((Date.now() - started) / 10) / 100,
      limitations: [
        'No provider generation, MCP publication or production database is exercised.',
        'Each source uses an independent authorized SQL observation; no cross-source grand total is inferred.',
      ],
    },
    null,
    2,
  ),
);
