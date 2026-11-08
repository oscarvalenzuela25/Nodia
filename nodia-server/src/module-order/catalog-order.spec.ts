import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GetModulesDto } from '../module/dto/get-modules.dto.js';
import { GetModuleGroupsDto } from '../module-group/dto/get-module-groups.dto.js';
import { compareCatalogOrder } from './compare-catalog-order.js';
import { assertOrderView } from './order-metadata.js';
import { locateModuleOrderPage } from './order-metadata.js';
import type { EntityManager } from 'typeorm';
import { vi } from 'vitest';

describe('catalog presentation order', () => {
  it('locates a module page from its global ordinal without converting the bigint ID', async () => {
    const query = vi.fn<(sql: string, parameters: unknown[]) => Promise<Array<{ position: string }>>>()
      .mockResolvedValue([{ position: '11' }]);
    const manager = { query } as unknown as EntityManager;
    expect(await locateModuleOrderPage(manager, '9007199254740993', 5)).toBe(3);
    expect(query.mock.calls[0]?.[1]).toEqual(['9007199254740993']);
  });

  it('rejects missing anchors and invalid ordinals instead of guessing a page', async () => {
    const query = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ position: 'invalid' }]);
    const manager = { query } as unknown as EntityManager;
    await expect(locateModuleOrderPage(manager, '1', 10)).rejects.toThrow('modules:not_found');
    await expect(locateModuleOrderPage(manager, '1', 10)).rejects.toThrow('modules:invalid_order_metadata');
  });

  it('preserves zero, gaps and exact bigint tie-breakers', () => {
    const rows = [
      { id: '9007199254740993', sort_order: 7 },
      { id: '30', sort_order: 0 },
      { id: '9007199254740992', sort_order: 7 },
    ];
    expect(rows.sort(compareCatalogOrder).map((row) => row.id))
      .toEqual(['30', '9007199254740992', '9007199254740993']);
    expect(compareCatalogOrder(rows[0], rows[0])).toBe(0);
  });

  it('allows only the complete bounded page in ordering mode', () => {
    expect(() => assertOrderView({ ordering: true, limit: 100, q: {} })).not.toThrow();
    expect(() => assertOrderView({ ordering: false, all: true, limit: 500, q: { key_cont: 'x' } })).not.toThrow();
  });

  it.each([
    { all: true },
    { limit: 101 },
    { limit: 0 },
    { limit: 1.5 },
    { q: { is_active_eq: true } },
    { q: { s: 'id DESC' } },
  ])('rejects a partial or unbounded ordering view: %j', (options) => {
    expect(() => assertOrderView({ ordering: true, ...options })).toThrow('modules:invalid_order_view');
  });

  it.each([GetModulesDto, GetModuleGroupsDto])('parses strict boolean ordering flags for %s', (Dto) => {
    expect(plainToInstance(Dto, { ordering: 'true' }).ordering).toBe(true);
    expect(plainToInstance(Dto, { ordering: 'false' }).ordering).toBe(false);
    expect(plainToInstance(Dto, {}).ordering).toBe(false);
    for (const ordering of ['yes', '0', 'null', 1]) {
      expect(validateSync(plainToInstance(Dto, { ordering })).some((error) => error.property === 'ordering')).toBe(true);
    }
  });
});
