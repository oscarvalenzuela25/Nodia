/** Logical report vocabulary. SQL mappings are trusted code and never public descriptors. */
export type ReportScopeKind = 'personal' | 'business' | 'rental';
export type ReportValueType =
  | 'string'
  | 'bigint_id'
  | 'bigint_integer'
  | 'uuid'
  | 'boolean'
  | 'integer'
  | 'date'
  | 'datetime';
export type ReportFilterOperator =
  'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'contains' | 'is_null';
export type ReportAggregation = 'sum' | 'count';
export type ReportTemporalKind = 'civil_date' | 'instant' | 'local_datetime';

export interface ReportFieldDescriptor {
  readonly field_key: string;
  readonly value_type: ReportValueType;
  readonly allowed_operators: readonly ReportFilterOperator[];
  readonly nullable: boolean;
  readonly dimension_key: string | null;
  readonly temporal_kind: ReportTemporalKind | null;
  readonly values: readonly string[] | null;
  readonly semantics: string;
}
export interface ReportMeasureDescriptor {
  readonly measure_key: string;
  readonly aggregations: readonly ReportAggregation[];
  readonly unit: 'money' | 'peso' | 'count' | 'units';
  readonly currency: string | null;
  readonly scale: number;
  readonly semantic: string;
  readonly grain: string;
  readonly nullable: boolean;
  readonly supported: boolean;
  readonly unsupported_reason: string | null;
}
export interface ReportRelationshipDescriptor {
  readonly relationship_key: string;
  readonly cardinality: 'one_to_many';
  readonly filter_fields: readonly string[];
  readonly semantics: string;
}
export interface ReportSourceDescriptor {
  readonly source_key: string;
  readonly module_key: string;
  readonly measure_keys: readonly string[];
  readonly dimension_keys: readonly string[];
  readonly field_keys: readonly string[];
  readonly relationship_keys: readonly string[];
  readonly basis_key: string;
  readonly scope_kind: ReportScopeKind;
  readonly grain: string;
  readonly fields: readonly ReportFieldDescriptor[];
  readonly measures: readonly ReportMeasureDescriptor[];
  readonly relationships: readonly ReportRelationshipDescriptor[];
  readonly limitations: readonly string[];
}
export interface ReportFieldDefinition {
  readonly descriptor: ReportFieldDescriptor;
  /** Fixed expression from this registry; no user identifier interpolation. */
  readonly expressionSql: string;
  /** A related predicate is evaluated as a semijoin, preserving the parent grain. */
  readonly existsSql?: {
    readonly fromSql: string;
    readonly correlationSql: string;
  };
}
export interface ReportMeasureDefinition {
  readonly descriptor: ReportMeasureDescriptor;
  /** Scalar per base row. Compiler owns SUM/COUNT and exact serialization. */
  readonly expressionSql: string;
  /** Heterogeneous quantities require grouping or fixing this dimension; no scalar total is exposed. */
  readonly requiredDimensionKey?: string;
}
export interface ReportSourceDefinition {
  /** A new domain source stays private until this exact document is present in the compiled approved bundle. */
  readonly publicationDocumentId?: string;
  readonly sourceKey: string;
  readonly moduleKey: string;
  readonly requiredModuleRoutes: readonly string[];
  readonly descriptor: ReportSourceDescriptor;
  readonly fromSql: string;
  readonly fields: Readonly<Record<string, ReportFieldDefinition>>;
  readonly measures: Readonly<Record<string, ReportMeasureDefinition>>;
  readonly scope: {
    readonly kind: ReportScopeKind;
    readonly idExpressionSql: string;
  };
  readonly basePredicatesSql: readonly string[];
}
