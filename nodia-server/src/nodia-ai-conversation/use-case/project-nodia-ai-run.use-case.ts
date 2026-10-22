import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { ValidateNodiaAiSnapshotsUseCase } from './validate-nodia-ai-snapshots.use-case.js';
@Injectable()
export class ProjectNodiaAiRunUseCase {
  constructor(private readonly snapshots: ValidateNodiaAiSnapshotsUseCase) {}
  execute(run: NodiaAiRun) {
    const usage = {
      tool_calls: run.tool_calls_used,
      mcp_rpc_messages: run.mcp_rpc_messages_used,
      provider_dispatches: run.provider_dispatches_used,
      compactions: run.compactions_used,
      delegations: run.delegations_used,
    };
    try {
      this.snapshots.execute(
        {
          base_selection: run.selection_snapshot,
          routing: run.routing_snapshot,
          budget: run.budget_snapshot,
          usage,
          stage: null,
        },
        run.budget_snapshot,
      );
      if (
        ![
          'queued',
          'running',
          'waiting_for_user',
          'completed',
          'failed',
          'cancel_requested',
          'cancelled',
          'unknown',
        ].includes(run.state)
      )
        throw Error();
      return {
        run_id: run.id,
        conversation_id: run.conversation_id,
        user_message_id: run.user_message_id,
        assistant_message_id: run.assistant_message_id,
        revision: run.revision,
        selection: { ...run.selection_snapshot },
        catalog_version: run.catalog_version,
        state: run.state,
        phase: run.phase,
        deadline_at: run.deadline_at.toISOString(),
        created_at: run.created_at.toISOString(),
        completed_at: run.completed_at?.toISOString() ?? null,
        error: run.error_code
          ? {
              code: run.error_code,
              message_key: run.error_code.startsWith('nodia_ai:') ? run.error_code : `nodia_ai:${run.error_code}`,
              field_errors: [],
              retry_action: run.state === 'unknown' ? 'recover_status' : 'none',
              correlation_id: run.id,
            }
          : null,
        routing: structuredClone(run.routing_snapshot),
        budget_limits: { ...run.budget_snapshot },
        budget_used: usage,
        active_stage: null,
      };
    } catch {
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    }
  }
}
