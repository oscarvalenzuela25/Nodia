import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { API_EXECUTOR_OWNER } from '../nodia-ai-adapter/api-nodia-ai-runtime-owner.js';
import type { NodiaAiApiConfiguration } from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import type { NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import type { CvTailoringDraft } from './engine/index.js';
import type { StartNodiaCvGenerationDto } from './dto/nodia-cv-generation.dto.js';
import { cvGenerationError } from './policies/nodia-cv-generation-errors.js';
import type {
  CvDraftReviewContent,
  CvGenerationClaim,
  CvGenerationRow,
  CvOperation,
} from './types/nodia-cv-generation.types.js';
import type { NodiaCvProfileDetail } from './types/nodia-cv-profile.types.js';

type Admission = {
  id: string;
  owner: string;
  sessionId: string;
  input: StartNodiaCvGenerationDto;
  profile: NodiaCvProfileDetail;
  config: NodiaAiApiConfiguration;
  scopeHash: string;
  requestHash: string;
  purposeVersion: string;
  promptVersion: string;
  qualification: boolean;
  waitSeconds: number;
};

const expireCoreFields = `state='expired',profile_id=NULL,profile_revision=NULL,auth_session_public_id=NULL,
  profile_snapshot=NULL,offer_text=NULL,vacancy_title=NULL,vacancy_company=NULL,
  draft=NULL,
  request_hash=NULL,selection_snapshot=NULL,error_code='generation_expired',updated_at=clock_timestamp()`;
const expireFields = `${expireCoreFields},review=NULL,review_revision=NULL,review_updated_by_actor_id=NULL`;

/** The operator has already checked that this restored CV store has no open work. */
export async function expireRestoredCvGenerations(manager: EntityManager) {
  const [schema]: { has_review: boolean }[] = await manager.query(
    `SELECT EXISTS(SELECT 1 FROM pg_attribute
       WHERE attrelid='public.nodia_cv_generations'::regclass AND attname='review_revision'
         AND attnum>0 AND NOT attisdropped) AS has_review`,
  );
  await manager.query(
    `UPDATE nodia_cv_generations SET ${schema?.has_review ? expireFields : expireCoreFields}
       WHERE state<>'expired'`,
  );
}

@Injectable()
export class NodiaCvGenerationStore {
  async status(
    manager: EntityManager,
    owner: string,
    reference: { id: string } | { key: string },
    lock = false,
  ) {
    const filter = 'id' in reference ? 'id' : 'request_key';
    const id = 'id' in reference ? reference.id : reference.key;
    const [row] = await manager.query<CvGenerationRow[]>(
      `SELECT * FROM nodia_cv_generations WHERE owner_user_id=$1 AND ${filter}=$2${lock ? ' FOR UPDATE' : ''}`,
      [owner, id],
    );
    return row ?? null;
  }

  async updateReview(
    manager: EntityManager,
    owner: string,
    id: string,
    revision: number,
    review: CvDraftReviewContent,
  ) {
    const [row] = await manager.query<CvGenerationRow[]>(
      `WITH changed AS (
        UPDATE nodia_cv_generations SET review=$4::jsonb,review_revision=review_revision+1,
          review_updated_by_actor_id=$1,updated_at=clock_timestamp()
        WHERE owner_user_id=$1 AND id=$2 AND review_revision=$3
          AND state='ready' AND profile_id IS NOT NULL AND expires_at>clock_timestamp()
        RETURNING *
      ) SELECT * FROM changed`,
      [owner, id, revision, JSON.stringify(review)],
    );
    return row ?? null;
  }

  async admit(manager: EntityManager, a: Admission) {
    const [row] = await manager.query<CvGenerationRow[]>(
      `INSERT INTO nodia_cv_generations (id,owner_user_id,auth_session_public_id,profile_id,profile_revision,
         request_key,request_hash,state,language,purpose_version,prompt_version,profile_snapshot,offer_text,vacancy_title,
         vacancy_company,selection_snapshot,configuration_generation,session_generation,resource_key,
         scope_hash,qualification,queue_expires_at,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'queued',$8,$9,$10,$11::jsonb,$12,$13,$14,$15::jsonb,$16,$17,
         $18,$19,$20,clock_timestamp()+$21*interval '1 second',clock_timestamp()+interval '24 hours')
       RETURNING *`,
      [
        a.id,
        a.owner,
        a.sessionId,
        a.profile.id,
        a.profile.revision,
        a.input.request_key,
        a.requestHash,
        a.input.language,
        a.purposeVersion,
        a.promptVersion,
        JSON.stringify(a.profile),
        a.input.offer_text,
        a.input.vacancy_title || null,
        a.input.vacancy_company || null,
        JSON.stringify(a.input.selection),
        a.config.configurationGeneration,
        a.config.sessionGeneration,
        a.config.resourceKey,
        a.scopeHash,
        a.qualification,
        a.waitSeconds,
      ],
    );
    return row;
  }

  async checkQueue(
    manager: EntityManager,
    owner: string,
    policy: NodiaAiRuntimePolicy,
  ) {
    const [counts] = await manager.query<{ total: number; personal: number }[]>(
      `WITH queued AS (
        SELECT owner_user_id AS actor FROM nodia_cv_generations WHERE state='queued' AND queue_expires_at>clock_timestamp()
        UNION ALL SELECT actor_id FROM teacher_generation_jobs WHERE state='queued'
        UNION ALL SELECT p.owner_user_id FROM teacher_flashcard_library_parts part
          JOIN teacher_flashcard_library_proposals p ON p.id=part.proposal_id
          WHERE part.state='queued' AND p.queue_expires_at>clock_timestamp()
        UNION ALL SELECT c.owner_id FROM nodia_ai_jobs j JOIN nodia_ai_conversations c ON c.id=j.conversation_id WHERE j.state IN ('ready','waiting') AND j.kind IN ('turn','execution')
            AND c.lifecycle='active' AND c.expires_at>clock_timestamp()
      ) SELECT count(*)::int AS total,count(*) FILTER(WHERE actor=$1)::int AS personal FROM queued`,
      [owner],
    );
    if (
      counts.total >= policy.queue.waiting_global ||
      counts.personal >= policy.queue.waiting_per_owner
    )
      cvGenerationError('generation_queue_busy', 429);
  }

  async next(manager: EntityManager, globalWorkers: number, onlyId?: string) {
    const [row] = await manager.query<CvGenerationRow[]>(
      `SELECT g.* FROM nodia_cv_generations g
       WHERE g.state='queued' AND g.queue_expires_at>clock_timestamp() AND g.expires_at>clock_timestamp()
       AND ($1::uuid IS NULL OR g.id=$1)
       AND NOT EXISTS (SELECT 1 FROM nodia_ai_runtime_slots s WHERE s.resource_key=g.resource_key AND s.state<>'free')
       AND NOT EXISTS (SELECT 1 FROM ai_generation_operations o WHERE o.actor_id=g.owner_user_id AND o.acknowledged_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM teacher_generation_jobs j WHERE j.actor_id=g.owner_user_id AND j.state IN ('running','unknown') AND j.blocks_duplicate)
       AND NOT EXISTS (SELECT 1 FROM nodia_ai_jobs j JOIN nodia_ai_conversations c ON c.id=j.conversation_id
         WHERE c.owner_id=g.owner_user_id AND j.state IN ('leased','unknown'))
       AND ((SELECT count(*) FROM nodia_ai_jobs WHERE state='leased')
         +(SELECT count(*) FROM teacher_generation_jobs WHERE state='running')
         +(SELECT count(*) FROM nodia_ai_runtime_slots s JOIN ai_generation_operations o ON o.id=s.generation_operation_id
           WHERE s.state='held' AND o.owner_kind IN ('flashcard_library','cv')))<$2
       ORDER BY g.created_at,g.id LIMIT 1 FOR UPDATE OF g SKIP LOCKED`,
      [onlyId ?? null, globalWorkers],
    );
    return row ?? null;
  }

  async hold(
    manager: EntityManager,
    claim: Omit<CvGenerationClaim, 'fence' | 'deadlineAt'>,
    policy: NodiaAiRuntimePolicy,
  ) {
    const { row, configuration, selection, workerId, executionHash } = claim;
    await manager.query(
      "INSERT INTO nodia_ai_runtime_slots(resource_key,state,fence) VALUES($1,'free',0) ON CONFLICT DO NOTHING",
      [row.resource_key],
    );
    const [slot] = await manager.query<{ state: string; fence: string }[]>(
      'SELECT state,fence FROM nodia_ai_runtime_slots WHERE resource_key=$1 FOR UPDATE',
      [row.resource_key],
    );
    if (slot?.state !== 'free') return null;
    const fence = (BigInt(slot.fence) + 1n).toString();
    const [timing] = await manager.query<{ deadline_at: Date }[]>(
      `WITH changed AS (UPDATE nodia_cv_generations SET state='running',
        deadline_at=least(expires_at,clock_timestamp()+$2*interval '1 second'),
        lease_until=least(expires_at,clock_timestamp()+least($2,$3)*interval '1 second'),
        updated_at=clock_timestamp() WHERE id=$1 RETURNING deadline_at)
       SELECT deadline_at FROM changed`,
      [
        row.id,
        policy.timing.provider_dispatch_seconds,
        policy.timing.lease_seconds,
      ],
    );
    await manager.query(
      `INSERT INTO ai_generation_operations (id,owner_kind,cv_generation_id,actor_id,auth_session_public_id,
        connection_id,selected_key_id,selection_snapshot,configuration_generation,session_generation,resource_key,
        worker_id,owner_fence,runtime_fence,phase,request_hash,exchange_limit,reserved_exchanges,api_owner_identity)
       VALUES($1,'cv',$1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,1,$11,'dispatch_armed',$12,1,1,$13::jsonb)`,
      [
        row.id,
        row.owner_user_id,
        row.auth_session_public_id,
        configuration.connectionId,
        configuration.keyId,
        JSON.stringify(selection),
        row.configuration_generation,
        row.session_generation,
        row.resource_key,
        workerId,
        fence,
        executionHash,
        JSON.stringify(API_EXECUTOR_OWNER),
      ],
    );
    await manager.query(
      `UPDATE nodia_ai_runtime_slots s SET state='held',generation_operation_id=$1,holder_worker_id=$2,
       fence=$3,lease_until=g.lease_until,external_operation_ref=($1::uuid)::text,updated_at=clock_timestamp()
       FROM nodia_cv_generations g WHERE s.resource_key=$4 AND g.id=$1`,
      [row.id, workerId, fence, row.resource_key],
    );
    return { ...claim, fence, deadlineAt: timing.deadline_at };
  }

  async owned(manager: EntityManager, claim: CvGenerationClaim) {
    const [row] = await manager.query<CvOperation[]>(
      `SELECT o.id,o.phase,o.started_exchanges,o.request_hash,o.runtime_fence,o.api_owner_identity,
        (s.state='held' AND g.state='running' AND g.profile_id IS NOT NULL AND
          g.deadline_at>clock_timestamp() AND g.lease_until>clock_timestamp()) AS valid_lease
       FROM ai_generation_operations o JOIN nodia_cv_generations g ON g.id=o.cv_generation_id
       JOIN nodia_ai_runtime_slots s ON s.resource_key=o.resource_key AND s.generation_operation_id=o.id
       WHERE o.id=$1 AND o.owner_kind='cv' AND o.acknowledged_at IS NULL AND o.worker_id=$2
        AND s.holder_worker_id=$2 AND o.runtime_fence=$3 AND s.fence=$3
        AND o.request_hash=$4 AND o.api_owner_identity=$5::jsonb FOR UPDATE OF o,g,s`,
      [
        claim.row.id,
        claim.workerId,
        claim.fence,
        claim.executionHash,
        JSON.stringify(API_EXECUTOR_OWNER),
      ],
    );
    return row ?? null;
  }

  async beforeExchange(manager: EntityManager, id: string) {
    await manager.query(
      "UPDATE ai_generation_operations SET phase='transport_open',started_exchanges=1,updated_at=clock_timestamp() WHERE id=$1",
      [id],
    );
  }

  async renew(manager: EntityManager, id: string, leaseSeconds: number) {
    await manager.query(
      `WITH renewed AS (UPDATE nodia_cv_generations SET lease_until=least(clock_timestamp()+$2*interval '1 second',deadline_at)
        WHERE id=$1 RETURNING lease_until)
       UPDATE nodia_ai_runtime_slots SET lease_until=renewed.lease_until FROM renewed WHERE generation_operation_id=$1`,
      [id, leaseSeconds],
    );
  }

  async fail(
    manager: EntityManager,
    id: string,
    state: 'failed' | 'unknown',
    code: string,
    keepLease = false,
  ) {
    await manager.query(
      `UPDATE nodia_cv_generations SET state=$2,draft=NULL,review=NULL,review_revision=NULL,
       review_updated_by_actor_id=NULL,error_code=$3,updated_at=clock_timestamp(),
       lease_until=CASE WHEN $4 THEN lease_until ELSE NULL END WHERE id=$1 AND state<>'expired'`,
      [id, state, code, keepLease],
    );
  }

  async publish(
    manager: EntityManager,
    row: CvGenerationRow,
    draft: CvTailoringDraft,
    responseHash: string,
  ) {
    await manager.query(
      `UPDATE nodia_cv_generations SET state='ready',draft=$2::jsonb,review=$3::jsonb,review_revision=1,
       error_code=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1`,
      [
        row.id,
        JSON.stringify(draft),
        JSON.stringify({
          included_fact_ids: draft.selectedFacts.map(({ id }) => id),
          evidence: [],
        } satisfies CvDraftReviewContent),
      ],
    );
    if (row.qualification) {
      await manager.query(
        `INSERT INTO nodia_cv_generation_qualifications(scope_hash,generation_id,response_hash)
         VALUES($1,$2,$3) ON CONFLICT(scope_hash) DO NOTHING`,
        [row.scope_hash, row.id, responseHash],
      );
    }
  }

  async close(
    manager: EntityManager,
    op: CvOperation,
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
      contract: 'nodia-cv-api-text/1',
      operation_id: op.id,
      request_hash: op.request_hash,
      owner: op.api_owner_identity,
      owner_fence: '1',
      runtime_fence: op.runtime_fence,
      local_transport_closed: true,
      closure_basis: basis,
      dispatch_not_started: op.started_exchanges === 0,
      remote_outcome: remote,
      response_hash: responseHash,
      observed_at: new Date().toISOString(),
    };
    const [freed] = await manager.query<{ resource_key: string }[]>(
      `WITH freed AS (UPDATE nodia_ai_runtime_slots SET state='free',generation_operation_id=NULL,holder_worker_id=NULL,
       lease_until=NULL,external_operation_ref=NULL,fence=fence+1,updated_at=clock_timestamp()
       WHERE generation_operation_id=$1 AND fence=$2 RETURNING resource_key) SELECT resource_key FROM freed`,
      [op.id, op.runtime_fence],
    );
    if (!freed) cvGenerationError('generation_lease_lost');
    await manager.query(
      `UPDATE ai_generation_operations SET phase='closed',terminal_proof=$2::jsonb,remote_outcome=$3,
       response_hash=$4,acknowledged_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1`,
      [op.id, JSON.stringify(proof), remote, responseHash],
    );
  }

  async markUnproven(manager: EntityManager, op: CvOperation) {
    await this.fail(manager, op.id, 'unknown', 'local_closure_unproven', true);
    await manager.query(
      "UPDATE nodia_ai_runtime_slots SET state='unknown',updated_at=clock_timestamp() WHERE generation_operation_id=$1 AND fence=$2",
      [op.id, op.runtime_fence],
    );
  }

  async expiredOperations(manager: EntityManager) {
    return manager.query<CvOperation[]>(
      `SELECT o.id,o.phase,o.started_exchanges,o.request_hash,o.runtime_fence,o.api_owner_identity
       FROM ai_generation_operations o JOIN nodia_cv_generations g ON g.id=o.cv_generation_id
       WHERE o.owner_kind='cv' AND o.acknowledged_at IS NULL AND g.lease_until<=clock_timestamp()
       ORDER BY g.lease_until,g.id LIMIT 30 FOR UPDATE OF o,g SKIP LOCKED`,
    );
  }

  async expire(manager: EntityManager) {
    await manager.query(
      `WITH stale AS (SELECT id FROM nodia_cv_generations WHERE state='queued' AND queue_expires_at<=clock_timestamp()
        ORDER BY queue_expires_at,id LIMIT 30 FOR UPDATE SKIP LOCKED)
       UPDATE nodia_cv_generations g SET state='failed',error_code='generation_queue_deadline',updated_at=clock_timestamp()
       FROM stale WHERE g.id=stale.id`,
    );
    await manager.query(
      `WITH due AS (SELECT id FROM nodia_cv_generations WHERE state<>'expired'
        AND (expires_at<=clock_timestamp() OR profile_id IS NULL)
        ORDER BY expires_at,id LIMIT 30 FOR UPDATE SKIP LOCKED)
       UPDATE nodia_cv_generations g SET ${expireFields} FROM due WHERE g.id=due.id`,
    );
  }

  async removeProfileContent(
    manager: EntityManager,
    owner: string,
    profile: string,
  ) {
    await manager.query(
      `UPDATE nodia_cv_generations SET ${expireFields} WHERE owner_user_id=$1 AND profile_id=$2`,
      [owner, profile],
    );
  }
}
