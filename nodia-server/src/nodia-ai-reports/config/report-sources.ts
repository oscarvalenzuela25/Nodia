import { createHash } from 'node:crypto';
import { PRODUCT_MEASUREMENT_UNITS } from '../../product/product-measurement-unit.js';
import type {
  ReportFieldDefinition,
  ReportFilterOperator,
  ReportMeasureDefinition,
  ReportRelationshipDescriptor,
  ReportScopeKind,
  ReportSourceDefinition,
  ReportTemporalKind,
  ReportValueType,
} from '../types/report-source.types.js';

const equality: readonly ReportFilterOperator[] = [
  'eq',
  'neq',
  'in',
  'is_null',
];
const ordered: readonly ReportFilterOperator[] = [
  ...equality,
  'lt',
  'lte',
  'gt',
  'gte',
];
const textual: readonly ReportFilterOperator[] = [...equality, 'contains'];

function field(
  key: string,
  type: ReportValueType,
  sql: string,
  options: {
    nullable?: boolean;
    temporal?: ReportTemporalKind;
    values?: readonly string[];
    semantics?: string;
    groupable?: boolean;
    exists?: { fromSql: string; correlationSql: string };
  } = {},
): ReportFieldDefinition {
  return {
    descriptor: {
      field_key: key,
      value_type: type,
      allowed_operators:
        options.temporal === 'local_datetime'
          ? []
          : type === 'string' && !options.values
            ? textual
            : ['integer', 'bigint_integer', 'date', 'datetime'].includes(type)
              ? ordered
              : equality,
      nullable: options.nullable ?? false,
      dimension_key:
        options.exists ||
        options.groupable === false ||
        options.temporal === 'local_datetime'
          ? null
          : key,
      temporal_kind: options.temporal ?? null,
      values: options.values ?? null,
      semantics: options.semantics ?? key,
    },
    expressionSql: sql,
    ...(options.exists ? { existsSql: options.exists } : {}),
  };
}

function measure(
  key: string,
  sql: string,
  grain: string,
  semantic: string,
  options: {
    unit?: 'money' | 'peso' | 'count' | 'units';
    currency?: string | null;
    unsupportedReason?: string;
    scale?: number;
    requiredDimensionKey?: string;
  } = {},
): ReportMeasureDefinition {
  const unit = options.unit ?? 'money';
  return {
    descriptor: {
      measure_key: key,
      aggregations: unit === 'count' ? ['count'] : ['sum'],
      unit,
      currency: options.currency ?? null,
      scale: options.scale ?? 0,
      semantic,
      grain,
      nullable: false,
      supported: !options.unsupportedReason,
      unsupported_reason: options.unsupportedReason ?? null,
    },
    expressionSql: sql,
    ...(options.requiredDimensionKey
      ? { requiredDimensionKey: options.requiredDimensionKey }
      : {}),
  };
}

function source(config: {
  key: string;
  module: string;
  route: string;
  scope: ReportScopeKind;
  scopeSql: string;
  fromSql: string;
  grain: string;
  basis: string;
  fields: readonly ReportFieldDefinition[];
  measures?: readonly ReportMeasureDefinition[];
  relationships?: readonly ReportRelationshipDescriptor[];
  limitations?: readonly string[];
  predicates?: readonly string[];
  publicationDocumentId?: string;
}): ReportSourceDefinition {
  const measures = [
    measure('records', '1', config.grain, 'base_record_count', {
      unit: 'count',
    }),
    ...(config.measures ?? []),
  ];
  const relationships = config.relationships ?? [];
  return {
    sourceKey: config.key,
    ...(config.publicationDocumentId
      ? { publicationDocumentId: config.publicationDocumentId }
      : {}),
    moduleKey: config.module,
    requiredModuleRoutes: [config.route],
    fromSql: config.fromSql,
    fields: Object.fromEntries(
      config.fields.map((entry) => [entry.descriptor.field_key, entry]),
    ),
    measures: Object.fromEntries(
      measures.map((entry) => [entry.descriptor.measure_key, entry]),
    ),
    scope: { kind: config.scope, idExpressionSql: config.scopeSql },
    basePredicatesSql: config.predicates ?? [],
    descriptor: {
      source_key: config.key,
      module_key: config.module,
      measure_keys: measures.map((entry) => entry.descriptor.measure_key),
      dimension_keys: config.fields.flatMap((entry) =>
        entry.descriptor.dimension_key ? [entry.descriptor.dimension_key] : [],
      ),
      field_keys: config.fields.map((entry) => entry.descriptor.field_key),
      relationship_keys: relationships.map((entry) => entry.relationship_key),
      basis_key: config.basis,
      scope_kind: config.scope,
      grain: config.grain,
      fields: config.fields.map((entry) => entry.descriptor),
      measures: measures.map((entry) => entry.descriptor),
      relationships,
      limitations: config.limitations ?? [],
    },
  };
}

const finance = {
  module: 'personal_finance',
  route: '/finances-personal',
  scope: 'personal' as const,
  scopeSql: 'r.user_id',
};
const business = {
  module: 'businesses',
  route: '/business',
  scope: 'business' as const,
  scopeSql: 'r.business_id',
};
const rental = {
  module: 'rental_reservations',
  route: '/reservations',
  scope: 'rental' as const,
  scopeSql: 'r.property_id',
};
const recordedAt = () =>
  field('created_at', 'datetime', 'r.created_at', {
    temporal: 'instant',
    semantics: 'server_record_creation_instant',
  });
const localRecordedAt = () =>
  field('created_at', 'datetime', 'r.created_at', {
    temporal: 'local_datetime',
    semantics: 'legacy_creation_timestamp_without_timezone',
  });
const active = () =>
  field('is_active', 'boolean', 'r.is_active', {
    semantics: 'visibility_not_financial_cancellation',
  });
const financeLimits = [
  'Only the server creation instant is available; there is no purchase, accrual or payment date.',
  'There is no commercial supplier relationship.',
  'Amounts are native integer pesos by the finance contract; no ISO currency is stored or inferred. No conversion or cross-source comparison is authorized.',
  'Activity is visibility. Inactive records retain their monetary effect unless explicitly filtered.',
];
const legacyLimits = [
  'Legacy creation timestamps have no timezone. An instant period requires an explicit domain timezone contract and is unsupported here.',
];

/** Explicit immutable whitelist. Adding a product requires a reviewed mapping, not ORM discovery. */
export const NODIA_AI_REPORT_SOURCES: readonly ReportSourceDefinition[] =
  deepFreeze([
    source({
      ...finance,
      key: 'finance_movements',
      fromSql: 'finance_movements r',
      grain: 'one_finance_movement',
      basis: 'created_at',
      fields: [
        field('id', 'bigint_id', 'r.id'),
        field('category_id', 'bigint_id', 'r.category_id'),
        field('obligation_id', 'bigint_id', 'r.obligation_id', {
          nullable: true,
        }),
        field('name', 'string', 'r.name'),
        field('type', 'string', 'r.type', { values: ['income', 'expense'] }),
        field('status', 'string', 'r.status', {
          values: ['pending', 'received', 'paid', 'cancelled'],
        }),
        field('recorded_amount', 'bigint_integer', 'r.amount', {
          groupable: false,
          semantics: 'original_recorded_pesos_before_financial_status_effect',
        }),
        active(),
        recordedAt(),
        field('category_group_id', 'bigint_id', 'fg.category_group_id', {
          semantics: 'active_category_group_membership',
          exists: {
            fromSql: 'finance_category_group_memberships fg',
            correlationSql:
              'fg.user_id = r.user_id AND fg.category_id = r.category_id AND fg.is_active = TRUE',
          },
        }),
      ],
      measures: [
        measure(
          'confirmed_amount',
          "CASE WHEN r.status IN ('received','paid') THEN r.amount ELSE 0 END",
          'one_finance_movement',
          'confirmed_finance_movement_amount',
          { unit: 'peso' },
        ),
        measure(
          'confirmed_expense_amount',
          "CASE WHEN r.type = 'expense' AND r.status = 'paid' THEN r.amount ELSE 0 END",
          'one_finance_movement',
          'paid_personal_expense_amount',
          { unit: 'peso' },
        ),
        measure(
          'confirmed_income_amount',
          "CASE WHEN r.type = 'income' AND r.status = 'received' THEN r.amount ELSE 0 END",
          'one_finance_movement',
          'received_personal_income_amount',
          { unit: 'peso' },
        ),
      ],
      relationships: [
        {
          relationship_key: 'category_groups',
          cardinality: 'one_to_many',
          filter_fields: ['category_group_id'],
          semantics:
            'Active membership filters are semijoins; overlapping groups never duplicate movements.',
        },
      ],
      limitations: financeLimits,
    }),
    source({
      ...finance,
      key: 'finance_obligations',
      fromSql: 'finance_obligations r',
      grain: 'one_finance_obligation',
      basis: 'created_at',
      fields: [
        field('id', 'bigint_id', 'r.id'),
        field('name', 'string', 'r.name'),
        field('key', 'string', 'r.key'),
        field('type', 'string', 'r.type', { values: ['loan', 'debt'] }),
        field('recorded_amount', 'bigint_integer', 'r.amount', {
          groupable: false,
          semantics:
            'original_obligation_principal_pesos_not_remaining_balance',
        }),
        active(),
        recordedAt(),
      ],
      measures: [
        measure(
          'principal_amount',
          'r.amount',
          'one_finance_obligation',
          'original_obligation_principal_amount',
          { unit: 'peso' },
        ),
      ],
      limitations: [
        ...financeLimits,
        'Principal is the recorded original amount, not remaining balance or cash flow; payments are separate movements.',
      ],
    }),
    source({
      ...business,
      key: 'business_invoices',
      fromSql: 'invoices r',
      grain: 'one_business_invoice',
      basis: 'created_at',
      fields: [
        field('id', 'bigint_id', 'r.id'),
        field('provider_id', 'bigint_id', 'r.provider_id', { nullable: true }),
        field('code', 'string', 'r.code', { nullable: true }),
        field('measurement_unit', 'string', 'r.measurement_unit', {
          values: PRODUCT_MEASUREMENT_UNITS,
        }),
        active(),
        localRecordedAt(),
      ],
      measures: [
        measure(
          'invoice_amount',
          'r.total_amount',
          'one_business_invoice',
          'recorded_invoice_total_not_payment',
          {
            unsupportedReason:
              'Invoice currency is not typed. A monetary sum cannot assert compatible currency.',
          },
        ),
      ],
      limitations: [
        ...legacyLimits,
        'No typed invoice currency, issue/purchase date or payment status; JSON extraction data is not reportable.',
        'Count is supported; monetary sum requires a currency contract.',
      ],
    }),
    source({
      ...business,
      key: 'business_products',
      fromSql: 'products r',
      grain: 'one_current_product',
      basis: 'current_snapshot',
      fields: [
        field('id', 'bigint_id', 'r.id'),
        field('provider_id', 'bigint_id', 'r.provider_id', { nullable: true }),
        field('code', 'string', 'r.code'),
        field('name', 'string', 'r.name'),
        field('barcode', 'string', 'r.barcode', { nullable: true }),
        field('has_stock', 'boolean', 'r.has_stock', {
          nullable: true,
          semantics: 'manual_availability_not_inventory_units',
        }),
        field('is_offer_enabled', 'boolean', 'r.is_offer_enabled'),
        field('sale_price', 'integer', 'r.sale_price', { groupable: false }),
        active(),
        localRecordedAt(),
        field('log_name', 'string', 'pl.name', {
          exists: {
            fromSql: 'product_logs pl',
            correlationSql: 'pl.product_id = r.id',
          },
        }),
      ],
      relationships: [
        {
          relationship_key: 'historical_snapshots',
          cardinality: 'one_to_many',
          filter_fields: ['log_name'],
          semantics:
            'Existence of historical snapshot by name; never a sale or stock event.',
        },
      ],
      limitations: [
        ...legacyLimits,
        'Availability is manual, not inventory units. Product prices are not completed sales and are not monetary aggregates.',
      ],
    }),
    source({
      ...business,
      key: 'business_product_logs',
      fromSql: 'product_logs r INNER JOIN products rp ON rp.id = r.product_id',
      scopeSql: 'rp.business_id',
      grain: 'one_historical_product_snapshot',
      basis: 'created_at',
      fields: [
        field('id', 'uuid', 'r.id'),
        field('product_id', 'bigint_id', 'r.product_id'),
        field('code', 'string', 'r.code'),
        field('name', 'string', 'r.name'),
        localRecordedAt(),
      ],
      limitations: [
        ...legacyLimits,
        'Historical snapshots are not sales or inventory movements; stocks across snapshots must not be summed.',
        'Business is resolved through the current parent product; historic provider ownership is not stored.',
      ],
    }),
    source({
      ...business,
      key: 'business_sales',
      publicationDocumentId: 'businesses.point-of-sale-and-sales',
      fromSql: 'sales r',
      grain: 'one_business_sale',
      basis: 'completed_at',
      fields: [
        field('id', 'uuid', 'r.id'),
        field('status', 'string', 'r.status', {
          values: ['draft', 'completed', 'cancelled', 'discarded'],
        }),
        field('payment_method', 'string', 'r.payment_method', {
          values: [
            'cash',
            'bank_transfer',
            'debit_card',
            'credit_card',
            'other',
          ],
          semantics: 'informational_method_not_evidence_of_collection',
        }),
        field('completed_at', 'datetime', 'r.completed_at', {
          nullable: true,
          temporal: 'instant',
        }),
        field('cancelled_at', 'datetime', 'r.cancelled_at', {
          nullable: true,
          temporal: 'instant',
        }),
        recordedAt(),
      ],
      measures: [
        measure(
          'registered_sale_amount',
          "CASE WHEN r.status = 'completed' THEN r.total_amount ELSE 0 END",
          'one_business_sale',
          'currently_non_cancelled_registered_sale_amount_not_collected_money',
          { currency: 'CLP' },
        ),
      ],
      limitations: [
        'Recorded sales are not collections, bank income or fiscal documents.',
        'Only completed sales contribute monetary effect. A later cancellation removes the sale from its original period; no immutable closing report is implied.',
        'America/Santiago governs calendar reporting; completed_at is the server confirmation instant.',
      ],
    }),
    source({
      ...business,
      key: 'business_sale_items',
      publicationDocumentId: 'businesses.point-of-sale-and-sales',
      fromSql:
        'sale_items r INNER JOIN sales sale ON sale.id=r.sale_id AND sale.business_id=r.business_id',
      grain: 'one_business_sale_item',
      basis: 'completed_at',
      fields: [
        field('sale_id', 'uuid', 'r.sale_id'),
        field('product_id', 'bigint_id', 'r.product_id'),
        field('product_code', 'string', 'r.product_code_snapshot', {
          nullable: true,
          groupable: false,
        }),
        field('measurement_unit', 'string', 'r.measurement_unit_snapshot', {
          values: PRODUCT_MEASUREMENT_UNITS,
          semantics: 'frozen_product_measurement_unit_no_automatic_conversion',
        }),
        field('product_barcode', 'string', 'r.product_barcode_snapshot', {
          nullable: true,
          groupable: false,
        }),
        field('product_name', 'string', 'r.product_name_snapshot', {
          groupable: false,
        }),
        field('price_source', 'string', 'r.price_source', {
          values: ['regular', 'offer', 'manual'],
        }),
        field('status', 'string', 'sale.status', {
          values: ['draft', 'completed', 'cancelled', 'discarded'],
        }),
        field('completed_at', 'datetime', 'sale.completed_at', {
          nullable: true,
          temporal: 'instant',
        }),
      ],
      measures: [
        measure(
          'sold_units',
          "CASE WHEN sale.status = 'completed' THEN r.quantity ELSE 0 END",
          'one_business_sale_item',
          'currently_completed_sale_quantity_in_frozen_measurement_unit',
          { unit: 'units', scale: 3, requiredDimensionKey: 'measurement_unit' },
        ),
        measure(
          'registered_line_amount',
          "CASE WHEN sale.status = 'completed' THEN r.line_total ELSE 0 END",
          'one_business_sale_item',
          'currently_completed_effective_frozen_line_amount',
          { currency: 'CLP' },
        ),
      ],
      limitations: [
        'Rank by stable product_id and frozen measurement_unit, never group by names/codes, current unit or current offer.',
        'sold_units requires group_by measurement_unit or an explicit all/eq measurement_unit filter. Quantities appear in rows only, never in scalar totals; kilograms, grams, units and other measures are not added or converted.',
        'Amounts use the effective frozen price, not the current catalog or an inferred discount/profit.',
        'Lines and sale headers have different grains: never join line aggregates to sum header totals.',
        'America/Santiago governs sale periods.',
      ],
    }),
    source({
      ...business,
      key: 'business_providers',
      fromSql: 'providers r',
      grain: 'one_commercial_provider',
      basis: 'created_at',
      fields: [
        field('id', 'bigint_id', 'r.id'),
        field('name', 'string', 'r.name'),
        active(),
        localRecordedAt(),
        field('contact_name', 'string', 'pc.name', {
          exists: {
            fromSql: 'personal_info_provider pc',
            correlationSql: 'pc.provider_id = r.id',
          },
        }),
        field('product_code', 'string', 'pp.code', {
          exists: {
            fromSql: 'products pp',
            correlationSql:
              'pp.provider_id = r.id AND pp.business_id = r.business_id',
          },
        }),
        field('invoice_code', 'string', 'pi.code', {
          exists: {
            fromSql: 'invoices pi',
            correlationSql:
              'pi.provider_id = r.id AND pi.business_id = r.business_id',
          },
        }),
      ],
      relationships: [
        {
          relationship_key: 'contacts',
          cardinality: 'one_to_many',
          filter_fields: ['contact_name'],
          semantics:
            'Contacts of this commercial provider, irrespective of visibility.',
        },
        {
          relationship_key: 'products',
          cardinality: 'one_to_many',
          filter_fields: ['product_code'],
          semantics: 'Products of the same provider and business.',
        },
        {
          relationship_key: 'invoices',
          cardinality: 'one_to_many',
          filter_fields: ['invoice_code'],
          semantics:
            'Invoices of the same provider and business; invoiced does not mean paid.',
        },
      ],
      limitations: [
        ...legacyLimits,
        'Provider JSON fields, phone arrays and schedules are not report fields.',
      ],
    }),
    source({
      ...rental,
      key: 'rental_reservations',
      fromSql: 'rental_reservations r',
      grain: 'one_rental_reservation',
      basis: 'check_in_on',
      fields: [
        field('id', 'bigint_id', 'r.id'),
        field('channel', 'string', 'r.channel', {
          values: ['whatsapp', 'airbnb', 'facebook', 'other'],
        }),
        field('status', 'string', 'r.status', {
          values: [
            'draft',
            'confirmed',
            'in_progress',
            'completed',
            'cancelled',
          ],
        }),
        field('check_in_on', 'date', 'r.check_in_on', {
          temporal: 'civil_date',
        }),
        field('check_out_on', 'date', 'r.check_out_on', {
          temporal: 'civil_date',
        }),
        field('recorded_amount', 'bigint_integer', 'r.total_amount', {
          groupable: false,
          semantics: 'agreed_gross_total_clp_not_cash_received',
        }),
        active(),
        recordedAt(),
        field('payment_method', 'string', 'py.method', {
          nullable: true,
          exists: {
            fromSql: 'rental_payments py',
            correlationSql:
              "py.property_id = r.property_id AND py.reservation_id = r.id AND py.status = 'confirmed' AND py.type = 'payment'",
          },
        }),
      ],
      measures: [
        measure(
          'commercial_amount',
          'r.total_amount',
          'one_rental_reservation',
          'reservation_agreed_gross_total_not_cash',
          { currency: 'CLP' },
        ),
      ],
      relationships: [
        {
          relationship_key: 'confirmed_payments',
          cardinality: 'one_to_many',
          filter_fields: ['payment_method'],
          semantics:
            'Confirmed payment existence; does not multiply agreed reservation totals.',
        },
      ],
      limitations: [
        'Commercial amount includes the explicitly selected statuses and is not collected money, net income or amount due.',
        'Civil periods use the property calendar timezone; archived reservations preserve their commercial and monetary history.',
      ],
    }),
    paymentSource(false),
    paymentSource(true),
    source({
      ...rental,
      key: 'rental_expenses',
      fromSql: 'rental_expenses r',
      grain: 'one_rental_expense',
      basis: 'incurred_on',
      fields: [
        field('id', 'bigint_id', 'r.id'),
        field('reservation_id', 'bigint_id', 'r.reservation_id', {
          nullable: true,
        }),
        field('name', 'string', 'r.name'),
        field('category', 'string', 'r.category', { nullable: true }),
        field('status', 'string', 'r.status', {
          values: ['pending', 'paid', 'voided'],
        }),
        field('recorded_amount', 'bigint_integer', 'r.amount', {
          groupable: false,
          semantics: 'recorded_expense_clp_before_voided_status_effect',
        }),
        field('incurred_on', 'date', 'r.incurred_on', {
          temporal: 'civil_date',
        }),
        field('paid_on', 'date', 'r.paid_on', {
          temporal: 'civil_date',
          nullable: true,
        }),
        recordedAt(),
      ],
      measures: [
        measure(
          'amount',
          "CASE WHEN r.status <> 'voided' THEN r.amount ELSE 0 END",
          'one_rental_expense',
          'non_voided_incurred_rental_expense_amount',
          { currency: 'CLP' },
        ),
        measure(
          'paid_amount',
          "CASE WHEN r.status = 'paid' THEN r.amount ELSE 0 END",
          'one_rental_expense',
          'paid_rental_expense_amount',
          { currency: 'CLP' },
        ),
      ],
      limitations: [
        'Incurred amount is distinct from paid cash. Pending expenses have no paid_on date. No commercial supplier relationship is stored.',
      ],
    }),
    source({
      ...rental,
      key: 'rental_blocks',
      fromSql: 'rental_blocks r',
      grain: 'one_rental_occupancy_block',
      basis: 'starts_at',
      fields: [
        field('id', 'bigint_id', 'r.id'),
        field('reason', 'string', 'r.reason'),
        active(),
        field('starts_at', 'datetime', 'r.starts_at', { temporal: 'instant' }),
        field('ends_at', 'datetime', 'r.ends_at', { temporal: 'instant' }),
        recordedAt(),
      ],
      limitations: [
        'Counts blocks whose start lies in the selected period; this is not overlap, availability or occupied nights.',
      ],
    }),
  ]);

function paymentSource(refund: boolean): ReportSourceDefinition {
  const grain = refund ? 'one_rental_refund' : 'one_rental_payment';
  return source({
    ...rental,
    key: refund ? 'rental_refunds' : 'rental_payments',
    fromSql: 'rental_payments r',
    grain,
    basis: 'occurred_on',
    predicates: [refund ? "r.type = 'refund'" : "r.type = 'payment'"],
    fields: [
      field('id', 'bigint_id', 'r.id'),
      field('reservation_id', 'bigint_id', 'r.reservation_id'),
      field('status', 'string', 'r.status', {
        values: ['confirmed', 'voided'],
      }),
      field('method', 'string', 'r.method', { nullable: true }),
      field('recorded_amount', 'bigint_integer', 'r.amount', {
        groupable: false,
        semantics: 'recorded_clp_before_voided_status_effect',
      }),
      field('occurred_on', 'date', 'r.occurred_on', { temporal: 'civil_date' }),
      recordedAt(),
    ],
    measures: [
      measure(
        'amount',
        "CASE WHEN r.status = 'confirmed' THEN r.amount ELSE 0 END",
        grain,
        refund
          ? 'confirmed_rental_refund_amount'
          : 'confirmed_rental_payment_amount',
        { currency: 'CLP' },
      ),
    ],
    limitations: [
      'Only confirmed records contribute money; voided records can be counted but contribute zero.',
      'Payment/refund civil date is the recorded effective date, not reservation check-in or server creation date.',
    ],
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Includes private mappings so a changed expression invalidates a previous query version. */
export const NODIA_AI_REPORT_SOURCES_VERSION = createHash('sha256')
  .update(canonical(NODIA_AI_REPORT_SOURCES), 'utf8')
  .digest('hex');

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined)
    throw new TypeError('Invalid trusted report source metadata');
  return encoded;
}
