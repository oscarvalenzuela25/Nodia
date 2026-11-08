import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";
import SalesReportFilters, { defaultReportFilters, reportPeriod } from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesReportFilters";
import type { ReportFilters } from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesReportFilters";
import i18n from "../../../../../../../../translate";
const text = (key: string) => String(i18n.t(key));
const defaults: ReportFilters = { from: "2026-04-01", through: "2026-04-30", metric: "units" };
async function open() { await userEvent.setup().click(screen.getByRole("button", { name: text("core:open_filters") })); return screen.findByRole("dialog"); }
describe("report filter draft", () => {
  it("keeps an invalid civil range in the shared Filter and applies only a corrected range", async () => {
    const apply = vi.fn(); render(<SalesReportFilters value={defaults} defaults={defaults} disabled={false} onApply={apply} />);
    const dialog = await open();
    fireEvent.change(within(dialog).getByRole("textbox", { name: text("business:pos.from") }), { target: { value: "2026-05-01" } });
    expect(within(dialog).getByRole("button", { name: text("core:filter_action") })).toBeDisabled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(text("business:pos.invalid_period")); expect(apply).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: text("business:pos.through") }), { target: { value: "2026-05-02" } });
    await userEvent.setup().click(within(dialog).getByRole("button", { name: text("core:filter_action") }));
    expect(apply).toHaveBeenCalledExactlyOnceWith({ from: "2026-05-01", through: "2026-05-02", metric: "units" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("discards canceled edits on reopening, clears to the current-month defaults and locks when fetching", async () => {
    const apply = vi.fn(); const value = { from: "2025-01-01", through: "2025-01-10", metric: "amount" as const };
    const view = render(<SalesReportFilters value={value} defaults={defaults} disabled={false} onApply={apply} />);
    let dialog = await open(); fireEvent.change(within(dialog).getByRole("textbox", { name: text("business:pos.from") }), { target: { value: "2024-01-01" } });
    await userEvent.setup().click(within(dialog).getByRole("button", { name: text("core:cancel") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); dialog = await open();
    expect(within(dialog).getByRole("textbox", { name: text("business:pos.from") })).toHaveValue(value.from); expect(apply).not.toHaveBeenCalled();
    await userEvent.setup().click(within(dialog).getByRole("button", { name: text("core:clear_filters") })); expect(apply).toHaveBeenCalledExactlyOnceWith(defaults);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    view.rerender(<SalesReportFilters value={value} defaults={defaults} disabled onApply={apply} />);
    expect(screen.getByRole("button", { name: text("core:open_filters") })).toBeDisabled();
  });
  it("preserves Santiago inclusive days across the offset change and rejects partial or impossible dates", () => {
    expect(defaultReportFilters(Temporal.PlainDate.from("2026-04-05"))).toEqual({ from: "2026-04-01", through: "2026-04-05", metric: "units" });
    expect(reportPeriod({ from: "2026-04-04", through: "2026-04-05" })).toEqual({ from: "2026-04-04T03:00:00Z", to_exclusive: "2026-04-06T04:00:00Z" });
    for (const from of ["", "2026-02-30", "2026-04-", "2026-4-01", "2026-04-01T12:00", "2026-04-01[u-ca=iso8601]", " 2026-04-01"]) expect(reportPeriod({ from, through: defaults.through })).toBeNull();
  });
});
