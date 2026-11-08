import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SalesReportRanking from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesReportRanking";
import type { TopProducts } from "../../../../../../../../modules/business/infrastructure/salesTypes";
import i18n from "../../../../../../../../translate";
import { formatClp } from "../../../../../../../../modules/business/infrastructure/salesPolicies";
import { mobileViewport } from "../mobileViewport";
const data: TopProducts = { currency: "CLP", timezone: "America/Santiago", metric: "units", data: [
  { product_id: "2", name: "Synthetic Z", code: "Z", units_sold: "7", total_amount: "0" },
  { product_id: "1", name: "Synthetic A", code: "A", units_sold: "0", total_amount: "9007199254740993123" },
] };
const props = { data, metric: "units" as const, loading: false, fetching: false, error: false, retryDisabled: false, onRetry: vi.fn() };
afterEach(() => vi.restoreAllMocks());
describe("bounded report ranking", () => {
  it("keeps the same ordered top and exact values across mobile cards, the600px table boundary and retry", async () => {
    const viewport = mobileViewport(320), retry = vi.fn();
    const longCode = "0000" + "synthetic-code-".repeat(12);
    const values = { ...data, data: [{ ...data.data[0], code: longCode }, data.data[1]] };
    const view = render(<SalesReportRanking {...props} data={values} onRetry={retry} />);
    const title = screen.getByRole("heading", { name: String(i18n.t("business:pos.top_products")) });
    const items = within(screen.getByRole("list", { name: title.textContent! })).getAllByRole("listitem");
    expect(items).toHaveLength(2); expect(items[0]).toHaveTextContent("Synthetic Z"); expect(items[0]).toHaveTextContent(longCode);
    expect(within(items[1]).getByText(`0 ${i18n.t("product:units.unit")}`)).toBeInTheDocument();
    expect(items[1]).toHaveTextContent(formatClp("9007199254740993123", i18n.language));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    for (const width of [390, 430, 599]) { act(() => viewport.resize(width)); expect(screen.queryByRole("table")).not.toBeInTheDocument(); }
    act(() => viewport.resize(600)); expect(screen.getByRole("table")).toBeInTheDocument(); expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: title.textContent! })).toBe(title);
    act(() => viewport.resize(390));
    const stale = screen.getByRole("article", { name: "Synthetic Z" });
    view.rerender(<SalesReportRanking {...props} data={values} error fetching retryDisabled onRetry={retry} />);
    expect(screen.getByRole("article", { name: "Synthetic Z" })).toBe(stale);
    expect(screen.getByRole("button", { name: String(i18n.t("business:pos.retry")) })).toBeDisabled();
    view.rerender(<SalesReportRanking {...props} data={values} error onRetry={retry} />);
    await userEvent.setup().click(screen.getByRole("button", { name: String(i18n.t("business:pos.retry")) })); expect(retry).toHaveBeenCalledTimes(1);
  });
  it("preserves server ranking rather than re-sorting the visible rows or inventing global pagination", () => {
    render(<SalesReportRanking {...props} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row"); expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("Synthetic Z"); expect(rows[2]).toHaveTextContent("Synthetic A");
    expect(screen.getByText(String(i18n.t("business:pos.top_products_limit_hint", { metric: String(i18n.t("business:pos.units_sold")).toLocaleLowerCase(i18n.language) })))).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(within(rows[2]).getByText(`0 ${i18n.t("product:units.unit")}`)).toBeInTheDocument();
  });
  it("keeps rows mounted after a refetch failure and retries without claiming that the ranking is empty", async () => {
    const retry = vi.fn(); const view = render(<SalesReportRanking {...props} onRetry={retry} />);
    const row = screen.getByText("Synthetic Z").closest("tr");
    view.rerender(<SalesReportRanking {...props} error onRetry={retry} />);
    expect(screen.getByText("Synthetic Z").closest("tr")).toBe(row); expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: String(i18n.t("business:pos.retry")) })); expect(retry).toHaveBeenCalledTimes(1);
    view.rerender(<SalesReportRanking {...props} data={undefined} error onRetry={retry} />);
    expect(screen.queryByText(String(i18n.t("business:pos.sales_empty")))).not.toBeInTheDocument();
    view.rerender(<SalesReportRanking {...props} data={{ ...data, data: [] }} fetching retryDisabled onRetry={retry} />);
    expect(screen.getByText(String(i18n.t("business:pos.sales_empty")))).toBeInTheDocument();
    view.rerender(<SalesReportRanking {...props} error fetching retryDisabled onRetry={retry} />);
    expect(screen.getByRole("button", { name: String(i18n.t("business:pos.retry")) })).toBeDisabled();
  });
});
