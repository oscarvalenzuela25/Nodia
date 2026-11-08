// Real compiled worker/admission/MCP with disposable PostgreSQL and frozen native file bytes.
// Storage, inspection, extraction transport and pure normalization are explicitly synthetic.
// No configured DB, Gemini account/profile, R2 or operational service is modified.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';
import { createAi15PublicationFixture } from './nodia-ai-ai15.fixture.mjs';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';

const started = Date.now(),
  checks = [];
const check = (name, condition = true) => {
  assert.ok(condition, name);
  checks.push(name);
};
// ai3603 is only an isolated fixture namespace; the implementation stage is AI-36-C03.
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const fixture = await createNodiaAiIntegrationFixture('ai3603');
const { db, options, identities } = fixture;
let ports,
  compiled,
  app,
  publication,
  dispatches = 0,
  normalizations = 0,
  preparations = 0,
  syntheticReads = 0,
  httpRequests = 0;
const name = 'nodia_invoices_analyze';
const load = async (...entries) =>
  Promise.all(entries.map(([file, name]) => loadAi(file, name)));
try {
  const [
    AnalysisModule,
    AnalysisBuilder,
    Tools,
    Conversation,
    Processing,
    Runtime,
    Observation,
  ] = await load(
    [
      'nodia-ai-invoice-analysis/nodia-ai-invoice-analysis.module',
      'NodiaAiInvoiceAnalysisModule',
    ],
    [
      'nodia-ai-invoice-analysis/use-case/build-nodia-ai-invoice-analysis-tool.use-case',
      'BuildNodiaAiInvoiceAnalysisToolUseCase',
    ],
    ['nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'],
    [
      'nodia-ai-conversation/nodia-ai-conversation.module',
      'NodiaAiConversationModule',
    ],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    [
      'nodia-ai-observation/nodia-ai-observation.module',
      'NodiaAiObservationModule',
    ],
  );
  const [Stage, Create, Admit, Adapter, Redis] = await load(
    [
      'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
      'RunNodiaAiStageUseCase',
    ],
    [
      'nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case',
      'CreateNodiaAiConversationUseCase',
    ],
    [
      'nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case',
      'AdmitNodiaAiMessageUseCase',
    ],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['common/redis/redis.service', 'RedisService'],
  );
  const builder = (imports, providers = []) =>
    Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => options,
          dataSourceFactory: async () => db,
        }),
        ...imports,
      ],
      providers,
    })
      .overrideProvider(Redis)
      .useValue({
        get: async () => null,
        set: async () => {},
        del: async () => {},
        keys: async () => [],
      });
  const [
    Attachment,
    Storage,
    Inspector,
    CreateFile,
    UploadFile,
    ManageFile,
    Normalizer,
  ] = await load(
    [
      'nodia-ai-attachment/nodia-ai-attachment.module',
      'NodiaAiAttachmentModule',
    ],
    ['nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentStorage'],
    [
      'nodia-ai-attachment/types/attachment-ports',
      'NodiaAiAttachmentInspector',
    ],
    [
      'nodia-ai-attachment/use-case/create-nodia-ai-attachment.use-case',
      'CreateNodiaAiAttachmentUseCase',
    ],
    [
      'nodia-ai-attachment/use-case/upload-nodia-ai-attachment.use-case',
      'UploadNodiaAiAttachmentUseCase',
    ],
    [
      'nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case',
      'ManageNodiaAiAttachmentUseCase',
    ],
    [
      'nodia-ai-invoice-analysis/types/invoice-analysis-contract.types',
      'NodiaAiInvoiceAnalysisContract',
    ],
  );
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a4WQAAAAASUVORK5CYII=',
    'base64',
  );
  const pdf = Buffer.from(
    '%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF\n',
  );
  const objects = new Map();
  let inspected = 'image/png',
    normalizationHook = async () => {},
    malformedOutput = false;
  const storage = {
    async put(key, path, _mime, signal) {
      signal.throwIfAborted();
      objects.set(key, await readFile(path));
    },
    async get(key, limit) {
      syntheticReads++;
      const bytes = objects.get(key);
      assert.ok(bytes && bytes.length <= limit);
      return bytes;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  // Declared synthetic pure normalizer. Real Python normalization is covered separately.
  // This fixture never claims the provider interpreted a document or starts another inference.
  const pureInputs = [];
  const normalizer = {
    async prepare(input) {
      pureInputs.push({ tax: input.tax, providerFields: input.providerFields });
      preparations++;
      return { instructions: 'Synthetic invoice guide' };
    },
    async normalize(extraction) {
      normalizations++;
      await normalizationHook();
      return malformedOutput
        ? { unexpected: true }
        : { extraction: structuredClone(extraction.extraction) };
    },
  };
  let external;
  const setup = builder([AnalysisModule.forPublication([name]), Attachment]);
  setup.overrideProvider(Adapter).useValue({
    verifyConfiguration: (...args) => external.verifyConfiguration(...args),
  });
  setup.overrideProvider(Storage).useValue(storage);
  setup.overrideProvider(Inspector).useValue({
    async inspect() {
      return {
        mediaType: inspected,
        pageCount: inspected === 'application/pdf' ? 1 : null,
        durationSeconds: null,
        extractedText: null,
      };
    },
  });
  setup.overrideProvider(Normalizer).useValue(normalizer);
  ports = await setup.compile();
  const families = ports.get(AnalysisBuilder).execute();
  assert.equal(families.flatMap((family) => family.capabilities).length, 1);
  check(
    'one closed candidate analyzer is built without repository publication',
    families[0].capabilities[0].toolName === name,
  );
  publication = await createAi15PublicationFixture(families);
  let scenario = async () => {},
    callbackError;
  external = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe() {
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_fixture_only',
        resourceKey: 'gemini-profile:' + 'a'.repeat(64),
        configurationGeneration: 'b'.repeat(64),
        sessionGeneration: 'c'.repeat(32),
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: true,
        verifiedModalities: ['image', 'pdf', 'audio'],
        verifiedAttachmentMediaTypes: [
          'image/png',
          'application/pdf',
          'audio/webm',
        ],
        reason: null,
      };
    },
    async verifyConfiguration(selection, _generation, manager) {
      const [row] = await (manager ?? db).query(
        'SELECT p.is_active,p.use_agentic,c.is_active AS catalog_active,c.can_use_agentic FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1',
        [selection.connection_id],
      );
      if (
        !row?.is_active ||
        !row.catalog_active ||
        !row.use_agentic ||
        !row.can_use_agentic
      )
        throw Error('nodia_ai:eligibility_changed');
    },
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
        text: 'Synthetic invoice extraction awaiting human review.',
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
  const composition = publication.override(
    builder(
      [
        Tools,
        Conversation,
        Processing,
        Runtime,
        Observation,
        AnalysisModule.forPublication([name]),
        Attachment,
      ],
      [Stage],
    ),
  );
  composition.overrideProvider(Adapter).useValue(external);
  composition.overrideProvider(Storage).useValue(storage);
  composition.overrideProvider(Inspector).useValue({
    async inspect() {
      return {
        mediaType: inspected,
        pageCount: inspected === 'application/pdf' ? 1 : null,
        durationSeconds: inspected === 'audio/webm' ? 1 : null,
        extractedText: null,
      };
    },
  });
  composition.overrideProvider(Normalizer).useValue(normalizer);
  compiled = await composition.compile();
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  const Filter = await loadAi(
    'common/filters/all-exceptions.filter',
    'AllExceptionsFilter',
  );
  app.useGlobalFilters(new Filter());
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
  const base = `${await app.getUrl()}/api/v1/nodia-ai`;
  async function httpResult(id, expected = 200, actor = '1') {
    httpRequests++;
    const response = await fetch(base + '/tool-calls/' + id + '/result', {
      headers: { 'x-fixture-actor': actor },
    });
    const value = await response.json();
    assert.ok(
      (Array.isArray(expected) ? expected : [expected]).includes(
        response.status,
      ),
      JSON.stringify({ expected, actual: response.status, value }),
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return value;
  }
  const [group] = await db.query(
    "SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'",
  );
  let [destination] = await db.query(
    "SELECT id::text FROM modules WHERE link='/business'",
  );
  if (!destination)
    [destination] = await db.query(
      "INSERT INTO modules(key,link,module_group_id) VALUES('synthetic_ai3603_business','/business',$1) RETURNING id::text",
      [group.id],
    );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',
    [destination.id],
  );
  const business = randomUUID(),
    otherBusiness = randomUUID();
  await db.query(
    "INSERT INTO businesses(id,owner_id,name) VALUES($1,1,'Synthetic AI36 invoice analysis'),($2,2,'Synthetic other business')",
    [business, otherBusiness],
  );
  const [supplier] = await db.query(
    "INSERT INTO providers(business_id,name,fields,tax) VALUES($1,'Synthetic supplier','{}',19) RETURNING id::text",
    [business],
  );
  const [wrongSupplier] = await db.query(
    "INSERT INTO providers(business_id,name,fields,tax) VALUES($1,'Synthetic unrelated supplier','{}',19) RETURNING id::text",
    [otherBusiness],
  );
  const [catalog] = await db.query(
    "INSERT INTO ai_provider_catalog(key,name,can_use_agentic) VALUES('gemini','Synthetic invoice catalog',true) ON CONFLICT(key) DO UPDATE SET is_active=true,can_use_agentic=true RETURNING id::text",
  );
  const [provider] = await db.query(
    "INSERT INTO ai_providers(catalog_id,name,use_agentic,fields,default_mode) VALUES($1,'Synthetic invoice connection',true,'{}','agentic') RETURNING id::text",
    [catalog.id],
  );
  const selection = {
    connection_id: provider.id,
    mode: 'agentic',
    model_id: 'synthetic-ai3603-model',
    effort_id: null,
  };
  const identity = identities.get('1'),
    signal = new AbortController().signal;
  const stage = compiled.get(Stage),
    create = compiled.get(Create),
    admit = compiled.get(Admit);
  const count = async (table, where = 'true', args = []) =>
    (
      await db.query(
        `SELECT count(*)::int n FROM ${table} WHERE ${where}`,
        args,
      )
    )[0].n;
  let activeRun, activeChat, activeAttachment;
  const call = (request, args, callId = randomUUID()) =>
    request.onToolCall({ callId, name, arguments: args }, signal);
  async function attachment(
    chat,
    kind = 'image',
    bytes = png,
    mime = 'image/png',
    reviewed = false,
  ) {
    inspected = mime;
    const intent = await compiled.get(CreateFile).execute(identity, {
      conversation_id: chat,
      client_request_id: randomUUID(),
      kind,
      byte_count: bytes.length,
      file_name: 'synthetic-source.' + (kind === 'image' ? 'png' : kind),
    });
    const ready = await compiled
      .get(UploadFile)
      .execute(
        identity,
        intent.attachment.attachment_id,
        Readable.from([bytes]),
        'application/octet-stream',
        String(bytes.length),
      );
    if (reviewed)
      await compiled.get(ManageFile).review(identity, ready.attachment_id, {
        text: 'Reviewed synthetic document',
        expected_revision: 0,
      });
    return ready.attachment_id;
  }
  async function runScenario(
    callback,
    {
      kind = 'image',
      bytes = png,
      mime = 'image/png',
      reviewed = false,
      withFile = true,
      existingChat = null,
    } = {},
  ) {
    callbackError = undefined;
    scenario = callback;
    const chat = existingChat
      ? {
          conversation_id: existingChat,
          revision: (
            await db.query(
              'SELECT revision FROM nodia_ai_conversations WHERE id=$1',
              [existingChat],
            )
          )[0].revision,
        }
      : await create.execute(identity, {
          client_request_id: randomUUID(),
          selection,
        });
    activeChat = chat.conversation_id;
    activeAttachment = withFile
      ? await attachment(activeChat, kind, bytes, mime, reviewed)
      : null;
    const accepted = await admit.execute(identity, activeChat, {
      client_message_id: randomUUID(),
      expected_conversation_revision: chat.revision,
      parts: [
        {
          kind: 'text',
          text: 'Analyze this synthetic invoice without creating records.',
        },
        ...(activeAttachment
          ? [{ kind, attachment_id: activeAttachment }]
          : []),
      ],
    });
    activeRun = accepted.run.run_id;
    await stage.execute(randomUUID(), signal);
    await stage.execute(randomUUID(), signal);
    if (callbackError) throw callbackError;
    const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [
      activeRun,
    ]);
    assert.equal(
      run.state,
      'completed',
      JSON.stringify({ state: run.state, error: run.error_code }),
    );
    return run;
  }
  const extraction = {
    code: 'SYN-C03-001',
    total_amount: 0,
    data: {
      issue_date: '',
      items: [
        {
          code: null,
          name: 'Synthetic zero-price item',
          quantity: 1,
          packages: null,
          units_per_package: null,
          cost_price: 0,
          cost_price_tax: 0,
          unit_price: null,
          total_price: 0,
        },
      ],
    },
  };
  const prepareArgs = () => ({
    action: 'prepare',
    attachment_id: activeAttachment,
    business_id: business,
    provider_id: supplier.id,
  });
  const completeArgs = (analysisId, value = extraction) => ({
    action: 'complete',
    analysis_id: analysisId,
    extraction: value,
  });
  const reject = async (
    name,
    work,
    pattern = /invalid_tool_input|invalid_tool_output|tool_not_available|capability|attachment|analysis|preconditions|conflict|eligibility|catalog|invalid_input/u,
  ) => {
    await assert.rejects(work, pattern);
    check(name);
  };
  const noEffects = async () => {
    for (const table of [
      'invoices',
      'products',
      'nodia_ai_drafts',
      'nodia_ai_proposals',
      'nodia_ai_executions',
    ])
      assert.equal(await count(table), 0, table);
  };
  await runScenario(async (request) => {
    check(
      'synthetic active Agentic dispatch receives exact frozen PNG bytes',
      request.attachments?.length === 1 &&
        Buffer.from(request.attachments[0].content_base64, 'base64').equals(
          png,
        ) &&
        request.attachments[0].sha256 ===
          createHash('sha256').update(png).digest('hex'),
    );
    assert.ok(request.tools.some((tool) => tool.name === name));
    const [armed] = await db.query(
      'SELECT phase FROM nodia_ai_job_attempts WHERE id=$1',
      [request.attemptId],
    );
    assert.equal(armed.phase, 'dispatch_armed');
    const prepared = await call(request, prepareArgs());
    check(
      'prepare commits a durable owned analysis anchor and native guide',
      prepared.status === 'prepared' &&
        prepared.review_required === true &&
        prepared.extraction_source === 'active_agentic_generation' &&
        typeof prepared.analysis_id === 'string',
    );
    const [anchor] = await db.query(
      'SELECT * FROM nodia_ai_tool_calls WHERE id=$1',
      [prepared.analysis_id],
    );
    assert.equal(anchor.state, 'completed');
    assert.equal(anchor.conversation_id, activeChat);
    const callId = randomUUID(),
      args = completeArgs(prepared.analysis_id);
    const analyzed = await call(request, args, callId);
    check(
      'complete retains zero and null from extraction without changing domain records',
      analyzed.status === 'analyzed' &&
        analyzed.review_required === true &&
        analyzed.extraction.total_amount === 0 &&
        analyzed.extraction.data.items[0].unit_price === null,
    );
    const once = normalizations;
    assert.deepEqual(await call(request, args, callId), analyzed);
    check(
      'same callback ID replays exact receipt without another normalization',
      normalizations === once,
    );
    await reject('same callback ID with different extraction conflicts', () =>
      call(
        request,
        completeArgs(prepared.analysis_id, { ...extraction, code: 'changed' }),
        callId,
      ),
    );
    await reject(
      'new callback ID cannot complete a previously consumed analysis anchor',
      () => call(request, args),
    );
    await noEffects();
    check('analysis creates no invoice product draft proposal or execution');
    await db.query(
      'UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id=$1',
      [destination.id],
    );
    await reject('current module revocation blocks prior analysis replay', () =>
      call(request, args, callId),
    );
    await db.query(
      'UPDATE user_modules SET is_active=true WHERE user_id=1 AND module_id=$1',
      [destination.id],
    );
  });
  const [firstComplete] = await db.query(
    "SELECT id,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 AND public_result->>'status'='analyzed'",
    [activeRun],
  );
  const beforeRecovery = normalizations,
    beforeDispatches = dispatches;
  assert.deepEqual(
    await httpResult(firstComplete.id),
    firstComplete.public_result,
  );
  await db.query(
    "UPDATE nodia_ai_runs SET deadline_at=now()-interval '1 second' WHERE id=$1",
    [activeRun],
  );
  assert.deepEqual(
    await httpResult(firstComplete.id),
    firstComplete.public_result,
  );
  check(
    'human GET recovers terminal analysis even after run deadline without another normalization',
    normalizations === beforeRecovery && dispatches === beforeDispatches,
  );
  await httpResult(firstComplete.id, 404, '2');
  check('another chat owner cannot inspect the saved extraction');
  await db.query(
    'UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id=$1',
    [destination.id],
  );
  await httpResult(firstComplete.id, [403, 404]);
  await db.query(
    'UPDATE user_modules SET is_active=true WHERE user_id=1 AND module_id=$1',
    [destination.id],
  );
  await db.query('UPDATE ai_providers SET is_active=false WHERE id=$1', [
    provider.id,
  ]);
  await httpResult(firstComplete.id, [403, 404]);
  await db.query('UPDATE ai_providers SET is_active=true WHERE id=$1', [
    provider.id,
  ]);
  check('terminal GET rechecks current module and exact connection authority');
  check(
    'two analysis phases share one existing provider dispatch',
    dispatches === 1,
  );
  await runScenario(
    async (request) => {
      check(
        'frozen PDF original reaches same Agentic generation',
        request.attachments?.[0].media_type === 'application/pdf' &&
          Buffer.from(request.attachments[0].content_base64, 'base64').equals(
            pdf,
          ),
      );
      const prepared = await call(request, prepareArgs());
      const value = await call(request, completeArgs(prepared.analysis_id));
      check(
        'PDF prepare and completion persist only review-required analysis',
        value.status === 'analyzed' && value.attachment_id === activeAttachment,
      );
    },
    { kind: 'pdf', bytes: pdf, mime: 'application/pdf' },
  );
  await runScenario(async (request) => {
    const before = normalizations;
    for (const prohibited of [
      { url: 'https://example.invalid/source.png' },
      { model: 'synthetic-forbidden-model' },
      { actor_id: '2' },
      { sql: 'SELECT synthetic_only' },
      { secret: 'synthetic-secret' },
    ])
      await assert.rejects(
        () => call(request, { ...prepareArgs(), ...prohibited }),
        /invalid_tool_input/u,
      );
    check(
      'closed MCP input rejects URL model actor SQL and secrets before pure-port work',
      normalizations === before,
    );
    await reject('supplier must belong to the specified business', () =>
      call(request, { ...prepareArgs(), provider_id: wrongSupplier.id }),
    );
    const prepared = await call(request, prepareArgs());
    const changed = { ...extraction, total_amount: -1 };
    await reject(
      'closed extraction rejects negative amount before normalization',
      () => call(request, completeArgs(prepared.analysis_id, changed)),
    );
  });
  await runScenario(async (request) => {
    const prepared = await call(request, prepareArgs());
    await db.query(
      'UPDATE nodia_ai_attachments SET content_hash=$2 WHERE id=$1',
      [activeAttachment, 'd'.repeat(64)],
    );
    await reject('source content hash mutation fences completion', () =>
      call(request, completeArgs(prepared.analysis_id)),
    );
  });
  await runScenario(async (request) => {
    const prepared = await call(request, prepareArgs());
    await db.query(
      'UPDATE nodia_ai_attachments SET generation=$2 WHERE id=$1',
      [activeAttachment, randomUUID()],
    );
    await reject('source object generation mutation fences completion', () =>
      call(request, completeArgs(prepared.analysis_id)),
    );
  });
  await runScenario(async (request) => {
    const prepared = await call(request, prepareArgs());
    await db.query(
      'UPDATE nodia_ai_attachments SET retention_epoch=retention_epoch+1 WHERE id=$1',
      [activeAttachment],
    );
    await reject('source retention epoch mutation fences completion', () =>
      call(request, completeArgs(prepared.analysis_id)),
    );
  });
  await runScenario(
    async (request) => {
      await reject(
        'reviewed text never impersonates an original in the current generation',
        () => call(request, prepareArgs()),
      );
      assert.ok(!request.attachments?.length);
    },
    { reviewed: true },
  );
  await runScenario(
    async (request) => {
      await reject(
        'audio is not an invoice source even when its exact format is verified',
        () => call(request, prepareArgs()),
      );
    },
    {
      kind: 'audio',
      bytes: Buffer.from('synthetic WebM bytes'),
      mime: 'audio/webm',
    },
  );
  let foreignAttachment;
  const foreignChat = await create.execute(identity, {
    client_request_id: randomUUID(),
    selection,
  });
  foreignAttachment = await attachment(foreignChat.conversation_id);
  await runScenario(async (request) => {
    await reject(
      'another chat attachment never becomes current-message original',
      () =>
        call(request, { ...prepareArgs(), attachment_id: foreignAttachment }),
    );
    await reject('unknown current-message attachment is rejected', () =>
      call(request, { ...prepareArgs(), attachment_id: randomUUID() }),
    );
    await reject('unprepared analysis ID cannot be completed', () =>
      call(request, completeArgs(randomUUID())),
    );
  });
  await runScenario(async (request) => {
    const prepared = await call(request, prepareArgs());
    const before = normalizations;
    normalizationHook = async () => {
      await db.query('UPDATE providers SET business_id=$2 WHERE id=$1', [
        supplier.id,
        otherBusiness,
      ]);
    };
    await reject(
      'supplier relation revocation during normalization blocks publication',
      () => call(request, completeArgs(prepared.analysis_id)),
    );
    normalizationHook = async () => {};
    await db.query('UPDATE providers SET business_id=$2 WHERE id=$1', [
      supplier.id,
      business,
    ]);
    assert.equal(normalizations, before + 1);
  });
  await runScenario(async (request) => {
    const prepared = await call(request, prepareArgs());
    malformedOutput = true;
    await reject(
      'malformed normalizer response never publishes successful extraction',
      () => call(request, completeArgs(prepared.analysis_id)),
    );
    malformedOutput = false;
    assert.equal(
      await count('nodia_ai_tool_calls', "run_id=$1 AND state='completed'", [
        activeRun,
      ]),
      1,
    );
  });
  const previousChat = activeChat,
    previousFile = activeAttachment;
  await runScenario(
    async (request) => {
      assert.ok(!request.attachments?.length);
      await reject(
        'an attachment from an earlier message is not the current generation source',
        () => call(request, { ...prepareArgs(), attachment_id: previousFile }),
      );
    },
    { existingChat: previousChat, withFile: false },
  );
  await runScenario(async (request) => {
    const prepared = await call(request, prepareArgs());
    await db.query('UPDATE ai_providers SET is_active=false WHERE id=$1', [
      provider.id,
    ]);
    await reject(
      'current connection revocation blocks completion before pure normalization',
      () => call(request, completeArgs(prepared.analysis_id)),
    );
    await db.query('UPDATE ai_providers SET is_active=true WHERE id=$1', [
      provider.id,
    ]);
    const completeId = randomUUID(),
      completed = await call(
        request,
        completeArgs(prepared.analysis_id),
        completeId,
      );
    assert.equal(completed.status, 'analyzed');
    await db.query(
      'UPDATE ai_provider_catalog SET can_use_agentic=false WHERE id=$1',
      [catalog.id],
    );
    await reject(
      'catalog mode revocation blocks completed receipt replay',
      () => call(request, completeArgs(prepared.analysis_id), completeId),
    );
    await db.query(
      'UPDATE ai_provider_catalog SET can_use_agentic=true WHERE id=$1',
      [catalog.id],
    );
  });
  await runScenario(async (request) => {
    const prepared = await call(request, prepareArgs()),
      id = randomUUID(),
      args = completeArgs(prepared.analysis_id);
    const before = normalizations;
    const outcomes = await Promise.allSettled([
      call(request, args, id),
      call(request, args, id),
    ]);
    const fulfilled = outcomes.filter(
      (outcome) => outcome.status === 'fulfilled',
    );
    assert.ok(fulfilled.length >= 1);
    for (const outcome of outcomes)
      if (outcome.status === 'rejected')
        assert.match(outcome.reason.message, /request_conflict/u);
    check(
      'concurrent duplicate completion admits one normalization and one durable extraction',
      normalizations === before + 1 &&
        (await count(
          'nodia_ai_tool_calls',
          "run_id=$1 AND state='completed' AND public_result->>'status'='analyzed'",
          [activeRun],
        )) === 1,
    );
    if (fulfilled.length === 2)
      assert.deepEqual(fulfilled[0].value, fulfilled[1].value);
  });
  await runScenario(async (request) => {
    const prepared = await call(request, prepareArgs()),
      id = randomUUID(),
      args = completeArgs(prepared.analysis_id);
    const once = normalizations;
    normalizationHook = async () => {
      throw Error('Synthetic pure normalizer connection lost');
    };
    await assert.rejects(
      () => call(request, args, id),
      /Synthetic pure normalizer connection lost/u,
    );
    normalizationHook = async () => {};
    await reject(
      'incomplete external receipt cannot be replayed after lost acknowledgement',
      () => call(request, args, id),
    );
    check(
      'lost acknowledgement never automatically repeats pure normalization',
      normalizations === once + 1,
    );
  });
  await runScenario(
    async (request) => {
      const before = normalizations;
      await reject(
        'native invoice limit rejects a source larger than ten MiB',
        () => call(request, prepareArgs()),
      );
      assert.equal(normalizations, before);
    },
    {
      bytes: Buffer.concat([
        png,
        Buffer.alloc(10 * 1024 * 1024 + 1 - png.length),
      ]),
    },
  );
  await runScenario(async (request) => {
    const args = { ...prepareArgs() };
    delete args.provider_id;
    const prepared = await call(request, args);
    assert.equal(prepared.provider_id, null);
    assert.equal(pureInputs.at(-1).tax, null);
    assert.equal(pureInputs.at(-1).providerFields, null);
    const result = await call(
      request,
      completeArgs(prepared.analysis_id, {
        ...extraction,
        code: null,
        total_amount: null,
      }),
    );
    check(
      'omitted supplier preserves unknown tax and null extraction values',
      result.extraction.code === null &&
        result.extraction.total_amount === null,
    );
  });
  await noEffects();
  check(
    'all rejection and replay scenarios leave domain and proposal tables unchanged',
  );
  const receipts = await db.query(
    'SELECT public_result FROM nodia_ai_tool_calls WHERE public_result IS NOT NULL',
  );
  const wire = JSON.stringify(receipts);
  check(
    'public receipts contain neither private storage keys nor document base64',
    !wire.includes('storage_key') &&
      !wire.includes('content_base64') &&
      !wire.includes(png.toString('base64')),
  );
  const [budget] = await db.query(
    'SELECT provider_dispatches_used FROM nodia_ai_runs WHERE id=$1',
    [activeRun],
  );
  check(
    'pure normalization does not create another native dispatch or slot',
    budget.provider_dispatches_used === 1,
  );
  console.log(
    JSON.stringify(
      {
        stage: 'AI-36-C03',
        scope: 'compiled_worker_mcp_invoice_analysis_disposable_sql',
        status: 'passed',
        checks: checks.length,
        results: checks,
        elapsed_ms: Date.now() - started,
        migrations: await count('migrations'),
        synthetic_provider_dispatches: dispatches,
        synthetic_pure_preparations: preparations,
        synthetic_pure_normalizations: normalizations,
        synthetic_storage_reads: syntheticReads,
        actual_provider_generations: 0,
        http_requests: httpRequests,
        native_profile_calls: 0,
        configured_database_used: false,
        synthetic_publication: true,
        production_publication: false,
        parser_layer:
          'explicit_synthetic_pure_contract_port_python_normalizer_verified_separately',
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  else if (compiled) await compiled.close();
  if (ports) await ports.close();
  publication?.close();
  await fixture.close();
}
