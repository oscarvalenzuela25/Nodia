import { describe, expect, it } from 'vitest';
import { CompileNodiaAiReportUseCase } from './compile-nodia-ai-report.use-case.js';
import { compileSalesReport } from '../../sale/reporting/compile-sales-report.js';
import {
  NODIA_AI_REPORT_SOURCES,
  NODIA_AI_REPORT_SOURCES_VERSION,
} from '../config/report-sources.js';
import type { ReportSourceRequest } from '../types/report-query.types.js';

const business_id = '00000000-0000-4000-8000-000000000001';
describe('global sale ranking contracts', () => {
  it('aggregates the complete population before limiting, sorts integer amounts numerically and breaks ties by product', () => {
    const result = compileSalesReport('top', {
      business_id,
      metric: 'amount',
      limit: 2,
    });
    expect(result.sql.indexOf('GROUP BY g0')).toBeLessThan(
      result.sql.indexOf('page AS'),
    );
    expect(result.sql).toContain(
      'grouped.m1::numeric DESC NULLS LAST, grouped.g0 ASC NULLS LAST, grouped.g1 ASC NULLS LAST',
    );
    expect(result.parameters).toEqual([business_id, 'completed', 3]);
    expect(result.sql).not.toContain('GROUP BY r.product_name_snapshot');
  });
  it('retains exact aggregate cursor values above JS and SQL bigint and includes a stable tie-breaker', () => {
    const result = compileSalesReport('top', { business_id });
    const cursor = new CompileNodiaAiReportUseCase().nextCursor(result, {
      g0: '2',
      g1: 'kg',
      m0: '18446744073709551614.125',
      m1: '0',
    });
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as { values: unknown[] };
    expect(parsed.values).toEqual(['18446744073709551614.125', '2', 'kg']);
  });
  it('rejects partial periods and unsupported metrics instead of silently changing the report', () => {
    expect(() =>
      compileSalesReport('top', { business_id, from: '2026-10-28T00:00:00Z' }),
    ).toThrow('nodia_ai:invalid_input');
    expect(() =>
      compileSalesReport('top', { business_id, metric: 'profit' as 'units' }),
    ).toThrow('nodia_ai:invalid_input');
  });
  it('requires a frozen measurement partition and never exposes a mixed scalar quantity total', () => {
    const compiler = new CompileNodiaAiReportUseCase();
    const source = NODIA_AI_REPORT_SOURCES.find(
      (entry) => entry.sourceKey === 'business_sale_items',
    )!;
    const compile = (change: Partial<ReportSourceRequest> = {}) =>
      compiler.execute({
        source,
        request: {
          source_key: source.sourceKey,
          alias: 'items',
          scope: { business_id },
          measures: [
            {
              measure_key: 'sold_units',
              aggregation: 'sum',
              output_key: 'quantity',
            },
          ],
          ...change,
        },
        catalogVersion: 'synthetic-units',
        scopeSql: 'r.business_id=$1',
        scopeParameters: [business_id],
        scopeFingerprint: business_id,
        limits: {
          maxGroups: 100,
          maxFilters: 20,
          maxCollectionItems: 128,
          defaultGroups: 25,
        },
      });
    expect(() => compile()).toThrow('nodia_ai:unsupported_semantics');
    expect(() =>
      compile({
        group_by: [{ dimension_key: 'product_id', output_key: 'product' }],
      }),
    ).toThrow();
    expect(() =>
      compile({
        filters: {
          any: [
            { field_key: 'measurement_unit', operator: 'eq', value: 'kg' },
            { field_key: 'measurement_unit', operator: 'eq', value: 'g' },
          ],
        },
      }),
    ).toThrow();
    const grouped = compile({
      group_by: [{ dimension_key: 'measurement_unit', output_key: 'unit' }],
    });
    expect(grouped.columns[1].scale).toBe(3);
    expect(grouped.omittedTotalKeys).toEqual(['m0']);
    expect(grouped.sql).toContain(
      'totals AS (SELECT COUNT(*)::text AS matched_records FROM filtered)',
    );
    const filtered = compile({
      filters: {
        all: [{ field_key: 'measurement_unit', operator: 'eq', value: 'kg' }],
      },
    });
    expect(filtered.omittedTotalKeys).toEqual(['m0']);
    expect(filtered.parameters).toContain('kg');
  });
  it('binds fractional numeric cursors exactly and rejects more than three decimals', () => {
    const compiler = new CompileNodiaAiReportUseCase();
    const first = compileSalesReport('top', { business_id });
    const cursor = compiler.nextCursor(first, {
      g0: '2',
      g1: 'kg',
      m0: '0.125',
      m1: '10',
    });
    const source = NODIA_AI_REPORT_SOURCES.find(
      (entry) => entry.sourceKey === 'business_sale_items',
    )!;
    const next = compiler.execute({
      request: first.request,
      source,
      cursor,
      catalogVersion: NODIA_AI_REPORT_SOURCES_VERSION,
      scopeSql: 'r.business_id=$1',
      scopeParameters: [business_id],
      scopeFingerprint: business_id,
      limits: {
        maxGroups: 100,
        maxFilters: 20,
        maxCollectionItems: 128,
        defaultGroups: 25,
      },
    });
    expect(next.parameters).toContain('0.125');
    expect(() =>
      compiler.nextCursor(first, { g0: '2', g1: 'kg', m0: '0.1251', m1: '10' }),
    ).toThrow();
  });
  it('binds manual price-source filters while aggregating registered final amounts rather than catalog prices', () => {
    const source = NODIA_AI_REPORT_SOURCES.find(
      (entry) => entry.sourceKey === 'business_sale_items',
    )!;
    const result = new CompileNodiaAiReportUseCase().execute({
      source,
      request: {
        source_key: source.sourceKey,
        alias: 'manual_lines',
        scope: { business_id },
        filters: {
          all: [{ field_key: 'price_source', operator: 'eq', value: 'manual' }],
        },
        measures: [
          {
            measure_key: 'registered_line_amount',
            aggregation: 'sum',
            output_key: 'total',
          },
        ],
      },
      catalogVersion: NODIA_AI_REPORT_SOURCES_VERSION,
      scopeSql: 'r.business_id=$1',
      scopeParameters: [business_id],
      scopeFingerprint: business_id,
      limits: {
        maxGroups: 100,
        maxFilters: 20,
        maxCollectionItems: 128,
        defaultGroups: 25,
      },
    });
    expect(result.parameters).toContain('manual');
    expect(result.sql).toContain('r.price_source = $2');
    expect(result.sql).toContain(
      "CASE WHEN sale.status = 'completed' THEN r.line_total ELSE 0 END",
    );
    expect(result.sql).not.toContain('r.regular_unit_price');
    expect(result.sql).not.toContain('r.offer_price_snapshot');
  });
});
