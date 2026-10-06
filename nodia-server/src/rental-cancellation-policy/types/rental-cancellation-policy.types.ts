import { BadRequestException } from '@nestjs/common';
import type { RentalCancellationPolicy } from '../entities/rental-cancellation-policy.entity.js';
import type { RentalCancellationRule } from '../entities/rental-cancellation-policy-rule.entity.js';
import type { RentalCancellationRuleDto } from '../dto/create-rental-cancellation-policy.dto.js';
import { normalizePercent } from '../../rental-common/rental-validation.js';

export function normalizedCancellationRules(
  rules: RentalCancellationRuleDto[],
): RentalCancellationRuleDto[] {
  if (
    !rules.some((rule) => rule.min_days_before === 0) ||
    new Set(rules.map((rule) => rule.min_days_before)).size !== rules.length
  )
    throw new BadRequestException('rental:invalid_input');
  return rules
    .map((rule) => ({
      min_days_before: rule.min_days_before,
      refund_percent: normalizePercent(rule.refund_percent),
    }))
    .sort((a, b) => a.min_days_before - b.min_days_before);
}
export function rentalCancellationPolicyResponse(
  policy: RentalCancellationPolicy,
  rules: RentalCancellationRule[],
) {
  return {
    id: policy.id,
    property_id: policy.property_id,
    name: policy.name,
    is_active: policy.is_active,
    created_by: policy.created_by,
    updated_by: policy.updated_by,
    created_at: policy.created_at.toISOString(),
    updated_at: policy.updated_at.toISOString(),
    rules: rules
      .filter((rule) => rule.policy_id === policy.id)
      .map((rule) => ({
        id: rule.id,
        policy_id: rule.policy_id,
        min_days_before: rule.min_days_before,
        refund_percent: normalizePercent(rule.refund_percent),
        created_by: rule.created_by,
        updated_by: rule.updated_by,
        created_at: rule.created_at.toISOString(),
        updated_at: rule.updated_at.toISOString(),
      })),
  };
}
