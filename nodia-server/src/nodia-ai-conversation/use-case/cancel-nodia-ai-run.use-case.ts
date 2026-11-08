import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { publishNodiaAiRunChanged } from '../../nodia-ai-run/event-journal.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import { CancelNodiaAiRunDto } from '../dto/cancel-nodia-ai-run.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from './authorize-nodia-ai-conversation.use-case.js';
import { conversationId } from './get-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiRunUseCase } from './project-nodia-ai-run.use-case.js';

/** Requests a durable stop; only worker recovery/ACK may release an armed runtime. */
@Injectable()
export class CancelNodiaAiRunUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly project: ProjectNodiaAiRunUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id);
    validateNodiaAiDto(CancelNodiaAiRunDto, input);
    return this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const repository = manager.getRepository(NodiaAiRun);
      const initial = await repository.findOne({ where: { id: key } });
      if (!initial) throw new NotFoundException('nodia_ai:run_not_found');
      const { chat, actor } = await this.access.execute(
        manager,
        identity,
        initial.conversation_id,
        'write',
      );
      // The common queue/chat lock order serializes this intent with claims,
      // checkpoints and recovery. Lock the job before the run, as workers do.
      const job = chat.active_job_id
        ? await manager.getRepository(NodiaAiJob).findOne({
            where: { id: chat.active_job_id },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      const run = await repository.findOne({
        where: { id: key },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !run ||
        run.conversation_id !== chat.id ||
        run.actor_id !== actor.actorId
      )
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      if (
        [
          'completed',
          'failed',
          'cancelled',
          'unknown',
          'waiting_for_user',
        ].includes(run.state)
      )
        return {
          status: 'already_terminal' as const,
          run: this.project.execute(run),
        };
      if (
        !['queued', 'running', 'cancel_requested'].includes(run.state) ||
        !job ||
        job.kind !== 'turn' ||
        job.run_id !== run.id ||
        job.conversation_id !== chat.id ||
        !['ready', 'leased'].includes(job.state) ||
        run.retention_epoch !== chat.retention_epoch
      )
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      // The resource is the idempotency key: a stop cannot be withdrawn or
      // retargeted by changing client_request_id. Repeats create no new event.
      if (run.state === 'cancel_requested')
        return { status: 'accepted' as const, run: this.project.execute(run) };
      const changed: { id: string }[] = await manager.query(
        `WITH changed AS (UPDATE nodia_ai_runs SET state='cancel_requested',error_code=NULL
         WHERE id=$1 AND conversation_id=$2 AND actor_id=$3 AND revision=$4
         AND state=$5 AND retention_epoch=$6 RETURNING id) SELECT id FROM changed`,
        [
          run.id,
          chat.id,
          actor.actorId,
          run.revision,
          run.state,
          chat.retention_epoch,
        ],
      );
      if (changed.length !== 1)
        throw new ConflictException('nodia_ai:revision_conflict');
      run.state = 'cancel_requested';
      run.error_code = null;
      run.revision = await publishNodiaAiRunChanged(manager, {
        conversationId: chat.id,
        runId: run.id,
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
      // No grant/slot/fence changes here. A cancellation received after dispatch
      // remains uncertain until the existing native reconciliation owns its ACK.
      return { status: 'accepted' as const, run: this.project.execute(run) };
    });
  }
}
