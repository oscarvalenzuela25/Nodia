import { z } from "zod";
import type { RentalListResource, RentalQuery } from "../types";
import { ackSchema, idSchema, civilDateSchema } from "./schemas";
const instantSchema = z.iso.datetime({ offset: true });

// Mirrors the resource DTOs and rental-common/rental-query.ts, rather than
// allowing an arbitrary Ransack envelope through the broad UI query type.
const active = z.enum(["active", "inactive", "all"]).optional();
const base = {
  page: z.number().int().min(1).max(1000000).optional(),
  limit: z.number().int().min(1).max(100).optional(),
};
const civil = {
  from_on: civilDateSchema.optional(),
  to_on: civilDateSchema.optional(),
};
const q = (filters: string[], sorts: string[]) =>
  z
    .record(z.string(), z.string().max(255))
    .refine((value) =>
      Object.entries(value).every(([key, entry]) =>
        key === "s"
          ? sorts.some((sort) =>
              new RegExp(`^${sort} (asc|desc)$`, "i").test(entry),
            )
          : filters.includes(key),
      ),
    )
    .optional();
const unique = <T extends string>(values: readonly T[]) =>
  z
    .array(z.enum(values))
    .max(values.length)
    .refine((value) => new Set(value).size === value.length)
    .optional();
const schemas = {
  properties: z.strictObject({
    ...base,
    active,
    q: q(["name_cont"], ["name"]),
  }),
  collaborators: z.strictObject({
    ...base,
    active,
    q: q(["position_cont"], ["created_at"]),
  }),
  "cancellation-policies": z.strictObject({
    ...base,
    active,
    q: q(["name_cont"], ["name"]),
  }),
  reservations: z.strictObject({
    ...base,
    active,
    ...civil,
    q: q(
      ["guest_name_cont", "external_reference_cont"],
      ["check_in_on", "created_at"],
    ),
    status_in: unique([
      "draft",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
    ]),
    channel_in: unique(["whatsapp", "airbnb", "facebook", "other"]),
  }),
  payments: z.strictObject({
    ...base,
    ...civil,
    q: q(["reference_cont"], ["occurred_on"]),
    reservation_id: idSchema.optional(),
    type: z.enum(["payment", "refund"]).optional(),
    status: z.enum(["confirmed", "voided"]).optional(),
  }),
  expenses: z.strictObject({
    ...base,
    ...civil,
    q: q(["name_cont"], ["incurred_on"]),
    reservation_id: idSchema.optional(),
    category: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["pending", "paid", "voided"]).optional(),
  }),
  blocks: z.strictObject({
    ...base,
    active,
    q: q(["reason_cont"], ["starts_at"]),
    starts_at: instantSchema.optional(),
    ends_at: instantSchema.optional(),
  }),
  turnovers: z.strictObject({
    ...base,
    ...civil,
    q: q([], ["planned_ready_at"]),
    incoming_reservation_id: idSchema.optional(),
    linen_ready: z.enum(["true", "false", "unknown"]).optional(),
    cleaning_status: z.enum(["pending", "in_progress", "completed"]).optional(),
  }),
  "audit-events": z.strictObject({
    ...base,
    q: q([], []),
    resource_id: idSchema.optional(),
    resource_type: ackSchema.shape.resource_type.optional(),
    action: ackSchema.shape.operation.optional(),
    from_at: instantSchema.optional(),
    to_at: instantSchema.optional(),
  }),
  "collaborator-candidates": z.strictObject({
    page: base.page,
    limit: z.number().int().min(1).max(20).optional(),
    search: z.string().trim().min(3).max(100),
  }),
} satisfies Record<RentalListResource, z.ZodType>;
export function validateRentalListQuery(
  resource: RentalListResource,
  query: RentalQuery,
): void {
  schemas[resource].parse(query);
  for (const [start, end, civilPeriod] of [
    ["from_on", "to_on", true],
    ["starts_at", "ends_at", false],
    ["from_at", "to_at", false],
  ] as const) {
    const from = query[start],
      to = query[end];
    if (from === undefined && to === undefined) continue;
    const a =
      from === undefined
        ? NaN
        : Date.parse(civilPeriod ? `${from}T00:00:00Z` : from);
    const b =
      to === undefined ? NaN : Date.parse(civilPeriod ? `${to}T00:00:00Z` : to);
    if (!(b > a) || b - a > 366 * 86400000)
      throw new Error("rental:invalid_input");
  }
}
