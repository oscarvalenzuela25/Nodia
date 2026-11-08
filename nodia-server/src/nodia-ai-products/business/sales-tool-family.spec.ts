import { readFileSync } from 'node:fs';
import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { ReadSalesUseCase } from '../../sale/use-case/read-sales.use-case.js';
import { NodiaAiToolRegistryUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type { Sale } from '../../sale/entities/sale.entity.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { createNodiaAiSalesToolFamily } from './sales-tool-family.js';

const business = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const source = readFileSync(
  new URL('../contracts/sales.schema.json', import.meta.url),
  'utf8',
);
const sale = {
  id,
  business_id: business,
  status: 'completed',
  currency: 'CLP',
  payment_method: 'cash',
  payment_method_description: null,
  total_amount: '10010',
  version: 1,
  created_at: '2026-10-30T12:00:00Z',
  updated_at: '2026-10-30T12:00:00Z',
  completed_at: '2026-10-30T12:00:00Z',
  cancelled_at: null,
  cancellation_reason: null,
  items: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      product_id: '9007199254740993',
      position: 0,
      quantity: 1.001,
      product_code_snapshot: null,
      product_barcode_snapshot: null,
      measurement_unit_snapshot: 'kg',
      product_name_snapshot: 'Rice',
      regular_unit_price: '10000',
      offer_price_snapshot: null,
      is_offer_enabled_snapshot: false,
      price_source: 'regular',
      unit_price: '10000',
      line_total: '10010',
      product_version: 1,
    },
  ],
};

function fixture(value: unknown = sale) {
  const reader = {
    get: vi.fn(async () => value),
    list: vi.fn(async () => ({
      data: [value],
      meta: { page: 1, limit: 25, total_items: 1, total_pages: 1 },
    })),
  };
  const family = createNodiaAiSalesToolFamily(
    source,
    reader as unknown as ReadSalesUseCase,
  );
  const registry = new NodiaAiToolRegistryUseCase(
    [family],
    'synthetic_sale_units',
  );
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('AS authority_locks')) return [{ authority_locks: 9 }];
    if (sql.includes('AS "actorId"'))
      return [{ actorId: '7', sessionId: id, isSuperAdmin: true }];
    if (sql.includes('FROM businesses')) return [{ id: business }];
    throw new Error('Unexpected synthetic SQL boundary');
  });
  const context: NodiaAiToolHandlerContext = {
    manager: {
      query,
      queryRunner: { isTransactionActive: true },
    } as unknown as EntityManager,
    actor: { actorId: '7', sessionId: id, isSuperAdmin: true, modules: [] },
    moduleRoutes: ['/business'],
  };
  return { reader, registry, context };
}

describe('Read-only sale measurement contract', () => {
  it('accepts 1.001 through the actual registry and native result guard without IEEE multipleOf rejection', async () => {
    const { reader, registry, context } = fixture();
    expect(
      registry.list(['/business']).map((tool) => tool.toolName),
    ).toEqual(['nodia_sales_get', 'nodia_sales_list']);
    expect(
      registry.list(['/business']).every((tool) => tool.kind === 'read'),
    ).toBe(true);
    expect(
      registry.list(['/business']).every((tool) => tool.revision === 3),
    ).toBe(true);
    for (const operation of ['get', 'list']) {
      const tool = registry.get(`nodia_sales_${operation}`)!;
      const input = {
        business_id: business,
        ...(operation === 'get' ? { id } : {}),
      };
      const result = await tool.handler!(input, context);
      expect(registry.validateOutput(tool, result)).toEqual(result);
      await expect(
        tool.verifyResultAuthority!(input, result, context),
      ).resolves.toBeUndefined();
    }
    expect(reader.get).toHaveBeenCalledOnce();
    expect(reader.list).toHaveBeenCalledOnce();
  });

  it.each([0, -1, 1.0001, 0.0009, NaN, Infinity, '1.001', 2147483647.001])(
    'rejects malformed, excessive-scale or out-of-range reader quantity %j without coercion',
    async (quantity) => {
      const changed = { ...sale, items: [{ ...sale.items[0], quantity }] };
      const { registry, context } = fixture(changed);
      await expect(
        registry.get('nodia_sales_get')!.handler!(
          { business_id: business, id },
          context,
        ),
      ).rejects.toThrow('nodia_ai:business_result_invalid');
    },
  );

  it('enforces decimal scale again for a cached read result instead of relying on JSON Schema alone', async () => {
    const { registry, context } = fixture();
    const tool = registry.get('nodia_sales_get')!;
    const cached: NodiaAiJsonObject = {
      data: { ...sale, items: [{ ...sale.items[0], quantity: 1.0001 }] },
    };
    await expect(
      tool.verifyResultAuthority!(
        { business_id: business, id },
        cached,
        context,
      ),
    ).rejects.toThrow('nodia_ai:business_result_invalid');
  });

  it.each([null, undefined, 'mg', 'l', 'ml', 'm'])(
    'rejects missing or unsupported snapshot unit %j',
    async (measurement_unit_snapshot) => {
      const { registry, context } = fixture({
        ...sale,
        items: [{ ...sale.items[0], measurement_unit_snapshot }],
      });
      await expect(
        registry.get('nodia_sales_list')!.handler!(
          { business_id: business },
          context,
        ),
      ).rejects.toThrow('nodia_ai:business_result_invalid');
    },
  );

  it('preserves quantity and snapshot unit without modifying stored sales or synthesizing a supplier code', async () => {
    const { registry, context } = fixture({
      ...sale,
      items: [
        {
          ...sale.items[0],
          quantity: 0.001,
          measurement_unit_snapshot: 'bundle',
        },
      ],
    });
    const result = await registry.get('nodia_sales_get')!.handler!(
      { business_id: business, id },
      context,
    );
    expect((result.data as unknown as Sale).items[0]).toMatchObject({
      quantity: 0.001,
      measurement_unit_snapshot: 'bundle',
      product_code_snapshot: null,
    });
    expect(context.manager.query).toHaveBeenCalled();
    expect(
      vi
        .mocked(context.manager.query)
        .mock.calls.every(([sql]) =>
          String(sql).trimStart().startsWith('SELECT'),
        ),
    ).toBe(true);
  });
  it('returns an explicit manual price with its original catalog snapshots through read-only schema3 tools', async () => {
    const manual = {
      ...sale,
      total_amount: '901',
      items: [
        {
          ...sale.items[0],
          price_source: 'manual',
          unit_price: '900',
          line_total: '901',
          offer_price_snapshot: '8000',
          is_offer_enabled_snapshot: true,
        },
      ],
    };
    const { registry, context } = fixture(manual);
    for (const operation of ['get', 'list']) {
      const tool = registry.get(`nodia_sales_${operation}`)!;
      const input = {
        business_id: business,
        ...(operation === 'get' ? { id } : {}),
      };
      const result = await tool.handler!(input, context);
      expect(registry.validateOutput(tool, result)).toEqual(result);
      await expect(
        tool.verifyResultAuthority!(input, result, context),
      ).resolves.toBeUndefined();
      const rows =
        operation === 'get' ? [result.data] : (result.data as unknown[]);
      expect(rows).toEqual([manual]);
    }
    expect(
      registry.list(['/business']).map((tool) => tool.toolName),
    ).toEqual(['nodia_sales_get', 'nodia_sales_list']);
    expect(
      vi
        .mocked(context.manager.query)
        .mock.calls.every(([sql]) =>
          String(sql).trimStart().startsWith('SELECT'),
        ),
    ).toBe(true);
  });
});
