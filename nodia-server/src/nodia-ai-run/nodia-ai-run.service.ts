import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { NodiaAiRun } from './entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from './entities/nodia-ai-tool-call.entity.js';
import { NodiaAiEvent } from './entities/nodia-ai-event.entity.js';
/** Internal persisted work; no scheduler, claim, dispatch or model-facing CRUD. */
@Injectable()
export class NodiaAiRunService {
  findForConversation(
    manager: EntityManager,
    conversationId: string,
    runId: string,
  ) {
    return manager
      .getRepository(NodiaAiRun)
      .findOne({ where: { id: runId, conversation_id: conversationId } });
  }
  findToolCall(manager: EntityManager, runId: string, toolCallId: string) {
    return manager
      .getRepository(NodiaAiToolCall)
      .findOne({ where: { id: toolCallId, run_id: runId } });
  }
  findEvent(manager: EntityManager, conversationId: string, eventId: string) {
    return manager
      .getRepository(NodiaAiEvent)
      .findOne({ where: { id: eventId, conversation_id: conversationId } });
  }
}
