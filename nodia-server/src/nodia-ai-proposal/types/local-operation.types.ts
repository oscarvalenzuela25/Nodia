import { InternalServerErrorException } from '@nestjs/common';
import { isFinanceBigint } from '../../finance-common/validation/finance-validation.js';
import { nodiaAiFinanceOperationIdentity } from '../../nodia-ai-finance-effect/types/financial-operation.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiBusinessMutation,
  NodiaAiBusinessResource,
} from './native-operation.types.js';

type BusinessIdentity = Readonly<{
  family: 'business';
  resourceKey: NodiaAiBusinessResource;
  operation: NodiaAiBusinessMutation;
  idKind: 'bigint' | 'uuid';
}>;
const businessIdentities: Readonly<Record<string, BusinessIdentity>> =
  Object.freeze({
    ...Object.fromEntries(
      ['create', 'update', 'complete', 'cancel', 'discard'].map((operation) => [
        `nodia_sales_prepare_${operation}`,
        {
          family: 'business' as const,
          resourceKey: 'sales' as const,
          operation: operation as NodiaAiBusinessMutation,
          idKind: 'uuid' as const,
        },
      ]),
    ),
    nodia_businesses_prepare_create: {
      family: 'business',
      resourceKey: 'businesses',
      operation: 'create',
      idKind: 'uuid',
    },
    nodia_businesses_prepare_update: {
      family: 'business',
      resourceKey: 'businesses',
      operation: 'update',
      idKind: 'uuid',
    },
    nodia_businesses_prepare_set_collaborators: {
      family: 'business',
      resourceKey: 'businesses',
      operation: 'set_collaborators',
      idKind: 'uuid',
    },
    nodia_products_prepare_create: {
      family: 'business',
      resourceKey: 'products',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_products_prepare_update: {
      family: 'business',
      resourceKey: 'products',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_product_logs_prepare_create: {
      family: 'business',
      resourceKey: 'product_logs',
      operation: 'create',
      idKind: 'uuid',
    },
    nodia_product_logs_prepare_update: {
      family: 'business',
      resourceKey: 'product_logs',
      operation: 'update',
      idKind: 'uuid',
    },
    nodia_providers_prepare_create: {
      family: 'business',
      resourceKey: 'providers',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_providers_prepare_update: {
      family: 'business',
      resourceKey: 'providers',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_provider_contacts_prepare_create: {
      family: 'business',
      resourceKey: 'provider_contacts',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_provider_contacts_prepare_update: {
      family: 'business',
      resourceKey: 'provider_contacts',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_provider_contacts_prepare_set_active: {
      family: 'business',
      resourceKey: 'provider_contacts',
      operation: 'set_active',
      idKind: 'bigint',
    },
    nodia_invoices_prepare_create: {
      family: 'business',
      resourceKey: 'invoices',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_invoices_prepare_update: {
      family: 'business',
      resourceKey: 'invoices',
      operation: 'update',
      idKind: 'bigint',
    },
  });
export function nodiaAiBusinessOperationIdentity(name: string) {
  return Object.hasOwn(businessIdentities, name)
    ? businessIdentities[name]
    : null;
}
type RentalIdentity = Readonly<{
  family: 'rental';
  resourceKey:
    | 'rental_properties'
    | 'rental_collaborators'
    | 'rental_cancellation_policies'
    | 'rental_reservations'
    | 'rental_payments'
    | 'rental_expenses'
    | 'rental_blocks'
    | 'rental_turnovers';
  operation:
    | 'create'
    | 'update'
    | 'confirm'
    | 'start'
    | 'complete'
    | 'cancel'
    | 'void'
    | 'pay'
    | 'approve_same_day';
  idKind: 'bigint';
}>;
const rentalIdentities: Readonly<Record<string, RentalIdentity>> =
  Object.freeze({
    nodia_rental_properties_prepare_create: {
      family: 'rental',
      resourceKey: 'rental_properties',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_rental_properties_prepare_update: {
      family: 'rental',
      resourceKey: 'rental_properties',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_rental_collaborators_prepare_create: {
      family: 'rental',
      resourceKey: 'rental_collaborators',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_rental_collaborators_prepare_update: {
      family: 'rental',
      resourceKey: 'rental_collaborators',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_rental_cancellation_policies_prepare_create: {
      family: 'rental',
      resourceKey: 'rental_cancellation_policies',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_rental_cancellation_policies_prepare_update: {
      family: 'rental',
      resourceKey: 'rental_cancellation_policies',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_rental_reservations_prepare_create: {
      family: 'rental',
      resourceKey: 'rental_reservations',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_rental_reservations_prepare_update: {
      family: 'rental',
      resourceKey: 'rental_reservations',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_rental_reservations_prepare_confirm: {
      family: 'rental',
      resourceKey: 'rental_reservations',
      operation: 'confirm',
      idKind: 'bigint',
    },
    nodia_rental_reservations_prepare_start: {
      family: 'rental',
      resourceKey: 'rental_reservations',
      operation: 'start',
      idKind: 'bigint',
    },
    nodia_rental_reservations_prepare_complete: {
      family: 'rental',
      resourceKey: 'rental_reservations',
      operation: 'complete',
      idKind: 'bigint',
    },
    nodia_rental_reservations_prepare_cancel: {
      family: 'rental',
      resourceKey: 'rental_reservations',
      operation: 'cancel',
      idKind: 'bigint',
    },
    nodia_rental_payments_prepare_create: {
      family: 'rental',
      resourceKey: 'rental_payments',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_rental_payments_prepare_void: {
      family: 'rental',
      resourceKey: 'rental_payments',
      operation: 'void',
      idKind: 'bigint',
    },
    nodia_rental_expenses_prepare_create: {
      family: 'rental',
      resourceKey: 'rental_expenses',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_rental_expenses_prepare_update: {
      family: 'rental',
      resourceKey: 'rental_expenses',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_rental_expenses_prepare_pay: {
      family: 'rental',
      resourceKey: 'rental_expenses',
      operation: 'pay',
      idKind: 'bigint',
    },
    nodia_rental_expenses_prepare_void: {
      family: 'rental',
      resourceKey: 'rental_expenses',
      operation: 'void',
      idKind: 'bigint',
    },
    nodia_rental_blocks_prepare_create: {
      family: 'rental',
      resourceKey: 'rental_blocks',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_rental_blocks_prepare_update: {
      family: 'rental',
      resourceKey: 'rental_blocks',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_rental_turnovers_prepare_update: {
      family: 'rental',
      resourceKey: 'rental_turnovers',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_rental_turnovers_prepare_approve_same_day: {
      family: 'rental',
      resourceKey: 'rental_turnovers',
      operation: 'approve_same_day',
      idKind: 'bigint',
    },
  });
export function nodiaAiRentalOperationIdentity(name: string) {
  return Object.hasOwn(rentalIdentities, name) ? rentalIdentities[name] : null;
}
type CoreIdentity = Readonly<{
  family: 'core';
  resourceKey:
    | 'users'
    | 'roles'
    | 'actions'
    | 'business_actions'
    | 'modules'
    | 'module_groups';
  operation: 'create' | 'update' | 'delete';
  idKind: 'bigint';
}>;
const coreIdentities: Readonly<Record<string, CoreIdentity>> = Object.freeze({
  nodia_users_prepare_create: {
    family: 'core',
    resourceKey: 'users',
    operation: 'create',
    idKind: 'bigint',
  },
  nodia_users_prepare_update: {
    family: 'core',
    resourceKey: 'users',
    operation: 'update',
    idKind: 'bigint',
  },
  nodia_roles_prepare_create: {
    family: 'core',
    resourceKey: 'roles',
    operation: 'create',
    idKind: 'bigint',
  },
  nodia_roles_prepare_update: {
    family: 'core',
    resourceKey: 'roles',
    operation: 'update',
    idKind: 'bigint',
  },
  nodia_roles_prepare_delete: {
    family: 'core',
    resourceKey: 'roles',
    operation: 'delete',
    idKind: 'bigint',
  },
  nodia_actions_prepare_create: {
    family: 'core',
    resourceKey: 'actions',
    operation: 'create',
    idKind: 'bigint',
  },
  nodia_actions_prepare_update: {
    family: 'core',
    resourceKey: 'actions',
    operation: 'update',
    idKind: 'bigint',
  },
  nodia_actions_prepare_delete: {
    family: 'core',
    resourceKey: 'actions',
    operation: 'delete',
    idKind: 'bigint',
  },
  nodia_business_actions_prepare_create: {
    family: 'core',
    resourceKey: 'business_actions',
    operation: 'create',
    idKind: 'bigint',
  },
  nodia_business_actions_prepare_update: {
    family: 'core',
    resourceKey: 'business_actions',
    operation: 'update',
    idKind: 'bigint',
  },
  nodia_business_actions_prepare_delete: {
    family: 'core',
    resourceKey: 'business_actions',
    operation: 'delete',
    idKind: 'bigint',
  },
  nodia_modules_prepare_create: {
    family: 'core',
    resourceKey: 'modules',
    operation: 'create',
    idKind: 'bigint',
  },
  nodia_modules_prepare_update: {
    family: 'core',
    resourceKey: 'modules',
    operation: 'update',
    idKind: 'bigint',
  },
  nodia_modules_prepare_delete: {
    family: 'core',
    resourceKey: 'modules',
    operation: 'delete',
    idKind: 'bigint',
  },
  nodia_module_groups_prepare_create: {
    family: 'core',
    resourceKey: 'module_groups',
    operation: 'create',
    idKind: 'bigint',
  },
  nodia_module_groups_prepare_update: {
    family: 'core',
    resourceKey: 'module_groups',
    operation: 'update',
    idKind: 'bigint',
  },
  nodia_module_groups_prepare_delete: {
    family: 'core',
    resourceKey: 'module_groups',
    operation: 'delete',
    idKind: 'bigint',
  },
});
export function nodiaAiCoreOperationIdentity(name: string) {
  return Object.hasOwn(coreIdentities, name) ? coreIdentities[name] : null;
}
type AiProviderIdentity = Readonly<{
  family: 'ai_provider';
  resourceKey: 'ai_providers' | 'ai_provider_catalog';
  operation: 'create' | 'update';
  idKind: 'bigint';
}>;
const aiProviderIdentities: Readonly<Record<string, AiProviderIdentity>> =
  Object.freeze({
    nodia_ai_providers_prepare_create: {
      family: 'ai_provider',
      resourceKey: 'ai_providers',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_ai_providers_prepare_update: {
      family: 'ai_provider',
      resourceKey: 'ai_providers',
      operation: 'update',
      idKind: 'bigint',
    },
    nodia_ai_providers_prepare_catalog_create: {
      family: 'ai_provider',
      resourceKey: 'ai_provider_catalog',
      operation: 'create',
      idKind: 'bigint',
    },
    nodia_ai_providers_prepare_catalog_update: {
      family: 'ai_provider',
      resourceKey: 'ai_provider_catalog',
      operation: 'update',
      idKind: 'bigint',
    },
  });
export function nodiaAiProviderOperationIdentity(name: string) {
  return Object.hasOwn(aiProviderIdentities, name)
    ? aiProviderIdentities[name]
    : null;
}
export function nodiaAiLocalOperationIdentity(name: string) {
  const financial = nodiaAiFinanceOperationIdentity(name);
  return financial
    ? { ...financial, family: 'finance' as const, idKind: 'bigint' as const }
    : (nodiaAiBusinessOperationIdentity(name) ??
        nodiaAiRentalOperationIdentity(name) ??
        nodiaAiCoreOperationIdentity(name) ??
        nodiaAiProviderOperationIdentity(name) ??
        nodiaAiPreferenceOperationIdentity(name));
}
export function nodiaAiPreferenceOperationIdentity(name: string) {
  const operation =
    name === 'nodia_preferences_prepare_create'
      ? 'create'
      : name === 'nodia_preferences_prepare_update'
        ? 'update'
        : name === 'nodia_preferences_prepare_delete'
          ? 'delete'
          : null;
  return operation
    ? {
        family: 'preference' as const,
        resourceKey: 'nodia_ai_preferences' as const,
        operation,
        idKind: 'uuid' as const,
      }
    : null;
}
export function isNodiaAiDomainUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
type ReceiptSource = {
  tool_name: string;
  command_template: NodiaAiJsonObject;
  scope: NodiaAiJsonObject;
  preconditions: NodiaAiJsonObject;
};
type AssertReceipt = (
  schema: string,
  value: unknown,
  persisted: boolean,
) => void;
const invalid = (): never => {
  throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
};

/** Validates historical evidence against the frozen scope; never reads a current domain row. */
export function validateNodiaAiLocalReceipt(
  source: ReceiptSource,
  receipt: NodiaAiJsonObject | null,
  assert: AssertReceipt,
) {
  const identity = nodiaAiLocalOperationIdentity(source.tool_name);
  if (!identity || !receipt) return invalid();
  assert(
    identity.family === 'preference'
      ? 'PreferenceEffectReceipt'
      : identity.family === 'ai_provider'
        ? 'AiProviderEffectReceipt'
        : identity.family === 'core'
          ? 'CoreEffectReceipt'
          : identity.family === 'rental'
            ? 'RentalEffectReceipt'
            : identity.family === 'business'
              ? 'BusinessEffectReceipt'
              : source.tool_name === 'nodia_finance_movements_prepare_create'
                ? 'FinancialMovementReceipt'
                : 'FinancialEffectReceipt',
    receipt,
    true,
  );
  if (
    receipt.resource_key !== identity.resourceKey ||
    (identity.idKind === 'uuid'
      ? !isNodiaAiDomainUuid(receipt.resource_id)
      : !isFinanceBigint(receipt.resource_id))
  )
    return invalid();
  const legacy = source.tool_name === 'nodia_finance_movements_prepare_create';
  if (
    !legacy &&
    (receipt.operation !== identity.operation ||
      (identity.operation !== 'create' &&
        receipt.resource_id !== source.command_template.id))
  )
    return invalid();
  if (identity.family === 'preference') {
    const expectedRevision =
      identity.operation === 'create'
        ? 1
        : Number(source.command_template.expected_revision) + 1;
    if (
      receipt.owner_id !== source.scope.subject_user_id ||
      !isFinanceBigint(receipt.owner_id) ||
      receipt.revision !== expectedRevision ||
      receipt.resource_id !== source.command_template.id
    )
      return invalid();
  } else if (identity.family === 'finance') {
    if (
      !isFinanceBigint(receipt.subject_user_id) ||
      receipt.subject_user_id !== source.scope.subject_user_id ||
      receipt.subject_user_id !== source.command_template.owner_id
    )
      return invalid();
  } else if (identity.family === 'rental') {
    const propertyCreation =
      identity.resourceKey === 'rental_properties' &&
      identity.operation === 'create';
    const command = source.command_template.command;
    if (
      propertyCreation &&
      (!command ||
        typeof command !== 'object' ||
        Array.isArray(command) ||
        !isFinanceBigint(source.scope.subject_user_id) ||
        command.owner_id !== source.scope.subject_user_id)
    )
      return invalid();
    if (
      !isFinanceBigint(receipt.property_id) ||
      (propertyCreation
        ? receipt.property_id !== receipt.resource_id
        : receipt.property_id !== source.scope.property_id ||
          source.command_template.property_id !== source.scope.property_id)
    )
      return invalid();
  } else if (identity.family === 'core' || identity.family === 'ai_provider') {
    if (Object.keys(source.scope).length !== 0) return invalid();
    const target = source.preconditions.target;
    if (
      target &&
      typeof target === 'object' &&
      !Array.isArray(target) &&
      target.id !== undefined &&
      receipt.resource_id !== target.id
    )
      return invalid();
  } else {
    const destination =
      identity.resourceKey === 'businesses' && identity.operation === 'create'
        ? receipt.resource_id
        : source.preconditions.destination_business_id;
    if (
      !isNodiaAiDomainUuid(destination) ||
      receipt.business_id !== destination ||
      (source.command_template.business_id !== undefined &&
        source.command_template.business_id !== source.scope.business_id)
    )
      return invalid();
  }
  return {
    resource_key: identity.resourceKey,
    id: String(receipt.resource_id),
  };
}
export function buildNodiaAiLocalReceipt(
  source: ReceiptSource,
  result: {
    id: string;
    ownerId?: string;
    businessId?: string;
    propertyId?: string;
    revision?: number;
  },
  assert: AssertReceipt,
): NodiaAiJsonObject {
  const identity = nodiaAiLocalOperationIdentity(source.tool_name);
  if (!identity) return invalid();
  const receipt: NodiaAiJsonObject = {
    schema_version: 1,
    resource_key: identity.resourceKey,
    resource_id: result.id,
    ...(source.tool_name === 'nodia_finance_movements_prepare_create'
      ? {}
      : { operation: identity.operation }),
    ...(identity.family === 'preference'
      ? { owner_id: result.ownerId ?? null, revision: result.revision ?? null }
      : identity.family === 'core' || identity.family === 'ai_provider'
        ? {}
        : identity.family === 'rental'
          ? { property_id: result.propertyId ?? null }
          : identity.family === 'finance'
            ? { subject_user_id: result.ownerId ?? null }
            : { business_id: result.businessId ?? null }),
  };
  validateNodiaAiLocalReceipt(source, receipt, assert);
  return receipt;
}
