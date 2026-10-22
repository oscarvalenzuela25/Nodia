import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportObservation from "../../../../../modules/nodiaAi/components/ReportObservation/ReportObservation";
import useAuthStore from "../../../../../store/authStore";
import { report } from "../../infrastructure/reportFixtures";
import { toolRef } from "../../infrastructure/observationFixtures";
import i18n from "../../../../../translate";

const mocks = vi.hoisted(() => ({ getNodiaAiReport: vi.fn(), error: vi.fn() }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/services", async importOriginal => ({ ...await importOriginal<object>(), ...mocks }));
vi.mock("../../../../../config/httpFeedback", () => ({ notifyHttpError: mocks.error }));
const ref = { ...toolRef, tool_name: "nodia_reports_run" };
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ user: { id: "9", name: "Synthetic owner" }, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false });
  mocks.getNodiaAiReport.mockResolvedValue(report);
});
afterEach(() => { client.clear(); useAuthStore.setState({ token: null, user: null, sessionStatus: "anonymous" }); });
function open() { render(<QueryClientProvider client={client}><ReportObservation resultRef={ref} /></QueryClientProvider>); }
const reportKey = ["nodia-ai", "9", 1, "observation", "report", ref];

describe("NodiaAI report presentation", () => {
  it("shows verified comparisons only on intent and keeps missing groups distinct from zero", async () => {
    const other = { ...report.source_results[0], source_alias: "other", columns: report.source_results[0].columns.map(column => ({ ...column, source_aliases: ["other"] })) };
    mocks.getNodiaAiReport.mockResolvedValue({ ...report, combine: "compare_compatible", source_results: [report.source_results[0], other], provenance: [...report.provenance, { ...report.provenance[0], source_alias: "other" }], columns: [...report.columns, { ...report.columns[0], key: "other.total", source_aliases: ["other"] }], rows: [["0", null]] });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Ver comparación compatible" }));
    expect(screen.getByRole("cell", { name: "Desconocido" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "0" })).toBeInTheDocument();
    expect(mocks.getNodiaAiReport).toHaveBeenCalledTimes(1);
  });
  it("renders empty totals as real zero and preserves the original civil period in English", async () => {
    const period = { kind: "civil_date", dimension_key: "incurred_on", from: "2026-10-01", to_exclusive: "2026-11-01", timezone: "America/Santiago" };
    mocks.getNodiaAiReport.mockResolvedValue({ ...report, status: "empty", source_errors: [], source_results: [{ ...report.source_results[0], status: "empty", totals: { total: "0" }, matched_records: "0", rows: [], period }] });
    await i18n.changeLanguage("en");
    open();
    expect(await screen.findByText("total: 0 peso")).toBeInTheDocument();
    expect(screen.getByText("No records match the filters.")).toBeInTheDocument();
    expect(screen.getByText("From 2026-10-01 until 2026-11-01 (exclusive) · America/Santiago")).toBeInTheDocument();
  });
  it("shows exact source totals before groups, including provenance, unknown sources and no implicit grand total", async () => {
    open();
    expect(await screen.findByText("total: 90.071.992.547.409.930 peso")).toBeInTheDocument();
    expect(screen.getByText(/Informe parcial/)).toBeInTheDocument();
    expect(screen.getByText(/unavailable: resultado desconocido/)).toBeInTheDocument();
    expect(screen.getByText("Usuario: 9")).toBeInTheDocument();
    expect(screen.getByText("Base temporal: created_at")).toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-10-17T12:01:00Z"]')).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ver grupos del informe" }));
    expect(screen.getByRole("cell", { name: "Sin valor" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "0" })).toBeInTheDocument();
    expect(screen.getByText(/Hay más grupos/)).toBeInTheDocument();
    expect(mocks.getNodiaAiReport).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Ocultar grupos" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("keeps groups and totals through transport failures, with one toast and a read-only retry", async () => {
    open(); await screen.findByText(/total: 90/);
    await userEvent.click(screen.getByRole("button", { name: "Ver grupos del informe" }));
    mocks.getNodiaAiReport.mockRejectedValue(new Error("synthetic outage"));
    await act(() => client.invalidateQueries({ queryKey: reportKey }));
    expect(screen.getByText(/total: 90/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    mocks.getNodiaAiReport.mockResolvedValue(report);
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(mocks.getNodiaAiReport).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.queryByText(i18n.t("nodiaAi:observation.result_error"))).not.toBeInTheDocument());
  });
  it("removes previously rendered amounts on authorization rejection", async () => {
    open(); await screen.findByText(/total: 90/);
    const config = { headers: new AxiosHeaders() };
    mocks.getNodiaAiReport.mockRejectedValue(new AxiosError("Denied", "ERR_BAD_REQUEST", config, undefined, { config, data: {}, headers: {}, status: 403, statusText: "Forbidden" }));
    await act(() => client.invalidateQueries({ queryKey: reportKey }));
    await waitFor(() => expect(screen.queryByText(/total: 90/)).not.toBeInTheDocument());
    expect(client.getQueryData(reportKey)).toBeNull();
  });
  it("isolates the previous account cache and blocks duplicate controls while refreshing", async () => {
    open(); await screen.findByText(/total: 90/);
    mocks.getNodiaAiReport.mockImplementation(() => new Promise(() => {}));
    act(() => { void client.invalidateQueries({ queryKey: reportKey }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Ver grupos del informe" })).toBeDisabled());
    act(() => useAuthStore.setState({ user: { id: "10", name: "Synthetic other" }, sessionVersion: 2 }));
    expect(screen.queryByText(/total: 90/)).not.toBeInTheDocument();
  });
});
