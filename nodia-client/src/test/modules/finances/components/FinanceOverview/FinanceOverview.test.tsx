import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import FinanceOverview from "../../../../../modules/finances/components/FinanceOverview";
import type {
  FinanceOverviewData,
  FinanceQuery,
} from "../../../../../modules/finances/types";
import i18n from "../../../../../translate";

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  busy: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("../../../../../modules/finances/infrastructure/useServices", () => ({
  useFinanceOverview: mocks.overview,
  useFinanceBusy: mocks.busy,
}));
vi.mock("../../../../../modules/finances/components/FinanceFilters", () => ({
  default: ({
    onChange,
    disabled,
  }: {
    onChange: (query: FinanceQuery) => void;
    disabled: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={() => onChange({ active: "inactive" })}
    >
      Change overview filter
    </button>
  ),
}));
vi.mock(
  "../../../../../modules/finances/components/FinanceResourceTab",
  () => ({
    default: ({
      query,
      resource,
    }: {
      query: FinanceQuery;
      resource: string;
    }) => (
      <div data-testid="overview-movements">
        {resource}:{query.active}
      </div>
    ),
  }),
);
vi.mock(
  "../../../../../modules/finances/components/FinanceOverview/FinanceSummaryTable",
  () => ({
    default: ({ kind, query }: { kind: string; query: FinanceQuery }) => (
      <div data-testid={`summary-${kind}`}>{query.active}</div>
    ),
  }),
);
vi.mock("boneyard-js/react", () => ({
  Skeleton: ({
    loading,
    children,
  }: {
    loading: boolean;
    children: ReactNode;
  }) => (
    <div data-testid="overview-skeleton" data-loading={loading}>
      {children}
    </div>
  ),
}));

const overview: FinanceOverviewData = {
  scope: {
    active: "active",
    movement_filters: {
      q: {},
      category_ids: [],
      category_group_ids: [],
      obligation_id: null,
    },
    obligation_balances: {
      active: "active",
      repayments: "all_confirmed_history",
      includes_inactive_repayments: true,
      ignores_movement_filters: true,
    },
  },
  totals: {
    income_amount: "18446744073709551614",
    expense_amount: "20000",
    net_amount: "18446744073709531614",
    movement_count: 1000,
    pending_count: 3,
    cancelled_count: 2,
  },
  counts: { categories: 4, category_groups: 2, loans: 1, debts: 0 },
  obligations: { loan_remaining_amount: "60000", debt_remaining_amount: "0" },
};

beforeEach(() => {
  mocks.busy.mockReturnValue(false);
  mocks.refetch.mockReset();
  mocks.overview.mockReturnValue({
    data: overview,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: mocks.refetch,
  });
});

describe("FinanceOverview", () => {
  it("opens all movements with the applied financial scope", async () => {
    const onView = vi.fn();
    const query: FinanceQuery = {
      active: "inactive",
      category_ids: ["1"],
      q: { type_eq: "expense" },
    };
    render(
      <FinanceOverview
        query={query}
        onQueryChange={vi.fn()}
        onViewMovements={onView}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Ver todos los movimientos" }),
    );
    expect(onView).toHaveBeenCalledWith(query);
  });
  it("uses exact server totals rather than sums of the visible movement page", () => {
    render(
      <FinanceOverview query={{ active: "active" }} onQueryChange={vi.fn()} />,
    );
    expect(
      screen
        .getByTestId("finance-metric-income")
        .textContent?.replace(/\D/g, ""),
    ).toBe("18446744073709551614");
    expect(
      screen
        .getByTestId("finance-metric-loan_remaining")
        .textContent?.replace(/\D/g, ""),
    ).toBe("60000");
    expect(screen.getByTestId("overview-movements")).toHaveTextContent(
      "movements:active",
    );
    expect(screen.getByTestId("summary-categories")).toHaveTextContent(
      "active",
    );
    expect(screen.getByTestId("summary-category-groups")).toHaveTextContent(
      "active",
    );
    expect(screen.getByTestId("overview-skeleton")).toHaveAttribute(
      "data-loading",
      "false",
    );
  });

  it("preserves aggregate data after a failed refetch and offers retry", async () => {
    const view = render(
      <FinanceOverview query={{ active: "active" }} onQueryChange={vi.fn()} />,
    );
    mocks.overview.mockReturnValue({
      data: overview,
      isLoading: false,
      isFetching: false,
      isError: true,
      refetch: mocks.refetch,
    });
    view.rerender(
      <FinanceOverview query={{ active: "active" }} onQueryChange={vi.fn()} />,
    );
    expect(
      screen.getByTestId("finance-metric-loan_remaining"),
    ).toHaveTextContent("60.000");
    expect(screen.getByTestId("overview-skeleton")).toHaveAttribute(
      "data-loading",
      "false",
    );
    await userEvent.click(
      screen.getByRole("button", { name: i18n.t("finance:retry") }),
    );
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("does not invent zero metrics for a failed initial request", () => {
    mocks.overview.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      refetch: mocks.refetch,
    });
    render(
      <FinanceOverview query={{ active: "active" }} onQueryChange={vi.fn()} />,
    );
    expect(
      screen.queryByTestId("finance-metric-income"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("finance:retry") }),
    ).toBeEnabled();
  });

  it("distinguishes real zeros from absence and shares the active filter", async () => {
    mocks.overview.mockReturnValue({
      data: {
        ...overview,
        totals: {
          ...overview.totals,
          income_amount: "0",
          expense_amount: "0",
          net_amount: "0",
          movement_count: 0,
        },
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mocks.refetch,
    });
    const onChange = vi.fn();
    render(
      <FinanceOverview query={{ active: "active" }} onQueryChange={onChange} />,
    );
    expect(
      screen
        .getByTestId("finance-metric-income")
        .textContent?.replace(/\D/g, ""),
    ).toBe("0");
    await userEvent.click(
      screen.getByRole("button", { name: "Change overview filter" }),
    );
    expect(onChange).toHaveBeenCalledWith({ active: "inactive" });
  });

  it("uses skeletons only before data and blocks controls during refetch", () => {
    mocks.overview.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      refetch: mocks.refetch,
    });
    const view = render(
      <FinanceOverview query={{ active: "active" }} onQueryChange={vi.fn()} />,
    );
    expect(screen.getByTestId("overview-skeleton")).toHaveAttribute(
      "data-loading",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Change overview filter" }),
    ).toBeDisabled();
    mocks.overview.mockReturnValue({
      data: overview,
      isLoading: false,
      isFetching: true,
      isError: false,
      refetch: mocks.refetch,
    });
    view.rerender(
      <FinanceOverview query={{ active: "active" }} onQueryChange={vi.fn()} />,
    );
    expect(screen.getByTestId("overview-skeleton")).toHaveAttribute(
      "data-loading",
      "false",
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
