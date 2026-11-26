import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { GenerationWorkerSourceRegistry } from '../dist/ai-generation/worker-source-registry.js';
import { CheckModuleAccessUseCase } from '../dist/authorization/use-case/check-module-access.use-case.js';
import { ApiNodiaAiCredentialsService } from '../dist/nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { NodiaAiConnectionsService } from '../dist/nodia-ai-conversation/nodia-ai-connections.service.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { NodiaCvGenerationScope } from '../dist/nodia-cv/nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from '../dist/nodia-cv/nodia-cv-generation.store.js';
import { NodiaCvGenerationWorker } from '../dist/nodia-cv/nodia-cv-generation.worker.js';
import { NodiaCvProfilesService } from '../dist/nodia-cv/nodia-cv-profiles.service.js';
import { NodiaCvSelectionService } from '../dist/nodia-cv/nodia-cv-selection.service.js';
import {
  CV_PROBE_CANDIDATE,
  CV_PROBE_OFFER,
} from '../dist/nodia-cv/policies/nodia-cv-generation.js';
import { prepareCvTailoring } from '../dist/nodia-cv/engine/index.js';
import { NodiaCvGenerationsUseCase } from '../dist/nodia-cv/use-case/nodia-cv-generations.use-case.js';
import { NodiaCvProfilesUseCase } from '../dist/nodia-cv/use-case/nodia-cv-profiles.use-case.js';

// Use real SQL, authority, credential metadata, engine, ledger and worker.
// The provider reply is synthetic and never qualifies a real connection.
const url = new URL(process.env.NODIA_CV_TEST_DATABASE_URL ?? 'invalid:');
assert.ok(
  url.protocol === 'postgresql:' &&
    url.hostname === '127.0.0.1' &&
    /^\/nodia_cv_test_[a-z0-9_]+$/.test(url.pathname) &&
    !url.search &&
    !url.hash,
  'Use an empty disposable loopback PostgreSQL database named nodia_cv_test_*.',
);
const db = new DataSource({
  type: 'postgres',
  url: url.href,
  synchronize: false,
  entities: [fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url))],
  migrations: [
    fileURLToPath(new URL('../dist/migrations/*.js', import.meta.url)),
  ],
});
const hash = (text) => createHash('sha256').update(text).digest('hex');
const enginePolicy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
  JSON.parse(
    await readFile(
      new URL(
        '../dist/nodia-ai-runtime/config/runtime-policy.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);
const credentials = new ApiNodiaAiCredentialsService(db);
const access = new CheckModuleAccessUseCase(db);
const profiles = new NodiaCvProfilesService();
const store = new NodiaCvGenerationStore();
const people = new NodiaCvProfilesUseCase(db, access, profiles, store);
const scope = new NodiaCvGenerationScope(db, access);
const selections = new NodiaCvSelectionService(
  credentials,
  new NodiaAiConnectionsService(db),
  enginePolicy,
);
const okStatus = (status, pattern) => ({ status, message: pattern });
const model = 'cv-test-model';
const profileInput = {
  profile_name: 'Synthetic CV',
  full_name: CV_PROBE_CANDIDATE,
  main_stack: ['TypeScript'],
  contact: { email: 'private-qa@example.invalid' },
  experiences: [
    {
      company: 'Synthetic Studio',
      position: 'Developer',
      technologies: ['TypeScript'],
    },
  ],
};

async function user(id, admin = false) {
  const sessionId = randomUUID();
  await db.query("INSERT INTO users(id,email,name) VALUES($1,$2,'Synthetic')", [
    id,
    `cv-${id}@example.invalid`,
  ]);
  await db.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [sessionId, id, hash(sessionId)],
  );
  if (admin)
    await db.query(
      "INSERT INTO user_roles(user_id,role_id,is_active) SELECT $1,id,true FROM roles WHERE key='super_admin'",
      [id],
    );
  return { userId: id, sessionId };
}

try {
  await db.initialize();
  const [empty] = await db.query(
    "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'",
  );
  assert.equal(empty.count, 0, 'The disposable database must begin empty.');
  await db.runMigrations({ transaction: 'all' });
  const admin = await user('9007199254740931', true);
  const owner = await user('9007199254740932');
  const outsider = await user('9007199254740933');
  const [group] = await db.query(
    "INSERT INTO module_groups(key,sort_order) VALUES('cv_test',99) RETURNING id",
  );
  const [module] = await db.query(
    "INSERT INTO modules(module_group_id,key,link,sort_order) VALUES($1,'cv_test','/nodia-cv',0) RETURNING id",
    [group.id],
  );
  for (const actor of [owner, outsider])
    await db.query(
      'INSERT INTO user_modules(user_id,module_id,is_active) VALUES ($1,$2,true)',
      [actor.userId, module.id],
    );
  await db.query(
    "UPDATE ai_provider_catalog SET can_use_api_key=true,is_active=true WHERE key='openai'",
  );
  const [catalog] = await db.query(
    "SELECT id FROM ai_provider_catalog WHERE key='openai'",
  );
  assert.ok(catalog?.id);
  const [provider] = await db.query(
    "INSERT INTO ai_providers(catalog_id,fields,name,use_api_key,is_active) VALUES($1,$2::jsonb,'Synthetic',true,true) RETURNING id::text",
    [
      catalog.id,
      JSON.stringify({ api_key: { available_models: [{ id: model }] } }),
    ],
  );
  await db.query(
    "INSERT INTO ai_api_keys(provider_id,label,secret_ciphertext,secret_fingerprint,display_hint,is_active,is_selected) VALUES($1,'Synthetic','fixture-no-secret',repeat('a',64),'****',true,true)",
    [provider.id],
  );
  const selection = {
    connection_id: provider.id,
    mode: 'api_key',
    model_id: model,
    effort_id: null,
  };
  const adminProfile = await people.create(admin, {
    request_key: randomUUID(),
    profile: profileInput,
  });
  const ownerProfile = await people.create(owner, {
    request_key: randomUUID(),
    profile: { ...profileInput, full_name: 'Persona Sintética' },
  });
  const facts = prepareCvTailoring({
    profile: adminProfile,
    offer: CV_PROBE_OFFER,
    locale: 'en',
  }).evidence;
  const typeScript = facts.find((fact) => fact.text === 'TypeScript')?.id;
  assert.ok(typeScript);
  const valid = {
    requirements: [
      {
        quote: 'TypeScript',
        kind: 'required',
        relation: 'direct',
        evidenceIds: [typeScript],
      },
      {
        quote: 'Kubernetes',
        kind: 'preferred',
        relation: 'absent',
        evidenceIds: [],
      },
    ],
    selectedEvidenceIds: [typeScript],
  };
  let calls = 0;
  let behavior = 'valid';
  const api = {
    measure(prompt) {
      return { utf8Bytes: Buffer.byteLength(prompt), maximumUtf8Bytes: 65536 };
    },
    async execute(context) {
      assert.ok(!context.prompt.includes('private-qa@example.invalid'));
      await context.beforeExchange();
      calls++;
      await context.checkLease();
      if (behavior === 'lost') throw new Error('simulated response loss');
      const result =
        behavior === 'bad'
          ? { ...valid, selectedEvidenceIds: ['foreign-fact'] }
          : valid;
      const text = JSON.stringify(result);
      return {
        text,
        responseHash: hash(text),
        localClosed: true,
        remoteOutcome: 'completed',
      };
    },
  };
  const command = new NodiaCvGenerationsUseCase(
    scope,
    store,
    profiles,
    selections,
    api,
    enginePolicy,
  );
  const registry = new GenerationWorkerSourceRegistry();
  new NodiaCvGenerationWorker(
    scope,
    store,
    profiles,
    selections,
    api,
    registry,
    enginePolicy,
  ).onModuleInit();
  const run = () =>
    registry.execute(randomUUID(), new AbortController().signal);
  const input = (profile) => ({
    request_key: randomUUID(),
    profile_id: profile.id,
    profile_revision: profile.revision,
    language: 'en',
    offer_text: CV_PROBE_OFFER,
    selection,
  });

  const initialEligibility = await command.eligibility(owner, selection);
  assert.equal(initialEligibility.eligible, true);
  assert.equal(initialEligibility.qualified, false);
  assert.equal(initialEligibility.reason_code, 'available');
  assert.equal(
    (await command.eligibility(owner, { ...selection, mode: 'agentic' }))
      .reason_code,
    'agentic_transport_unavailable',
  );
  await assert.rejects(
    command.startProbe(owner, input(ownerProfile)),
    okStatus(403, /generation_probe_forbidden/),
  );
  const agenticRequest = input(ownerProfile);
  await assert.rejects(
    command.start(owner, {
      ...agenticRequest,
      selection: { ...selection, mode: 'agentic' },
    }),
    okStatus(503, /agentic_transport_unavailable/),
  );
  await assert.rejects(
    command.statusByRequest(owner, agenticRequest.request_key),
    okStatus(404, /generation_not_found/),
  );
  assert.equal(calls, 0);
  const request = input(ownerProfile);
  const [first, replayed] = await Promise.all([
    command.start(owner, request),
    command.start(owner, request),
  ]);
  assert.equal(first.id, replayed.id);
  await assert.rejects(
    command.start(owner, { ...request, offer_text: 'different' }),
    okStatus(409, /request_key_conflict/),
  );
  await assert.rejects(
    command.status(outsider, first.id),
    okStatus(404, /generation_not_found/),
  );
  assert.equal('recovery' in first, false);
  assert.equal('recovery' in replayed, false);
  assert.deepEqual(await command.statusByRequest(owner, request.request_key), {
    ...first,
    recovery: {
      offer_text: request.offer_text,
      profile: JSON.parse(JSON.stringify(ownerProfile)),
    },
  });
  const competed = await Promise.all([run(), run()]);
  assert.equal(competed.filter(Boolean).length, 1);
  assert.equal(calls, 1);
  const ready = await command.status(owner, first.id);
  assert.deepEqual(ready.review, {
    revision: 1,
    included_fact_ids: ready.draft.selectedFacts.map(({ id }) => id),
    evidence: [],
  });
  assert.deepEqual(
    ready.draft.requirements.map((r) => r.coverage),
    ['supported', 'gap'],
  );
  const [closed] = await db.query(
    'SELECT owner_kind,started_exchanges,reserved_exchanges,phase,remote_outcome,(acknowledged_at IS NOT NULL) AS ack FROM ai_generation_operations WHERE id=$1',
    [first.id],
  );
  assert.deepEqual(closed, {
    owner_kind: 'cv',
    started_exchanges: 1,
    reserved_exchanges: 1,
    phase: 'closed',
    remote_outcome: 'completed',
    ack: true,
  });
  assert.equal((await command.eligibility(owner, selection)).qualified, false);
  const canary = await command.startProbe(admin, input(adminProfile));
  assert.equal(canary.state, 'queued');
  assert.equal(await run(), true);
  assert.equal(calls, 2);
  assert.equal((await command.status(admin, canary.id)).state, 'ready');
  assert.equal((await command.eligibility(owner, selection)).qualified, true);

  behavior = 'bad';
  const bad = await command.start(owner, input(ownerProfile));
  await run();
  assert.equal(
    (await command.status(owner, bad.id)).error_code,
    'generation_invalid_output',
  );
  behavior = 'lost';
  const lost = await command.start(owner, input(ownerProfile));
  await run();
  const unknown = await command.status(owner, lost.id);
  assert.equal(unknown.state, 'unknown');
  assert.equal(unknown.draft, null);
  await registry.recover();
  assert.equal(await run(), false);
  assert.equal(calls, 4);

  const revoke = await command.start(owner, input(ownerProfile));
  await db.query(
    'UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2',
    [owner.userId, module.id],
  );
  await run();
  assert.equal(calls, 4);
  const [denied] = await db.query(
    'SELECT state,error_code FROM nodia_cv_generations WHERE id=$1',
    [revoke.id],
  );
  assert.deepEqual(denied, {
    state: 'failed',
    error_code: 'authority_changed',
  });
  await assert.rejects(command.status(owner, first.id), { status: 403 });
  await db.query(
    'UPDATE user_modules SET is_active=true WHERE user_id=$1 AND module_id=$2',
    [owner.userId, module.id],
  );
  const changed = await command.start(owner, input(ownerProfile));
  await db.query(
    'UPDATE ai_api_keys SET is_selected=false WHERE provider_id=$1',
    [selection.connection_id],
  );
  await run();
  assert.equal(calls, 4);
  const configFailure = await command.status(owner, changed.id);
  assert.equal(configFailure.state, 'failed');
  assert.equal(configFailure.error_code, 'configuration_unavailable');
  await command.updateDraft(owner, first.id, {
    revision: 1,
    included_fact_ids: ready.review.included_fact_ids,
    evidence: [
      {
        requirement_id: 'r2',
        source: 'Reviewed',
        detail: 'Synthetic evidence',
      },
    ],
  });
  assert.equal(calls, 4);
  await db.query(
    "UPDATE nodia_cv_generations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [first.id],
  );
  await assert.rejects(
    command.updateDraft(owner, first.id, {
      revision: 2,
      included_fact_ids: [],
      evidence: [],
    }),
    okStatus(410, /generation_expired/),
  );
  await registry.recover();
  await assert.rejects(
    command.statusByRequest(owner, request.request_key),
    okStatus(410, /generation_expired/),
  );
  const [purged] = await db.query(
    `SELECT profile_snapshot,offer_text,draft,request_hash,review,review_revision,review_updated_by_actor_id
     FROM nodia_cv_generations WHERE id=$1`,
    [first.id],
  );
  assert.deepEqual(purged, {
    profile_snapshot: null,
    offer_text: null,
    draft: null,
    request_hash: null,
    review: null,
    review_revision: null,
    review_updated_by_actor_id: null,
  });
  await people.delete(owner, ownerProfile.id, ownerProfile.revision);
  console.log(
    'CV generation: isolated SQL, ordinary first use, scoped probe receipts, one dispatch, drafts, recovery, revocation and purge passed.',
  );
} finally {
  if (db.isInitialized) await db.destroy();
}
