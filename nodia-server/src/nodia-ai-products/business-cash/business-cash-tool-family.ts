import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { assertBusinessesAccess } from '../../business-access/business-access.js';
import { normalizeCashUuid } from '../../business-cash/policies/cash-category.policy.js';
import type {
  CashCategory,
  CashMovement,
  CashSummary,
} from '../../business-cash/types/cash.types.js';
import type { ReadCashCategoriesUseCase } from '../../business-cash/use-case/read-cash-categories.use-case.js';
import type { ReadCashMovementsUseCase } from '../../business-cash/use-case/read-cash-movements.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolHandlerContext,
} from '../../nodia-ai-tools/types/tool-registry.types.js';

const route = '/business';
const definitions = [
  [
    'categories_list',
    'business_cash_categories',
    'list',
    'CashCategoriesList',
    'Caja de Negocios. Lista categorías de un negocio autorizado, con búsqueda por nombre y paginación. Por defecto devuelve las activas.',
  ],
  [
    'movements_list',
    'business_cash_movements',
    'list',
    'CashMovementsList',
    'Caja de Negocios. Lista movimientos y totales exactos en CLP de todos los movimientos filtrados antes de paginar. Admite categoría, fechas civiles inclusivas, actividad y texto. Por defecto devuelve los activos.',
  ],
  [
    'movements_get',
    'business_cash_movements',
    'get',
    'CashMovementsGet',
    'Caja de Negocios. Lee un movimiento por ID dentro del negocio autorizado indicado.',
  ],
  [
    'monthly_summary',
    'business_cash_movements',
    'monthly_summary',
    'CashMonthlySummary',
    'Caja de Negocios. Lee los totales exactos en CLP de movimientos activos del mes en curso en America/Santiago. Para otro período usa movements_list con las fechas explícitas.',
  ],
] as const;

function readActor(context: NodiaAiToolHandlerContext): ActorReference {
  return {
    userId: context.actor.actorId,
    sessionId: context.actor.sessionId,
    statementTimeoutMs: context.statementTimeoutMs,
  };
}

async function verifyAuthority(
  input: NodiaAiJsonObject,
  context: NodiaAiToolHandlerContext,
): Promise<void> {
  if (
    !context.moduleRoutes.includes(route) ||
    !context.manager.queryRunner?.isTransactionActive
  )
    throw new ForbiddenException('nodia_ai:capability_denied');
  await assertBusinessesAccess(
    context.manager,
    readActor(context),
    [normalizeCashUuid(input.business_id)],
    { lock: true },
  );
}

function presentCategory(category: CashCategory): NodiaAiJsonObject {
  return {
    id: category.id,
    business_id: category.business_id,
    name: category.name,
    description: category.description,
    is_active: category.is_active,
  };
}

function presentMovement(movement: CashMovement): NodiaAiJsonObject {
  const { category, invoice } = movement;
  return {
    id: movement.id,
    business_id: movement.business_id,
    category: {
      id: category.id,
      name: category.name,
      is_active: category.is_active,
    },
    type: movement.type,
    amount: movement.amount,
    occurred_on: movement.occurred_on,
    is_active: movement.is_active,
    source: movement.source,
    description: movement.description,
    invoice: invoice && { id: invoice.id, code: invoice.code },
  };
}

function presentSummary({
  currency,
  income,
  expense,
}: CashSummary): NodiaAiJsonObject {
  return {
    currency,
    income: { count: income.count, total_amount: income.total_amount },
    expense: { count: expense.count, total_amount: expense.total_amount },
  };
}

function listOptions(input: NodiaAiJsonObject) {
  return {
    page: input.page as number | undefined,
    limit: input.limit as number | undefined,
    search: input.search as string | undefined,
    isActive:
      input.activity === 'all' ? undefined : input.activity !== 'inactive',
  };
}

export function createNodiaAiBusinessCashToolFamily(
  sourceJson: string,
  categories: ReadCashCategoriesUseCase,
  movements: ReadCashMovementsUseCase,
): NodiaAiToolFamily {
  const sha256 = createHash('sha256').update(sourceJson).digest('hex');
  const handlers = {
    categories_list: async (
      input: NodiaAiJsonObject,
      context: NodiaAiToolHandlerContext,
    ) => {
      const business_id = normalizeCashUuid(input.business_id);
      const { page, limit, search, isActive } = listOptions(input);
      const result = await categories.list(
        {
          page,
          limit,
          q: {
            business_id_eq: business_id,
            is_active_eq: isActive,
            name_cont: search,
          },
        },
        readActor(context),
        context.manager,
      );
      return {
        business_id,
        data: result.data.map(presentCategory),
        meta: result.meta,
      };
    },
    movements_list: async (
      input: NodiaAiJsonObject,
      context: NodiaAiToolHandlerContext,
    ) => {
      const business_id = normalizeCashUuid(input.business_id);
      const { page, limit, search, isActive } = listOptions(input);
      const result = await movements.list(
        {
          page,
          limit,
          q: {
            business_id_eq: business_id,
            is_active_eq: isActive,
            search,
            category_id_eq: input.category_id as string | undefined,
            occurred_on_gteq: input.from as string | undefined,
            occurred_on_lteq: input.to as string | undefined,
          },
        },
        readActor(context),
        context.manager,
      );
      return {
        business_id,
        data: result.data.map(presentMovement),
        meta: result.meta,
        summary: presentSummary(result.summary),
      };
    },
    movements_get: async (
      input: NodiaAiJsonObject,
      context: NodiaAiToolHandlerContext,
    ) => {
      const business_id = normalizeCashUuid(input.business_id);
      const result = await movements.detailInBusiness(
        business_id,
        normalizeCashUuid(input.id),
        readActor(context),
        context.manager,
      );
      return { business_id, data: presentMovement(result) };
    },
    monthly_summary: async (
      input: NodiaAiJsonObject,
      context: NodiaAiToolHandlerContext,
    ) => {
      const business_id = normalizeCashUuid(input.business_id);
      const result = await movements.monthly(
        business_id,
        readActor(context),
        context.manager,
      );
      return {
        business_id,
        period: result.period,
        summary: presentSummary(result.summary),
      };
    },
  };

  return {
    familyKey: 'business_cash',
    modules: [{ key: 'businesses', route, label: 'Negocios' }],
    resources: [
      {
        key: 'business_cash_categories',
        label: 'Categorías de Caja',
        requiredModuleRoutes: [route],
      },
      {
        key: 'business_cash_movements',
        label: 'Movimientos de Caja',
        requiredModuleRoutes: [route],
      },
    ],
    capabilities: definitions.map(
      ([suffix, resourceKey, operationKey, prefix, description]) => ({
        capabilityId: `nodia_business_cash_${suffix}`,
        toolName: `nodia_business_cash_${suffix}`,
        revision: 1,
        publication: 'published',
        kind: 'read',
        moduleKey: 'businesses',
        resourceKey,
        operationKey,
        descriptionKey: `nodia_ai.capabilities.business_cash_${suffix}`,
        description,
        requiredModuleRoutes: [route],
        actionKeys: [],
        effectKey: `read:${resourceKey}`,
        inputSchema: { sourceJson, sha256, definition: `${prefix}Input` },
        outputSchema: { sourceJson, sha256, definition: `${prefix}Result` },
        verifyAuthority,
        verifyResultAuthority: async (input, result, context) => {
          await verifyAuthority(input, context);
          const businessId = normalizeCashUuid(input.business_id);
          const rows =
            operationKey === 'monthly_summary'
              ? []
              : operationKey === 'get'
                ? [result.data]
                : result.data;
          if (
            result.business_id !== businessId ||
            !Array.isArray(rows) ||
            rows.some(
              (row) =>
                !row ||
                typeof row !== 'object' ||
                Array.isArray(row) ||
                row.business_id !== businessId ||
                (operationKey === 'get' &&
                  row.id !== normalizeCashUuid(input.id)),
            )
          )
            throw new ForbiddenException(
              'nodia_ai:business_result_scope_invalid',
            );
        },
        handler: handlers[suffix],
      }),
    ),
  };
}
