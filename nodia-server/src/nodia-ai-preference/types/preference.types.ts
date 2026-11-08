import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

/** Nodia's own bounded memory budget; never a provider quota. */
export const NODIA_AI_PREFERENCE_LIMIT = 50;
export const NODIA_AI_PREFERENCE_CATALOG = Object.freeze([
  {
    scope_key: 'finance',
    key: 'expense_category_id',
    value_type: 'bigint',
    requires_business_scope: false,
    route: '/finances-personal',
  },
  {
    scope_key: 'finance',
    key: 'income_category_id',
    value_type: 'bigint',
    requires_business_scope: false,
    route: '/finances-personal',
  },
  {
    scope_key: 'business',
    key: 'business_id',
    value_type: 'uuid',
    requires_business_scope: false,
    route: '/business',
  },
  {
    scope_key: 'business',
    key: 'supplier_id',
    value_type: 'bigint',
    requires_business_scope: true,
    route: '/business',
  },
  {
    scope_key: 'rental',
    key: 'property_id',
    value_type: 'bigint',
    requires_business_scope: false,
    route: '/reservations',
  },
] as const);
export type NodiaAiPreferenceScopeKey =
  (typeof NODIA_AI_PREFERENCE_CATALOG)[number]['scope_key'];
export type NodiaAiPreferenceKey =
  (typeof NODIA_AI_PREFERENCE_CATALOG)[number]['key'];
export interface NodiaAiPreferenceValue {
  scope_key: NodiaAiPreferenceScopeKey;
  scope: NodiaAiJsonObject;
  key: NodiaAiPreferenceKey;
  value: string;
}
export interface NodiaAiContextPreference extends NodiaAiPreferenceValue {
  id: string;
  revision: number;
  value_label: string;
  scope_label: string | null;
}
export const preferenceInvalid = (): never => {
  throw new BadRequestException('nodia_ai:invalid_input');
};
export function preferenceDefinition(scope: unknown, key: unknown) {
  return (
    NODIA_AI_PREFERENCE_CATALOG.find(
      (item) => item.scope_key === scope && item.key === key,
    ) ?? preferenceInvalid()
  );
}
export function validatePreferenceValue(
  raw: NodiaAiJsonObject,
): NodiaAiPreferenceValue {
  const definition = preferenceDefinition(raw.scope_key, raw.key);
  const scope = raw.scope;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope))
    return preferenceInvalid();
  if (definition.requires_business_scope) {
    if (Object.keys(scope).length !== 1 || !isUUID(scope.business_id, '4'))
      return preferenceInvalid();
  } else if (Object.keys(scope).length) return preferenceInvalid();
  if (
    typeof raw.value !== 'string' ||
    (definition.value_type === 'uuid'
      ? !isUUID(raw.value, '4')
      : !/^[1-9][0-9]{0,18}$/.test(raw.value) ||
        BigInt(raw.value) > 9223372036854775807n)
  )
    return preferenceInvalid();
  return {
    scope_key: definition.scope_key,
    scope: definition.requires_business_scope
      ? { business_id: String(scope.business_id).toLowerCase() }
      : {},
    key: definition.key,
    value:
      definition.value_type === 'uuid' ? raw.value.toLowerCase() : raw.value,
  };
}
export function preferenceScopeHash(
  scope_key: string,
  scope: NodiaAiJsonObject,
) {
  return createHash('sha256')
    .update(JSON.stringify({ scope_key, scope }))
    .digest('hex');
}
export function preferenceFingerprint(
  items: readonly NodiaAiContextPreference[],
): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        [...items]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((item) => ({
            id: item.id,
            revision: item.revision,
            scope_key: item.scope_key,
            scope: item.scope,
            key: item.key,
            value: item.value,
            value_label: item.value_label,
            scope_label: item.scope_label,
          })),
      ),
    )
    .digest('hex');
}
export interface NodiaAiPreferenceOperation extends NodiaAiProposalPreparer {
  readonly resourceKey: 'nodia_ai_preferences';
  readonly operation: 'create' | 'update' | 'delete';
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; ownerId: string; revision: number }>;
}
export const NODIA_AI_PREFERENCE_OPERATIONS = Symbol(
  'NODIA_AI_PREFERENCE_OPERATIONS',
);
