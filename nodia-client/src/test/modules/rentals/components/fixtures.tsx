import { vi } from "vitest";
import type { ReactNode } from "react";
import { createElement } from "react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import {
  ackSchema,
  cancellationPreviewSchema,
} from "../../../../modules/rentals/infrastructure/schemas";
import {
  examples,
  example,
  property as sourceProperty,
  reservation as sourceReservation,
  turnover as sourceTurnover,
  payment as sourcePayment,
  expense as sourceExpense,
  overview as sourceOverview,
  calendar as sourceCalendar,
  availability as sourceAvailability,
} from "../infrastructure/fixtures";
const ui = vi.hoisted(() => ({
  list: vi.fn(),
  record: vi.fn(),
  execute: vi.fn(),
  recover: vi.fn(),
  retry: vi.fn(),
  preview: vi.fn(),
  busy: false,
  pending: false,
  uncertain: false,
  accessError: false,
}));
export { ui };
export const property = sourceProperty;
export const reservation = sourceReservation;
export const turnover = sourceTurnover;
export const payment = sourcePayment;
export const expense = sourceExpense;
export const overview = sourceOverview;
export const calendar = sourceCalendar;
export const availability = sourceAvailability;
vi.mock("../../../../modules/rentals/infrastructure/useServices", () => ({
  useRentalBusy: () => ui.busy,
  useRentalPendingCount: () => (ui.uncertain ? 1 : 0),
  useRentalList: (...args: unknown[]) => ui.list(...args),
  useRentalRecord: (...args: unknown[]) => ui.record(...args),
  useRentalProperty: (id?: string) => ({
    ...result(id ? property : undefined),
    isError: ui.accessError,
  }),
  useRentalMutation: () => ({
    execute: ui.execute,
    recover: ui.recover,
    retry: ui.retry,
    isPending: ui.pending,
    isUncertain: ui.uncertain,
    intent: undefined,
    error: null,
  }),
  useRentalCalendar: () => result(calendar),
  useRentalAvailability: () => result(availability),
  useRentalOverview: () => result(overview),
  useRentalCancellationPreview: () => ({
    execute: ui.preview,
    isPending: false,
    error: null,
  }),
  rentalKeys: { scope: (actor?: string, id?: string) => ["rental", actor, id] },
}));
vi.mock("../../../../modules/rentals/components/RentalRemoteSelect", () => ({
  default: ({
    label,
    value,
    onChange,
    disabled,
  }: {
    label: string;
    value: string | null;
    onChange: (value: string | null) => void;
    disabled?: boolean;
  }) =>
    createElement(
      "select",
      {
        "aria-label": label,
        value: value ?? "",
        disabled,
        onChange: (event: { target: { value: string } }) =>
          onChange(event.target.value || null),
      },
      createElement("option", { value: "" }, ""),
      createElement("option", { value: "1" }, "Synthetic selection"),
      value && value !== "1" ? createElement("option", { value }, value) : null,
    ),
}));
export const result = <T,>(data?: T) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});
export const page = <T,>(rows: T[], total = rows.length) =>
  result({
    data: rows,
    meta: {
      page: 1,
      limit: 10,
      total_items: total,
      total_pages: Math.ceil(total / 10),
    },
  });
export function resetUI() {
  vi.clearAllMocks();
  ui.busy = false;
  ui.pending = false;
  ui.uncertain = false;
  ui.accessError = false;
  ui.execute.mockResolvedValue(undefined);
  ui.recover.mockResolvedValue(undefined);
  ui.retry.mockResolvedValue(undefined);
  ui.preview.mockResolvedValue(
    cancellationPreviewSchema.parse(
      examples.find((row) => row.url.endsWith("cancellation-preview"))!
        .response,
    ),
  );
  ui.list.mockImplementation((resource: string) =>
    resource === "properties"
      ? page([property])
      : result(example(`/{propertyId}/${resource}`)),
  );
  ui.record.mockImplementation(
    (resource: string, _house: string, id?: string) =>
      result(
        id
          ? resource === "reservations"
            ? reservation
            : resource === "turnovers"
              ? turnover
              : resource === "payments"
                ? payment
                : resource === "expenses"
                  ? expense
                  : undefined
          : undefined,
      ),
  );
}
export const paymentAck = ackSchema.parse(
  examples.find(
    (row) =>
      row.route === "POST /api/v1/rental/properties/{propertyId}/payments",
  )!.response,
);
export function renderRoute(
  element: ReactNode,
  url = "/tools/reservations?property=1",
) {
  const router = createMemoryRouter(
    [
      { path: "/tools/reservations", element },
      { path: "/elsewhere", element: <p>Elsewhere</p> },
    ],
    { initialEntries: [url] },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
    client,
  };
}
