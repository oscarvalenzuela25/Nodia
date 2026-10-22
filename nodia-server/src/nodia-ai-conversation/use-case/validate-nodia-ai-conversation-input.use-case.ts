import { Injectable } from '@nestjs/common';
import { CreateNodiaAiConversationDto } from '../dto/create-nodia-ai-conversation.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import type { NodiaAiSelection } from '../types/nodia-ai-persistence.types.js';
export interface NodiaAiConversationCreateCommand {
  client_request_id: string;
  title: string | null;
  selection: NodiaAiSelection | null;
}
@Injectable()
export class ValidateNodiaAiConversationInputUseCase {
  execute(input: unknown): NodiaAiConversationCreateCommand {
    const dto = validateNodiaAiDto(CreateNodiaAiConversationDto, input);
    return {
      client_request_id: dto.client_request_id.toLowerCase(),
      title: dto.title ?? null,
      selection: dto.selection
        ? {
            connection_id: dto.selection.connection_id,
            mode: dto.selection.mode,
            model_id: dto.selection.model_id,
            effort_id: dto.selection.effort_id ?? null,
          }
        : null,
    };
  }
}
