import { createHash, randomUUID } from 'node:crypto';
import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from '../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import {
  ApiNodiaAiCredentialsService,
  type NodiaAiApiConfiguration,
} from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import {
  API_EXECUTOR_OWNER,
  isApiExecutorProvenClosed,
  type ApiExecutorOwner,
} from '../nodia-ai-adapter/api-nodia-ai-runtime-owner.js';
import { NodiaAiConnectionsService } from '../nodia-ai-conversation/nodia-ai-connections.service.js';
import { projectNodiaAiConnection } from '../nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.js';
import { lockNodiaAiQueue } from '../nodia-ai-runtime/queue-lock.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../nodia-ai-runtime/config/runtime-policy.js';
import type {
  TeacherGenerationJob,
  TeacherGenerationPort,
  TeacherPurpose,
  TeacherSelection,
} from '../teacher/types/teacher.types.js';
import {
  AiGenerationPort,
  type AiGenerationResult,
} from './ai-generation-port.js';
import { GenerationWorkerSourceRegistry } from './worker-source-registry.js';
import { promptSnapshot } from '../teacher/policies/teacher-prompts.js';
import { teacherGenerationDeadline } from '../teacher/policies/teacher-generation-deadline.js';
import { reportTeacherPublicationFailure } from '../teacher/policies/teacher-publication-diagnostic.js';
import { TeacherAgenticTextService, validateTeacherAgenticDescriptor, teacherAgenticScope } from './teacher-agentic-text.service.js';
import { TeacherAgenticClosedError, TeacherAgenticUnclosedError, parseTeacherAgenticProof, type TeacherAgenticConfiguration, type TeacherAgenticDescriptor, type TeacherAgenticObservation, type TeacherAgenticProof } from './agentic-text-contract.js';

import { currentTeacherQualificationProbe, teacherApiQualificationScope as scope, teacherPurposeRequiresQualification, teacherPurposeQualificationScope, TEACHER_GENERATION_POLICY_HASH, TEACHER_GENERATION_POLICY } from './teacher-qualification-policy.js';

import { assertContextualQualificationJob, contextualQualificationReplyMatches } from './teacher-contextual-qualification-policy.js';
import { enrichmentRecord, readAnchor, rejectFinalHelp } from '../teacher/use-case/teacher-enrichment-persistence.js';

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
const hash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
type Job = TeacherGenerationJob & {
  session_owner_user_id: string;
  configuration_generation: string;
  session_generation: string;
  lease_owner: string;
  lease_until: Date;
};
type Claim = {
  job: Job;
  operationId: string;
  runtimeFence: string;
  config: NodiaAiApiConfiguration | TeacherAgenticConfiguration;
  requestHash: string;
};
type Publisher = (
  manager: EntityManager,
  job: TeacherGenerationJob,
  output: string,
) => Promise<Record<string, unknown>>;
type PredispatchClosure = {
  state: 'cancelled_before_dispatch' | 'failed_known';
  error: string;
};
type AgenticClosure = {
  descriptor: TeacherAgenticDescriptor | null;
  proof: TeacherAgenticProof | null;
  notStarted: boolean;
  error: string | null;
};
function safeFailureCode(error: unknown): string {
  const response = error instanceof HttpException ? error.getResponse() : null;
  const candidate =
    typeof response === 'string'
      ? response
      : response && typeof response === 'object' && 'message' in response
        ? response.message
        : error instanceof Error
          ? error.message
          : null;
  if (
    typeof candidate === 'string' &&
    /^(?:teacher|auth|core):[a-z0-9_]{1,100}$/.test(candidate)
  ) {
    if (
      candidate === 'auth:session_expired' ||
      candidate === 'core:module_access_required'
    )
      return 'authority_changed';
    return candidate.split(':')[1];
  }
  return 'provider_unavailable';
}
function assert(value: unknown, code = 'lease_lost'): asserts value {
  if (!value) throw Error('teacher:' + code);
}

/** Teacher's durable owner store over the SAME slots and admission barrier as chat. */
@Injectable()
export class TeacherGenerationRuntimeService
  implements TeacherGenerationPort, OnModuleInit
{
  private readonly logger = new Logger(TeacherGenerationRuntimeService.name);
  private publisher: Publisher | null = null;
  private readonly closedLocally = new Map<
    string,
    {
      claim: Claim;
      result: AiGenerationResult | null;
      predispatch: PredispatchClosure | null;
      native?: AgenticClosure;
    }
  >();
  private readonly qualificationJobs = new Set<string>();
  private readonly qualificationAgentic = new Map<string, TeacherAgenticObservation>();
  constructor(
    private readonly source: DataSource,
    private readonly access: CheckModuleAccessUseCase,
    private readonly credentials: ApiNodiaAiCredentialsService,
    private readonly connectionsReader: NodiaAiConnectionsService,
    private readonly registry: GenerationWorkerSourceRegistry,
    private readonly transport: AiGenerationPort,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Optional() private readonly agentic?: TeacherAgenticTextService,
  ) {}
  onModuleInit() {
    this.registry.register(this);
  }
  setPublisher(publisher: Publisher) {
    if (this.publisher) throw Error('teacher_publisher_duplicate');
    this.publisher = publisher;
  }
  private configuration(selection: TeacherSelection, manager = this.source.manager, override?: TeacherAgenticObservation) {
    if (selection.mode === 'api_key') return this.credentials.configuration(selection, manager);
    if (!this.agentic) throw new ServiceUnavailableException('teacher:adapter_unqualified');
    return this.agentic.configuration(selection, manager, override);
  }
  private async authority(manager: EntityManager, actor: ActorReference) {
    const identity = await currentActor(manager, actor);
    await this.access.execute(identity.actorId, ['/nodia-teacher'], manager);
    return identity;
  }
  async connections(actor: ActorReference) {
    return this.source.transaction(async (manager) => {
      await lockAuthority(manager);
      await this.authority(manager, actor);
      const rows = await this.connectionsReader.list(manager, null, 200);
      if (rows.length > 200)
        throw new ServiceUnavailableException(
          'teacher:connection_catalog_too_large',
        );
      return { items: rows.map(projectNodiaAiConnection), next_cursor: null };
    });
  }
  async eligibility(
    actor: ActorReference,
    connectionId: string,
    input: Omit<TeacherSelection, 'connection_id'>,
  ) {
    const exactSelection = { ...input, connection_id: connectionId };
    if (exactSelection.mode === 'agentic' && this.agentic) {
      await this.source.transaction(async manager => { await lockAuthority(manager); await this.authority(manager, actor); });
      // Native observation runs outside the authority transaction; execution revalidates it.
      return this.agentic.eligibility(exactSelection, AbortSignal.timeout(30000));
    }
    return this.source.transaction(async (manager) => {
      await lockAuthority(manager);
      await this.authority(manager, actor);
      const selection = exactSelection;
      if (selection.mode !== 'api_key')
        return {
          eligible: false,
          reason_code: 'adapter_unqualified',
          checked_at: null,
          selection,
        };
      try {
        const config = await this.configuration(selection, manager);
        const qualified = await manager.query(
          'SELECT observed_at FROM ai_generation_qualifications WHERE scope_hash=$1',
          [scope(selection, config)],
        );
        return {
          eligible: qualified.length === 1,
          reason_code: qualified.length === 1 ? null : 'adapter_unqualified',
          checked_at: qualified[0]?.observed_at ?? null,
          selection,
        };
      } catch {
        return {
          eligible: false,
          reason_code: 'provider_unavailable',
          checked_at: null,
          selection,
        };
      }
    });
  }
  async verifySelection(
    manager: EntityManager,
    actor: ActorReference,
    selection: TeacherSelection,
    purpose?: TeacherPurpose,
  ) {
    await this.authority(manager, actor);
    if (selection.mode === 'agentic' && this.agentic) {
      const native = await this.configuration(selection, manager);
      await this.verifyPurpose(manager, selection, native, purpose);
      return { configuration_generation: native.configurationGeneration, session_generation: native.sessionGeneration };
    }
    if (selection.mode !== 'api_key')
      throw new ServiceUnavailableException('teacher:adapter_unqualified');
    let config: NodiaAiApiConfiguration | TeacherAgenticConfiguration;
    try {
      config = await this.configuration(selection, manager);
    } catch {
      throw new ServiceUnavailableException('teacher:provider_unavailable');
    }
    const rows = await manager.query(
      'SELECT scope_hash FROM ai_generation_qualifications WHERE scope_hash=$1',
      [scope(selection, config)],
    );
    if (rows.length !== 1)
      throw new ServiceUnavailableException('teacher:adapter_unqualified');
    await this.verifyPurpose(manager, selection, config, purpose);
    return {
      configuration_generation: config.configurationGeneration,
      session_generation: config.sessionGeneration,
    };
  }
  private transportScope(selection: TeacherSelection, config: NodiaAiApiConfiguration | TeacherAgenticConfiguration) {
    return selection.mode === 'api_key' ? scope(selection, config)
      : teacherAgenticScope(selection, config as TeacherAgenticConfiguration);
  }
  private async verifyPurpose(manager: EntityManager, selection: TeacherSelection,
    config: NodiaAiApiConfiguration | TeacherAgenticConfiguration, purpose?: TeacherPurpose) {
    if (!teacherPurposeRequiresQualification(purpose)) return;
    const rows = await manager.query(`SELECT scope_hash FROM teacher_purpose_qualifications
      WHERE scope_hash=$1 AND policy_hash=$2 AND purpose='contextual_reply'
      AND selection_snapshot=$3::jsonb AND configuration_generation=$4
      AND session_generation IS NOT DISTINCT FROM $5`,
    [teacherPurposeQualificationScope(this.transportScope(selection, config)), TEACHER_GENERATION_POLICY_HASH,
      JSON.stringify(selection), config.configurationGeneration, config.sessionGeneration]);
    if (rows.length !== 1) throw new ServiceUnavailableException('teacher:adapter_unqualified');
  }
  private async claim(
    workerId: string,
    onlyJobId: string | null = null,
  ): Promise<Claim | null> {
    return this.source.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const rows: Job[] = await manager.query(
        `SELECT j.*,s.owner_user_id::text AS session_owner_user_id FROM teacher_generation_jobs j JOIN teacher_sessions s ON s.id=j.session_id
        WHERE j.state='queued' AND j.available_at<=clock_timestamp() AND j.deadline_at>clock_timestamp()
        AND j.created_at>clock_timestamp()-interval '300 seconds'
        AND ($2::uuid IS NULL OR j.id=$2)
        AND s.state NOT IN ('paused','archived')
        AND NOT EXISTS(SELECT 1 FROM teacher_generation_jobs active WHERE active.session_id=j.session_id AND active.state IN ('running','unknown') AND active.blocks_duplicate=true)
        AND NOT EXISTS(SELECT 1 FROM teacher_generation_jobs active WHERE active.actor_id=j.actor_id AND active.state IN ('running','unknown') AND active.blocks_duplicate=true)
        AND NOT EXISTS(SELECT 1 FROM nodia_ai_jobs cj JOIN nodia_ai_conversations c ON c.id=cj.conversation_id WHERE c.owner_id=j.actor_id AND cj.state IN ('leased','unknown'))
        AND ((SELECT count(*) FROM nodia_ai_jobs WHERE kind IN ('turn','execution') AND state='leased')+(SELECT count(*) FROM teacher_generation_jobs WHERE state='running'))<$1
        ORDER BY j.available_at,j.id FOR UPDATE OF s,j SKIP LOCKED LIMIT 1`,
        [this.policy.queue.foreground_workers, onlyJobId],
      );
      const job = rows[0];
      if (!job) return null;
      const actor = {
        userId: job.actor_id,
        sessionId: job.auth_session_public_id ?? '',
      };
      let config: NodiaAiApiConfiguration | TeacherAgenticConfiguration;
      try {
        const current = await this.authority(manager, actor);
        assert(
          job.session_owner_user_id === current.actorId || current.isSuperAdmin,
          'authority_changed',
        );
        if (job.purpose === 'contextual_reply') await rejectFinalHelp(manager, job.session_id);
        if (!this.qualificationJobs.has(job.id))
          await this.verifySelection(manager, actor, job.selection_snapshot, job.purpose);
        config = await this.configuration(
          job.selection_snapshot,
          manager,
          this.qualificationAgentic.get(job.id),
        );
        assert(
          config.configurationGeneration === job.configuration_generation &&
            config.sessionGeneration === job.session_generation,
          'configuration_changed',
        );
      } catch (error) {
        await manager.query(
          "UPDATE teacher_generation_jobs SET state='failed_known',blocks_duplicate=false,error_code=$2,updated_at=clock_timestamp() WHERE id=$1",
          [job.id, safeFailureCode(error)],
        );
        return null;
      }
      await manager.query(
        "INSERT INTO nodia_ai_runtime_slots(resource_key,state,fence) VALUES($1,'free',0) ON CONFLICT DO NOTHING",
        [config.resourceKey],
      );
      const slots = await manager.query(
        'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1 FOR UPDATE',
        [config.resourceKey],
      );
      if (slots[0]?.state !== 'free') return null;
      if (job.selection_snapshot.mode === 'agentic') {
        const pendingAck = await manager.query('SELECT id FROM ai_generation_operations WHERE resource_key=$1 AND agentic_transport_descriptor IS NOT NULL AND agentic_acknowledged_at IS NULL AND acknowledged_at IS NOT NULL LIMIT 1', [config.resourceKey]);
        if (pendingAck.length) return null;
      }
      const operationId = randomUUID();
      const fence = (BigInt(job.fence) + 1n).toString();
      const runtimeFence = (BigInt(slots[0].fence) + 1n).toString();
      const requestHash = hash({
        operationId,
        selection: job.selection_snapshot,
        prompt: hash(job.prompt_snapshot),
        configuration: config.configurationGeneration,
        deadline: job.deadline_at,
      });
      await manager.query(
        `UPDATE teacher_generation_jobs SET state='running',fence=$2,lease_owner=$3,lease_until=LEAST(clock_timestamp()+interval '30 seconds',deadline_at),updated_at=clock_timestamp() WHERE id=$1`,
        [job.id, fence, workerId],
      );
      await manager.query(
        `INSERT INTO teacher_generation_attempts(id,session_id,job_id,attempt_no,worker_id,fence,phase)
        SELECT $1,$2,$3,coalesce(max(attempt_no),0)+1,$4,$5,'claimed' FROM teacher_generation_attempts WHERE job_id=$3`,
        [operationId, job.session_id, job.id, workerId, fence],
      );
      await manager.query(
        `INSERT INTO ai_generation_operations(id,owner_kind,teacher_attempt_id,teacher_job_id,teacher_session_id,actor_id,auth_session_public_id,connection_id,selected_key_id,selection_snapshot,configuration_generation,session_generation,resource_key,worker_id,owner_fence,runtime_fence,phase,request_hash,exchange_limit)
        VALUES($1,'teacher',$1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,'reserved',$15,1)`,
        [
          operationId,
          job.id,
          job.session_id,
          job.actor_id,
          job.auth_session_public_id,
          config.connectionId,
          config.keyId,
          JSON.stringify(job.selection_snapshot),
          config.configurationGeneration,
          config.sessionGeneration,
          config.resourceKey,
          workerId,
          fence,
          runtimeFence,
          requestHash,
        ],
      );
      await manager.query(
        `UPDATE nodia_ai_runtime_slots SET state='held',generation_operation_id=$2::uuid,conversation_id=NULL,job_id=NULL,holder_worker_id=$3,fence=$4,lease_until=LEAST(clock_timestamp()+interval '30 seconds',$5::timestamptz),external_operation_ref=($2::uuid)::text,updated_at=clock_timestamp() WHERE resource_key=$1`,
        [
          config.resourceKey,
          operationId,
          workerId,
          runtimeFence,
          job.deadline_at,
        ],
      );
      return {
        job: { ...job, fence, lease_owner: workerId },
        operationId,
        runtimeFence,
        config,
        requestHash,
      };
    });
  }
  private async owned(
    manager: EntityManager,
    claim: Claim,
    allowPaused = false,
  ) {
    await lockAuthority(manager);
    await lockNodiaAiQueue(manager);
    const current = await this.authority(manager, {
      userId: claim.job.actor_id,
      sessionId: claim.job.auth_session_public_id ?? '',
    });
    const sessions = await manager.query(
      'SELECT state,owner_user_id::text AS owner_user_id FROM teacher_sessions WHERE id=$1 FOR UPDATE',
      [claim.job.session_id],
    );
    assert(
      sessions.length === 1 &&
        (sessions[0].owner_user_id === current.actorId || current.isSuperAdmin),
      'authority_changed',
    );
    assert(
      sessions.length === 1 &&
        sessions[0].state !== 'archived' &&
        (allowPaused || sessions[0].state !== 'paused'),
      'session_paused',
    );
    const currentConfiguration = await this.configuration(claim.job.selection_snapshot, manager,
      this.qualificationAgentic.get(claim.job.id));
    assert(currentConfiguration.configurationGeneration === claim.config.configurationGeneration &&
      currentConfiguration.sessionGeneration === claim.config.sessionGeneration &&
      currentConfiguration.resourceKey === claim.config.resourceKey, 'configuration_changed');
    const rows = await manager.query(
      `SELECT j.*,o.phase AS operation_phase,o.started_exchanges,o.reserved_exchanges FROM teacher_generation_jobs j
      JOIN ai_generation_operations o ON o.teacher_job_id=j.id AND o.id=$2
      JOIN nodia_ai_runtime_slots s ON s.generation_operation_id=o.id AND s.resource_key=o.resource_key
      WHERE j.id=$1 AND j.state='running' AND j.fence=$3 AND j.lease_owner=$4 AND j.lease_until>clock_timestamp()
      AND s.state='held' AND s.fence=$5 AND s.holder_worker_id=$4 AND s.lease_until>clock_timestamp()
      AND o.owner_fence=$3 AND o.runtime_fence=$5 AND o.request_hash=$6
      FOR UPDATE OF j,o,s`,
      [
        claim.job.id,
        claim.operationId,
        claim.job.fence,
        claim.job.lease_owner,
        claim.runtimeFence,
        claim.requestHash,
      ],
    );
    assert(rows.length === 1);
    return rows[0];
  }
  private async arm(claim: Claim) {
    await this.source.transaction(async (manager) => {
      const row = await this.owned(manager, claim);
      assert(row.operation_phase === 'reserved' && row.dispatches_used === 0);
      const config = await this.configuration(
        claim.job.selection_snapshot,
        manager,
        this.qualificationAgentic.get(claim.job.id),
      );
      assert(
        config.configurationGeneration === claim.config.configurationGeneration,
        'configuration_changed',
      );
      const charged = await manager.query(
        `WITH charged AS (UPDATE teacher_sessions SET dispatches_used=dispatches_used+1 WHERE id=$1 AND dispatches_used<dispatch_limit RETURNING id) SELECT id FROM charged`,
        [claim.job.session_id],
      );
      assert(charged.length === 1, 'budget_exhausted');
      await manager.query(
        'UPDATE teacher_generation_jobs SET dispatches_used=1 WHERE id=$1',
        [claim.job.id],
      );
      await manager.query(
        "UPDATE teacher_generation_attempts SET phase='dispatch_armed' WHERE id=$1",
        [claim.operationId],
      );
      await manager.query(
        "UPDATE ai_generation_operations SET phase='dispatch_armed',reserved_exchanges=1,api_owner_identity=$2::jsonb,updated_at=clock_timestamp() WHERE id=$1",
        [claim.operationId, claim.job.selection_snapshot.mode === 'api_key' ? JSON.stringify(API_EXECUTOR_OWNER) : null],
      );
    });
  }
  private async beforeExchange(claim: Claim) {
    await this.source.transaction(async (manager) => {
      const row = await this.owned(manager, claim);
      assert(
        row.operation_phase === 'dispatch_armed' &&
          row.reserved_exchanges === 1 &&
          row.started_exchanges === 0,
        'dispatch_already_started',
      );
      const config = await this.configuration(
        claim.job.selection_snapshot,
        manager,
        this.qualificationAgentic.get(claim.job.id),
      );
      assert(
        config.configurationGeneration === claim.config.configurationGeneration,
        'configuration_changed',
      );
      await manager.query(
        "UPDATE ai_generation_operations SET started_exchanges=1,phase='transport_open',updated_at=clock_timestamp() WHERE id=$1",
        [claim.operationId],
      );
      await manager.query(
        "UPDATE teacher_generation_attempts SET phase='transport_open' WHERE id=$1",
        [claim.operationId],
      );
    });
  }
  private async heartbeat(claim: Claim) {
    await this.source.transaction(async (manager) => {
      await this.owned(manager, claim, true);
      await manager.query(
        "UPDATE teacher_generation_jobs SET lease_until=LEAST(clock_timestamp()+interval '30 seconds',deadline_at) WHERE id=$1",
        [claim.job.id],
      );
      await manager.query(
        "UPDATE nodia_ai_runtime_slots SET lease_until=LEAST(clock_timestamp()+interval '30 seconds',$2::timestamptz) WHERE generation_operation_id=$1",
        [claim.operationId, claim.job.deadline_at],
      );
    });
  }
  private assertDescriptor(claim: Claim, descriptor: TeacherAgenticDescriptor) {
    validateTeacherAgenticDescriptor(descriptor);
    const r = descriptor.reference, s = claim.job.selection_snapshot;
    assert(r.operation_id === claim.operationId && r.attempt_id === claim.operationId &&
      r.session_id === claim.job.session_id && r.job_id === claim.job.id && r.actor_id === claim.job.actor_id &&
      r.connection_id === s.connection_id && r.model_id === s.model_id && r.effort_id === s.effort_id &&
      r.resource_key === claim.config.resourceKey && r.configuration_generation === claim.config.configurationGeneration &&
      r.session_generation === claim.config.sessionGeneration && descriptor.provider === claim.config.providerKey,
    'agentic_owner_mismatch');
  }
  private async persistAgenticDescriptor(claim: Claim, descriptor: TeacherAgenticDescriptor) {
    this.assertDescriptor(claim, descriptor);
    assert(claim.job.selection_snapshot.mode === 'agentic');
    await this.source.transaction(async manager => {
      const row = await this.owned(manager, claim);
      assert(row.operation_phase === 'dispatch_armed' && row.started_exchanges === 0);
      const updated = await manager.query(`WITH changed AS (UPDATE ai_generation_operations
        SET agentic_transport_descriptor=$2::jsonb,updated_at=clock_timestamp()
        WHERE id=$1 AND (agentic_transport_descriptor IS NULL OR agentic_transport_descriptor=$2::jsonb)
        RETURNING id) SELECT id FROM changed`, [claim.operationId, JSON.stringify(descriptor)]);
      assert(updated.length === 1, 'agentic_owner_mismatch');
    });
  }
  private async close(
    claim: Claim,
    result: AiGenerationResult | null,
    predispatch: PredispatchClosure | null = null,
    native?: AgenticClosure,
  ) {
    const isNative = claim.job.selection_snapshot.mode === 'agentic';
    if (isNative && !predispatch) {
      assert(native && (native.notStarted || native.proof && native.descriptor), 'local_closure_unproven');
      if (native.descriptor) this.assertDescriptor(claim, native.descriptor);
      if (native.proof && native.descriptor) parseTeacherAgenticProof(native.proof, native.descriptor.reference);
    }
    this.closedLocally.set(claim.operationId, { claim, result, predispatch, native });
    // All fetch readers/callbacks have ended before this local proof is written.
    // Closure deliberately survives lost authority/lease; it never publishes domain content.
    const proof = {
      schema_version: isNative ? 2 : 1,
      contract: isNative ? 'teacher-agentic-text/1' : 'teacher-text/1',
      operation_id: claim.operationId,
      request_hash: claim.requestHash,
      owner: isNative ? { kind: 'teacher_agentic', descriptor_hash: native?.descriptor ? hash(native.descriptor) : null } : API_EXECUTOR_OWNER,
      owner_fence: claim.job.fence,
      runtime_fence: claim.runtimeFence,
      local_transport_closed: true,
      remote_outcome: predispatch || native?.notStarted ? null : result ? 'completed' : native?.proof?.remote_outcome ?? 'unknown',
      response_hash: result?.responseHash ?? native?.proof?.response_hash ?? null,
      dispatch_not_armed: predispatch !== null,
      predispatch_state: predispatch?.state ?? null,
      error_code: predispatch?.error ?? null,
      ...(isNative ? { native_proof: native?.proof ?? null, transport_not_started: native?.notStarted ?? !!predispatch,
        native_error_code: native?.error ?? null } : {}),
      observed_at: new Date().toISOString(),
    };
    await this.source.transaction(async (manager) => {
      await lockNodiaAiQueue(manager);
      const rows = await manager.query(
        `WITH closed AS (UPDATE ai_generation_operations SET phase='closed',terminal_proof=$2::jsonb,remote_outcome=$3,response_hash=$4,updated_at=clock_timestamp()
        WHERE id=$1 AND worker_id=$5 AND owner_fence=$6 AND request_hash=$7 AND phase<>'closed' RETURNING id) SELECT id FROM closed`,
        [
          claim.operationId,
          JSON.stringify(proof),
          proof.remote_outcome,
          proof.response_hash,
          claim.job.lease_owner,
          claim.job.fence,
          claim.requestHash,
        ],
      );
      assert(rows.length === 1);
    });
  }
  private async publish(claim: Claim, result: AiGenerationResult | null) {
    await this.source.transaction(async (manager) => {
      let authorized = true;
      try {
        await this.owned(manager, claim, true);
      } catch {
        authorized = false;
      }
      // A failed SQL transaction cannot be reused: authority errors are JS exceptions;
      // database errors escape so recovery retains the ownership and proof.
      const operations = await manager.query(
        'SELECT * FROM ai_generation_operations WHERE id=$1 FOR UPDATE',
        [claim.operationId],
      );
      const op = operations[0];
      assert(
        op?.phase === 'closed' &&
          op.worker_id === claim.job.lease_owner &&
          op.owner_fence === claim.job.fence &&
          op.runtime_fence === claim.runtimeFence,
      );
      if (op.acknowledged_at) return;
      let state = 'unknown',
        error: string | null = 'provider_outcome_unknown',
        ref: Record<string, unknown> | null = null;
      if (
        op.terminal_proof?.dispatch_not_armed === true &&
        op.started_exchanges === 0 &&
        op.reserved_exchanges === 0
      ) {
        state =
          op.terminal_proof.predispatch_state === 'failed_known'
            ? 'failed_known'
            : 'cancelled_before_dispatch';
        error = op.terminal_proof.error_code ?? 'cancelled_before_dispatch';
      } else if (claim.job.selection_snapshot.mode === 'agentic' && op.terminal_proof?.transport_not_started === true) {
        state = 'failed_known';
        error = op.terminal_proof.native_error_code ?? 'agentic_preflight_failed';
      } else if (result && authorized) {
        assert(
          op.response_hash === result.responseHash &&
            op.started_exchanges === 1,
        );
        assert(this.publisher, 'publisher_unavailable');
        await manager.query('SAVEPOINT teacher_publish');
        try {
          ref = await this.publisher(manager, claim.job, result.text);
          state = 'ready';
          error = null;
          await manager.query('RELEASE SAVEPOINT teacher_publish');
        } catch (publicationError) {
          reportTeacherPublicationFailure({
            job_id: claim.job.id,
            operation_id: claim.operationId,
            purpose: claim.job.purpose,
          }, publicationError, (event) => this.logger.warn(event));
          await manager.query('ROLLBACK TO SAVEPOINT teacher_publish');
          state = 'failed_known';
          error = 'invalid_generated_content';
        }
      } else if (result) {
        state = 'failed_known';
        error = 'authority_changed';
      }
      await manager.query(
        `UPDATE teacher_generation_jobs SET state=$2,error_code=$3,result_ref=$4::jsonb,blocks_duplicate=$5,lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1 AND fence=$6`,
        [
          claim.job.id,
          state,
          error,
          ref ? JSON.stringify(ref) : null,
          state === 'unknown',
          claim.job.fence,
        ],
      );
      await manager.query(
        "UPDATE teacher_generation_attempts SET phase='terminal',ended_at=clock_timestamp() WHERE id=$1",
        [claim.operationId],
      );
      const released = await manager.query(
        `WITH released AS (UPDATE nodia_ai_runtime_slots SET state='free',generation_operation_id=NULL,holder_worker_id=NULL,lease_until=NULL,external_operation_ref=NULL,fence=fence+1,updated_at=clock_timestamp()
      WHERE generation_operation_id=$1 AND fence=$2 AND holder_worker_id=$3 RETURNING resource_key) SELECT resource_key FROM released`,
        [claim.operationId, claim.runtimeFence, claim.job.lease_owner],
      );
      assert(released.length === 1);
      await manager.query(
        'UPDATE ai_generation_operations SET acknowledged_at=clock_timestamp() WHERE id=$1',
        [claim.operationId],
      );
      // Local closure removes duplicate exclusion, never the original unknown outcome.
      if (state === 'unknown')
        await manager.query(
          'UPDATE teacher_generation_jobs SET blocks_duplicate=false WHERE id=$1',
          [claim.job.id],
        );
    });
    this.closedLocally.delete(claim.operationId);
  }
  /** ACK follows the SQL publication/closure commit; failures remain durable and block new claims. */
  private async acknowledgeAgentic(operationId: string): Promise<boolean> {
    if (!this.agentic) return false;
    const rows = await this.source.query('SELECT * FROM ai_generation_operations WHERE id=$1 AND owner_kind=\'teacher\' AND phase=\'closed\' AND acknowledged_at IS NOT NULL AND agentic_acknowledged_at IS NULL', [operationId]);
    const op = rows[0];
    if (!op) return true;
    if (op.selection_snapshot?.mode !== 'agentic') return true;
    if (op.terminal_proof?.transport_not_started !== true && op.terminal_proof?.dispatch_not_armed !== true) {
      if (!op.agentic_transport_descriptor || !op.terminal_proof?.native_proof) return false;
      const descriptor = validateTeacherAgenticDescriptor(op.agentic_transport_descriptor);
      const proof = parseTeacherAgenticProof(op.terminal_proof.native_proof, descriptor.reference);
      try { await this.agentic.acknowledge(descriptor, proof, AbortSignal.timeout(10000)); } catch { return false; }
    }
    await this.source.query(`UPDATE ai_generation_operations SET agentic_acknowledged_at=clock_timestamp()
      WHERE id=$1 AND phase='closed' AND acknowledged_at IS NOT NULL AND agentic_acknowledged_at IS NULL`, [operationId]);
    return true;
  }
  async execute(workerId: string, signal: AbortSignal): Promise<boolean> {
    return this.run(workerId, signal);
  }
  private async run(
    workerId: string,
    signal: AbortSignal,
    onlyJobId: string | null = null,
  ): Promise<boolean> {
    if (!this.publisher || signal.aborted) return false;
    const claim = await this.claim(workerId, onlyJobId);
    if (!claim) return false;
    const deadline = teacherGenerationDeadline(
      claim.job.purpose,
      new Date(claim.job.deadline_at),
      Date.now(),
    );
    const abort = new AbortController();
    const cancel = () => abort.abort(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(
      () => abort.abort(Error('teacher:deadline')),
      Math.max(1, deadline - Date.now()),
    );
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let pending = Promise.resolve();
    let result: AiGenerationResult | null = null;
    let predispatch: PredispatchClosure | null = null;
    let native: AgenticClosure | undefined;
    let nativeUnclosed = false;
    try {
      await this.arm(claim);
      heartbeat = setInterval(() => {
        pending = pending
          .then(() => this.heartbeat(claim))
          .catch(() => {
            abort.abort(Error('teacher:lease_lost'));
          });
      }, 5000);
      result = await this.transport.execute(
        {
          operationId: claim.operationId,
          selection: claim.job.selection_snapshot,
          resourceKey: claim.config.resourceKey,
          configurationGeneration: claim.config.configurationGeneration,
          sessionGeneration: claim.config.sessionGeneration,
          deadlineAt: new Date(deadline),
          prompt: claim.job.prompt_snapshot,
          beforeExchange: () => this.beforeExchange(claim),
          checkLease: () =>
            this.source.transaction(async (manager) => {
              await this.owned(manager, claim, true);
            }),
          ...(claim.job.selection_snapshot.mode === 'agentic' && 'agentic' in claim.config ? {
            teacherOwner: { actorId: claim.job.actor_id, sessionId: claim.job.session_id, jobId: claim.job.id, attemptId: claim.operationId },
            nativeObservation: claim.config.agentic,
            persistAgenticDescriptor: (descriptor: TeacherAgenticDescriptor) => this.persistAgenticDescriptor(claim, descriptor),
          } : {}),
        },
        abort.signal,
      );
      if (claim.job.selection_snapshot.mode === 'agentic') {
        assert(result.agentic, 'local_closure_unproven');
        this.assertDescriptor(claim, result.agentic.descriptor);
        native = { ...result.agentic, notStarted: false, error: null };
      }
    } catch (error) {
      if (claim.job.selection_snapshot.mode === 'agentic') {
        if (error instanceof TeacherAgenticClosedError) {
          if (error.descriptor) this.assertDescriptor(claim, error.descriptor);
          native = { descriptor: error.descriptor, proof: error.proof, notStarted: error.notStarted, error: safeFailureCode(error) };
        } else if (error instanceof TeacherAgenticUnclosedError) {
          this.assertDescriptor(claim, error.descriptor);
          nativeUnclosed = true;
        }
      }
      // A lost arm COMMIT must never be guessed. Only durable zero-exchange reserved
      // ownership proves this intention did not reach the dispatch barrier.
      try {
        const rows = await this.source.query(
          `SELECT o.phase,o.reserved_exchanges,o.started_exchanges,j.dispatches_used FROM ai_generation_operations o JOIN teacher_generation_jobs j ON j.id=o.teacher_job_id WHERE o.id=$1 AND o.worker_id=$2 AND o.owner_fence=$3 AND o.runtime_fence=$4 AND o.request_hash=$5`,
          [
            claim.operationId,
            claim.job.lease_owner,
            claim.job.fence,
            claim.runtimeFence,
            claim.requestHash,
          ],
        );
        if (
          rows[0]?.phase === 'reserved' &&
          rows[0].reserved_exchanges === 0 &&
          rows[0].started_exchanges === 0 &&
          rows[0].dispatches_used === 0
        ) {
          const code = safeFailureCode(error);
          predispatch = {
            state:
              code === 'session_paused'
                ? 'cancelled_before_dispatch'
                : 'failed_known',
            error: code,
          };
        } else if (claim.job.selection_snapshot.mode === 'agentic' && !nativeUnclosed && !native &&
            rows[0]?.phase === 'dispatch_armed' && rows[0].started_exchanges === 0) {
          // The native adapter cannot start before the durable beforeExchange callback.
          native = { descriptor: null, proof: null, notStarted: true, error: safeFailureCode(error) };
        }
      } catch {
        /* Uncertain local commit keeps the conservative unknown outcome. */
      }
    } finally {
      clearTimeout(timer);
      clearInterval(heartbeat);
      signal.removeEventListener('abort', cancel);
      await pending;
    }
    if (claim.job.selection_snapshot.mode === 'agentic' && !predispatch && (!native || nativeUnclosed)) {
      await this.source.transaction(async manager => {
        await lockNodiaAiQueue(manager);
        await manager.query(`UPDATE teacher_generation_jobs j SET state='unknown',blocks_duplicate=true,
          error_code='local_closure_unproven',lease_until=clock_timestamp(),updated_at=clock_timestamp()
          FROM ai_generation_operations o WHERE j.id=$1 AND j.fence=$2 AND j.lease_owner=$3
          AND o.id=$4 AND o.teacher_job_id=j.id AND o.phase<>'closed' AND o.acknowledged_at IS NULL`,
        [claim.job.id, claim.job.fence, claim.job.lease_owner, claim.operationId]);
        await manager.query(`UPDATE nodia_ai_runtime_slots SET state='unknown' WHERE generation_operation_id=$1
          AND fence=$2 AND holder_worker_id=$3 AND EXISTS(SELECT 1 FROM ai_generation_operations WHERE id=$1 AND phase<>'closed' AND acknowledged_at IS NULL)`,
        [claim.operationId, claim.runtimeFence, claim.job.lease_owner]);
      });
      return true;
    }
    await this.close(claim, result, predispatch, native);
    await this.publish(claim, result);
    if (claim.job.selection_snapshot.mode === 'agentic') await this.acknowledgeAgentic(claim.operationId);
    return true;
  }
  /** Internal operator canary, absent from controllers/tools. One explicit POST, exact selection,
   * normal Teacher owner/counters/fences/publication. Requires an owned draft dedicated to this check. */
  async qualifyText(
    actor: ActorReference,
    sessionId: string,
    selection: TeacherSelection,
    signal: AbortSignal,
  ) {
    assert(selection.mode === 'api_key' || this.agentic, 'adapter_unqualified');
    // Authorize before consulting a native profile. No transaction spans live observation.
    await this.source.transaction(async manager => { await lockAuthority(manager); await this.authority(manager, actor); });
    const nativeConfig = selection.mode === 'agentic' ? await this.agentic!.observe(selection, signal) : null;
    const nonce = randomUUID();
    const jobId = randomUUID();
    await this.source.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      await this.authority(manager, actor);
      const rows = await manager.query(
        'SELECT * FROM teacher_sessions WHERE id=$1 FOR UPDATE',
        [sessionId],
      );
      const session = rows[0];
      assert(
        session?.owner_user_id === actor.userId &&
          session.state === 'draft' &&
          session.dispatches_used === 0,
        'qualification_session_required',
      );
      assert(
        hash(session.selection) === hash(selection),
        'configuration_changed',
      );
      const active = await manager.query(
        'SELECT id FROM teacher_generation_jobs WHERE session_id=$1 AND blocks_duplicate',
        [sessionId],
      );
      assert(active.length === 0, 'capacity_unavailable');
      const pending=await manager.query("SELECT count(*)::integer AS n FROM teacher_generation_jobs WHERE actor_id=$1 AND state IN ('queued','running','blocked_paused')",[actor.userId]);
      assert(pending[0]?.n<2,'capacity_unavailable');
      const c = await this.configuration(selection, manager, nativeConfig?.agentic);
      const input = {
        qualification_probe: { contract: nativeConfig ? 'teacher-agentic-text/1' : 'teacher-text/1', nonce,
          teacher_policy_hash: TEACHER_GENERATION_POLICY_HASH },
        session: {
          topic: 'Text transport verification',
          objective: 'Verify a structured reply under the bounded internal transport probe contract.',
          explanation_language: 'en',
          context: null,
          declared_base: null,
        },
        messages: [],
        target: {},
      };
      const snapshot = promptSnapshot('setup_reply', input);
      await manager.query(
        `INSERT INTO teacher_generation_jobs(id,session_id,actor_id,auth_session_public_id,purpose,semantic_key,input_snapshot,prompt_snapshot,template_ref,template_version,template_hash,input_hash,selection_snapshot,configuration_generation,session_generation,deadline_at)
        VALUES($1,$2,$3,$4,'setup_reply',$5,$6::jsonb,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,clock_timestamp()+interval '120 seconds')`,
        [
          jobId,
          sessionId,
          actor.userId,
          actor.sessionId,
          hash({ jobId, nonce }),
          JSON.stringify(input),
          snapshot.prompt,
          snapshot.template_ref,
          snapshot.template_version,
          snapshot.template_hash,
          hash(input),
          JSON.stringify(selection),
          c.configurationGeneration,
          c.sessionGeneration,
        ],
      );
      return c;
    });
    this.qualificationJobs.add(jobId);
    if (nativeConfig) this.qualificationAgentic.set(jobId, nativeConfig.agentic);
    try {
      await this.run(randomUUID(), signal, jobId);
      return await this.completeTextQualification(actor, sessionId, jobId, signal);
    } finally {
      this.qualificationJobs.delete(jobId);
      this.qualificationAgentic.delete(jobId);
    }
  }
  /** Complete only the original bounded canary after a lost ACK/receipt; never dispatch. */
  async completeTextQualification(actor: ActorReference, sessionId: string, jobId: string, signal: AbortSignal) {
    const original = await this.source.transaction(async manager => {
      await lockAuthority(manager); await this.authority(manager, actor);
      const rows = await manager.query(`SELECT j.* FROM teacher_generation_jobs j JOIN teacher_sessions s ON s.id=j.session_id
        WHERE j.id=$1 AND j.session_id=$2 AND j.actor_id=$3 AND s.owner_user_id=$3 AND s.state='draft'
        AND j.purpose='setup_reply' AND j.selection_snapshot=s.selection`, [jobId, sessionId, actor.userId]);
      const job = rows[0];
      const probe = job?.input_snapshot?.qualification_probe;
      assert(job && probe && typeof probe.nonce === 'string' && /^[0-9a-f-]{36}$/.test(probe.nonce) &&
        probe.contract === (job.selection_snapshot.mode === 'agentic' ? 'teacher-agentic-text/1' : 'teacher-text/1') &&
        hash({ jobId, nonce: probe.nonce }) === job.semantic_key, 'qualification_session_required');
      return { selection: job.selection_snapshot as TeacherSelection, nonce: probe.nonce };
    });
    const { selection, nonce } = original;
    const live = selection.mode === 'agentic' ? await this.agentic!.observe(selection, signal) : null;
    if (live) {
      const operations = await this.source.query('SELECT id FROM ai_generation_operations WHERE teacher_job_id=$1', [jobId]);
      assert(operations.length === 1, 'qualification_failed');
      assert(await this.acknowledgeAgentic(operations[0].id), 'qualification_failed');
    }
    return this.source.transaction(async manager => {
      await lockAuthority(manager); await this.authority(manager, actor);
      const config = await this.configuration(selection, manager, live?.agentic);
      const rows = await manager.query(`SELECT o.*,j.state AS job_state,j.input_snapshot,j.semantic_key,j.template_hash,m.text AS reply
        FROM ai_generation_operations o JOIN teacher_generation_jobs j ON j.id=o.teacher_job_id
        JOIN teacher_sessions s ON s.id=j.session_id JOIN teacher_setup_messages m ON m.generation_job_id=j.id
        WHERE j.id=$1 AND j.session_id=$2 AND j.actor_id=$3 AND s.owner_user_id=$3 AND s.state='draft'
        AND j.selection_snapshot=s.selection AND o.selection_snapshot=$4::jsonb FOR UPDATE OF o,s`,
      [jobId, sessionId, actor.userId, JSON.stringify(selection)]);
      const op = rows[0];
      assert(rows.length === 1 && op.job_state === 'ready' && op.phase === 'closed' && op.remote_outcome === 'completed' &&
        op.acknowledged_at && op.started_exchanges === 1 && op.reserved_exchanges === 1 &&
        op.terminal_proof?.local_transport_closed === true && op.reply === nonce &&
        op.input_snapshot?.qualification_probe?.nonce === nonce && op.semantic_key === hash({ jobId, nonce }) &&
        op.configuration_generation === config.configurationGeneration && op.session_generation === config.sessionGeneration &&
        op.resource_key === config.resourceKey, 'qualification_failed');
      const qualifiesCurrentPolicy = currentTeacherQualificationProbe(op.input_snapshot.qualification_probe, op.template_hash);
      const observedPolicyHash = op.input_snapshot.qualification_probe.teacher_policy_hash ?? null;
      const evidenceHash = hash({ contract: live ? 'teacher-agentic-text/1' : 'teacher-text/1',
        ...(observedPolicyHash === null ? {} : { teacher_policy_hash: observedPolicyHash }), nonce,
        operation: op.id, request: op.request_hash, response: op.response_hash });
      if (live) {
        assert(op.agentic_acknowledged_at, 'qualification_failed');
        if (qualifiesCurrentPolicy) await this.agentic!.recordQualification(manager, selection, live, op.id, op.response_hash, evidenceHash);
      } else if (qualifiesCurrentPolicy) await manager.query(`INSERT INTO ai_generation_qualifications(scope_hash,contract_version,operation_id,response_hash,evidence_hash)
        VALUES($1,'teacher-text/1',$2,$3,$4) ON CONFLICT(scope_hash) DO UPDATE SET operation_id=excluded.operation_id,
        response_hash=excluded.response_hash,evidence_hash=excluded.evidence_hash,observed_at=clock_timestamp()`,
      [scope(selection, config), op.id, op.response_hash, evidenceHash]);
      return { job_id: jobId, operation_id: op.id, configuration_generation: config.configurationGeneration,
        selection, local_closed: true, remote_outcome: 'completed', posts: 1, evidence_hash: evidenceHash,
        teacher_policy_hash: observedPolicyHash, qualified_current_policy: qualifiesCurrentPolicy,
        qualification_scope: 'text_transport_only', excluded_purposes: ['contextual_reply'] };
    });
  }
  /** Explicit operator-only anchored protocol probe. Never called by a controller/tool.
   * Requires current transport qualification and an unused real thread in an owned active lab session. */
  async qualifyContextualReply(actor: ActorReference, sessionId: string, selection: TeacherSelection,
    threadId: string, signal: AbortSignal) {
    const jobId = randomUUID(), nonce = randomUUID();
    await this.source.transaction(async manager => {
      await lockAuthority(manager); await lockNodiaAiQueue(manager);
      const config = await this.verifySelection(manager, actor, selection, 'learning_packet');
      const [session] = await manager.query('SELECT * FROM teacher_sessions WHERE id=$1 FOR UPDATE', [sessionId]);
      assert(session?.owner_user_id === actor.userId && session.state === 'active', 'qualification_session_required');
      assert(hash(session.selection) === hash(selection), 'configuration_changed');
      await rejectFinalHelp(manager, sessionId);
      const [busy] = await manager.query(`SELECT EXISTS(SELECT 1 FROM teacher_generation_jobs
        WHERE session_id=$1 AND blocks_duplicate) AS active,
        (SELECT count(*)::integer FROM teacher_generation_jobs WHERE actor_id=$2
          AND state IN ('queued','running','blocked_paused')) AS pending`, [sessionId, actor.userId]);
      assert(!busy.active && busy.pending < 2, 'capacity_unavailable');
      await manager.query('SELECT revision FROM teacher_enrichment_states WHERE session_id=$1 FOR UPDATE', [sessionId]);
      const thread = await enrichmentRecord(manager, sessionId, threadId, 'thread', true);
      const [used] = await manager.query(`SELECT EXISTS(SELECT 1 FROM teacher_enrichment_events
        WHERE session_id=$1 AND record_id=$2) OR EXISTS(SELECT 1 FROM teacher_generation_jobs
        WHERE session_id=$1 AND input_snapshot->>'thread_id'=$2::text) AS exists`, [sessionId, threadId]);
      assert(!used.exists, 'qualification_session_required');
      const block = await readAnchor(manager, sessionId, thread.data);
      const anchorHash = hash({ block, selection: thread.data.selection });
      const input = { qualification_probe: { contract: 'teacher-contextual-probe/1', purpose: 'contextual_reply',
          nonce, teacher_policy_hash: TEACHER_GENERATION_POLICY_HASH },
        thread_id: threadId, visible_context: block, selection: thread.data.selection,
        anchor_hash: anchorHash, messages: [] };
      const snapshot = promptSnapshot('contextual_reply', input);
      await manager.query(`INSERT INTO teacher_generation_jobs(id,session_id,actor_id,auth_session_public_id,
        purpose,semantic_key,input_snapshot,prompt_snapshot,template_ref,template_version,template_hash,input_hash,
        selection_snapshot,configuration_generation,session_generation,deadline_at)
        VALUES($1,$2,$3,$4,'contextual_reply',$5,$6::jsonb,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,clock_timestamp()+interval '120 seconds')`,
      [jobId, sessionId, actor.userId, actor.sessionId,
        hash({ jobId, nonce, purpose: 'contextual_reply', threadId, anchorHash }), JSON.stringify(input),
        snapshot.prompt, snapshot.template_ref, snapshot.template_version, snapshot.template_hash, hash(input),
        JSON.stringify(selection), config.configuration_generation, config.session_generation]);
    });
    this.qualificationJobs.add(jobId);
    try {
      await this.run(randomUUID(), signal, jobId);
      return await this.completeContextualQualification(actor, sessionId, jobId, signal);
    } finally { this.qualificationJobs.delete(jobId); }
  }
  /** Reconcile the same anchored canary after lost ACK/receipt. Never dispatch or replace a job. */
  async completeContextualQualification(actor: ActorReference, sessionId: string, jobId: string, signal: AbortSignal) {
    const original = await this.source.transaction(async manager => {
      await lockAuthority(manager); await this.authority(manager, actor);
      const [job] = await manager.query(`SELECT j.* FROM teacher_generation_jobs j
        JOIN teacher_sessions s ON s.id=j.session_id WHERE j.id=$1 AND j.session_id=$2
        AND j.actor_id=$3 AND s.owner_user_id=$3 AND s.state='active'
        AND j.purpose='contextual_reply' AND j.selection_snapshot=s.selection`, [jobId, sessionId, actor.userId]);
      assertContextualQualificationJob(job, jobId);
      return job;
    });
    const selection = original.selection_snapshot as TeacherSelection;
    // Native ACK belongs to the original persisted descriptor; observing does not dispatch.
    const live = selection.mode === 'agentic' ? await this.agentic!.observe(selection, signal) : null;
    if (live) {
      const operations = await this.source.query('SELECT id FROM ai_generation_operations WHERE teacher_job_id=$1', [jobId]);
      assert(operations.length === 1 && await this.acknowledgeAgentic(operations[0].id), 'qualification_failed');
    }
    signal.throwIfAborted();
    return this.source.transaction(async manager => {
      await lockAuthority(manager); await this.authority(manager, actor);
      const config = await this.configuration(selection, manager, live?.agentic);
      const [op] = await manager.query(`SELECT o.*,j.purpose,j.state AS job_state,j.input_snapshot,j.semantic_key,j.template_hash,
        e.data->>'text' AS reply FROM ai_generation_operations o JOIN teacher_generation_jobs j ON j.id=o.teacher_job_id
        JOIN teacher_sessions s ON s.id=j.session_id JOIN teacher_enrichment_events e
          ON e.session_id=j.session_id AND e.kind='message' AND e.data->>'role'='assistant' AND e.data->>'job_id'=j.id::text
        WHERE j.id=$1 AND j.session_id=$2 AND j.actor_id=$3 AND s.owner_user_id=$3 AND s.state='active'
        AND j.selection_snapshot=s.selection AND o.selection_snapshot=$4::jsonb FOR UPDATE OF o,s`,
      [jobId, sessionId, actor.userId, JSON.stringify(selection)]);
      assertContextualQualificationJob(op, jobId);
      assert(op.job_state === 'ready' && op.phase === 'closed' && op.remote_outcome === 'completed'
        && op.acknowledged_at && op.started_exchanges === 1 && op.reserved_exchanges === 1
        && op.terminal_proof?.local_transport_closed === true
        && (selection.mode !== 'agentic' || op.agentic_acknowledged_at)
        && contextualQualificationReplyMatches(op.reply, op.input_snapshot.selection)
        && op.configuration_generation === config.configurationGeneration
        && op.session_generation === config.sessionGeneration && op.resource_key === config.resourceKey,
      'qualification_failed');
      await rejectFinalHelp(manager, sessionId);
      const thread = await enrichmentRecord(manager, sessionId, op.input_snapshot.thread_id, 'thread');
      const block = await readAnchor(manager, sessionId, thread.data);
      assert(hash({ block, selection: thread.data.selection }) === op.input_snapshot.anchor_hash, 'invalid_anchor');
      const policyCurrent = op.input_snapshot.qualification_probe.teacher_policy_hash === TEACHER_GENERATION_POLICY_HASH
        && op.template_hash === TEACHER_GENERATION_POLICY.purposes.contextual_reply.template_hash;
      const transportScope = this.transportScope(selection, config);
      const evidenceHash = hash({ contract: 'teacher-contextual-probe/1',
        policy_hash: op.input_snapshot.qualification_probe.teacher_policy_hash,
        nonce: op.input_snapshot.qualification_probe.nonce, operation: op.id,
        anchor_hash: op.input_snapshot.anchor_hash, request: op.request_hash, response: op.response_hash });
      if (policyCurrent) await this.verifySelection(manager, actor, selection, 'learning_packet');
      if (policyCurrent) await manager.query(`INSERT INTO teacher_purpose_qualifications
        (scope_hash,policy_hash,transport_scope_hash,purpose,selection_snapshot,configuration_generation,
          session_generation,operation_id,response_hash,evidence_hash)
        VALUES($1,$2,$3,'contextual_reply',$4::jsonb,$5,$6,$7,$8,$9)
        ON CONFLICT(scope_hash) DO UPDATE SET operation_id=excluded.operation_id,response_hash=excluded.response_hash,
          evidence_hash=excluded.evidence_hash,observed_at=clock_timestamp()`,
      [teacherPurposeQualificationScope(transportScope), TEACHER_GENERATION_POLICY_HASH, transportScope,
        JSON.stringify(selection), config.configurationGeneration, config.sessionGeneration, op.id, op.response_hash, evidenceHash]);
      return { job_id: jobId, operation_id: op.id, selection, local_closed: true, remote_outcome: 'completed',
        posts: 1, evidence_hash: evidenceHash, teacher_policy_hash: op.input_snapshot.qualification_probe.teacher_policy_hash,
        qualified_current_policy: policyCurrent, qualification_scope: 'contextual_anchor_protocol_only',
        purpose: 'contextual_reply', thread_id: thread.id, pedagogical_quality_verified: false };
    });
  }
  async recover(): Promise<void> {
    for (const { claim, result, predispatch, native } of this.closedLocally.values()) {
      const rows = await this.source.query(
        'SELECT phase,acknowledged_at FROM ai_generation_operations WHERE id=$1',
        [claim.operationId],
      );
      if (rows[0]?.acknowledged_at) {
        this.closedLocally.delete(claim.operationId);
        if (claim.job.selection_snapshot.mode === 'agentic') await this.acknowledgeAgentic(claim.operationId);
        continue;
      }
      if (rows[0]?.phase !== 'closed')
        await this.close(claim, result, predispatch, native);
      await this.publish(claim, result);
      if (claim.job.selection_snapshot.mode === 'agentic') await this.acknowledgeAgentic(claim.operationId);
    }
    if (this.agentic) await this.recoverAgentic();
    await this.source.transaction(async (manager) => {
      await lockNodiaAiQueue(manager);
      await manager.query(
        "UPDATE teacher_generation_jobs SET state='failed_known',blocks_duplicate=false,error_code='queue_deadline',updated_at=clock_timestamp() WHERE state='queued' AND (deadline_at<=clock_timestamp() OR created_at<=clock_timestamp()-interval '300 seconds')",
      );
      await manager.query(
        "UPDATE teacher_generation_jobs SET state='cancelled_before_dispatch',blocks_duplicate=false,error_code='queue_deadline',updated_at=clock_timestamp() WHERE state='blocked_paused' AND dispatches_used=0 AND (deadline_at<=clock_timestamp() OR created_at<=clock_timestamp()-interval '300 seconds')",
      );
      const rows =
        await manager.query(`SELECT o.*,j.state AS job_state FROM ai_generation_operations o JOIN teacher_generation_jobs j ON j.id=o.teacher_job_id
        WHERE o.owner_kind='teacher' AND o.selection_snapshot->>'mode'='api_key'
        AND o.acknowledged_at IS NULL AND j.lease_until<clock_timestamp() ORDER BY o.created_at LIMIT 20 FOR UPDATE OF o,j SKIP LOCKED`);
      for (const op of rows) {
        const beforeDispatch =
          op.phase === 'reserved' &&
          op.reserved_exchanges === 0 &&
          op.started_exchanges === 0;
        const closed =
          op.phase === 'closed' ||
          (op.api_owner_identity &&
            isApiExecutorProvenClosed(
              op.api_owner_identity as ApiExecutorOwner,
            ));
        if (!beforeDispatch && !closed) {
          await manager.query(
            "UPDATE teacher_generation_jobs SET state='unknown',error_code='local_closure_unproven' WHERE id=$1",
            [op.teacher_job_id],
          );
          await manager.query(
            "UPDATE nodia_ai_runtime_slots SET state='unknown' WHERE generation_operation_id=$1",
            [op.id],
          );
          continue;
        }
        // Proof of a dead local owner says nothing about the remote response. Never replay.
        const proof = op.terminal_proof ?? {
          schema_version: 1,
          contract: 'teacher-text/1',
          operation_id: op.id,
          request_hash: op.request_hash,
          owner: op.api_owner_identity,
          owner_fence: op.owner_fence,
          runtime_fence: op.runtime_fence,
          local_transport_closed: true,
          closure_basis: beforeDispatch
            ? 'durable_before_dispatch'
            : 'proven_dead_local_owner',
          dispatch_not_armed: beforeDispatch,
          remote_outcome: beforeDispatch
            ? null
            : (op.remote_outcome ?? 'unknown'),
          response_hash: op.response_hash ?? null,
          observed_at: new Date().toISOString(),
        };
        await manager.query(
          "UPDATE ai_generation_operations SET phase='closed',terminal_proof=$2::jsonb,remote_outcome=CASE WHEN $3 THEN NULL ELSE coalesce(remote_outcome,'unknown') END,acknowledged_at=clock_timestamp() WHERE id=$1",
          [op.id, JSON.stringify(proof), beforeDispatch],
        );
        await manager.query(
          'UPDATE teacher_generation_jobs SET state=$2,blocks_duplicate=false,error_code=$3,lease_owner=NULL,lease_until=NULL WHERE id=$1',
          [
            op.teacher_job_id,
            beforeDispatch ? 'cancelled_before_dispatch' : 'unknown',
            beforeDispatch
              ? 'worker_lost_before_dispatch'
              : 'provider_outcome_unknown',
          ],
        );
        await manager.query(
          "UPDATE teacher_generation_attempts SET phase='terminal',ended_at=clock_timestamp() WHERE id=$1",
          [op.id],
        );
        await manager.query(
          "UPDATE nodia_ai_runtime_slots SET state='free',generation_operation_id=NULL,holder_worker_id=NULL,lease_until=NULL,external_operation_ref=NULL,fence=fence+1 WHERE generation_operation_id=$1",
          [op.id],
        );
      }
    });
  }
  /** Native reconciliation is external work; never hold the queue/authority transaction across it. */
  private async recoverAgentic(): Promise<void> {
    assert(this.agentic);
    const operations = await this.source.query(`SELECT o.* FROM ai_generation_operations o
      JOIN teacher_generation_jobs j ON j.id=o.teacher_job_id
      WHERE o.owner_kind='teacher' AND o.selection_snapshot->>'mode'='agentic'
      AND ((o.acknowledged_at IS NULL AND j.lease_until<clock_timestamp()) OR
        (o.acknowledged_at IS NOT NULL AND o.agentic_acknowledged_at IS NULL))
      ORDER BY o.created_at LIMIT 20`);
    for (const operation of operations) {
      if (operation.acknowledged_at) { await this.acknowledgeAgentic(operation.id); continue; }
      let descriptor: TeacherAgenticDescriptor | null = null;
      let nativeProof: TeacherAgenticProof | null = null;
      let notStarted = operation.started_exchanges === 0 && ['reserved', 'dispatch_armed'].includes(operation.phase);
      try {
        if (operation.agentic_transport_descriptor) {
          descriptor = validateTeacherAgenticDescriptor(operation.agentic_transport_descriptor);
          const r = descriptor.reference, s = operation.selection_snapshot;
          assert(r.operation_id === operation.id && r.attempt_id === operation.teacher_attempt_id &&
            r.session_id === operation.teacher_session_id && r.job_id === operation.teacher_job_id &&
            r.actor_id === operation.actor_id && r.connection_id === operation.connection_id &&
            r.model_id === s.model_id && r.effort_id === s.effort_id &&
            r.resource_key === operation.resource_key && r.configuration_generation === operation.configuration_generation &&
            r.session_generation === operation.session_generation, 'agentic_owner_mismatch');
        }
        const closed = operation.terminal_proof;
        const storedExclusion = operation.phase === 'closed' && closed?.schema_version === 2 &&
          closed.contract === 'teacher-agentic-text/1' && closed.operation_id === operation.id &&
          closed.request_hash === operation.request_hash && closed.owner_fence === operation.owner_fence &&
          closed.runtime_fence === operation.runtime_fence && closed.local_transport_closed === true &&
          closed.transport_not_started === true && closed.native_proof === null && closed.remote_outcome === null &&
          closed.owner?.kind === 'teacher_agentic' && closed.owner?.descriptor_hash === (descriptor ? hash(descriptor) : null);
        notStarted ||= storedExclusion;
        if (!notStarted) {
          assert(descriptor, 'local_closure_unproven');
          nativeProof = operation.phase === 'closed' && operation.terminal_proof?.native_proof
            ? parseTeacherAgenticProof(operation.terminal_proof.native_proof, descriptor.reference)
            : await this.agentic.reconcile(descriptor, AbortSignal.timeout(10000));
          if (nativeProof) nativeProof = parseTeacherAgenticProof(nativeProof, descriptor.reference);
        }
      } catch { nativeProof = null; }
      if (!notStarted && !nativeProof) {
        await this.source.transaction(async manager => {
          await lockNodiaAiQueue(manager);
          await manager.query(`UPDATE teacher_generation_jobs j SET state='unknown',blocks_duplicate=true,error_code='local_closure_unproven'
            FROM ai_generation_operations o WHERE j.id=$1 AND o.id=$2 AND o.acknowledged_at IS NULL`, [operation.teacher_job_id, operation.id]);
          await manager.query("UPDATE nodia_ai_runtime_slots SET state='unknown' WHERE generation_operation_id=$1 AND EXISTS(SELECT 1 FROM ai_generation_operations WHERE id=$1 AND acknowledged_at IS NULL)", [operation.id]);
        });
        continue;
      }
      await this.source.transaction(async manager => {
        await lockNodiaAiQueue(manager);
        const freshRows = await manager.query(`SELECT o.*,j.fence AS job_fence,j.lease_owner,j.lease_until FROM ai_generation_operations o
          JOIN teacher_generation_jobs j ON j.id=o.teacher_job_id
          WHERE o.id=$1 AND o.acknowledged_at IS NULL AND j.lease_until<clock_timestamp()
          FOR UPDATE OF o,j`, [operation.id]);
        const fresh = freshRows[0];
        if (!fresh || fresh.owner_fence !== operation.owner_fence || fresh.runtime_fence !== operation.runtime_fence ||
            fresh.worker_id !== operation.worker_id || fresh.request_hash !== operation.request_hash ||
            fresh.job_fence !== operation.owner_fence || fresh.lease_owner !== operation.worker_id ||
            notStarted && fresh.phase !== 'closed' && fresh.started_exchanges !== 0) return;
        if (descriptor) assert(hash(fresh.agentic_transport_descriptor) === hash(descriptor), 'agentic_owner_mismatch');
        const proof = {
          schema_version: 2, contract: 'teacher-agentic-text/1', operation_id: fresh.id,
          request_hash: fresh.request_hash, owner_fence: fresh.owner_fence, runtime_fence: fresh.runtime_fence,
          owner: { kind: 'teacher_agentic', descriptor_hash: descriptor ? hash(descriptor) : null },
          local_transport_closed: true, native_proof: nativeProof,
          transport_not_started: notStarted, dispatch_not_armed: fresh.reserved_exchanges === 0,
          closure_basis: notStarted ? 'durable_before_agentic_exchange' : 'verified_original_native_owner',
          remote_outcome: notStarted ? null : nativeProof!.remote_outcome,
          response_hash: nativeProof?.response_hash ?? null, observed_at: new Date().toISOString(),
        };
        await manager.query(`UPDATE ai_generation_operations SET phase='closed',terminal_proof=$2::jsonb,
          remote_outcome=$3,response_hash=$4,acknowledged_at=clock_timestamp() WHERE id=$1`,
        [fresh.id, JSON.stringify(proof), proof.remote_outcome, proof.response_hash]);
        await manager.query(`UPDATE teacher_generation_jobs SET state=$2,result_ref=NULL,blocks_duplicate=false,error_code=$3,
          lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1`,
        [fresh.teacher_job_id, notStarted ? 'cancelled_before_dispatch' : 'unknown',
          notStarted ? 'worker_lost_before_dispatch' : proof.remote_outcome === 'completed' ? 'provider_result_lost' : 'provider_outcome_unknown']);
        await manager.query("UPDATE teacher_generation_attempts SET phase='terminal',ended_at=clock_timestamp() WHERE id=$1", [fresh.id]);
        const released = await manager.query(`WITH released AS (UPDATE nodia_ai_runtime_slots
          SET state='free',generation_operation_id=NULL,holder_worker_id=NULL,lease_until=NULL,external_operation_ref=NULL,fence=fence+1
          WHERE generation_operation_id=$1 AND fence=$2 AND holder_worker_id=$3 RETURNING resource_key) SELECT resource_key FROM released`,
        [fresh.id, fresh.runtime_fence, fresh.worker_id]);
        assert(released.length === 1, 'lease_lost');
      });
      await this.acknowledgeAgentic(operation.id);
    }
  }
}
