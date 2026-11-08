import type {
  ReportSourceDefinition,
  ReportValueType,
} from './report-source.types.js';

export type ReportScalar = string | number | boolean | null;
export interface ReportPredicate {
  field_key: string;
  operator:
    'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'contains' | 'is_null';
  value?: ReportScalar;
  values?: ReportScalar[];
}
export interface ReportPeriod {
  kind: 'civil_date' | 'instant';
  dimension_key: string;
  from: string;
  to_exclusive: string;
  timezone: string;
}
export interface ReportSourceRequest {
  source_key: string;
  alias: string;
  scope: {
    subject_user_id?: string;
    business_id?: string;
    property_id?: string;
    provider_id?: string;
  };
  filters?: { all?: ReportPredicate[]; any?: ReportPredicate[] };
  period?: ReportPeriod;
  measures: {
    measure_key: string;
    aggregation: 'sum' | 'count';
    output_key: string;
  }[];
  group_by?: { dimension_key: string; output_key: string }[];
  /** Only selected output keys; Server maps these to trusted aggregate/dimension expressions. */
  order_by?: { output_key: string; direction: 'asc' | 'desc' }[];
}
export interface CompileReportInput {
  request: unknown;
  source: ReportSourceDefinition;
  catalogVersion: string;
  /** Constructed exclusively by the backend authority adapter, never public input. */
  scopeSql: string;
  scopeParameters: readonly unknown[];
  scopeFingerprint: string;
  sourceTimezone?: string;
  pageLimit?: number;
  cursor?: string;
  limits: {
    maxGroups: number;
    maxFilters: number;
    maxCollectionItems: number;
    defaultGroups: number;
  };
}
export interface CompiledReportColumn {
  output_key: string;
  sql_key: string;
  value_type: 'text' | 'decimal' | 'number' | 'boolean' | 'date' | 'instant';
  unit: string | null;
  scale: number | null;
  measure_key?: string;
}
export interface CompiledReportQuery {
  sql: string;
  parameters: unknown[];
  request: ReportSourceRequest;
  columns: CompiledReportColumn[];
  queryFingerprint: string;
  pageLimit: number;
  groupKeys: string[];
  groupTypes: string[];
  omittedTotalKeys?: string[];
  cursorOrder: {
    key: string;
    type: ReportValueType | 'aggregate_integer' | 'aggregate_decimal';
    direction: 'asc' | 'desc';
    aggregate: boolean;
  }[];
}
