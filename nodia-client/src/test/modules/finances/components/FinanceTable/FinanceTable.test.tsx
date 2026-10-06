import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import FinanceTable from "../../../../../modules/finances/components/FinanceTable";
import type { FinanceTableProps } from "../../../../../modules/finances/components/FinanceTable";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      values?.name ? `${key}:${values.name}` : key,
  }),
}));
vi.mock("boneyard-js/react", () => ({
  Skeleton: ({
    loading,
    children,
  }: {
    loading: boolean;
    children: ReactNode;
  }) => (
    <div data-testid="skeleton" data-loading={String(loading)}>
      {children}
    </div>
  ),
}));

type Row = { id: string; name: string; is_active: boolean };
const row: Row = {
  id: "9007199254740993",
  name: "Movimiento personal",
  is_active: true,
};
function props(
  overrides: Partial<FinanceTableProps<Row>> = {},
): FinanceTableProps<Row> {
  return {
    rows: [row],
    columns: [
      {
        key: "name",
        labelKey: "finance:name",
        render: (record) => record.name,
      },
    ],
    search: "",
    onSearchChange: vi.fn(),
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onToggle: vi.fn(),
    meta: { page: 1, limit: 10, total_items: 26, total_pages: 3 },
    page: 1,
    limit: 10,
    onPageChange: vi.fn(),
    onLimitChange: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

describe("FinanceTable", () => {
  it("dispatches update and toggle with the exact record from its three-dot menu", async () => {
    const user = userEvent.setup();
    const callbacks = props();
    render(<FinanceTable {...callbacks} />);
    expect(screen.getAllByRole("columnheader").at(-1)).toHaveTextContent(
      "finance:actions",
    );
    await user.click(
      screen.getByRole("button", {
        name: "finance:row_actions:Movimiento personal",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "finance:update" }));
    expect(callbacks.onEdit).toHaveBeenCalledWith(row);
    await user.click(
      screen.getByRole("button", {
        name: "finance:row_actions:Movimiento personal",
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "finance:deactivate" }),
    );
    expect(callbacks.onToggle).toHaveBeenCalledWith(row);
  });

  it("retains existing data on a failed refetch and uses soft loading", () => {
    const callbacks = props();
    const view = render(<FinanceTable {...callbacks} />);
    view.rerender(<FinanceTable {...callbacks} isFetching />);
    expect(screen.getByText(row.name)).toBeVisible();
    expect(screen.getByTestId("skeleton")).toHaveAttribute(
      "data-loading",
      "false",
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "finance:create" }),
    ).toBeDisabled();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "finance:pagination_next" })).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "finance:row_actions:Movimiento personal",
      }),
    ).toBeDisabled();
    view.rerender(<FinanceTable {...callbacks} isError />);
    expect(screen.getByText(row.name)).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("finance:load_error");
    expect(screen.getByRole("button", { name: "finance:retry" })).toBeEnabled();
    expect(screen.queryByText("finance:empty_records")).not.toBeInTheDocument();
  });

  it("distinguishes empty from initial error and initial loading", () => {
    const callbacks = props({ rows: [] });
    const view = render(<FinanceTable {...callbacks} />);
    expect(screen.getByText("finance:empty_records")).toBeVisible();
    view.rerender(<FinanceTable {...callbacks} isLoading />);
    expect(screen.getByTestId("skeleton")).toHaveAttribute(
      "data-loading",
      "true",
    );
    expect(screen.queryByText("finance:empty_records")).not.toBeInTheDocument();
    view.rerender(<FinanceTable {...callbacks} isError />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText("finance:empty_records")).not.toBeInTheDocument();
  });

  it("uses one-based server pagination and disables payment for closed obligations", async () => {
    const user = userEvent.setup();
    const callbacks = props({ onPayment: vi.fn(), canPay: () => false });
    render(<FinanceTable {...callbacks} />);
    await user.click(
      screen.getByRole("button", { name: "finance:pagination_next" }),
    );
    expect(callbacks.onPageChange).toHaveBeenCalledWith(2);
    await user.click(
      screen.getByRole("button", {
        name: "finance:row_actions:Movimiento personal",
      }),
    );
    expect(
      screen.getByRole("menuitem", { name: "finance:register_payment" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("changes the server page size through the footer selector", async () => {
    const user = userEvent.setup();
    const callbacks = props();
    render(<FinanceTable {...callbacks} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "25" }));
    expect(callbacks.onLimitChange).toHaveBeenCalledWith(25);
  });
});
