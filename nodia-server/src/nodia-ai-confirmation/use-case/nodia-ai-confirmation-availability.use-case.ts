import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import { NODIA_AI_WORKFLOW_CATALOG_VERSION } from '../../nodia-ai-proposal/types/workflow.types.js';
import { nodiaAiSecureOperationIdentity } from '../../nodia-ai-proposal/types/secure-operation.types.js';
import {
  NODIA_AI_EXECUTION_ADMISSION,
  type NodiaAiExecutionAdmission,
} from '../types/execution-admission.types.js';
@Injectable()
export class NodiaAiConfirmationAvailabilityUseCase {
  private readonly registrations: ReadonlyMap<
    string,
    NodiaAiExecutionAdmission
  >;
  constructor(
    @Inject(NODIA_AI_EXECUTION_ADMISSION)
    registrations: readonly NodiaAiExecutionAdmission[],
  ) {
    const result = new Map<string, NodiaAiExecutionAdmission>();
    for (const item of registrations) {
      if (
        !item.toolName ||
        !/^[a-f0-9]{64}$/.test(item.contractHash) ||
        !item.catalogVersion ||
        result.has(item.toolName)
      )
        throw new Error('nodia_ai:invalid_execution_admission');
      result.set(item.toolName, Object.freeze({ ...item }));
    }
    this.registrations = result;
  }
  describe(steps: readonly NodiaAiProposalStep[], catalogVersion: string) {
    const workflow = catalogVersion === NODIA_AI_WORKFLOW_CATALOG_VERSION;
    const prior = new Map<string, NodiaAiProposalStep>();
    const available =
      steps.length > 0 &&
      (workflow || steps.length === 1) &&
      (!steps.some((step) => nodiaAiSecureOperationIdentity(step.tool_name)) ||
        (!workflow && steps.length === 1)) &&
      steps.every((step, index) => {
        const registration = this.registrations.get(step.tool_name);
        const dependencies = step.public_step.depends_on;
        if (
          !registration ||
          registration.contractHash !== step.contract_hash ||
          (!workflow && registration.catalogVersion !== catalogVersion) ||
          step.position !== index + 1 ||
          prior.has(step.id) ||
          !Array.isArray(dependencies) ||
          !Array.isArray(step.output_bindings) ||
          (!workflow && (dependencies.length || step.output_bindings.length))
        )
          return false;
        const sources = new Set<string>(),
          targets = new Set<string>();
        for (const binding of step.output_bindings) {
          const field = binding.target_field_key,
            id = binding.from_step_id,
            output = binding.output_key;
          if (
            typeof field !== 'string' ||
            typeof id !== 'string' ||
            typeof output !== 'string' ||
            targets.has(field)
          )
            return false;
          const source = prior.get(id);
          const producer = source && this.registrations.get(source.tool_name);
          if (
            !source ||
            !registration.bindableFields?.[field] ||
            registration.bindableFields[field] !==
              producer?.outputKeys?.[output]
          )
            return false;
          sources.add(id);
          targets.add(field);
        }
        if (
          dependencies.length !== sources.size ||
          dependencies.some(
            (dep) => typeof dep !== 'string' || !sources.has(dep),
          ) ||
          new Set(dependencies).size !== dependencies.length
        )
          return false;
        prior.set(step.id, step);
        return true;
      });
    return {
      can_confirm: available,
      reason: available ? null : 'nodia_ai:execution_unavailable',
    } as const;
  }
  require(steps: readonly NodiaAiProposalStep[], catalogVersion: string): void {
    if (!this.describe(steps, catalogVersion).can_confirm)
      throw new ServiceUnavailableException('nodia_ai:execution_unavailable');
  }
}
