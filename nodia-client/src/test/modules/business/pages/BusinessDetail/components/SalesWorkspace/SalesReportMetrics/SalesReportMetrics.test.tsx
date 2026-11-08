import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SalesReportMetrics from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesReportMetrics";
import type { SalesSummary } from "../../../../../../../../modules/business/infrastructure/salesTypes";
import { formatClp } from "../../../../../../../../modules/business/infrastructure/salesPolicies";
import i18n from "../../../../../../../../translate";
const summary: SalesSummary = { currency: "CLP", timezone: "America/Santiago", sales_count: "0", total_amount: "0", units_sold: "0", average_ticket: null };
const averageCard = () => screen.getByRole("heading", { name: String(i18n.t("business:pos.average_per_sale")) }).closest("article")!;
describe("report metric cards", () => {
  it("shows quantities by unit instead of adding incompatible physical measures", () => {
    render(<SalesReportMetrics summary={{ ...summary, quantity_by_unit: [{ measurement_unit: "unit", quantity: "2.5" }, { measurement_unit: "kg", quantity: "1.125" }] }} loading={false} />);
    expect(screen.getByText("2,5 Unidades · 1,125 Kilos")).toBeInTheDocument();
  });
  it("keeps real zero metrics and an undefined average distinct, without inventing missing figures", () => {
    const view = render(<SalesReportMetrics summary={summary} loading={false} />);
    expect(screen.getAllByRole("article")).toHaveLength(4); expect(within(averageCard()).getByText("—")).toBeInTheDocument();
    expect(screen.getByText(formatClp("0", i18n.language))).toBeInTheDocument(); expect(screen.getAllByText("0")).toHaveLength(2);
    view.rerender(<SalesReportMetrics summary={undefined} loading={false} />); expect(screen.getAllByText("—")).toHaveLength(4); expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
  it.each([null, { numerator: "10", denominator: "0" }])("does not display an average for an absent or zero denominator: %s", ratio => {
    render(<SalesReportMetrics summary={{ ...summary, average_ticket: ratio }} loading={false} />);
    expect(within(averageCard()).getByText("—")).toBeInTheDocument(); expect(within(averageCard()).queryByText(/≈/)).not.toBeInTheDocument();
  });
  it("marks only the rounded average as approximate and preserves integers beyond Number precision", () => {
    render(<SalesReportMetrics summary={{ ...summary, sales_count: "2", units_sold: "9007199254740993123", total_amount: "9007199254740993123", average_ticket: { numerator: "9007199254740993123", denominator: "2" } }} loading={false} />);
    expect(screen.getByText(formatClp("9007199254740993123", i18n.language))).toBeInTheDocument();
    expect(within(averageCard()).getByText(`≈ ${formatClp("4503599627370496562", i18n.language)}`)).toBeInTheDocument();
    expect(within(averageCard()).getByText(String(i18n.t("business:pos.average_per_sale_help")))).toBeInTheDocument();
  });
});
