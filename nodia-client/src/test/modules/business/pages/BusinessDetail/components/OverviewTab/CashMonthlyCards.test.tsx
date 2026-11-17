import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../../../../../translate";
import CashMonthlyCards from "../../../../../../../modules/business/pages/BusinessDetail/components/OverviewTab/CashMonthlyCards";
import { useCashMonthlySummary } from "../../../../../../../modules/business/infrastructure/useCashServices";

const query = vi.hoisted(() => ({
  summary: undefined as unknown,
  error: null as unknown,
  refetch: vi.fn(),
}));

vi.mock("../../../../../../../hooks/useAuth", () => ({
  default: () => ({ user: { id: "1" }, sessionVersion: 9 }),
}));
vi.mock("../../../../../../../modules/business/infrastructure/useCashServices", () => ({
  useCashMonthlySummary: vi.fn(() => ({
    data: query.summary,
    error: query.error,
    isError: Boolean(query.error),
    isLoading: false,
    isFetching: false,
    refetch: query.refetch,
  })),
}));

const december = {
  period: { from: "2025-12-01", to: "2025-12-31", time_zone: "America/Santiago" },
  summary: {
    currency: "CLP",
    income: { count: 8, total_amount: "9009999999999099" },
    expense: { count: 0, total_amount: "0" },
  },
};

describe("Monthly cash cards", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("es");
    query.summary = undefined;
    query.error = null;
    vi.clearAllMocks();
  });

  it("uses the server's month and exact CLP totals including a verified zero", () => {
    query.summary = december;
    render(<CashMonthlyCards businessId="business-a" />);
    expect(useCashMonthlySummary).toHaveBeenCalledWith({ businessId: "business-a", actorId: "1", sessionVersion: 9 });
    expect(screen.getAllByText(/diciembre.*2025/i)).toHaveLength(2);
    expect(screen.getByText(/9\.009\.999\.999\.999\.099/)).toBeVisible();
    expect(screen.getByText(/CLP\s+0$/)).toBeVisible();
  });

  it("shows retry and omits cached figures when current authority was lost", () => {
    query.summary = december;
    query.error = { isAxiosError: true, response: { status: 403 } };
    render(<CashMonthlyCards businessId="business-a" />);
    expect(screen.getByRole("button", { name: i18n.t("core:retry") })).toBeVisible();
    expect(screen.queryByText(/CLP/)).not.toBeInTheDocument();
  });
});
