import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { conversationId } from '../../nodia-ai-conversation/types/conversation-id.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { NodiaAiProposalRevision } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-revision.entity.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiExecution } from '../entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from '../entities/nodia-ai-execution-step.entity.js';
import { NodiaAiConfirmationService } from '../nodia-ai-confirmation.service.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
import { GetNodiaAiExecutionUseCase } from './get-nodia-ai-execution.use-case.js';
import {
  ValidateNodiaAiConfirmationUseCase,
  type NodiaAiConfirmRequest,
} from './validate-nodia-ai-confirmation.use-case.js';
@Injectable()
export class ConfirmNodiaAiProposalUseCase {
  constructor(
    private readonly store: NodiaAiConfirmationService,
    private readonly get: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiConfirmationUseCase,
    private readonly proposalValidator: ValidateNodiaAiProposalUseCase,
    private readonly availability: NodiaAiConfirmationAvailabilityUseCase,
    private readonly status: GetNodiaAiExecutionUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id);
    const request = this.validate.input(input, 'confirm');
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      await lockNodiaAiQueue(manager);
      const loaded = await this.get.load(manager, identity, key, 'write');
      const { proposal, revision, steps, actor, chat, now, context } = loaded;
      const duplicate = await this.store.request(
        manager,
        actor.actorId,
        request.client_request_id,
      );
      const origin =
        duplicate ?? (await this.store.origin(manager, proposal.id));
      if (origin) {
        this.assertIntent(origin, actor.actorId, proposal.id, request);
        if (!duplicate)
          throw new ConflictException('nodia_ai:proposal_already_confirmed');
        const result = {
          execution: await this.status.project(manager, origin, now, steps),
        };
        this.validate.assert('ExecutionAccepted', result, true);
        return result;
      }
      if (
        proposal.current_revision !== request.proposal_revision ||
        revision.hash !== request.expected_hash
      )
        throw new ConflictException('nodia_ai:revision_conflict');
      if (revision.state !== 'ready')
        throw new ConflictException('nodia_ai:proposal_not_ready');
      if (now >= revision.expires_at)
        throw new GoneException('nodia_ai:proposal_expired');
      if (chat.active_job_id)
        throw new ConflictException('nodia_ai:conversation_busy');
      this.availability.require(steps, revision.catalog_version);
      if (steps.length * 2 + 4 > this.policy.results.outbox_events_per_activity)
        throw new ConflictException('nodia_ai:execution_limit');
      const digest = createHash('sha256')
        .update(request.confirmation_token)
        .digest('hex');
      const challenge = await this.store.challenge(manager, digest);
      if (
        !challenge ||
        challenge.proposal_id !== proposal.id ||
        challenge.proposal_revision !== revision.revision ||
        challenge.actor_id !== actor.actorId ||
        challenge.session_public_id !== actor.sessionId ||
        challenge.expected_hash !== revision.hash ||
        challenge.consumed_at ||
        now >= challenge.expires_at
      )
        throw new ForbiddenException('nodia_ai:confirmation_invalid');
      const sessionExpiry = await this.store.sessionExpiry(
        manager,
        actor.actorId,
        actor.sessionId,
      );
      if (!sessionExpiry)
        throw new UnauthorizedException('auth:session_expired');
      for (const step of steps)
        await this.proposalValidator
          .preparer(step.tool_name, step.contract_hash)
          .verifyPreconditions(storedStep(step), context);
      // Material checks can cross a short-lived challenge/session boundary.
      const admissionTime = await this.store.now(manager);
      if (admissionTime >= challenge.expires_at)
        throw new ForbiddenException('nodia_ai:confirmation_invalid');
      if (
        admissionTime >= revision.expires_at ||
        admissionTime >= chat.expires_at
      )
        throw new GoneException('nodia_ai:proposal_expired');
      if (admissionTime >= sessionExpiry)
        throw new UnauthorizedException('auth:session_expired');
      const [counts]: { global_waiting: string; owner_waiting: string }[] =
        await manager.query(
          `SELECT count(*) FILTER(WHERE j.state IN ('ready','waiting'))::text AS global_waiting,
      count(*) FILTER(WHERE j.state IN ('ready','waiting') AND c.owner_id=$1)::text AS owner_waiting
      FROM nodia_ai_jobs j JOIN nodia_ai_conversations c ON c.id=j.conversation_id WHERE j.kind IN ('turn','execution') AND c.lifecycle='active' AND c.expires_at>$2`,
          [actor.actorId, now],
        );
      if (
        Number(counts.global_waiting) >= this.policy.queue.waiting_global ||
        Number(counts.owner_waiting) >= this.policy.queue.waiting_per_owner
      )
        throw new HttpException(
          {
            message: 'nodia_ai:execution_limit',
            retry_after_seconds: this.policy.queue.local_retry_after_seconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const execution = Object.assign(new NodiaAiExecution(), {
        id: randomUUID(),
        conversation_id: chat.id,
        proposal_id: proposal.id,
        origin_conversation_id: chat.id,
        origin_proposal_id: proposal.id,
        origin_proposal_revision: revision.revision,
        proposal_hash: revision.hash,
        actor_id: actor.actorId,
        chat_owner_id: chat.owner_id,
        client_request_id: request.client_request_id,
        catalog_version: revision.catalog_version,
        revision: 1,
        state: 'queued',
        minimal_scope: {
          schema_version: 1,
          steps: steps.map((step) => ({
            step_id: step.id,
            tool_name: step.tool_name,
            contract_hash: step.contract_hash,
            scope: step.scope,
          })),
        },
        prior_execution_id: proposal.prior_execution_id ?? null,
        created_at: now,
        completed_at: null,
        retention_epoch: chat.retention_epoch,
      });
      const executionSteps = steps.map((step) =>
        Object.assign(new NodiaAiExecutionStep(), {
          id: step.id,
          execution_id: execution.id,
          source_step_id: step.id,
          position: step.position,
          tool_name: step.tool_name,
          template_hash: this.validate.hash({
            command_template: step.command_template,
            output_bindings: step.output_bindings,
            preconditions: step.preconditions,
          }),
          bound_command_hash: null,
          bound_command: null,
          native_request_key: randomUUID(),
          state: (step.public_step.depends_on as unknown[]).length
            ? 'blocked'
            : 'ready',
          minimal_scope: step.scope,
          minimal_receipt: null,
          recovery_descriptor: null,
          lease_fence: '0',
          error_code: null,
          dispatched_at: null,
          completed_at: null,
        }),
      );
      const deadline = new Date(
        Math.min(
          now.getTime() + this.policy.timing.execution_admission_seconds * 1000,
          chat.expires_at.getTime(),
          sessionExpiry.getTime(),
        ),
      );
      const jobId = randomUUID();
      const modules = [
        ...new Set(
          steps.flatMap(
            (step) =>
              this.proposalValidator.preparer(
                step.tool_name,
                step.contract_hash,
              ).moduleRoutes,
          ),
        ),
      ].sort();
      const operations = [
        ...new Set(steps.map((step) => step.tool_name)),
      ].sort();
      await this.store.create(manager, execution, executionSteps);
      await manager.query(
        'UPDATE nodia_ai_confirmation_challenges SET consumed_at=$2 WHERE id=$1 AND consumed_at IS NULL',
        [challenge.id, now],
      );
      await manager.getRepository(NodiaAiProposalRevision).update(
        {
          proposal_id: proposal.id,
          revision: revision.revision,
          state: 'ready',
        },
        { state: 'confirmed' },
      );
      await manager.query(
        `INSERT INTO nodia_ai_execution_grants(id,actor_id,session_public_id,run_id,execution_id,command_set_hash,allowed_modules,allowed_operations,allowed_scope,policy_version,expires_at,revoked_at,created_at)
      VALUES($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,NULL,$11)`,
        [
          randomUUID(),
          actor.actorId,
          actor.sessionId,
          execution.id,
          revision.hash,
          JSON.stringify(modules),
          JSON.stringify(operations),
          JSON.stringify(execution.minimal_scope),
          this.policy.policyVersion,
          deadline,
          now,
        ],
      );
      await manager.query(
        `INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,run_id,execution_id,storage_key,storage_generation,recovery_descriptor,state,available_at,lease_owner,lease_until,fence,attempt_count,deadline_at,created_at,updated_at,stage_key,stage_seq)
      VALUES($1,'execution',$2,$3,NULL,$4,NULL,NULL,NULL,'ready',$5,NULL,NULL,0,0,$6,$5,$5,'execution_step',1)`,
        [
          jobId,
          `execution:${execution.id}`,
          chat.id,
          execution.id,
          now,
          deadline,
        ],
      );
      await manager.query(
        'UPDATE nodia_ai_conversations SET active_job_id=$2 WHERE id=$1',
        [chat.id, jobId],
      );
      await appendNodiaAiExecutionEvent(manager, {
        conversationId: chat.id,
        executionId: execution.id,
        eventKey: `execution:${execution.id}:1:queued`,
        payload: { revision: 1, state: 'queued', error: null },
        moduleRoutes: modules,
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
      const result = {
        execution: await this.status.project(manager, execution, now, steps),
      };
      this.validate.assert('ExecutionAccepted', result, true);
      return result;
    });
  }
  private assertIntent(
    execution: NodiaAiExecution,
    actor: string,
    proposalId: string,
    request: NodiaAiConfirmRequest,
  ) {
    if (
      execution.actor_id !== actor ||
      execution.origin_proposal_id !== proposalId ||
      execution.origin_proposal_revision !== request.proposal_revision ||
      execution.proposal_hash !== request.expected_hash
    )
      throw new ConflictException('nodia_ai:request_conflict');
  }
}
