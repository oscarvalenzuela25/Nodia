import { InternalServerErrorException } from '@nestjs/common';
import type { NodiaAiExecutionStep } from '../../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import type { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { nodiaAiFinancialBinding } from '../../nodia-ai-finance-effect/types/financial-operation.types.js';
import { isDeepStrictEqual } from 'node:util';
import { isFinanceBigint } from '../../finance-common/validation/finance-validation.js';

/** First-bind protects resolved preconditions too; legacy witnesses retain their original hash. */
export function nodiaAiBoundExecutionBinding(
  source: NodiaAiProposalStep,
  hasPayload: boolean,
) {
  const native = nodiaAiFinancialBinding(source);
  return hasPayload
    ? { ...native, preconditions: source.preconditions }
    : native;
}

function object(value: unknown): value is NodiaAiJsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Read only the closed payload persisted at first bind; never refresh domain data here. */
export function boundNodiaAiProposalStep(
  source: NodiaAiProposalStep,
  step: NodiaAiExecutionStep,
): NodiaAiProposalStep {
  const bound = step.bound_command;
  // Older single-operation receipts predate the first-bind payload column.
  if (bound === null || bound === undefined) {
    if (source.output_bindings.length && step.bound_command_hash !== null)
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    return source;
  }
  if (
    !object(bound) ||
    Object.keys(bound).length !== 3 ||
    !object(bound.command_template) ||
    !object(bound.scope) ||
    !object(bound.preconditions) ||
    !step.bound_command_hash
  )
    throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
  const invalid = (): never => {
    throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
  };
  if (!source.output_bindings.length) {
    if (
      !isDeepStrictEqual(bound.command_template, source.command_template) ||
      !isDeepStrictEqual(bound.scope, source.scope) ||
      !isDeepStrictEqual(bound.preconditions, source.preconditions)
    )
      invalid();
  } else {
    // This release exposes exactly one typed future relation. Expanding it
    // requires a matching closed invariant, rather than arbitrary path writes.
    const binding = source.output_bindings[0];
    const providerId = bound.command_template.provider_id;
    const future = source.preconditions.future_provider;
    const provider = bound.preconditions.provider;
    if (!object(future) || !object(provider)) return invalid();
    const expected = future.expected_provider;
    if (!object(expected)) return invalid();
    if (
      source.tool_name !== 'nodia_provider_contacts_prepare_create' ||
      source.output_bindings.length !== 1 ||
      binding.target_field_key !== 'provider_id' ||
      binding.output_key !== 'id' ||
      !isFinanceBigint(providerId) ||
      future.from_step_id !== binding.from_step_id ||
      source.preconditions.provider !== null ||
      provider.id !== providerId ||
      typeof provider.updated_at !== 'string' ||
      Object.keys(provider).length !== 7 ||
      !isDeepStrictEqual(bound.command_template, {
        ...source.command_template,
        provider_id: providerId,
      }) ||
      !isDeepStrictEqual(bound.scope, {
        ...source.scope,
        provider_id: providerId,
      })
    )
      invalid();
    if (
      Object.keys(expected).length !== 5 ||
      expected.business_id !== source.scope.business_id ||
      Object.keys(expected).some(
        (key) => !isDeepStrictEqual(provider[key], expected[key]),
      )
    )
      invalid();
    const { future_provider: _future, ...conditions } = source.preconditions;
    if (!isDeepStrictEqual(bound.preconditions, { ...conditions, provider }))
      invalid();
  }
  return {
    ...source,
    command_template: bound.command_template,
    scope: bound.scope,
    preconditions: bound.preconditions,
  };
}
