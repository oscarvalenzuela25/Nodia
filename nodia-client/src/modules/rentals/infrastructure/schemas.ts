// Generated from verified rental OpenAPI by scripts/generate-rental-contracts.py.
// DTOs/use cases, not incomplete Swagger request metadata, govern request inputs.
import { z } from "zod";
import { isCivilDate, isTimezone } from "../utils/dates";
export const idSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((v) => /^[1-9]\d*$/.test(v) && BigInt(v) <= 9223372036854775807n);
export const civilDateSchema = z.string().refine(isCivilDate);
export const timezoneSchema = z.string().max(64).refine(isTimezone);
export const propertySchema = z.strictObject({
  id: idSchema,
  owner_id: idSchema,
  name: z.string(),
  location: z.string().nullable(),
  timezone: timezoneSchema,
  max_guests: z.number().finite().int().max(Number.MAX_SAFE_INTEGER).min(0),
  check_in_time: z
    .string()
    .regex(new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$")),
  check_out_time: z
    .string()
    .regex(new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$")),
  default_nightly_rate: z
    .string()
    .regex(new RegExp("^(0|[1-9][0-9]*)$"))
    .nullable(),
  default_deposit_percent: z
    .string()
    .regex(new RegExp("^(0|[1-9][0-9]?|100)\\.[0-9]{2}$"))
    .nullable(),
  minimum_turnover_minutes: z
    .number()
    .finite()
    .int()
    .max(Number.MAX_SAFE_INTEGER)
    .min(0),
  default_cancellation_policy_id: idSchema.nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_by: idSchema,
  updated_by: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  membership: z.strictObject({
    type: z.enum(["owner", "collaborator"]),
    can_manage_configuration: z.boolean(),
    can_manage_collaborators: z.boolean(),
  }),
});
export const collaboratorSchema = z.strictObject({
  id: idSchema,
  property_id: idSchema,
  user_id: idSchema,
  position: z.string().nullable(),
  is_active: z.boolean(),
  created_by: idSchema,
  updated_by: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  user: z.strictObject({
    id: idSchema,
    name: z.string().nullable(),
    image_url: z.string().nullable(),
  }),
});
export const policySchema = z.strictObject({
  id: idSchema,
  property_id: idSchema,
  name: z.string(),
  is_active: z.boolean(),
  created_by: idSchema,
  updated_by: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  rules: z.array(
    z.strictObject({
      id: idSchema,
      policy_id: idSchema,
      min_days_before: z
        .number()
        .finite()
        .int()
        .max(Number.MAX_SAFE_INTEGER)
        .min(0),
      refund_percent: z
        .string()
        .regex(new RegExp("^(0|[1-9][0-9]?|100)\\.[0-9]{2}$")),
      created_by: idSchema,
      updated_by: idSchema,
      created_at: z.iso.datetime({ offset: true }),
      updated_at: z.iso.datetime({ offset: true }),
    }),
  ),
});
export const reservationSchema = z.strictObject({
  id: idSchema,
  property_id: idSchema,
  guest_name: z.string(),
  guest_contact: z.string(),
  guests_count: z.number().finite().int().max(Number.MAX_SAFE_INTEGER).min(0),
  channel: z.enum(["whatsapp", "airbnb", "facebook", "other"]),
  external_reference: z.string().nullable(),
  check_in_on: civilDateSchema,
  check_out_on: civilDateSchema,
  check_in_time: z
    .string()
    .regex(new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$")),
  check_out_time: z
    .string()
    .regex(new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$")),
  nightly_rate: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  cleaning_fee: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  discount_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  total_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  commission_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  deposit_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  deposit_due_at: z.iso.datetime({ offset: true }).nullable(),
  balance_due_at: z.iso.datetime({ offset: true }).nullable(),
  cancellation_policy_id: idSchema.nullable(),
  cancelled_at: z.iso.datetime({ offset: true }).nullable(),
  refund_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")).nullable(),
  status: z.enum([
    "draft",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
  ]),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_by: idSchema,
  updated_by: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  nights: z.number().finite().int().max(Number.MAX_SAFE_INTEGER).min(0),
  check_in_at: z.iso.datetime({ offset: true }),
  check_out_at: z.iso.datetime({ offset: true }),
  expected_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  refunded_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  net_received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  balance_due_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  refund_due_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  retained_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")).nullable(),
  turnover_id: idSchema.nullable(),
  policy_snapshot: z
    .union([
      z.strictObject({
        schema_version: z.literal(1),
        kind: z.enum(["direct"]),
        policy_id: idSchema,
        policy_name: z.string(),
        captured_at: z.iso.datetime({ offset: true }),
        timezone: timezoneSchema,
        days_basis: z.enum(["local_calendar_days"]),
        refund_basis: z.enum(["confirmed_received_amount"]),
        rounding: z.enum(["floor_clp"]),
        rules: z.array(
          z.strictObject({
            min_days_before: z
              .number()
              .finite()
              .int()
              .max(Number.MAX_SAFE_INTEGER)
              .min(0),
            refund_percent: z
              .string()
              .regex(new RegExp("^(0|[1-9][0-9]?|100)\\.[0-9]{2}$")),
          }),
        ),
      }),
      z.strictObject({
        schema_version: z.literal(1),
        kind: z.enum(["platform"]),
        channel: z.enum(["airbnb"]),
        captured_at: z.iso.datetime({ offset: true }),
        timezone: timezoneSchema,
        platform_reference: z.string(),
        platform_description: z.string(),
        resolution: z.enum(["manual_external"]),
      }),
    ])
    .nullable(),
  cancellation_snapshot: z
    .union([
      z.strictObject({
        schema_version: z.literal(1),
        cancelled_at: z.iso.datetime({ offset: true }).nullable(),
        computed_at: z.iso.datetime({ offset: true }),
        timezone: timezoneSchema,
        check_in_on: civilDateSchema,
        cancellation_local_on: civilDateSchema,
        days_before: z
          .number()
          .finite()
          .int()
          .max(Number.MAX_SAFE_INTEGER)
          .min(0),
        received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
        refund_amount: z
          .string()
          .regex(new RegExp("^(0|[1-9][0-9]*)$"))
          .nullable(),
        retained_amount: z
          .string()
          .regex(new RegExp("^(0|[1-9][0-9]*)$"))
          .nullable(),
        kind: z.enum(["unpaid_draft"]),
        reason: z.enum(["no_received_payment"]),
      }),
      z.strictObject({
        schema_version: z.literal(1),
        cancelled_at: z.iso.datetime({ offset: true }).nullable(),
        computed_at: z.iso.datetime({ offset: true }),
        timezone: timezoneSchema,
        check_in_on: civilDateSchema,
        cancellation_local_on: civilDateSchema,
        days_before: z
          .number()
          .finite()
          .int()
          .max(Number.MAX_SAFE_INTEGER)
          .min(0),
        received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
        refund_amount: z
          .string()
          .regex(new RegExp("^(0|[1-9][0-9]*)$"))
          .nullable(),
        retained_amount: z
          .string()
          .regex(new RegExp("^(0|[1-9][0-9]*)$"))
          .nullable(),
        kind: z.enum(["direct"]),
        days_basis: z.enum(["local_calendar_days"]),
        refund_basis: z.enum(["confirmed_received_amount"]),
        rounding: z.enum(["floor_clp"]),
        selected_rule: z.strictObject({
          min_days_before: z
            .number()
            .finite()
            .int()
            .max(Number.MAX_SAFE_INTEGER)
            .min(0),
          refund_percent: z
            .string()
            .regex(new RegExp("^(0|[1-9][0-9]?|100)\\.[0-9]{2}$")),
        }),
        payment_count: z
          .number()
          .finite()
          .int()
          .max(Number.MAX_SAFE_INTEGER)
          .min(0),
        payment_ledger_sha256: z.string().regex(new RegExp("^[a-f0-9]{64}$")),
      }),
      z.strictObject({
        schema_version: z.literal(1),
        cancelled_at: z.iso.datetime({ offset: true }).nullable(),
        computed_at: z.iso.datetime({ offset: true }),
        timezone: timezoneSchema,
        check_in_on: civilDateSchema,
        cancellation_local_on: civilDateSchema,
        days_before: z
          .number()
          .finite()
          .int()
          .max(Number.MAX_SAFE_INTEGER)
          .min(0),
        received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
        refund_amount: z
          .string()
          .regex(new RegExp("^(0|[1-9][0-9]*)$"))
          .nullable(),
        retained_amount: z
          .string()
          .regex(new RegExp("^(0|[1-9][0-9]*)$"))
          .nullable(),
        kind: z.enum(["platform"]),
        resolution: z.enum(["manual_external"]),
        resolution_note: z.string(),
        payment_count: z
          .number()
          .finite()
          .int()
          .max(Number.MAX_SAFE_INTEGER)
          .min(0),
        payment_ledger_sha256: z.string().regex(new RegExp("^[a-f0-9]{64}$")),
      }),
    ])
    .nullable(),
});
export const paymentSchema = z.strictObject({
  id: idSchema,
  property_id: idSchema,
  reservation_id: idSchema,
  type: z.enum(["payment", "refund"]),
  amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  occurred_on: civilDateSchema,
  method: z.string().nullable(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(["confirmed", "voided"]),
  created_by: idSchema,
  updated_by: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export const expenseSchema = z.strictObject({
  id: idSchema,
  property_id: idSchema,
  reservation_id: idSchema.nullable(),
  name: z.string(),
  category: z.string().nullable(),
  amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  incurred_on: civilDateSchema,
  paid_on: civilDateSchema.nullable(),
  status: z.enum(["pending", "paid", "voided"]),
  notes: z.string().nullable(),
  created_by: idSchema,
  updated_by: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export const blockSchema = z.strictObject({
  id: idSchema,
  property_id: idSchema,
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  reason: z.string(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_by: idSchema,
  updated_by: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export const turnoverSchema = z.strictObject({
  id: idSchema,
  property_id: idSchema,
  incoming_reservation_id: idSchema,
  previous_reservation_id: idSchema.nullable(),
  linen_ready: z.boolean().nullable(),
  cleaning_status: z.enum(["pending", "in_progress", "completed"]),
  planned_ready_at: z.iso.datetime({ offset: true }).nullable(),
  ready_at: z.iso.datetime({ offset: true }).nullable(),
  same_day_approved_at: z.iso.datetime({ offset: true }).nullable(),
  notes: z.string().nullable(),
  created_by: idSchema,
  updated_by: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export const auditSchema = z.strictObject({
  id: idSchema,
  property_id: idSchema,
  actor_id: idSchema,
  action: z.enum([
    "property.create",
    "property.update",
    "collaborator.create",
    "collaborator.update",
    "policy.create",
    "policy.update",
    "reservation.create",
    "reservation.update",
    "reservation.confirm",
    "reservation.start",
    "reservation.complete",
    "reservation.cancel",
    "payment.create",
    "payment.void",
    "expense.create",
    "expense.update",
    "expense.pay",
    "expense.void",
    "block.create",
    "block.update",
    "turnover.update",
    "turnover.approve_same_day",
  ]),
  resource_type: z.enum([
    "property",
    "collaborator",
    "policy",
    "reservation",
    "payment",
    "expense",
    "block",
    "turnover",
  ]),
  resource_id: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  changes: z.record(z.string(), z.unknown()),
});
export const candidateSchema = z.strictObject({
  id: idSchema,
  name: z.string().nullable(),
  image_url: z.string().nullable(),
});
export const pageMetaSchema = z.strictObject({
  page: z.number().finite().int().max(Number.MAX_SAFE_INTEGER).min(0),
  limit: z.number().finite().int().max(Number.MAX_SAFE_INTEGER).min(0),
  total_items: z.number().finite().int().max(Number.MAX_SAFE_INTEGER).min(0),
  total_pages: z.number().finite().int().max(Number.MAX_SAFE_INTEGER).min(0),
});
export const rentalPageSchema = <T extends z.ZodType>(item: T) =>
  z.strictObject({ data: z.array(item), meta: pageMetaSchema });
export const turnoverDetailSchema = z.strictObject({
  id: idSchema,
  property_id: idSchema,
  incoming_reservation_id: idSchema,
  previous_reservation_id: idSchema.nullable(),
  linen_ready: z.boolean().nullable(),
  cleaning_status: z.enum(["pending", "in_progress", "completed"]),
  planned_ready_at: z.iso.datetime({ offset: true }).nullable(),
  ready_at: z.iso.datetime({ offset: true }).nullable(),
  same_day_approved_at: z.iso.datetime({ offset: true }).nullable(),
  notes: z.string().nullable(),
  created_by: idSchema,
  updated_by: idSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  current_previous_reservation_id: idSchema.nullable(),
  same_day_required: z.boolean(),
  plan_valid: z.boolean(),
  needs_approval: z.boolean(),
});
export const calendarSchema = z.strictObject({
  scope: z.strictObject({
    property_id: idSchema,
    timezone: timezoneSchema,
    from_on: civilDateSchema,
    to_on: civilDateSchema,
    includes_archived_occupancy: z.boolean(),
  }),
  reservations: z.array(
    z.strictObject({
      id: idSchema,
      property_id: idSchema,
      guest_name: z.string(),
      check_in_on: civilDateSchema,
      check_out_on: civilDateSchema,
      check_in_time: z
        .string()
        .regex(new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$")),
      check_out_time: z
        .string()
        .regex(new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$")),
      check_in_at: z.iso.datetime({ offset: true }),
      check_out_at: z.iso.datetime({ offset: true }),
      channel: z.enum(["whatsapp", "airbnb", "facebook", "other"]),
      status: z.enum([
        "draft",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ]),
      is_active: z.boolean(),
    }),
  ),
  blocks: z.array(
    z.strictObject({
      id: idSchema,
      property_id: idSchema,
      starts_at: z.iso.datetime({ offset: true }),
      ends_at: z.iso.datetime({ offset: true }),
      reason: z.string(),
      is_active: z.boolean(),
    }),
  ),
  turnovers: z.array(
    z.strictObject({
      id: idSchema,
      property_id: idSchema,
      incoming_reservation_id: idSchema,
      previous_reservation_id: idSchema.nullable(),
      linen_ready: z.boolean().nullable(),
      cleaning_status: z.enum(["pending", "in_progress", "completed"]),
      planned_ready_at: z.iso.datetime({ offset: true }).nullable(),
      ready_at: z.iso.datetime({ offset: true }).nullable(),
      same_day_approved_at: z.iso.datetime({ offset: true }).nullable(),
    }),
  ),
});
export const availabilitySchema = z.strictObject({
  checked_at: z.iso.datetime({ offset: true }),
  check_in_at: z.iso.datetime({ offset: true }),
  check_out_at: z.iso.datetime({ offset: true }),
  available: z.boolean(),
  conflicts: z.array(
    z.strictObject({
      id: idSchema,
      starts_at: z.iso.datetime({ offset: true }),
      ends_at: z.iso.datetime({ offset: true }),
      resource_type: z.enum(["reservation", "block"]),
    }),
  ),
  turnover_requirements: z.array(
    z.strictObject({
      incoming_reservation_id: idSchema.nullable(),
      turnover_id: idSchema.nullable(),
      needs_approval: z.boolean(),
      plan_valid: z.boolean(),
    }),
  ),
});
export const overviewSchema = z.strictObject({
  scope: z.strictObject({
    property_id: idSchema,
    timezone: timezoneSchema,
    from_on: civilDateSchema,
    to_on: civilDateSchema,
    cash_dates: z.enum(["occurred_on_and_paid_on"]),
    includes_archived_history: z.boolean(),
    pending_scope: z.enum(["all_current_property_records"]),
  }),
  as_of: z.iso.datetime({ offset: true }),
  cash: z.strictObject({
    received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
    refunded_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
    paid_expenses_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
    net_amount: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")),
  }),
  pending: z.strictObject({
    reservation_balance_amount: z
      .string()
      .regex(new RegExp("^(0|[1-9][0-9]*)$")),
    refund_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")).nullable(),
    expense_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
    draft_received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  }),
  counts: z.strictObject({
    confirmed_reservations: z
      .number()
      .finite()
      .int()
      .max(Number.MAX_SAFE_INTEGER)
      .min(0),
    in_progress_reservations: z
      .number()
      .finite()
      .int()
      .max(Number.MAX_SAFE_INTEGER)
      .min(0),
    pending_turnovers: z
      .number()
      .finite()
      .int()
      .max(Number.MAX_SAFE_INTEGER)
      .min(0),
    draft_count: z.number().finite().int().max(Number.MAX_SAFE_INTEGER).min(0),
  }),
  upcoming_check_ins: z.array(
    z.strictObject({
      id: idSchema,
      guest_name: z.string(),
      status: z.enum([
        "draft",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ]),
      check_in_on: civilDateSchema,
      check_out_on: civilDateSchema,
      check_in_at: z.iso.datetime({ offset: true }),
      check_out_at: z.iso.datetime({ offset: true }),
    }),
  ),
  upcoming_check_outs: z.array(
    z.strictObject({
      id: idSchema,
      guest_name: z.string(),
      status: z.enum([
        "draft",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ]),
      check_in_on: civilDateSchema,
      check_out_on: civilDateSchema,
      check_in_at: z.iso.datetime({ offset: true }),
      check_out_at: z.iso.datetime({ offset: true }),
    }),
  ),
  pending_turnovers: z.array(
    z.strictObject({
      id: idSchema,
      incoming_reservation_id: idSchema,
      previous_reservation_id: idSchema.nullable(),
      linen_ready: z.boolean().nullable(),
      cleaning_status: z.enum(["pending", "in_progress", "completed"]),
      planned_ready_at: z.iso.datetime({ offset: true }).nullable(),
      ready_at: z.iso.datetime({ offset: true }).nullable(),
      same_day_approved_at: z.iso.datetime({ offset: true }).nullable(),
    }),
  ),
});
export const recoverySchema = z.strictObject({
  schema_version: z.literal(1),
  http_status: z.union([z.literal(200), z.literal(201)]),
  body: z.strictObject({
    property_id: idSchema,
    resource_id: idSchema,
    updated_at: z.iso.datetime({ offset: true }),
    operation: z.enum([
      "property.create",
      "property.update",
      "collaborator.create",
      "collaborator.update",
      "policy.create",
      "policy.update",
      "reservation.create",
      "reservation.update",
      "reservation.confirm",
      "reservation.start",
      "reservation.complete",
      "reservation.cancel",
      "payment.create",
      "payment.void",
      "expense.create",
      "expense.update",
      "expense.pay",
      "expense.void",
      "block.create",
      "block.update",
      "turnover.update",
      "turnover.approve_same_day",
    ]),
    resource_type: z.enum([
      "property",
      "collaborator",
      "policy",
      "reservation",
      "payment",
      "expense",
      "block",
      "turnover",
    ]),
    status: z.enum([
      "active",
      "inactive",
      "draft",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
      "voided",
      "pending",
      "paid",
    ]),
  }),
});
export const cancellationPreviewSchema = z.strictObject({
  reservation_id: idSchema.nullable(),
  as_of: z.iso.datetime({ offset: true }),
  check_in_at: z.iso.datetime({ offset: true }),
  refund_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")).nullable(),
  cancellation_snapshot: z.union([
    z.strictObject({
      schema_version: z.literal(1),
      cancelled_at: z.iso.datetime({ offset: true }).nullable(),
      computed_at: z.iso.datetime({ offset: true }),
      timezone: timezoneSchema,
      check_in_on: civilDateSchema,
      cancellation_local_on: civilDateSchema,
      days_before: z
        .number()
        .finite()
        .int()
        .max(Number.MAX_SAFE_INTEGER)
        .min(0),
      received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
      refund_amount: z
        .string()
        .regex(new RegExp("^(0|[1-9][0-9]*)$"))
        .nullable(),
      retained_amount: z
        .string()
        .regex(new RegExp("^(0|[1-9][0-9]*)$"))
        .nullable(),
      kind: z.enum(["unpaid_draft"]),
      reason: z.enum(["no_received_payment"]),
    }),
    z.strictObject({
      schema_version: z.literal(1),
      cancelled_at: z.iso.datetime({ offset: true }).nullable(),
      computed_at: z.iso.datetime({ offset: true }),
      timezone: timezoneSchema,
      check_in_on: civilDateSchema,
      cancellation_local_on: civilDateSchema,
      days_before: z
        .number()
        .finite()
        .int()
        .max(Number.MAX_SAFE_INTEGER)
        .min(0),
      received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
      refund_amount: z
        .string()
        .regex(new RegExp("^(0|[1-9][0-9]*)$"))
        .nullable(),
      retained_amount: z
        .string()
        .regex(new RegExp("^(0|[1-9][0-9]*)$"))
        .nullable(),
      kind: z.enum(["direct"]),
      days_basis: z.enum(["local_calendar_days"]),
      refund_basis: z.enum(["confirmed_received_amount"]),
      rounding: z.enum(["floor_clp"]),
      selected_rule: z.strictObject({
        min_days_before: z
          .number()
          .finite()
          .int()
          .max(Number.MAX_SAFE_INTEGER)
          .min(0),
        refund_percent: z
          .string()
          .regex(new RegExp("^(0|[1-9][0-9]?|100)\\.[0-9]{2}$")),
      }),
      payment_count: z
        .number()
        .finite()
        .int()
        .max(Number.MAX_SAFE_INTEGER)
        .min(0),
      payment_ledger_sha256: z.string().regex(new RegExp("^[a-f0-9]{64}$")),
    }),
    z.strictObject({
      schema_version: z.literal(1),
      cancelled_at: z.iso.datetime({ offset: true }).nullable(),
      computed_at: z.iso.datetime({ offset: true }),
      timezone: timezoneSchema,
      check_in_on: civilDateSchema,
      cancellation_local_on: civilDateSchema,
      days_before: z
        .number()
        .finite()
        .int()
        .max(Number.MAX_SAFE_INTEGER)
        .min(0),
      received_amount: z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
      refund_amount: z
        .string()
        .regex(new RegExp("^(0|[1-9][0-9]*)$"))
        .nullable(),
      retained_amount: z
        .string()
        .regex(new RegExp("^(0|[1-9][0-9]*)$"))
        .nullable(),
      kind: z.enum(["platform"]),
      resolution: z.enum(["manual_external"]),
      resolution_note: z.string(),
      payment_count: z
        .number()
        .finite()
        .int()
        .max(Number.MAX_SAFE_INTEGER)
        .min(0),
      payment_ledger_sha256: z.string().regex(new RegExp("^[a-f0-9]{64}$")),
    }),
  ]),
  balance_due_after_cancellation: z
    .string()
    .regex(new RegExp("^(0|[1-9][0-9]*)$")),
  refund_due_after_cancellation: z
    .string()
    .regex(new RegExp("^(0|[1-9][0-9]*)$")),
});
export const ackSchema = z.strictObject({
  operation: z.enum([
    "property.create",
    "property.update",
    "collaborator.create",
    "collaborator.update",
    "policy.create",
    "policy.update",
    "reservation.create",
    "reservation.update",
    "reservation.confirm",
    "reservation.start",
    "reservation.complete",
    "reservation.cancel",
    "payment.create",
    "payment.void",
    "expense.create",
    "expense.update",
    "expense.pay",
    "expense.void",
    "block.create",
    "block.update",
    "turnover.update",
    "turnover.approve_same_day",
  ]),
  property_id: idSchema,
  resource_type: z.enum([
    "property",
    "collaborator",
    "policy",
    "reservation",
    "payment",
    "expense",
    "block",
    "turnover",
  ]),
  resource_id: idSchema,
  status: z.enum([
    "active",
    "inactive",
    "draft",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    "voided",
    "pending",
    "paid",
  ]),
  updated_at: z.iso.datetime({ offset: true }),
});
export const rentalRecordSchemas = {
  properties: propertySchema,
  collaborators: collaboratorSchema,
  "cancellation-policies": policySchema,
  reservations: reservationSchema,
  payments: paymentSchema,
  expenses: expenseSchema,
  blocks: blockSchema,
  turnovers: turnoverSchema,
  "audit-events": auditSchema,
  "collaborator-candidates": candidateSchema,
} as const;
