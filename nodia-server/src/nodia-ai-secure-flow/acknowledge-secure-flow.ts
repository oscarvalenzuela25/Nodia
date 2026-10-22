import { lockAuthority } from '../authorization/authority-transaction.js';
import { lockNodiaAiQueue } from '../nodia-ai-runtime/queue-lock.js';
import type { NodiaAiExecutionService } from '../nodia-ai-execution/nodia-ai-execution.service.js';
import type {
  ManageAiProviderSecureSessionUseCase,
  AiProviderSecureRequest,
} from '../ai-provider/use-case/manage-ai-provider-secure-session.use-case.js';
import { NodiaAiExecutionStep } from '../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import {
  secureDescriptor,
  type SecureFlowDescriptor,
} from './types/secure-flow.types.js';

export const terminalSecureStates: readonly string[] = [
  'completed',
  'cancelled',
  'expired',
  'failed',
];
export interface SecureFlowAcknowledgement {
  executionId: string;
  reference: string;
  actor: string;
  revision: number;
  request: AiProviderSecureRequest;
}
export function secureFlowAcknowledgement(
  executionId: string,
  revision: number,
  descriptor: SecureFlowDescriptor,
): SecureFlowAcknowledgement | null {
  return descriptor.native_request &&
    terminalSecureStates.includes(descriptor.status)
    ? {
        executionId,
        reference: descriptor.reference,
        actor: descriptor.actor_id,
        revision,
        request: { ...descriptor.native_request },
      }
    : null;
}
/** Commit first, acknowledge second. A failed/lost acknowledgement remains an outbox entry, never an operation failure. */
export async function acknowledgeSecureFlow(
  store: NodiaAiExecutionService,
  native: ManageAiProviderSecureSessionUseCase,
  target: SecureFlowAcknowledgement | null,
): Promise<boolean> {
  if (!target) return false;
  try {
    await native.acknowledgeRequest(target.request, target.actor);
    return await store.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const execution = await store.execution(
        manager,
        target.executionId,
        true,
      );
      if (!execution || execution.revision !== target.revision) return false;
      const steps = await store.steps(manager, target.executionId);
      if (steps.length !== 1) return false;
      const step = steps[0],
        descriptor = secureDescriptor(step.recovery_descriptor);
      if (
        descriptor.reference !== target.reference ||
        descriptor.actor_id !== target.actor ||
        !terminalSecureStates.includes(descriptor.status) ||
        !descriptor.native_request ||
        ['request_id', 'provider_id', 'provider_key', 'mode'].some(
          (key) =>
            descriptor.native_request![key] !==
            target.request[key as keyof AiProviderSecureRequest],
        )
      )
        return false;
      if (execution.conversation_id === null) {
        // The receipt/terminal witness was committed before acknowledgement. No expired chat content survives.
        await manager.query(
          `DELETE FROM nodia_ai_jobs WHERE kind='execution' AND
          (execution_id=$1::uuid OR (execution_id IS NULL AND recovery_descriptor->>'execution_id'=$2::text))`,
          [execution.id, execution.id],
        );
        await manager.query('DELETE FROM nodia_ai_executions WHERE id=$1', [
          execution.id,
        ]);
      } else {
        descriptor.native_request = null;
        step.recovery_descriptor = descriptor;
        await manager.getRepository(NodiaAiExecutionStep).save(step);
      }
      return true;
    });
  } catch {
    // Native proof must remain durable until this checkpoint can be retried by maintenance.
    return false;
  }
}
