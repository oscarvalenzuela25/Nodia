import type {
  RentalOperation,
  RentalReservation,
  RentalProperty,
  RentalBlock,
  RentalTurnover,
} from "./types";

export type RentalQuery = {
  page?: number;
  limit?: number;
  active?: "active" | "inactive" | "all";
  q?: Record<string, string>;
  search?: string;
  reservation_id?: string;
  status?: string;
  type?: "payment" | "refund";
  category?: string;
  status_in?: RentalReservation["status"][];
  channel_in?: RentalReservation["channel"][];
  from_on?: string;
  to_on?: string;
  from_at?: string;
  to_at?: string;
  starts_at?: string;
  ends_at?: string;
  cleaning_status?: RentalTurnover["cleaning_status"];
  incoming_reservation_id?: string;
  linen_ready?: "true" | "false" | "unknown";
  resource_type?: string;
  resource_id?: string;
  action?: RentalOperation;
  check_in_on?: string;
  check_out_on?: string;
  check_in_time?: string;
  check_out_time?: string;
  exclude_reservation_id?: string;
  include_non_occupying?: boolean;
};
type PropertyInput = Pick<
  RentalProperty,
  "name" | "timezone" | "max_guests" | "check_in_time" | "check_out_time"
> &
  Partial<
    Pick<
      RentalProperty,
      | "location"
      | "default_nightly_rate"
      | "default_deposit_percent"
      | "minimum_turnover_minutes"
      | "notes"
      | "is_active"
    >
  >;
type ReservationInput = Pick<
  RentalReservation,
  | "guest_name"
  | "guest_contact"
  | "guests_count"
  | "channel"
  | "check_in_on"
  | "check_out_on"
  | "check_in_time"
  | "check_out_time"
  | "nightly_rate"
  | "deposit_amount"
> &
  Partial<
    Pick<
      RentalReservation,
      | "external_reference"
      | "cleaning_fee"
      | "discount_amount"
      | "commission_amount"
      | "deposit_due_at"
      | "balance_due_at"
      | "cancellation_policy_id"
      | "notes"
      | "is_active"
    >
  >;
type Rule = { min_days_before: number; refund_percent: string };
type PolicyInput = { name: string; rules: Rule[]; is_active?: boolean };
type PlatformPolicy = { reference: string; description: string };
export type RentalPreviewInput = {
  cancelled_at: string;
  refund_amount?: string;
  resolution_note?: string;
};
type ExpenseInput = {
  name: string;
  amount: string;
  incurred_on: string;
  status: "pending" | "paid";
  paid_on?: string | null;
  reservation_id?: string | null;
  category?: string | null;
  notes?: string | null;
};
type BlockInput = Pick<RentalBlock, "starts_at" | "ends_at" | "reason"> &
  Partial<Pick<RentalBlock, "notes" | "is_active">>;
export type RentalPayloadMap = {
  "property.create": PropertyInput;
  "property.update": Partial<
    PropertyInput & Pick<RentalProperty, "default_cancellation_policy_id">
  >;
  "collaborator.create": {
    user_id: string;
    position?: string | null;
    is_active?: boolean;
  };
  "collaborator.update": { position?: string | null; is_active?: boolean };
  "policy.create": PolicyInput;
  "policy.update": Partial<PolicyInput>;
  "reservation.create": ReservationInput;
  "reservation.update": Partial<ReservationInput>;
  "reservation.confirm": {
    same_day_approvals?: string[];
    platform_policy?: PlatformPolicy;
  };
  "reservation.start": Record<string, never>;
  "reservation.complete": Record<string, never>;
  "reservation.cancel": RentalPreviewInput & { expected_refund_amount: string };
  "payment.create": {
    reservation_id: string;
    type: "payment" | "refund";
    amount: string;
    occurred_on: string;
    method?: string | null;
    reference?: string | null;
    notes?: string | null;
    platform_policy?: PlatformPolicy;
  };
  "payment.void": { reason: string };
  "expense.create": ExpenseInput;
  "expense.update": Partial<Omit<ExpenseInput, "status" | "paid_on">>;
  "expense.pay": { paid_on: string };
  "expense.void": { reason: string };
  "block.create": BlockInput;
  "block.update": Partial<BlockInput>;
  "turnover.update": Partial<
    Pick<
      RentalTurnover,
      | "linen_ready"
      | "cleaning_status"
      | "planned_ready_at"
      | "ready_at"
      | "notes"
    >
  >;
  "turnover.approve_same_day": Record<string, never>;
};
export type RentalCommand = {
  [O in RentalOperation]: {
    operation: O;
    id?: string;
    data: RentalPayloadMap[O];
  };
}[RentalOperation];
