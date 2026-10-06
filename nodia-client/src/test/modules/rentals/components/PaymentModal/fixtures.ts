import { readFileSync } from "node:fs";
import { createElement } from "react";
import { vi } from "vitest";
import { z } from "zod";
import {
  propertySchema,
  reservationSchema,
  paymentSchema,
  expenseSchema,
  overviewSchema,
  auditSchema,
} from "../../../../../modules/rentals/infrastructure/schemas";
import i18n from "../../../../../translate";
import translations from "../../../../../modules/rentals/components/RentalOverview/translations.json";
const moneyMock = vi.hoisted(() => ({
  execute: vi.fn(),
  recover: vi.fn(),
  retry: vi.fn(),
  list: vi.fn(),
  record: vi.fn(),
  overview: vi.fn(),
  busy: false,
  uncertain: false,
  pending: false,
}));
export { moneyMock };
vi.mock("../../../../../modules/rentals/infrastructure/useServices", () => ({
  useRentalMutation: () => ({
    execute: moneyMock.execute,
    recover: moneyMock.recover,
    retry: moneyMock.retry,
    isPending: moneyMock.pending,
    isUncertain: moneyMock.uncertain,
    error: null,
    intent: undefined,
  }),
  useRentalBusy: () => moneyMock.busy,
  useRentalList: (...args: unknown[]) => moneyMock.list(...args),
  useRentalRecord: (...args: unknown[]) => moneyMock.record(...args),
  useRentalOverview: (...args: unknown[]) => moneyMock.overview(...args),
}));
vi.mock("../../../../../modules/rentals/components/RentalRemoteSelect", () => ({
  default: (props: {
    label: string;
    value: string | null;
    onChange: (value: string | null) => void;
    disabled?: boolean;
  }) =>
    createElement(
      "select",
      {
        "aria-label": props.label,
        value: props.value ?? "",
        disabled: props.disabled,
        onChange: (event: { target: { value: string } }) =>
          props.onChange(event.target.value || null),
      },
      createElement("option", { value: "" }, ""),
      createElement("option", { value: "1" }, "Synthetic reservation"),
      props.value && props.value !== "1"
        ? createElement("option", { value: props.value }, props.value)
        : null,
    ),
}));
const examples = z
  .array(z.object({ route: z.string(), response: z.unknown() }))
  .parse(
    JSON.parse(
      readFileSync("../nodia-server/test/fixtures/rental/api.json", "utf8"),
    ),
  );
const example = (suffix: string) =>
  examples.find(
    (row) => row.route === `GET /api/v1/rental/properties${suffix}`,
  )!.response;
export const property = propertySchema.parse(example("/{propertyId}"));
export const reservation = {
  ...reservationSchema.parse(example("/{propertyId}/reservations/{id}")),
  status: "draft" as const,
  cancelled_at: null,
  refund_amount: null,
  cancellation_snapshot: null,
  policy_snapshot: null,
  channel: "whatsapp" as const,
  deposit_amount: "20000",
  total_amount: "100000",
  expected_amount: "100000",
  balance_due_amount: "100000",
  refund_due_amount: "0",
  received_amount: "0",
  cancellation_policy_id: "1",
};
export const payment = {
  ...paymentSchema.parse(example("/{propertyId}/payments/{id}")),
  status: "confirmed" as const,
  amount: "9007199254740993",
};
export const expense = {
  ...expenseSchema.parse(example("/{propertyId}/expenses/{id}")),
  status: "pending" as const,
  amount: "10000",
  incurred_on: "2026-10-01",
  paid_on: null,
  reservation_id: null,
};
export const overview = overviewSchema.parse(example("/{propertyId}/overview"));
export const audit = z
  .object({ data: z.array(auditSchema) })
  .parse(example("/{propertyId}/audit-events")).data[0];
export const ack = {
  operation: "payment.create" as const,
  property_id: property.id,
  resource_id: "3",
  resource_type: "payment" as const,
  status: "confirmed" as const,
  updated_at: "2026-10-04T12:00:00Z",
};
export const result = <T>(data?: T) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});
export const pageResult = <T>(data: T[], total = data.length) =>
  result({
    data,
    meta: {
      page: 1,
      limit: 10,
      total_items: total,
      total_pages: Math.ceil(total / 10),
    },
  });
export function resetMoneyMocks() {
  vi.clearAllMocks();
  moneyMock.busy = false;
  moneyMock.uncertain = false;
  moneyMock.pending = false;
  moneyMock.execute.mockResolvedValue(ack);
  moneyMock.recover.mockResolvedValue(ack);
  moneyMock.retry.mockResolvedValue(ack);
  moneyMock.list.mockImplementation((resource: string) =>
    resource === "payments"
      ? pageResult([payment], 25)
      : resource === "expenses"
        ? pageResult([expense], 25)
        : pageResult([audit], 25),
  );
  moneyMock.record.mockImplementation(
    (resource: string, _propertyId: string, id?: string) =>
      result(
        id
          ? resource === "reservations"
            ? reservation
            : resource === "payments"
              ? payment
              : expense
          : undefined,
      ),
  );
  moneyMock.overview.mockReturnValue(result(overview));
  for (const language of ["es", "en"] as const)
    i18n.addResourceBundle(
      language,
      "rental",
      translations[language],
      true,
      true,
    );
}
