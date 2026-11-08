import { BadRequestException, Injectable } from '@nestjs/common';
import {
  NodiaAiSnapshotsDto,
  NodiaAiBudgetSnapshotDto,
} from '../dto/nodia-ai-snapshots.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import type {
  NodiaAiBudgetSnapshot,
  NodiaAiSelection,
} from '../types/nodia-ai-persistence.types.js';
const budgetKeys = [
  'tool_calls',
  'mcp_rpc_messages',
  'provider_dispatches',
  'compactions',
  'delegations',
] as const;
function exactSelection(value: {
  connection_id: string;
  mode: string;
  model_id: string;
  effort_id?: string | null;
}): asserts value is NodiaAiSelection {
  if (value.effort_id === undefined)
    throw new BadRequestException('nodia_ai:invalid_input');
}
function sameSelection(left: NodiaAiSelection, right: NodiaAiSelection) {
  return (
    left.connection_id === right.connection_id &&
    left.mode === right.mode &&
    left.model_id === right.model_id &&
    left.effort_id === right.effort_id
  );
}
/** Structural/semantic snapshot validation only; admission, fencing and dispatch belong to AI10..12. */
@Injectable()
export class ValidateNodiaAiSnapshotsUseCase {
  execute(input: unknown, maximumBudget: NodiaAiBudgetSnapshot) {
    const dto = validateNodiaAiDto(NodiaAiSnapshotsDto, input);
    const maximum = validateNodiaAiDto(NodiaAiBudgetSnapshotDto, maximumBudget);
    const invalid = () => new BadRequestException('nodia_ai:invalid_input');
    exactSelection(dto.base_selection);
    if (dto.routing.enabled || dto.routing.target !== null) throw invalid();
    for (const key of budgetKeys)
      if (dto.budget[key] > maximum[key] || dto.usage[key] > dto.budget[key])
        throw invalid();
    if (
      dto.budget.provider_dispatches < 1 ||
      dto.budget.delegations > 1 ||
      dto.budget.compactions > 1
    )
      throw invalid();
    if (dto.stage) {
      exactSelection(dto.stage.selection);
      if (dto.stage.routing_phase === 'base') {
        if (!sameSelection(dto.stage.selection, dto.base_selection))
          throw invalid();
      } else throw invalid();
    }
    return dto;
  }
}
