import type { SchemaObject } from '@nestjs/swagger';
import {
  RENTAL_AUDIT_ACTIONS,
  RENTAL_AUDIT_RESOURCES,
} from '../rental-audit/dto/rental-audit-query.dto.js';

// Explicit HTTP projections: adding an entity column never exposes it here.
const text: SchemaObject = { type: 'string' };
const id: SchemaObject = { type: 'string', pattern: '^[1-9][0-9]*$' };
const money: SchemaObject = { type: 'string', pattern: '^(0|[1-9][0-9]*)$' };
const integer: SchemaObject = { type: 'integer', minimum: 0 };
const boolean: SchemaObject = { type: 'boolean' };
const instant: SchemaObject = { type: 'string', format: 'date-time' };
const percent: SchemaObject = {
  type: 'string',
  pattern: '^(0|[1-9][0-9]?|100)\\.[0-9]{2}$',
};
const nullable = (schema: SchemaObject): SchemaObject => ({
  ...schema,
  nullable: true,
});
const array = (items: SchemaObject): SchemaObject => ({ type: 'array', items });
const enumeration = (...values: string[]): SchemaObject => ({
  type: 'string',
  enum: values,
});
const object = (properties: Record<string, SchemaObject>): SchemaObject => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const nullableNames = new Set([
  'location',
  'default_nightly_rate',
  'default_deposit_percent',
  'default_cancellation_policy_id',
  'notes',
  'position',
  'external_reference',
  'deposit_due_at',
  'balance_due_at',
  'cancellation_policy_id',
  'cancelled_at',
  'refund_amount',
  'retained_amount',
  'reservation_id',
  'method',
  'reference',
  'category',
  'paid_on',
  'previous_reservation_id',
  'linen_ready',
  'planned_ready_at',
  'ready_at',
  'same_day_approved_at',
]);
function field(name: string): SchemaObject {
  let schema = text;
  if (
    name === 'id' ||
    name.endsWith('_id') ||
    ['created_by', 'updated_by'].includes(name)
  )
    schema = id;
  else if (
    name.endsWith('_amount') ||
    ['amount', 'nightly_rate', 'default_nightly_rate', 'cleaning_fee'].includes(
      name,
    )
  )
    schema = money;
  else if (name.endsWith('_percent')) schema = percent;
  else if (name.endsWith('_at') || name === 'as_of') schema = instant;
  else if (name.endsWith('_on')) schema = { type: 'string', format: 'date' };
  else if (name.endsWith('_time'))
    schema = { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' };
  else if (['is_active', 'linen_ready'].includes(name)) schema = boolean;
  else if (
    [
      'max_guests',
      'guests_count',
      'minimum_turnover_minutes',
      'nights',
      'min_days_before',
      'days_before',
      'payment_count',
    ].includes(name)
  )
    schema = integer;
  return nullableNames.has(name) ? nullable(schema) : schema;
}
function shape(
  names: string,
  extra: Record<string, SchemaObject> = {},
): SchemaObject {
  return object({
    ...Object.fromEntries(
      names
        .split(' ')
        .filter(Boolean)
        .map((name) => [name, field(name)]),
    ),
    ...extra,
  });
}
function pick(schema: SchemaObject, names: string): SchemaObject {
  return object(
    Object.fromEntries(
      names
        .split(' ')
        .map((name) => [name, schema.properties![name] as SchemaObject]),
    ),
  );
}
const authorship = 'created_by updated_by created_at updated_at';
const rule = object({ min_days_before: integer, refund_percent: percent });
const policySnapshot = {
  oneOf: [
    object({
      schema_version: { type: 'integer', enum: [1] },
      kind: enumeration('direct'),
      policy_id: id,
      policy_name: text,
      captured_at: instant,
      timezone: text,
      days_basis: enumeration('local_calendar_days'),
      refund_basis: enumeration('confirmed_received_amount'),
      rounding: enumeration('floor_clp'),
      rules: array(rule),
    }),
    object({
      schema_version: { type: 'integer', enum: [1] },
      kind: enumeration('platform'),
      channel: enumeration('airbnb'),
      captured_at: instant,
      timezone: text,
      platform_reference: text,
      platform_description: text,
      resolution: enumeration('manual_external'),
    }),
  ],
} satisfies SchemaObject;
const cancellationBase = {
  schema_version: { type: 'integer', enum: [1] } as SchemaObject,
  ...shape(
    'cancelled_at computed_at timezone check_in_on cancellation_local_on days_before received_amount refund_amount retained_amount',
  ).properties,
};
const cancellationSnapshot: SchemaObject = {
  oneOf: [
    object({
      ...cancellationBase,
      kind: enumeration('unpaid_draft'),
      reason: enumeration('no_received_payment'),
    }),
    object({
      ...cancellationBase,
      kind: enumeration('direct'),
      days_basis: enumeration('local_calendar_days'),
      refund_basis: enumeration('confirmed_received_amount'),
      rounding: enumeration('floor_clp'),
      selected_rule: rule,
      payment_count: integer,
      payment_ledger_sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    }),
    object({
      ...cancellationBase,
      kind: enumeration('platform'),
      resolution: enumeration('manual_external'),
      resolution_note: text,
      payment_count: integer,
      payment_ledger_sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    }),
  ],
};
const user = object({ id, name: nullable(text), image_url: nullable(text) });
const property = shape(
  `id owner_id name location timezone max_guests check_in_time check_out_time default_nightly_rate default_deposit_percent minimum_turnover_minutes default_cancellation_policy_id notes is_active ${authorship}`,
  {
    membership: object({
      type: enumeration('owner', 'collaborator'),
      can_manage_configuration: boolean,
      can_manage_collaborators: boolean,
    }),
  },
);
const collaborator = shape(
  `id property_id user_id position is_active ${authorship}`,
  { user },
);
const policy = shape(`id property_id name is_active ${authorship}`, {
  rules: array(
    shape(`id policy_id min_days_before refund_percent ${authorship}`),
  ),
});
const reservation = shape(
  `id property_id guest_name guest_contact guests_count channel external_reference check_in_on check_out_on check_in_time check_out_time nightly_rate cleaning_fee discount_amount total_amount commission_amount deposit_amount deposit_due_at balance_due_at cancellation_policy_id cancelled_at refund_amount status notes is_active ${authorship} nights check_in_at check_out_at expected_amount received_amount refunded_amount net_received_amount balance_due_amount refund_due_amount retained_amount turnover_id`,
  {
    policy_snapshot: nullable(policySnapshot),
    cancellation_snapshot: nullable(cancellationSnapshot),
    channel: enumeration('whatsapp', 'airbnb', 'facebook', 'other'),
    status: enumeration(
      'draft',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
    ),
  },
);
reservation.properties!.turnover_id = nullable(id);
const payment = shape(
  `id property_id reservation_id type amount occurred_on method reference notes status ${authorship}`,
  {
    type: enumeration('payment', 'refund'),
    status: enumeration('confirmed', 'voided'),
    reservation_id: id,
  },
);
const expense = shape(
  `id property_id reservation_id name category amount incurred_on paid_on status notes ${authorship}`,
  { status: enumeration('pending', 'paid', 'voided') },
);
const block = shape(
  `id property_id starts_at ends_at reason notes is_active ${authorship}`,
);
const turnover = shape(
  `id property_id incoming_reservation_id previous_reservation_id linen_ready cleaning_status planned_ready_at ready_at same_day_approved_at notes ${authorship}`,
  { cleaning_status: enumeration('pending', 'in_progress', 'completed') },
);
const audit = shape(
  'id property_id actor_id action resource_type resource_id created_at',
  {
    action: enumeration(...RENTAL_AUDIT_ACTIONS),
    resource_type: enumeration(...RENTAL_AUDIT_RESOURCES),
    changes: { type: 'object', additionalProperties: true },
  },
);
const acknowledgement = shape('property_id resource_id updated_at', {
  operation: enumeration(...RENTAL_AUDIT_ACTIONS),
  resource_type: enumeration(...RENTAL_AUDIT_RESOURCES),
  status: enumeration(
    'active',
    'inactive',
    'draft',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'voided',
    'pending',
    'paid',
  ),
});
const scope = shape('property_id timezone from_on to_on');
const calendarTurnover = pick(
  turnover,
  'id property_id incoming_reservation_id previous_reservation_id linen_ready cleaning_status planned_ready_at ready_at same_day_approved_at',
);
const pendingTurnover = pick(
  turnover,
  'id incoming_reservation_id previous_reservation_id linen_ready cleaning_status planned_ready_at ready_at same_day_approved_at',
);
const upcoming = pick(
  reservation,
  'id guest_name status check_in_on check_out_on check_in_at check_out_at',
);
export const rentalResponseSchemas = {
  property,
  collaborator,
  policy,
  reservation,
  payment,
  expense,
  block,
  turnover,
  audit,
  turnover_detail: object({
    ...turnover.properties,
    current_previous_reservation_id: nullable(id),
    same_day_required: boolean,
    plan_valid: boolean,
    needs_approval: boolean,
  }),
  candidate: user,
  operation: object({
    schema_version: { type: 'integer', enum: [1] },
    http_status: { type: 'integer', enum: [200, 201] },
    body: acknowledgement,
  }),
  cancellation: shape('reservation_id as_of check_in_at refund_amount', {
    cancellation_snapshot: cancellationSnapshot,
    balance_due_after_cancellation: money,
    refund_due_after_cancellation: money,
  }),
  calendar: object({
    scope: object({
      ...scope.properties,
      includes_archived_occupancy: boolean,
    }),
    reservations: array(
      pick(
        reservation,
        'id property_id guest_name check_in_on check_out_on check_in_time check_out_time check_in_at check_out_at channel status is_active',
      ),
    ),
    blocks: array(
      pick(block, 'id property_id starts_at ends_at reason is_active'),
    ),
    turnovers: array(calendarTurnover),
  }),
  availability: shape('checked_at check_in_at check_out_at', {
    available: boolean,
    conflicts: array(
      shape('id starts_at ends_at', {
        resource_type: enumeration('reservation', 'block'),
      }),
    ),
    turnover_requirements: array(
      object({
        incoming_reservation_id: nullable(id),
        turnover_id: nullable(id),
        needs_approval: boolean,
        plan_valid: boolean,
      }),
    ),
  }),
  overview: object({
    scope: object({
      ...scope.properties,
      cash_dates: enumeration('occurred_on_and_paid_on'),
      includes_archived_history: boolean,
      pending_scope: enumeration('all_current_property_records'),
    }),
    as_of: instant,
    cash: shape('received_amount refunded_amount paid_expenses_amount', {
      net_amount: { type: 'string', pattern: '^-?(0|[1-9][0-9]*)$' },
    }),
    pending: shape(
      'reservation_balance_amount refund_amount expense_amount draft_received_amount',
    ),
    counts: object({
      confirmed_reservations: integer,
      in_progress_reservations: integer,
      pending_turnovers: integer,
      draft_count: integer,
    }),
    upcoming_check_ins: array(upcoming),
    upcoming_check_outs: array(upcoming),
    pending_turnovers: array(pendingTurnover),
  }),
} satisfies Record<string, SchemaObject>;

export function rentalResponseSchema(
  resource: keyof typeof rentalResponseSchemas,
  paginated = false,
): SchemaObject {
  const schema = rentalResponseSchemas[resource];
  return paginated
    ? object({
        data: array(schema),
        meta: object({
          page: integer,
          limit: integer,
          total_items: integer,
          total_pages: integer,
        }),
      })
    : schema;
}
