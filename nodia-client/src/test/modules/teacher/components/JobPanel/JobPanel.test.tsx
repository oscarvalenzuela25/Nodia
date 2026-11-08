import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JobPanel from "../../../../../modules/teacher/components/JobPanel";
import type { Job } from "../../../../../modules/teacher/infrastructure/schemas";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../../../../modules/teacher/infrastructure/useServices", () => ({ useTeacherJob: mocks.query }));
const onTerminal = vi.fn(); const onReady = vi.fn(); const onNew = vi.fn(async () => {}); const onContinue = vi.fn(async () => {});
const action = { enabled: true, reason_code: null };
let job: Job;
let query: { data: Job | undefined; isLoading: boolean; isFetching: boolean; isError: boolean; refetch: ReturnType<typeof vi.fn> };
beforeEach(() => {
  onTerminal.mockClear(); onReady.mockClear(); onNew.mockClear(); onContinue.mockClear();
  job = { job_id: "fixture-job", fence: "7", state: "running", purpose: "plan_outline", result_ref: null, error_code: null, local_closed: null, remote_outcome: null, retry_after_ms: 2000, allowed_actions: {} };
  query = { data: job, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() };
  mocks.query.mockImplementation(() => query);
});
const view = (paused = false, presentation: "panel" | "inline" = "panel") => <JobPanel presentation={presentation} jobId={job.job_id} paused={paused} busy={false} onReady={onReady} onTerminal={onTerminal} onNew={onNew} onContinue={onContinue} />;

describe("Teacher job presentation", () => {
  it("shows inline state without a separate heading and refreshes only the existing job read", async () => {
    job.state = "queued";
    render(view(false, "inline"));
    expect(screen.queryByText("Trabajo de Teacher")).not.toBeInTheDocument();
    expect(screen.getByText("En cola")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    expect(query.refetch).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled(); expect(onNew).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled(); expect(onTerminal).not.toHaveBeenCalled();
  });
  it("retains inline progress and state during polling and consumes READY once across presentation changes", () => {
    const { rerender } = render(view(false, "inline"));
    const progress = screen.getByRole("progressbar", { name: "Preparación en curso; sin porcentaje disponible" });
    const status = screen.getByText("Preparando");
    expect(progress).not.toHaveAttribute("aria-valuenow");
    query.isFetching = true; query.data = { ...job }; rerender(view(false, "inline"));
    expect(screen.getByRole("progressbar", { name: "Preparación en curso; sin porcentaje disponible" })).toBe(progress);
    expect(screen.getByText("Preparando")).toBe(status);
    expect(screen.getByRole("button", { name: "Actualizar estado" })).toBeDisabled();
    job = { ...job, state: "ready", local_closed: true, remote_outcome: "completed" };
    query.data = job; query.isFetching = false; rerender(view(false, "inline"));
    expect(screen.queryByRole("progressbar", { name: "Preparación en curso; sin porcentaje disponible" })).not.toBeInTheDocument();
    expect(screen.getByText("Resultado guardado")).toBeVisible(); expect(onReady).toHaveBeenCalledOnce();
    rerender(view()); expect(onReady).toHaveBeenCalledOnce();
    rerender(view(false, "inline")); expect(onReady).toHaveBeenCalledOnce();
  });
  it("preserves inline unknown diagnostics, cached-read errors and explicit recovery without replay", async () => {
    job.state = "unknown"; job.error_code = "local_closure_unproven"; query.isError = true;
    const { rerender } = render(view(false, "inline"));
    expect(screen.getByText(/No se volverá a enviar esta inferencia/)).toBeVisible();
    expect(screen.getByText(/Todavía no se ha comprobado el cierre local/)).toBeVisible();
    expect(screen.getByText(/Se conserva el último estado confirmado/)).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(onTerminal).toHaveBeenCalledExactlyOnceWith(job);
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(query.refetch).toHaveBeenCalledOnce(); expect(onNew).not.toHaveBeenCalled();
    job = { ...job, purpose: "assessment_only", error_code: "provider_outcome_unknown", local_closed: true, allowed_actions: { request_new_generation: action } };
    query.data = job; query.isError = false; rerender(view(false, "inline"));
    await userEvent.click(screen.getByRole("button", { name: "Solicitar nueva generación" }));
    expect(onNew).toHaveBeenCalledExactlyOnceWith(job); expect(onContinue).not.toHaveBeenCalled();
    expect(onTerminal).toHaveBeenCalledOnce();
  });
  it("retains an explicit inline continue action for a paused job without animating or automatically continuing", async () => {
    job.state = "blocked_paused"; job.allowed_actions = { continue_before_dispatch: action };
    render(view(true, "inline"));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Continuar preparación" }));
    expect(onContinue).toHaveBeenCalledExactlyOnceWith(job); expect(query.refetch).not.toHaveBeenCalled();
  });
  it("keeps inline refresh outside initial informational loading and retains a retry after an empty failed read", async () => {
    query.data = undefined; query.isLoading = true; query.isFetching = true;
    const { container, rerender } = render(view(false, "inline"));
    expect(screen.getByRole("button", { name: "Actualizar estado" })).toBeDisabled();
    expect(container.querySelector('[data-boneyard-overlay="true"]')?.childElementCount).toBeGreaterThan(0);
    expect(screen.queryByText("Todavía no hay un estado confirmado para este trabajo.")).not.toBeInTheDocument();
    query.isLoading = false; query.isFetching = false; query.isError = true; rerender(view(false, "inline"));
    expect(container.querySelector('[data-boneyard-overlay="true"]')).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText("Todavía no hay un estado confirmado para este trabajo.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    expect(query.refetch).toHaveBeenCalledOnce(); expect(onNew).not.toHaveBeenCalled(); expect(onContinue).not.toHaveBeenCalled();
  });
  it.each(["failed_known", "unknown", "cancelled_before_dispatch"] as const)("notifies %s once so the session can release its stale preparing state without replay", state => {
    const { rerender } = render(view());
    expect(onTerminal).not.toHaveBeenCalled();
    job = { ...job, state, local_closed: true }; query.data = job; rerender(view());
    expect(onTerminal).toHaveBeenCalledExactlyOnceWith(job);
    query.data = { ...job }; query.isFetching = true; rerender(view());
    expect(onTerminal).toHaveBeenCalledOnce(); expect(onReady).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled(); expect(onNew).not.toHaveBeenCalled();
  });
  it("keeps indeterminate progress and the observed status mounted between polling requests", () => {
    const { rerender } = render(view());
    const progress = screen.getByRole("progressbar"); const status = screen.getByText("Preparando");
    expect(progress).not.toHaveAttribute("aria-valuenow");
    query.isFetching = true; rerender(view());
    expect(screen.getByRole("progressbar")).toBe(progress); expect(screen.getByText("Preparando")).toBe(status);
    expect(screen.getByRole("button", { name: "Actualizar estado" })).toBeDisabled();
    query.isFetching = false; rerender(view());
    expect(screen.getByRole("progressbar")).toBe(progress);
    expect(onNew).not.toHaveBeenCalled();
  });
  it("removes active progress on a terminal result and delivers READY only once through refetches", () => {
    const { rerender } = render(view());
    job = { ...job, state: "ready", local_closed: true, remote_outcome: "completed" };
    query.data = job; rerender(view());
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(); expect(onReady).toHaveBeenCalledOnce();
    query.isFetching = true; query.data = { ...job }; rerender(view());
    expect(screen.getByText("Resultado guardado")).toBeInTheDocument(); expect(onReady).toHaveBeenCalledOnce();
  });
  it("retains cached job status after a failed refresh and retries only its status read", async () => {
    query.isError = true;
    render(view());
    expect(screen.getByText("Preparando")).toBeInTheDocument();
    expect(screen.getByText(/Se conserva el último estado confirmado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(query.refetch).toHaveBeenCalledOnce(); expect(onNew).not.toHaveBeenCalled();
  });
  it("explains a known preparation error without rendering an arbitrary server diagnostic", () => {
    job.state = "failed_known"; job.error_code = "invalid_generated_content";
    const { rerender } = render(view());
    expect(screen.getByText("El contenido recibido no pasó la validación y no se publicó.")).toBeInTheDocument();
    job.error_code = "private-fixture-path/token-like-diagnostic"; rerender(view());
    expect(screen.getByText(/No hay un detalle de error reconocido/)).toBeInTheDocument();
    expect(screen.queryByText(job.error_code)).not.toBeInTheDocument();
  });
  it("explains an excluded plan dispatch without inventing a fresh-generation action", async () => {
    job.state = "failed_known"; job.error_code = "native_dispatch_excluded";
    const { rerender } = render(view());
    expect(screen.getByText("El motor no inició esta preparación. No se generó contenido.")).toBeInTheDocument();
    expect(screen.queryByText(/Puedes solicitar una preparación nueva/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar nueva generación" })).not.toBeInTheDocument();
    job.allowed_actions = { request_new_generation: action }; query.isFetching = true; rerender(view());
    expect(screen.getByText(/El motor no inició/)).toBeInTheDocument();
    expect(screen.getByText(/Puedes solicitar una preparación nueva/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar nueva generación" })).toBeDisabled();
    query.isFetching = false; rerender(view());
    await userEvent.click(screen.getByRole("button", { name: "Solicitar nueva generación" }));
    expect(onNew).toHaveBeenCalledExactlyOnceWith(job);
    job.state = "unknown"; rerender(view());
    expect(screen.queryByText(/El motor no inició/)).not.toBeInTheDocument();
    expect(screen.getByText(/No se volverá a enviar esta inferencia/)).toBeInTheDocument();
    expect(onNew).toHaveBeenCalledOnce();
  });
  it("does not animate a paused job or automatically continue it", () => {
    job.state = "blocked_paused"; job.allowed_actions = { continue_before_dispatch: action };
    query.isFetching = true;
    render(view(true));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar preparación" })).toBeDisabled();
    expect(onContinue).not.toHaveBeenCalled();
  });
});
