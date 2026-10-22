import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { NodiaAiExecution } from './entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from './entities/nodia-ai-execution-step.entity.js';
import { NodiaAiConfirmationChallenge } from './entities/nodia-ai-confirmation-challenge.entity.js';
import { NodiaAiJob } from '../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
@Injectable()
export class NodiaAiConfirmationService {
  constructor(private readonly source: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.source.transaction(work);
  }
  execution(manager: EntityManager, id: string) {
    return manager.getRepository(NodiaAiExecution).findOneBy({ id });
  }
  request(manager: EntityManager, actor: string, clientRequestId: string) {
    return manager
      .getRepository(NodiaAiExecution)
      .findOneBy({ actor_id: actor, client_request_id: clientRequestId });
  }
  origin(manager: EntityManager, proposalId: string) {
    return manager
      .getRepository(NodiaAiExecution)
      .findOneBy({ origin_proposal_id: proposalId });
  }
  steps(manager: EntityManager, executionId: string) {
    return manager.getRepository(NodiaAiExecutionStep).find({
      where: { execution_id: executionId },
      order: { position: 'ASC' },
    });
  }
  lockJobs(manager: EntityManager, executionId: string) {
    return manager.getRepository(NodiaAiJob).find({
      where: { execution_id: executionId },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }
  lockExecution(manager: EntityManager, id: string) {
    return manager
      .getRepository(NodiaAiExecution)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  lockSteps(manager: EntityManager, executionId: string) {
    return manager.getRepository(NodiaAiExecutionStep).find({
      where: { execution_id: executionId },
      order: { position: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }
  async executionEventCount(
    manager: EntityManager,
    executionId: string,
    limit: number,
  ): Promise<number> {
    const rows: { execution_event_count: string }[] = await manager.query(
      `SELECT count(*)::text AS execution_event_count FROM
       (SELECT id FROM nodia_ai_events WHERE execution_id=$1 LIMIT $2) bounded_events`,
      [executionId, limit],
    );
    const count = Number(rows[0]?.execution_event_count);
    if (
      rows.length !== 1 ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > limit
    )
      throw new Error('nodia_ai:invalid_persisted_state');
    return count;
  }
  async sessionExpiry(
    manager: EntityManager,
    actorId: string,
    sessionId: string,
  ): Promise<Date | null> {
    const rows: { expires_at: Date }[] = await manager.query(
      'SELECT expires_at FROM auth_sessions WHERE public_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp()',
      [sessionId, actorId],
    );
    return rows[0] ? new Date(rows[0].expires_at) : null;
  }
  async now(manager: EntityManager): Promise<Date> {
    const rows: { now: Date }[] = await manager.query(
      'SELECT clock_timestamp() AS now',
    );
    return new Date(rows[0].now);
  }
  challenge(manager: EntityManager, digest: string) {
    return manager.getRepository(NodiaAiConfirmationChallenge).findOne({
      where: { token_hash: digest },
      lock: { mode: 'pessimistic_write' },
    });
  }
  async issue(
    manager: EntityManager,
    challenge: NodiaAiConfirmationChallenge,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO nodia_ai_confirmation_challenges (id,proposal_id,proposal_revision,actor_id,session_public_id,expected_hash,token_hash,expires_at,consumed_at,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9)
    ON CONFLICT (proposal_id,proposal_revision,actor_id,session_public_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,expected_hash=EXCLUDED.expected_hash,expires_at=EXCLUDED.expires_at,consumed_at=NULL,created_at=EXCLUDED.created_at`,
      [
        challenge.id,
        challenge.proposal_id,
        challenge.proposal_revision,
        challenge.actor_id,
        challenge.session_public_id,
        challenge.expected_hash,
        challenge.token_hash,
        challenge.expires_at,
        challenge.created_at,
      ],
    );
  }
  async create(
    manager: EntityManager,
    execution: NodiaAiExecution,
    steps: readonly NodiaAiExecutionStep[],
  ): Promise<void> {
    await manager.query(
      `INSERT INTO nodia_ai_executions(id,conversation_id,proposal_id,origin_conversation_id,origin_proposal_id,origin_proposal_revision,proposal_hash,actor_id,chat_owner_id,client_request_id,catalog_version,revision,state,minimal_scope,prior_execution_id,created_at,completed_at,retention_epoch)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        execution.id,
        execution.conversation_id,
        execution.proposal_id,
        execution.origin_conversation_id,
        execution.origin_proposal_id,
        execution.origin_proposal_revision,
        execution.proposal_hash,
        execution.actor_id,
        execution.chat_owner_id,
        execution.client_request_id,
        execution.catalog_version,
        execution.revision,
        execution.state,
        execution.minimal_scope,
        execution.prior_execution_id,
        execution.created_at,
        execution.completed_at,
        execution.retention_epoch,
      ],
    );
    await manager.query(
      `INSERT INTO nodia_ai_execution_steps(id,execution_id,source_step_id,position,tool_name,template_hash,bound_command_hash,native_request_key,state,minimal_scope,minimal_receipt,recovery_descriptor,lease_fence,error_code,dispatched_at,completed_at)
      SELECT id,execution_id,source_step_id,position,tool_name,template_hash,bound_command_hash,native_request_key,state,minimal_scope,minimal_receipt,recovery_descriptor,lease_fence,error_code,dispatched_at,completed_at
      FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,execution_id uuid,source_step_id uuid,position integer,tool_name text,template_hash char(64),bound_command_hash char(64),native_request_key uuid,state text,minimal_scope jsonb,minimal_receipt jsonb,recovery_descriptor jsonb,lease_fence bigint,error_code text,dispatched_at timestamptz,completed_at timestamptz)`,
      [JSON.stringify(steps)],
    );
  }
}
