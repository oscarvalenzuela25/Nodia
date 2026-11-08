import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { NodiaAiExecution } from '../nodia-ai-confirmation/entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from '../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import { NodiaAiJob } from '../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiExecutionGrant } from '../nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.js';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiExecutionClaim } from './types/execution-claim.types.js';
import { NodiaAiConversation } from '../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import { nodiaAiCoreOperationIdentity } from '../nodia-ai-proposal/types/local-operation.types.js';

@Injectable()
export class NodiaAiExecutionService {
  constructor(private readonly source: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.source.transaction(work);
  }
  /** Unlocked hint only; the frozen steps and exclusive proof are rechecked in the transaction. */
  async requiresExclusiveAuthority(executionId: string): Promise<boolean> {
    return this.source.transaction(async (manager) => {
      await manager.query("SET LOCAL statement_timeout = '5s'");
      const steps = await manager.getRepository(NodiaAiExecutionStep).find({
        where: { execution_id: executionId },
        select: { tool_name: true },
        order: { position: 'ASC' },
        take: 9,
      });
      return steps.some((step) => nodiaAiCoreOperationIdentity(step.tool_name) !== null);
    });
  }
  chat(manager: EntityManager, id: string) {
    return manager
      .getRepository(NodiaAiConversation)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  async candidate(
    manager: EntityManager,
    globalLimit: number,
    ownerLimit: number,
    waitSeconds: number,
  ) {
    const teacher = await hasGenerationBridge(manager);
    const rows: {
      id: string;
      execution_id: string;
      conversation_id: string;
    }[] = await manager.query(
      `SELECT j.id,j.execution_id,j.conversation_id FROM nodia_ai_jobs j
       JOIN nodia_ai_conversations c ON c.id=j.conversation_id AND c.active_job_id=j.id
       JOIN nodia_ai_executions e ON e.id=j.execution_id
       WHERE j.kind='execution' AND j.state='ready' AND e.state='queued'
         AND NOT COALESCE(j.recovery_descriptor ? 'restore_quarantined',false)
         AND j.available_at<=clock_timestamp() AND j.deadline_at>clock_timestamp()
         AND j.available_at+$3*interval '1 second'>clock_timestamp()
         AND c.expires_at>clock_timestamp() AND c.lifecycle='active'
           AND ((SELECT count(*) FROM nodia_ai_jobs a WHERE a.state='leased')${teacher ? "+(SELECT count(*) FROM teacher_generation_jobs WHERE state='running')" : ''})<$1
           AND ((SELECT count(*) FROM nodia_ai_jobs a JOIN nodia_ai_conversations ac ON ac.id=a.conversation_id
                WHERE a.state IN ('leased','unknown') AND ac.owner_id=c.owner_id)${teacher ? "+(SELECT count(*) FROM teacher_generation_jobs WHERE state IN ('running','unknown') AND blocks_duplicate=true AND actor_id=c.owner_id)" : ''})<$2
       ORDER BY j.available_at,j.id LIMIT 1`,
      [globalLimit, ownerLimit, waitSeconds],
    );
    return rows[0] ?? null;
  }
  execution(manager: EntityManager, id: string, lock = false) {
    return manager.getRepository(NodiaAiExecution).findOne({
      where: { id },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }
  jobs(manager: EntityManager, executionId: string) {
    return manager.getRepository(NodiaAiJob).find({
      where: { execution_id: executionId },
      lock: { mode: 'pessimistic_write' },
    });
  }
  steps(manager: EntityManager, executionId: string) {
    return manager.getRepository(NodiaAiExecutionStep).find({
      where: { execution_id: executionId },
      order: { position: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }
  grants(manager: EntityManager, executionId: string) {
    return manager.getRepository(NodiaAiExecutionGrant).find({
      where: { execution_id: executionId },
      lock: { mode: 'pessimistic_write' },
    });
  }
  async sessionExpiry(manager: EntityManager, actor: string, session: string) {
    const rows: { expires_at: Date }[] = await manager.query(
      'SELECT expires_at FROM auth_sessions WHERE public_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp()',
      [session, actor],
    );
    return rows[0] ? new Date(rows[0].expires_at) : null;
  }
  async now(manager: EntityManager): Promise<Date> {
    const rows: { now: Date }[] = await manager.query(
      'SELECT clock_timestamp() AS now',
    );
    return new Date(rows[0].now);
  }
  async hasAttempts(manager: EntityManager, jobId: string): Promise<boolean> {
    const [row]: { present: boolean }[] = await manager.query(
      'SELECT EXISTS(SELECT 1 FROM nodia_ai_job_attempts WHERE job_id=$1) AS present',
      [jobId],
    );
    return row.present;
  }
  async confirmedBySession(
    manager: EntityManager,
    execution: NodiaAiExecution,
    sessionId: string | null,
  ): Promise<boolean> {
    const [row]: { present: boolean }[] = await manager.query(
      `SELECT EXISTS(SELECT 1 FROM nodia_ai_confirmation_challenges
        WHERE proposal_id=$1 AND proposal_revision=$2 AND actor_id=$3 AND ($4::uuid IS NULL OR session_public_id=$4)
        AND expected_hash=$5 AND consumed_at IS NOT NULL AND consumed_at>=created_at
        AND consumed_at<expires_at AND consumed_at<=$6) AS present`,
      [
        execution.origin_proposal_id,
        execution.origin_proposal_revision,
        execution.actor_id,
        sessionId,
        execution.proposal_hash,
        execution.created_at,
      ],
    );
    return row.present;
  }
  async bind(
    manager: EntityManager,
    step: NodiaAiExecutionStep,
    command: NodiaAiJsonObject,
    hash: string,
  ): Promise<void> {
    const rows: { id: string }[] = await manager.query(
      `WITH changed AS (UPDATE nodia_ai_execution_steps SET bound_command=$2::jsonb,bound_command_hash=$3
       WHERE id=$1 AND bound_command IS NULL AND bound_command_hash IS NULL
         AND state IN ('ready','running') AND minimal_receipt IS NULL
         AND dispatched_at IS NULL AND completed_at IS NULL RETURNING id)
       SELECT id FROM changed`,
      [step.id, JSON.stringify(command), hash],
    );
    if (rows.length !== 1)
      throw new ConflictException('nodia_ai:execution_conflict');
  }
  async complete(
    manager: EntityManager,
    execution: NodiaAiExecution,
    step: NodiaAiExecutionStep,
    job: NodiaAiJob,
    grant: NodiaAiExecutionGrant,
    boundHash: string,
    receipt: NodiaAiJsonObject,
    now: Date,
    claim?: NodiaAiExecutionClaim,
    nextPosition?: number,
  ): Promise<void> {
    const continuing = nextPosition !== undefined;
    const changed: {
      step_count: string;
      execution_count: string;
      job_count: string;
      grant_count: string;
      chat_count: string;
      next_step_count: string;
    }[] = await manager.query(
      `WITH step AS (
        UPDATE nodia_ai_execution_steps SET state='completed',bound_command_hash=$4,minimal_receipt=$5::jsonb,
          dispatched_at=$6,completed_at=$6,error_code=NULL
        WHERE id=$1 AND execution_id=$2 AND state=$10 AND lease_fence=$11 RETURNING id
      ), next_step AS (
        UPDATE nodia_ai_execution_steps SET state='ready'
        WHERE execution_id=$2 AND position=$15 AND state IN ('ready','blocked')
          AND minimal_receipt IS NULL AND dispatched_at IS NULL AND completed_at IS NULL RETURNING id
      ), execution AS (
        UPDATE nodia_ai_executions SET state=CASE WHEN $15::integer IS NULL THEN 'completed' ELSE 'queued' END,
          revision=revision+1,completed_at=CASE WHEN $15::integer IS NULL THEN $6::timestamptz ELSE NULL END
        WHERE id=$2 AND state=$12 AND revision=$7 RETURNING id
      ), job AS (
        UPDATE nodia_ai_jobs SET state=CASE WHEN $15::integer IS NULL THEN 'done' ELSE 'ready' END,
          stage_seq=COALESCE($15,stage_seq),available_at=CASE WHEN $15::integer IS NULL THEN available_at ELSE $6::timestamptz END,
          lease_owner=NULL,lease_until=NULL,updated_at=$6
        WHERE id=$3 AND execution_id=$2 AND state=$13 AND fence=$11
          AND lease_owner IS NOT DISTINCT FROM $14::uuid RETURNING id
      ), grant_change AS (
        UPDATE nodia_ai_execution_grants SET revoked_at=CASE WHEN $15::integer IS NULL THEN $6::timestamptz ELSE NULL END
          WHERE id=$8 AND execution_id=$2 AND revoked_at IS NULL RETURNING id
      ), chat AS (
        UPDATE nodia_ai_conversations SET active_job_id=CASE WHEN $15::integer IS NULL THEN NULL ELSE $3::uuid END
          WHERE id=$9 AND active_job_id=$3 RETURNING id
      ) SELECT (SELECT count(*)::text FROM step) AS step_count,
        (SELECT count(*)::text FROM execution) AS execution_count,
        (SELECT count(*)::text FROM job) AS job_count,
        (SELECT count(*)::text FROM grant_change) AS grant_count,
        (SELECT count(*)::text FROM chat) AS chat_count,
        (SELECT count(*)::text FROM next_step) AS next_step_count`,
      [
        step.id,
        execution.id,
        job.id,
        boundHash,
        JSON.stringify(receipt),
        now,
        execution.revision,
        grant.id,
        execution.conversation_id,
        claim ? 'running' : 'ready',
        claim?.fence ?? '0',
        claim ? 'running' : 'queued',
        claim ? 'leased' : 'ready',
        claim?.workerId ?? null,
        continuing ? nextPosition : null,
      ],
    );
    if (
      changed.length !== 1 ||
      Object.entries(changed[0]).some(
        ([name, count]) =>
          count !== (name === 'next_step_count' && !continuing ? '0' : '1'),
      )
    )
      throw new ConflictException('nodia_ai:execution_conflict');
    if (claim) {
      const rows: { id: string }[] = await manager.query(
        `WITH changed AS (UPDATE nodia_ai_job_attempts SET phase='completed',ended_at=$5,error_code=NULL
         WHERE id=$1 AND job_id=$2 AND worker_id=$3 AND fence=$4 AND phase='claimed' AND ended_at IS NULL RETURNING id)
         SELECT id FROM changed`,
        [claim.attemptId, claim.jobId, claim.workerId, claim.fence, now],
      );
      if (rows.length !== 1)
        throw new ConflictException('nodia_ai:execution_conflict');
    }
  }
}
import { hasGenerationBridge } from '../ai-generation/chat-generation-ownership.js';
