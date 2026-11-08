import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { assertBusinessesAccess } from '../../business-access/business-access.js';
import { ReadSalesUseCase } from '../../sale/use-case/read-sales.use-case.js';
import type { SaleListQuery } from '../../sale/types/sale.types.js';
import { saleQuantityThousandths } from '../../sale/policies/sale-quantity.js';
import { validateProductMeasurementUnit } from '../../product/product-measurement-unit.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolHandlerContext,
} from '../../nodia-ai-tools/types/tool-registry.types.js';

/** JSON Schema number bounds alone cannot check exact decimal scale in Ajv. */
function assertSaleMeasurements(rows: unknown): void {
  if (!Array.isArray(rows))
    throw new BadRequestException('nodia_ai:business_result_invalid');
  for (const row of rows) {
    if (
      !row ||
      typeof row !== 'object' ||
      !('items' in row) ||
      !Array.isArray(row.items)
    )
      throw new BadRequestException('nodia_ai:business_result_invalid');
    for (const item of row.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new BadRequestException('nodia_ai:business_result_invalid');
      try {
        saleQuantityThousandths(item.quantity);
        validateProductMeasurementUnit(item.measurement_unit_snapshot);
      } catch {
        throw new BadRequestException('nodia_ai:business_result_invalid');
      }
    }
  }
}

/** Candidate only: publication still requires an approved exact knowledge binding. */
export function createNodiaAiSalesToolFamily(
  sourceJson: string,
  reader: ReadSalesUseCase,
): NodiaAiToolFamily {
  const sha256 = createHash('sha256').update(sourceJson).digest('hex');
  const actor = (context: NodiaAiToolHandlerContext) => ({
    userId: context.actor.actorId,
    sessionId: context.actor.sessionId,
  });
  const authority = async (
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ) => {
    if (
      !context.moduleRoutes.includes('/business') ||
      !context.manager.queryRunner?.isTransactionActive
    )
      throw new ForbiddenException('nodia_ai:capability_denied');
    await assertBusinessesAccess(
      context.manager,
      actor(context),
      [String(input.business_id)],
      { lock: true },
    );
  };
  return {
    familyKey: 'business_sales',
    modules: [
      { key: 'businesses', route: '/business', label: 'Negocios' },
    ],
    resources: [
      {
        key: 'sales',
        label: 'Ventas',
        requiredModuleRoutes: ['/business'],
      },
    ],
    capabilities: (['get', 'list'] as const).map((operation) => ({
      capabilityId: `nodia_sales_${operation}`,
      revision: 3,
      publication: 'published',
      toolName: `nodia_sales_${operation}`,
      kind: 'read',
      moduleKey: 'businesses',
      resourceKey: 'sales',
      operationKey: operation,
      descriptionKey: `nodia_ai.capabilities.sales_${operation}`,
      description:
        'Read authorized registered business sales and their frozen effective CLP prices. Informational payment method is not proof of collection. No writes.',
      requiredModuleRoutes: ['/business'],
      actionKeys: [],
      effectKey: 'read:sales',
      inputSchema: {
        sourceJson,
        sha256,
        definition: operation === 'get' ? 'SalesGetInput' : 'SalesListInput',
      },
      outputSchema: {
        sourceJson,
        sha256,
        definition: operation === 'get' ? 'SalesGetResult' : 'SalesListResult',
      },
      verifyAuthority: authority,
      verifyResultAuthority: async (input, result, context) => {
        await authority(input, context);
        const rows = operation === 'get' ? [result.data] : result.data;
        if (
          !Array.isArray(rows) ||
          rows.some(
            (row) =>
              !row ||
              typeof row !== 'object' ||
              Array.isArray(row) ||
              typeof row.business_id !== 'string' ||
              row.business_id.toLowerCase() !==
                String(input.business_id).toLowerCase() ||
              (operation === 'get' &&
                String(row.id).toLowerCase() !==
                  String(input.id).toLowerCase()),
          )
        )
          throw new ForbiddenException(
            'nodia_ai:business_result_scope_invalid',
          );
        assertSaleMeasurements(rows);
      },
      handler: async (input, context) => {
        await authority(input, context);
        const result =
          operation === 'get'
            ? {
                data: await reader.get(
                  String(input.business_id),
                  String(input.id),
                  actor(context),
                  context.manager,
                ),
              }
            : await reader.list(
                String(input.business_id),
                {
                  page: input.page ?? 1,
                  limit: input.limit ?? 25,
                  ...(input.status ? { status: input.status } : {}),
                  ...(input.from ? { from: input.from } : {}),
                  ...(input.to_exclusive
                    ? { to_exclusive: input.to_exclusive }
                    : {}),
                  ...(input.search ? { search: input.search } : {}),
                } as SaleListQuery,
                actor(context),
                context.manager,
              );
        assertSaleMeasurements(
          operation === 'get' ? [result.data] : result.data,
        );
        if (operation === 'list') {
          const page = result as Awaited<ReturnType<ReadSalesUseCase['list']>>;
          return JSON.parse(
            JSON.stringify({
              data: page.data,
              meta: {
                page: page.meta.page,
                limit: page.meta.limit,
                total_items: page.meta.total_items,
                total_pages: page.meta.total_pages,
              },
            }),
          ) as NodiaAiJsonObject;
        }
        return JSON.parse(JSON.stringify(result)) as NodiaAiJsonObject;
      },
    })),
  };
}
