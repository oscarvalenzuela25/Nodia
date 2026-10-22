import { Injectable } from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from './authorize-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiRunUseCase } from './project-nodia-ai-run.use-case.js';
import { conversationId } from '../types/conversation-id.js';
import { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
export { conversationId } from '../types/conversation-id.js';
@Injectable()
export class GetNodiaAiConversationUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly project: ProjectNodiaAiConversationUseCase,
    private readonly runs: ProjectNodiaAiRunUseCase,
    private readonly executions: GetNodiaAiExecutionUseCase,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string) {
    const key = conversationId(id);
    return this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const { actor, chat } = await this.access.execute(
        manager,
        identity,
        key,
        'read',
        'detail',
      );
      const run = await this.conversations.latestRun(manager, key);
      const active: { id: string }[] = await manager.query(
        `SELECT id FROM nodia_ai_executions WHERE conversation_id=$1 AND state IN ('queued','running','waiting_for_user','cancel_requested','unknown')`,
        [key],
      );
      return {
        conversation: this.project.execute(
          chat,
          actor.actorId !== chat.owner_id,
        ),
        current_run: run ? this.runs.execute(run) : null,
        active_execution: active.length
          ? await this.executions.load(manager, identity, active[0].id)
          : null,
      };
    });
  }
}
