import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const [action, release, profileName, connectionId, modelId, effortId, requestKey] =
  process.argv.slice(2);
const releasePath = join('/opt/nodia/releases', release ?? '');
const report = { release, action, status: 'failed' };
const check = (condition, code) => {
  if (!condition) throw new Error(code);
};
const safeCode = (value) =>
  typeof value === 'string' && /^(?:(?:nodiaCv|nodia_ai|auth):)?[a-z][a-z0-9_]{2,80}$/.test(value)
    ? value : 'cv_operator_failed';

async function compose() {
  const require = createRequire(join(releasePath, 'package.json'));
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const load = (file) => import(pathToFileURL(join(releasePath, 'dist', file + '.js')).href);
  const { AssertNodiaAiOperationModeUseCase } =
    await load('nodia-ai-runtime/use-case/assert-nodia-ai-operation-mode.use-case');
  new AssertNodiaAiOperationModeUseCase().execute(process.env);
  const { postgresConfig } = await load('config/db.config');
  const { NodiaCvProfileEntity } = await load('nodia-cv/entities/nodia-cv-profile.entity');
  const { readNodiaCvProfile } = await load('nodia-cv/policies/nodia-cv-profile');
  const { CV_PROBE_CANDIDATE, CV_PROBE_OFFER, validCvProbeDraft } =
    await load('nodia-cv/policies/nodia-cv-generation');
  const { CheckModuleAccessUseCase } = await load('authorization/use-case/check-module-access.use-case');
  const { CodexRuntimeService } = await load('common/ai/codex/codex-runtime.service');
  const { CodexChatRuntime } = await load('common/ai/codex/codex-chat-runtime');
  const { ApiNodiaAiCredentialsService } = await load('nodia-ai-adapter/api-nodia-ai-credentials.service');
  const { NodiaAiAdapterTransport } = await load('nodia-ai-adapter/nodia-ai-adapter.service');
  const { NodiaAiConnectionsService } = await load('nodia-ai-conversation/nodia-ai-connections.service');
  const { projectNodiaAiConnection } = await load('nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case');
  const { ValidateNodiaAiRuntimePolicyUseCase } = await load('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case');
  const { NodiaCvCodexSelection } = await load('nodia-cv/agentic/nodia-cv-codex-selection');
  const { NodiaCvCodexTransport } = await load('nodia-cv/agentic/nodia-cv-codex-transport');
  const { NodiaCvGeminiTransport } = await load('nodia-cv/agentic/nodia-cv-gemini-transport');
  const { NodiaCvGenerationScope } = await load('nodia-cv/nodia-cv-generation-scope.service');
  const { NodiaCvGenerationStore } = await load('nodia-cv/nodia-cv-generation.store');
  const { NodiaCvProfilesService } = await load('nodia-cv/nodia-cv-profiles.service');
  const { NodiaCvSelectionService } = await load('nodia-cv/nodia-cv-selection.service');
  const { NodiaCvGenerationsUseCase } = await load('nodia-cv/use-case/nodia-cv-generations.use-case');
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(JSON.parse(await readFile(
    join(releasePath, 'dist/nodia-ai-runtime/config/runtime-policy.json'), 'utf8',
  )));
  const db = new DataSource({
    ...postgresConfig,
    entities: [NodiaCvProfileEntity],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: {
      max: 2,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 5_000,
      lock_timeout: 2_000,
    },
  });
  const runtime = new CodexRuntimeService();
  const chat = new CodexChatRuntime(runtime);
  const connections = new NodiaAiConnectionsService(db);
  const codexSelection = new NodiaCvCodexSelection(connections, chat);
  const codex = new NodiaCvCodexTransport(codexSelection, runtime, chat.journal);
  const gemini = new NodiaCvGeminiTransport(new NodiaAiAdapterTransport());
  const selections = new NodiaCvSelectionService(
    new ApiNodiaAiCredentialsService(db), connections, policy, codex, codexSelection, gemini,
  );
  const scope = new NodiaCvGenerationScope(db, new CheckModuleAccessUseCase(db));
  const profiles = new NodiaCvProfilesService();
  const store = new NodiaCvGenerationStore();
  const agenticOnly = { measure() { throw new Error('cv_probe_agentic_required'); } };
  return {
    db, runtime, scope, connections, projectNodiaAiConnection,
    cv: new NodiaCvGenerationsUseCase(scope, store, profiles, selections, agenticOnly, policy),
    CV_PROBE_OFFER, CV_PROBE_CANDIDATE, readNodiaCvProfile, validCvProbeDraft,
  };
}

async function getProbeOwner(parts) {
  return parts.scope.transaction(async (manager) => {
    const rows = await manager.query(
      `SELECT p.id,p.revision,p.owner_user_id,p.data,p.professional_title
       FROM nodia_cv_profiles p WHERE p.profile_name=$1 AND p.full_name=$2 LIMIT 2`,
      [profileName, parts.CV_PROBE_CANDIDATE],
    );
    check(rows.length === 1, 'unique_cv_probe_profile_required');
    const profile = rows[0];
    const expected = parts.readNodiaCvProfile({
      profile_name: profileName,
      full_name: parts.CV_PROBE_CANDIDATE,
      professional_title: 'Software Developer',
      main_stack: ['TypeScript'],
    }).profile;
    check(profile.professional_title === expected.professional_title
      && isDeepStrictEqual(profile.data, expected.data), 'cv_probe_profile_must_be_synthetic');
    // The named synthetic profile binds the operator action to its owner.
    // Use that owner's newest live session, then recheck normal CV authority.
    const [session] = await manager.query(
      `SELECT public_id::text FROM auth_sessions
       WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp()
       ORDER BY created_at DESC,id DESC LIMIT 1`,
      [profile.owner_user_id],
    );
    check(session, 'active_cv_probe_owner_session_required');
    const actor = { userId: profile.owner_user_id, sessionId: session.public_id };
    const current = await parts.scope.authorize(manager, actor);
    check(current.isSuperAdmin, 'cv_probe_owner_must_be_super_admin');
    return { actor, profile };
  });
}

async function listConnections(parts) {
  const rows = await parts.connections.list(parts.db.manager, null, 100);
  check(rows.length <= 100, 'cv_probe_connection_limit_exceeded');
  return rows.filter((row) => ['openai', 'gemini'].includes(row.provider_key))
    .map((row) => {
      const connection = parts.projectNodiaAiConnection(row);
      const mode = connection.modes.find((item) => item.mode === 'agentic');
      return {
        connection_id: connection.connection_id,
        provider: connection.provider_key,
        configuration: mode.configuration,
        configured_selection: mode.configured_selection,
        models: mode.models.map(({ model_id, efforts }) => ({
          model_id, efforts: efforts.map(({ effort_id }) => effort_id),
        })),
      };
    });
}

async function verify(parts, actor, selection) {
  const [proof] = await parts.db.query(
    `SELECT g.id::text,g.state,g.error_code,g.selection_snapshot,o.phase,o.remote_outcome,
       o.started_exchanges,o.terminal_proof->>'process_closed'='true' AS process_closed,
       o.acknowledged_at IS NOT NULL AS acknowledged,q.scope_hash IS NOT NULL AS qualified,
       CASE WHEN g.state='queued' THEN jsonb_build_object(
         'queue_remaining_seconds', greatest(0, extract(epoch FROM g.queue_expires_at-clock_timestamp())::int),
         'slot_state', (SELECT s.state FROM nodia_ai_runtime_slots s WHERE s.resource_key=g.resource_key),
         'owner_pending', (SELECT count(*)::int FROM ai_generation_operations pending
           WHERE pending.actor_id=g.owner_user_id AND pending.owner_kind IN ('flashcard_library','cv')
             AND pending.acknowledged_at IS NULL),
         'teacher_pending', (SELECT count(*)::int FROM teacher_generation_jobs j
           WHERE j.actor_id=g.owner_user_id AND j.state IN ('running','unknown') AND j.blocks_duplicate),
         'chat_pending', (SELECT count(*)::int FROM nodia_ai_jobs j JOIN nodia_ai_conversations c ON c.id=j.conversation_id
           WHERE c.owner_id=g.owner_user_id AND j.state IN ('leased','unknown')),
         'global_held', ((SELECT count(*) FROM nodia_ai_jobs WHERE state='leased')
           +(SELECT count(*) FROM teacher_generation_jobs WHERE state='running')
           +(SELECT count(*) FROM nodia_ai_runtime_slots s JOIN ai_generation_operations held
             ON held.id=s.generation_operation_id WHERE s.state='held' AND held.owner_kind IN ('flashcard_library','cv')))
       ) END AS queue
       FROM nodia_cv_generations g
       LEFT JOIN ai_generation_operations o ON o.cv_generation_id=g.id AND o.actor_id=g.owner_user_id AND o.owner_kind='cv'
       LEFT JOIN nodia_cv_generation_qualifications q ON q.generation_id=g.id AND q.scope_hash=g.scope_hash
         AND q.response_hash=o.response_hash
       WHERE g.owner_user_id=$1 AND g.request_key=$2 AND g.qualification`,
    [actor.userId, requestKey],
  );
  check(proof, 'cv_probe_request_not_found');
  check(isDeepStrictEqual(proof.selection_snapshot, selection), 'cv_probe_selection_mismatch');
  const { selection_snapshot: _selection, ...summary } = proof;
  report.generation = summary;
  if (proof.state !== 'ready' || proof.phase !== 'closed' ||
      proof.remote_outcome !== 'completed' || Number(proof.started_exchanges) !== 1 ||
      !proof.process_closed || !proof.acknowledged || !proof.qualified)
    return 'awaiting_or_unqualified';
  const generation = await parts.cv.status(actor, proof.id);
  check(generation.draft && parts.validCvProbeDraft(generation.draft), 'cv_probe_draft_evidence_invalid');
  report.evidence_verified = true;
  const eligibility = await parts.cv.eligibility(actor, selection);
  report.eligibility = eligibility;
  return eligibility.eligible ? 'qualified' : 'awaiting_or_unqualified';
}

let parts;
try {
  check(process.platform === 'linux' && process.getuid() !== 0
    && process.env.NODE_ENV === 'production' && process.env.PGSSLMODE === 'verify-full'
    && await realpath('/opt/nodia/current') === releasePath && process.cwd() === releasePath,
  'cv_probe_release_context_invalid');
  parts = await compose();
  await parts.db.initialize();
  const { actor, profile } = await getProbeOwner(parts);
  if (action === 'catalog') {
    report.connections = await listConnections(parts);
    report.status = 'inspected';
  } else {
    const selection = { connection_id: connectionId, mode: 'agentic', model_id: modelId, effort_id: effortId };
    report.selection = selection;
    if (action === 'check') {
      report.eligibility = await parts.cv.eligibility(actor, selection);
      report.status = 'inspected';
    } else if (action === 'admit') {
      const generation = await parts.cv.startProbe(actor, {
        request_key: requestKey,
        profile_id: profile.id,
        profile_revision: profile.revision,
        language: 'en',
        offer_text: parts.CV_PROBE_OFFER,
        selection,
      });
      report.generation = { id: generation.id, state: generation.state, error_code: generation.error_code };
      report.status = 'admitted';
    } else if (action === 'verify') {
      report.status = await verify(parts, actor, selection);
    } else {
      throw new Error('cv_probe_action_invalid');
    }
  }
} catch (error) {
  report.error_code = safeCode(error?.message);
} finally {
  try {
    await parts?.runtime.onModuleDestroy();
  } catch {
    report.cleanup_error = 'cv_probe_runtime_cleanup_failed';
  } finally {
    if (parts?.db.isInitialized)
      await parts.db.destroy().catch(() => { report.cleanup_error = 'cv_probe_database_cleanup_failed'; });
  }
  process.stdout.write(JSON.stringify(report) + '\n');
  process.exitCode = report.status === 'failed' || report.cleanup_error ? 1 : 0;
}
