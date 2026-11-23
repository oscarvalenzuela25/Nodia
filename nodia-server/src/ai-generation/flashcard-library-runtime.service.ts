import { createHash } from 'node:crypto';
import {
  HttpException,
  Inject,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
} from '../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import {
  API_EXECUTOR_OWNER,
  isApiExecutorProvenClosed,
  type ApiExecutorOwner,
} from '../nodia-ai-adapter/api-nodia-ai-runtime-owner.js';
import { NodiaAiAdapterError } from '../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../nodia-ai-runtime/config/runtime-policy.js';
import { lockNodiaAiQueue } from '../nodia-ai-runtime/queue-lock.js';
import { readFlashcardTextProposal } from '../teacher/policies/teacher-flashcard-generation.js';
import { flashcardLibraryImagePrompt } from '../teacher/policies/teacher-flashcard-library.js';
import {
  FLASHCARD_IMAGE_MAX_BYTES,
  readFlashcardImage,
} from '../teacher/policies/teacher-flashcards.js';
import {
  hash,
  requireUuid,
  teacherError,
} from '../teacher/policies/teacher-validation.js';
import type { TeacherSelection } from '../teacher/types/teacher.types.js';
import { requireFlashcardLibraryTarget } from '../teacher/use-case/teacher-flashcard-library-target.js';
import {
  FLASHCARD_IMAGE_QUALIFICATION_PROMPT,
  FlashcardLibraryTransport,
} from './flashcard-library-transport.service.js';
import type {
  FlashcardProposalKind,
  FlashcardText,
} from './flashcard-library.store.js';
import {
  GenerationWorkerSourceRegistry,
  type GenerationWorkerSource,
} from './worker-source-registry.js';

type Part = {
  id: string;
  proposal_id: string;
  owner_user_id: string;
  auth_session_public_id: string | null;
  kind: FlashcardProposalKind;
  origin: Record<string, unknown>;
  qualification: boolean;
  prompt: string | null;
  preceding_text: FlashcardText | null;
  selection_snapshot: TeacherSelection;
  resource_key: string;
  configuration_generation: string;
  session_generation: string;
};

type Claim = {
  part: Part;
  prompt: string;
  workerId: string;
  fence: string;
  deadlineAt: Date;
  requestHash: string;
};

type ClosedOutput = {
  responseHash: string;
  text: FlashcardText | null;
  image: { bytes: Buffer; mime: string } | null;
  invalid: boolean;
};

type Closure = { claim: Claim; output: ClosedOutput | null; error: string };
type OwnedRow = {
  started_exchanges: number;
  valid_lease: boolean;
  phase: string;
};
type Recoverable = {
  id: string;
  kind: FlashcardProposalKind;
  proposal_id: string;
  phase: string;
  started_exchanges: number;
  request_hash: string;
  owner_fence: string;
  runtime_fence: string;
  api_owner_identity: ApiExecutorOwner | null;
};

function failureCode(error: unknown): string {
  if (error instanceof NodiaAiAdapterError) return 'provider_unavailable';
  if (error instanceof HttpException) {
    const response = error.getResponse();
    const publicCode =
      typeof response === 'string'
        ? response
        : 'message' in response && typeof response.message === 'string'
          ? response.message
          : '';
    if (publicCode.startsWith('auth:') || publicCode.startsWith('core:'))
      return 'authority_changed';
    if (/^teacher:[a-z0-9_]{1,100}$/.test(publicCode))
      return publicCode.slice(8);
  }
  return 'provider_unavailable';
}

/** One durable operation per requested part. Only the guarded callback may begin an HTTP exchange. */
@Injectable()
export class FlashcardLibraryRuntimeService
  implements OnModuleInit, GenerationWorkerSource
{
  private readonly closedLocally = new Map<string, Closure>();

  constructor(
    private readonly source: DataSource,
    private readonly moduleAccess: CheckModuleAccessUseCase,
    private readonly registry: GenerationWorkerSourceRegistry,
    private readonly transport: FlashcardLibraryTransport,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  onModuleInit() {
    this.registry.register(this, 'flashcard-library');
  }

  private scope<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.source.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      return work(manager);
    });
  }

  private async authority(manager: EntityManager, part: Part) {
    const actor = await currentActor(manager, {
      userId: part.owner_user_id,
      sessionId: part.auth_session_public_id ?? '',
    });
    await this.moduleAccess.execute(actor.actorId, ['/nodia-teacher'], manager);
    await requireFlashcardLibraryTarget(manager, actor.actorId, part.origin);
  }

  private async configuration(manager: EntityManager, part: Part) {
    const config = await this.transport.configure(
      part.selection_snapshot,
      part.kind,
      manager,
      part.qualification ? true : undefined,
    );
    if (
      config.resourceKey !== part.resource_key ||
      config.configurationGeneration !== part.configuration_generation ||
      config.sessionGeneration !== part.session_generation
    ) {
      teacherError('configuration_changed');
    }
    return config;
  }

  private async setPartFailure(
    manager: EntityManager,
    part: Pick<Part, 'id' | 'kind' | 'proposal_id'>,
    state: 'failed' | 'unknown',
    error: string,
    keepLease = false,
  ) {
    await manager.query(
      `UPDATE teacher_flashcard_library_parts SET state=$2,error_code=$3,
       lease_until=CASE WHEN $4 THEN lease_until ELSE NULL END WHERE id=$1`,
      [part.id, state, error, keepLease],
    );
    if (part.kind === 'text') {
      await manager.query(
        `UPDATE teacher_flashcard_library_parts SET state='failed',error_code='flashcard_proposal_text_dependency_failed'
         WHERE proposal_id=$1 AND kind='image' AND state='queued'`,
        [part.proposal_id],
      );
    }
  }

  private async claim(workerId: string, onlyId?: string) {
    return this.scope(async (manager) => {
      const [part]: Part[] = await manager.query(
        `SELECT part.*,proposal.owner_user_id,proposal.auth_session_public_id,proposal.origin,
                proposal.qualification,prior.text_value AS preceding_text
         FROM teacher_flashcard_library_parts part
         JOIN teacher_flashcard_library_proposals proposal ON proposal.id=part.proposal_id
         LEFT JOIN teacher_flashcard_library_parts prior ON prior.proposal_id=proposal.id AND prior.kind='text'
         WHERE part.state='queued' AND proposal.queue_expires_at>clock_timestamp()
           AND ($1::uuid IS NULL OR part.id=$1)
           AND (part.kind='text' OR prior.id IS NULL OR prior.state='ready')
           AND NOT EXISTS (SELECT 1 FROM nodia_ai_runtime_slots s WHERE s.resource_key=part.resource_key AND s.state<>'free')
           AND NOT EXISTS (SELECT 1 FROM ai_generation_operations o WHERE o.actor_id=proposal.owner_user_id
             AND o.owner_kind='flashcard_library' AND o.acknowledged_at IS NULL)
           AND NOT EXISTS (SELECT 1 FROM teacher_generation_jobs j WHERE j.actor_id=proposal.owner_user_id
             AND j.state IN ('running','unknown') AND j.blocks_duplicate)
           AND NOT EXISTS (SELECT 1 FROM nodia_ai_jobs j JOIN nodia_ai_conversations c ON c.id=j.conversation_id
             WHERE c.owner_id=proposal.owner_user_id AND j.state IN ('leased','unknown'))
           AND ((SELECT count(*) FROM nodia_ai_jobs WHERE state='leased')
             +(SELECT count(*) FROM teacher_generation_jobs WHERE state='running')
             +(SELECT count(*) FROM nodia_ai_runtime_slots s JOIN ai_generation_operations o ON o.id=s.generation_operation_id
                WHERE s.state='held' AND o.owner_kind='flashcard_library'))<$2
         ORDER BY proposal.created_at,part.id LIMIT 1 FOR UPDATE OF proposal,part SKIP LOCKED`,
        [onlyId ?? null, this.policy.queue.foreground_workers],
      );
      if (!part) return null;
      let prompt: string;
      let config: Awaited<ReturnType<FlashcardLibraryTransport['configure']>>;
      try {
        await this.authority(manager, part);
        const preceding = part.preceding_text;
        prompt =
          part.prompt ??
          (preceding
            ? flashcardLibraryImagePrompt(preceding.question, preceding.answer)
            : '');
        if (
          !prompt ||
          (part.qualification &&
            (part.kind !== 'image' ||
              prompt !== FLASHCARD_IMAGE_QUALIFICATION_PROMPT))
        ) {
          teacherError('invalid_input');
        }
        config = await this.configuration(manager, part);
      } catch (error) {
        if (
          !(error instanceof HttpException) &&
          !(error instanceof NodiaAiAdapterError)
        )
          throw error;
        await this.setPartFailure(manager, part, 'failed', failureCode(error));
        return { claim: null };
      }
      await manager.query(
        "INSERT INTO nodia_ai_runtime_slots(resource_key,state,fence) VALUES($1,'free',0) ON CONFLICT DO NOTHING",
        [part.resource_key],
      );
      const [slot]: { state: string; fence: string }[] = await manager.query(
        'SELECT state,fence FROM nodia_ai_runtime_slots WHERE resource_key=$1 FOR UPDATE',
        [part.resource_key],
      );
      if (slot?.state !== 'free') return null;
      const fence = (BigInt(slot.fence) + 1n).toString();
      const requestHash = hash({
        contract: 'teacher-flashcard-library/1',
        part: part.id,
        proposal: part.proposal_id,
        owner: part.owner_user_id,
        kind: part.kind,
        prompt,
        selection: part.selection_snapshot,
        resource: part.resource_key,
        configuration: part.configuration_generation,
        session: part.session_generation,
      });
      const [timing]: { deadline_at: Date }[] = await manager.query(
        `WITH changed AS (UPDATE teacher_flashcard_library_parts
         SET state='running',deadline_at=clock_timestamp()+$2*interval '1 second',
         lease_until=clock_timestamp()+least($2,$3)*interval '1 second' WHERE id=$1
         RETURNING deadline_at) SELECT deadline_at FROM changed`,
        [
          part.id,
          this.policy.timing.provider_dispatch_seconds,
          this.policy.timing.lease_seconds,
        ],
      );
      await manager.query(
        `INSERT INTO ai_generation_operations
           (id,owner_kind,flashcard_proposal_id,flashcard_part_id,actor_id,auth_session_public_id,
            connection_id,selected_key_id,selection_snapshot,configuration_generation,session_generation,resource_key,
            worker_id,owner_fence,runtime_fence,phase,request_hash,exchange_limit,reserved_exchanges,api_owner_identity)
         VALUES ($1,'flashcard_library',$2,$1,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,1,$12,'dispatch_armed',$13,1,1,$14::jsonb)`,
        [
          part.id,
          part.proposal_id,
          part.owner_user_id,
          part.auth_session_public_id,
          config.connectionId,
          config.keyId,
          JSON.stringify(part.selection_snapshot),
          part.configuration_generation,
          part.session_generation,
          part.resource_key,
          workerId,
          fence,
          requestHash,
          JSON.stringify(API_EXECUTOR_OWNER),
        ],
      );
      await manager.query(
        `UPDATE nodia_ai_runtime_slots s SET state='held',generation_operation_id=$1,holder_worker_id=$2,
         fence=$3,lease_until=p.lease_until,external_operation_ref=($1::uuid)::text,updated_at=clock_timestamp()
         FROM teacher_flashcard_library_parts p WHERE s.resource_key=$4 AND p.id=$1`,
        [part.id, workerId, fence, part.resource_key],
      );
      return {
        claim: {
          part,
          prompt,
          workerId,
          fence,
          deadlineAt: timing.deadline_at,
          requestHash,
        } satisfies Claim,
      };
    });
  }

  private async owned(
    manager: EntityManager,
    claim: Claim,
  ): Promise<OwnedRow | null> {
    const [row]: OwnedRow[] = await manager.query(
      `SELECT o.started_exchanges,o.phase,
              (s.state='held' AND p.state='running' AND p.deadline_at>clock_timestamp()
               AND p.lease_until>clock_timestamp()) AS valid_lease
       FROM ai_generation_operations o
       JOIN teacher_flashcard_library_parts p ON p.id=o.flashcard_part_id
       JOIN nodia_ai_runtime_slots s ON s.resource_key=o.resource_key AND s.generation_operation_id=o.id
       WHERE o.id=$1 AND o.owner_kind='flashcard_library' AND o.acknowledged_at IS NULL
         AND o.worker_id=$2 AND s.holder_worker_id=$2 AND o.runtime_fence=$3 AND s.fence=$3
         AND o.request_hash=$4 AND o.api_owner_identity=$5::jsonb
       FOR UPDATE OF o,p,s`,
      [
        claim.part.id,
        claim.workerId,
        claim.fence,
        claim.requestHash,
        JSON.stringify(API_EXECUTOR_OWNER),
      ],
    );
    return row ?? null;
  }

  private exchange(claim: Claim) {
    return this.scope(async (manager) => {
      const row = await this.owned(manager, claim);
      if (
        !row?.valid_lease ||
        row.phase !== 'dispatch_armed' ||
        row.started_exchanges !== 0
      ) {
        teacherError('lease_lost');
      }
      await this.authority(manager, claim.part);
      await this.configuration(manager, claim.part);
      await manager.query(
        "UPDATE ai_generation_operations SET started_exchanges=1,phase='transport_open',updated_at=clock_timestamp() WHERE id=$1",
        [claim.part.id],
      );
    });
  }

  private heartbeat(claim: Claim) {
    return this.scope(async (manager) => {
      if (!(await this.owned(manager, claim))?.valid_lease)
        teacherError('lease_lost');
      await this.authority(manager, claim.part);
      await manager.query(
        `WITH renewed AS (UPDATE teacher_flashcard_library_parts
           SET lease_until=least(clock_timestamp()+$2*interval '1 second',deadline_at)
           WHERE id=$1 RETURNING lease_until)
         UPDATE nodia_ai_runtime_slots SET lease_until=renewed.lease_until
         FROM renewed WHERE generation_operation_id=$1`,
        [claim.part.id, this.policy.timing.lease_seconds],
      );
    });
  }

  private readOutput(
    part: Part,
    result: Awaited<ReturnType<FlashcardLibraryTransport['execute']>>,
  ): ClosedOutput {
    let text: FlashcardText | null = null;
    let image: ClosedOutput['image'] = null;
    const imageResult = result.image;
    if (part.kind === 'text' && !imageResult) {
      try {
        const candidate = readFlashcardTextProposal(result.text);
        // JSONB adds its own object separators. Leave room before the database byte limit.
        if (Buffer.byteLength(JSON.stringify(candidate)) <= 16368)
          text = candidate;
      } catch {
        /* Invalid provider output is a known validation failure. */
      }
    } else if (
      part.kind === 'image' &&
      imageResult?.mime === 'image/webp' &&
      Buffer.isBuffer(imageResult.bytes) &&
      imageResult.bytes.length > 0 &&
      imageResult.bytes.length <= FLASHCARD_IMAGE_MAX_BYTES
    ) {
      try {
        if (
          readFlashcardImage({
            data: imageResult.bytes.toString('base64'),
            side: 'answer',
          })
        )
          image = imageResult;
      } catch {
        /* Reject an invalid still image before preview or persistence. */
      }
    }
    const responseHash = createHash('sha256')
      .update(image?.bytes ?? result.text)
      .digest('hex');
    return {
      responseHash,
      text,
      image,
      invalid: responseHash !== result.responseHash || (!text && !image),
    };
  }

  async execute(
    workerId: string,
    signal: AbortSignal,
    onlyId?: string,
  ): Promise<boolean> {
    requireUuid(workerId);
    if (onlyId) requireUuid(onlyId);
    if (signal.aborted) return false;
    const next = await this.claim(workerId, onlyId);
    if (!next) return false;
    const claim = next.claim;
    if (!claim) return true;
    const part = claim.part;
    const ownership = new AbortController();
    const leaseSignal = AbortSignal.any([
      signal,
      ownership.signal,
      AbortSignal.timeout(Math.max(1, claim.deadlineAt.getTime() - Date.now())),
    ]);
    let heartbeat: Promise<void> | undefined;
    const timer = setInterval(() => {
      if (!heartbeat)
        heartbeat = this.heartbeat(claim)
          .catch((error) => ownership.abort(error))
          .finally(() => {
            heartbeat = undefined;
          });
    }, this.policy.timing.heartbeat_seconds * 1000);
    timer.unref();
    let output: ClosedOutput | null = null;
    let error = 'provider_unavailable';
    try {
      const result = await this.transport.execute(
        part.kind,
        {
          operationId: part.id,
          selection: part.selection_snapshot,
          prompt: claim.prompt,
          resourceKey: part.resource_key,
          configurationGeneration: part.configuration_generation,
          sessionGeneration: part.session_generation,
          deadlineAt: claim.deadlineAt,
          beforeExchange: () => this.exchange(claim),
          checkLease: () => this.heartbeat(claim),
        },
        leaseSignal,
        part.qualification ? true : undefined,
      );
      output = this.readOutput(part, result);
    } catch (cause) {
      error = failureCode(cause);
    } finally {
      clearInterval(timer);
      await heartbeat;
    }
    const closure = { claim, output, error };
    // Retain only locally closed output for SQL recovery. No recovery path invokes the provider again.
    this.closedLocally.set(part.id, closure);
    await this.finish(closure);
    this.closedLocally.delete(part.id);
    return true;
  }

  private async closeOperation(
    manager: EntityManager,
    op: Pick<
      Recoverable,
      | 'id'
      | 'request_hash'
      | 'owner_fence'
      | 'runtime_fence'
      | 'api_owner_identity'
      | 'started_exchanges'
    >,
    basis:
      | 'same_executor_return'
      | 'durable_before_dispatch'
      | 'proven_dead_local_owner',
    responseHash: string | null,
  ) {
    const remote =
      op.started_exchanges === 0
        ? null
        : responseHash
          ? 'completed'
          : 'unknown';
    const proof = {
      schema_version: 1,
      contract: 'teacher-flashcard-library/1',
      operation_id: op.id,
      request_hash: op.request_hash,
      owner: op.api_owner_identity,
      owner_fence: op.owner_fence,
      runtime_fence: op.runtime_fence,
      local_transport_closed: true,
      closure_basis: basis,
      dispatch_not_started: op.started_exchanges === 0,
      remote_outcome: remote,
      response_hash: responseHash,
      observed_at: new Date().toISOString(),
    };
    const [freed] = await manager.query(
      `WITH freed AS (UPDATE nodia_ai_runtime_slots SET state='free',generation_operation_id=NULL,holder_worker_id=NULL,
         lease_until=NULL,external_operation_ref=NULL,fence=fence+1,updated_at=clock_timestamp()
         WHERE generation_operation_id=$1 AND fence=$2 RETURNING resource_key) SELECT resource_key FROM freed`,
      [op.id, op.runtime_fence],
    );
    if (!freed) teacherError('lease_lost');
    await manager.query(
      `UPDATE ai_generation_operations SET phase='closed',terminal_proof=$2::jsonb,remote_outcome=$3,
         response_hash=$4,acknowledged_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1`,
      [op.id, JSON.stringify(proof), remote, responseHash],
    );
  }

  private finish({ claim, output, error }: Closure) {
    return this.scope(async (manager) => {
      const owned = await this.owned(manager, claim);
      if (!owned) return;
      const part = claim.part;
      let publish = Boolean(
        owned.started_exchanges &&
        owned.valid_lease &&
        output &&
        !output.invalid,
      );
      let finalError = error;
      if (output && !publish)
        finalError = owned.valid_lease
          ? 'invalid_generated_content'
          : 'flashcard_proposal_deadline';
      if (publish) {
        try {
          await this.authority(manager, part);
          await this.configuration(manager, part);
        } catch (cause) {
          if (
            !(cause instanceof HttpException) &&
            !(cause instanceof NodiaAiAdapterError)
          )
            throw cause;
          publish = false;
          finalError = failureCode(cause);
        }
      }
      if (publish && output) {
        await manager.query(
          `UPDATE teacher_flashcard_library_parts SET state='ready',error_code=NULL,lease_until=NULL,
             text_value=$2::jsonb,image_mime=$3,image_bytes=$4 WHERE id=$1`,
          [
            part.id,
            output.text ? JSON.stringify(output.text) : null,
            output.image?.mime ?? null,
            output.image?.bytes ?? null,
          ],
        );
      } else {
        const uncertain = owned.started_exchanges > 0 && !output;
        await this.setPartFailure(
          manager,
          part,
          uncertain ? 'unknown' : 'failed',
          uncertain ? 'provider_outcome_unknown' : finalError,
        );
      }
      await this.closeOperation(
        manager,
        {
          id: part.id,
          request_hash: claim.requestHash,
          owner_fence: '1',
          runtime_fence: claim.fence,
          api_owner_identity: API_EXECUTOR_OWNER,
          started_exchanges: owned.started_exchanges,
        },
        'same_executor_return',
        owned.started_exchanges ? (output?.responseHash ?? null) : null,
      );
    });
  }

  async recover() {
    let failure: unknown;
    for (const [id, closure] of this.closedLocally) {
      try {
        await this.finish(closure);
        this.closedLocally.delete(id);
      } catch (error) {
        failure ??= error;
      }
    }
    await this.scope(async (manager) => {
      const expired: Pick<Part, 'id' | 'kind' | 'proposal_id'>[] =
        await manager.query(
          `SELECT part.id,part.kind,part.proposal_id FROM teacher_flashcard_library_parts part
         JOIN teacher_flashcard_library_proposals proposal ON proposal.id=part.proposal_id
         WHERE part.state='queued' AND proposal.queue_expires_at<=clock_timestamp()
         ORDER BY proposal.queue_expires_at,part.kind DESC LIMIT 40 FOR UPDATE OF part SKIP LOCKED`,
        );
      for (const part of expired) {
        await this.setPartFailure(manager, part, 'failed', 'queue_deadline');
      }
      const operations: Recoverable[] = await manager.query(
        `SELECT o.id,o.phase,o.started_exchanges,o.request_hash,o.owner_fence,o.runtime_fence,o.api_owner_identity,p.kind,p.proposal_id
         FROM ai_generation_operations o JOIN teacher_flashcard_library_parts p ON p.id=o.flashcard_part_id
         WHERE o.owner_kind='flashcard_library' AND o.acknowledged_at IS NULL
           AND p.lease_until<=clock_timestamp() ORDER BY o.created_at LIMIT 30 FOR UPDATE OF o,p SKIP LOCKED`,
      );
      for (const operation of operations) {
        // A stale lease fences the exchange callback but does not prove closure after a POST began.
        const beforeDispatch = operation.started_exchanges === 0;
        const localClosed =
          beforeDispatch ||
          (operation.api_owner_identity &&
            isApiExecutorProvenClosed(operation.api_owner_identity));
        if (!localClosed) {
          await this.setPartFailure(
            manager,
            operation,
            'unknown',
            'local_closure_unproven',
            true,
          );
          await manager.query(
            "UPDATE nodia_ai_runtime_slots SET state='unknown' WHERE generation_operation_id=$1 AND fence=$2",
            [operation.id, operation.runtime_fence],
          );
          continue;
        }
        await this.setPartFailure(
          manager,
          operation,
          beforeDispatch ? 'failed' : 'unknown',
          beforeDispatch
            ? 'worker_lost_before_dispatch'
            : 'provider_outcome_unknown',
        );
        await this.closeOperation(
          manager,
          operation,
          beforeDispatch
            ? 'durable_before_dispatch'
            : 'proven_dead_local_owner',
          null,
        );
      }
      await manager.query(
        `WITH victims AS (SELECT id FROM teacher_flashcard_library_proposals
           WHERE expires_at<=clock_timestamp() AND purged_at IS NULL ORDER BY expires_at LIMIT 40 FOR UPDATE SKIP LOCKED),
         scrubbed AS (UPDATE teacher_flashcard_library_proposals SET origin=NULL,purged_at=clock_timestamp()
           WHERE id IN (SELECT id FROM victims) RETURNING id)
         UPDATE teacher_flashcard_library_parts p SET prompt=NULL,text_value=NULL,image_mime=NULL,image_bytes=NULL,
           purged_at=clock_timestamp() FROM scrubbed WHERE p.proposal_id=scrubbed.id`,
      );
    });
    if (failure) throw failure;
  }
}
