import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { moduleRouteIncluded } from '../../authorization/canonical-module-route.js';
import { assertBusinessesAccess } from '../../business-access/business-access.js';
import type { ShoppingListSummary } from '../../business-shopping-list/types/shopping-list.types.js';
import type { ReadShoppingListsUseCase } from '../../business-shopping-list/use-case/read-shopping-lists.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolHandlerContext,
} from '../../nodia-ai-tools/types/tool-registry.types.js';

const BUSINESS_ROUTE = '/business';
const RESOURCE_KEY = 'business_shopping_lists';

function actor(context: NodiaAiToolHandlerContext): ActorReference {
  return {
    userId: context.actor.actorId,
    sessionId: context.actor.sessionId,
    transaction: context.manager,
    statementTimeoutMs: context.statementTimeoutMs,
  };
}

function summary(businessId: string, row: ShoppingListSummary) {
  return {
    business_id: businessId,
    id: row.id,
    name: row.name,
    is_active: row.is_active,
    item_count: row.item_count,
  };
}

async function verifyAuthority(
  input: NodiaAiJsonObject,
  context: NodiaAiToolHandlerContext,
): Promise<void> {
  if (
    !moduleRouteIncluded(context.moduleRoutes, BUSINESS_ROUTE) ||
    !context.manager.queryRunner?.isTransactionActive
  )
    throw new ForbiddenException('nodia_ai:capability_denied');
  await assertBusinessesAccess(
    context.manager,
    actor(context),
    [String(input.business_id)],
    { lock: true },
  );
}

export function createNodiaAiShoppingListsToolFamily(
  sourceJson: string,
  reader: ReadShoppingListsUseCase,
): NodiaAiToolFamily {
  const schema = {
    sourceJson,
    sha256: createHash('sha256').update(sourceJson).digest('hex'),
  };
  return {
    familyKey: RESOURCE_KEY,
    modules: [{ key: 'businesses', route: BUSINESS_ROUTE, label: 'Negocios' }],
    resources: [
      {
        key: RESOURCE_KEY,
        label: 'Listas de Market',
        requiredModuleRoutes: [BUSINESS_ROUTE],
      },
    ],
    capabilities: (['list', 'get'] as const).map((operation) => {
      const isDetail = operation === 'get';
      const definition = isDetail ? 'ShoppingListsGet' : 'ShoppingListsList';
      return {
        capabilityId: `nodia_${RESOURCE_KEY}_${operation}`,
        revision: 1,
        publication: 'published',
        toolName: `nodia_${RESOURCE_KEY}_${operation}`,
        kind: 'read',
        moduleKey: 'businesses',
        resourceKey: RESOURCE_KEY,
        operationKey: operation,
        descriptionKey: `nodia_ai.capabilities.${RESOURCE_KEY}_${operation}`,
        description: isDetail
          ? 'Listas de Market. Read one authorized business shopping list and a page of its ordered items, with quantities, purchase checkmarks and product availability. Check meta.total_pages before treating the result as complete.'
          : 'Listas de Market. Find the shopping lists of one authorized business, including active and inactive lists, with optional name search. Use the returned list id to read items and purchase checkmarks.',
        requiredModuleRoutes: [BUSINESS_ROUTE],
        actionKeys: [],
        effectKey: `read:${RESOURCE_KEY}`,
        inputSchema: { ...schema, definition: `${definition}Input` },
        outputSchema: { ...schema, definition: `${definition}Result` },
        verifyAuthority,
        verifyResultAuthority: async (input, output) => {
          const rows = isDetail ? [output.data] : output.data;
          if (
            !Array.isArray(rows) ||
            rows.some(
              (row) =>
                !row ||
                typeof row !== 'object' ||
                Array.isArray(row) ||
                row.business_id !== String(input.business_id).toLowerCase() ||
                (isDetail && row.id !== String(input.id).toLowerCase()),
            )
          )
            throw new ForbiddenException(
              'nodia_ai:business_result_scope_invalid',
            );
        },
        handler: async (input, context): Promise<NodiaAiJsonObject> => {
          const businessId = String(input.business_id).toLowerCase();
          const page = Number(input.page ?? 1);
          const limit = Number(input.limit ?? (isDetail ? 30 : 20));
          const reference = actor(context);
          if (!isDetail) {
            const result = await reader.list(
              businessId,
              { page, limit, search: String(input.search ?? '') },
              reference,
            );
            return {
              data: result.items.map((row) => summary(businessId, row)),
              meta: {
                page: result.pagination.page,
                limit: result.pagination.limit,
                total_items: result.pagination.total,
                total_pages: result.pagination.total_pages,
              },
            };
          }
          const detail = await reader.detail(
            businessId,
            String(input.id),
            reference,
          );
          const offset = (page - 1) * limit;
          return {
            data: {
              ...summary(businessId, detail),
              items: detail.items.slice(offset, offset + limit).map((item) => ({
                id: item.id,
                product_id: item.product_id,
                name: item.name,
                quantity: item.quantity,
                position: item.position,
                available: item.available,
                checked: item.checked,
              })),
            },
            meta: {
              page,
              limit,
              total_items: detail.item_count,
              total_pages: Math.ceil(detail.item_count / limit),
            },
          };
        },
      };
    }),
  };
}
