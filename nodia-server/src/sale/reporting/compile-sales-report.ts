import {
  CompileNodiaAiReportUseCase,
  NodiaAiReportQueryError,
} from '../../nodia-ai-reports/use-case/compile-nodia-ai-report.use-case.js';
import {
  NODIA_AI_REPORT_SOURCES,
  NODIA_AI_REPORT_SOURCES_VERSION,
} from '../../nodia-ai-reports/config/report-sources.js';
import type {
  CompiledReportQuery,
  ReportSourceRequest,
} from '../../nodia-ai-reports/types/report-query.types.js';

/** Native UI and conversational reports share exact SQL and frozen measurement partitions. */
export function compileSalesReport(
  kind: 'sales' | 'items' | 'top',
  query: {
    business_id: string;
    from?: string;
    to_exclusive?: string;
    metric?: 'units' | 'amount';
    limit?: number;
  },
): CompiledReportQuery {
  if ((query.from === undefined) !== (query.to_exclusive === undefined))
    throw new NodiaAiReportQueryError('invalid_input', 'period');
  if (query.metric !== undefined && !['units', 'amount'].includes(query.metric))
    throw new NodiaAiReportQueryError('invalid_input', 'metric');
  const source = NODIA_AI_REPORT_SOURCES.find(
    (item) =>
      item.sourceKey ===
      (kind === 'sales' ? 'business_sales' : 'business_sale_items'),
  )!;
  const request: ReportSourceRequest = {
    source_key: source.sourceKey,
    alias: 'sales',
    scope: { business_id: query.business_id },
    filters: {
      all: [{ field_key: 'status', operator: 'eq', value: 'completed' }],
    },
    measures:
      kind === 'sales'
        ? [
            {
              measure_key: 'records',
              aggregation: 'count',
              output_key: 'sales_count',
            },
            {
              measure_key: 'registered_sale_amount',
              aggregation: 'sum',
              output_key: 'total_amount',
            },
          ]
        : [
            {
              measure_key: 'sold_units',
              aggregation: 'sum',
              output_key: 'units_sold',
            },
            ...(kind === 'top'
              ? [
                  {
                    measure_key: 'registered_line_amount',
                    aggregation: 'sum' as const,
                    output_key: 'total_amount',
                  },
                ]
              : []),
          ],
    ...(kind !== 'sales'
      ? {
          group_by: [
            ...(kind === 'top'
              ? [{ dimension_key: 'product_id', output_key: 'product_id' }]
              : []),
            {
              dimension_key: 'measurement_unit',
              output_key: 'measurement_unit',
            },
          ],
          ...(kind === 'top'
            ? {
                order_by: [
                  {
                    output_key:
                      query.metric === 'amount' ? 'total_amount' : 'units_sold',
                    direction: 'desc' as const,
                  },
                ],
              }
            : {}),
        }
      : {}),
    ...(query.from && query.to_exclusive
      ? {
          period: {
            kind: 'instant' as const,
            dimension_key: 'completed_at',
            from: query.from,
            to_exclusive: query.to_exclusive,
            timezone: 'America/Santiago',
          },
        }
      : {}),
  };
  return new CompileNodiaAiReportUseCase().execute({
    request,
    source,
    catalogVersion: NODIA_AI_REPORT_SOURCES_VERSION,
    scopeSql: `${source.scope.idExpressionSql} = $1`,
    scopeParameters: [query.business_id],
    scopeFingerprint: query.business_id,
    sourceTimezone: 'America/Santiago',
    pageLimit: query.limit ?? 25,
    limits: {
      maxGroups: 100,
      maxFilters: 20,
      maxCollectionItems: 128,
      defaultGroups: 25,
    },
  });
}
