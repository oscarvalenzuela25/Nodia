import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfirmedExecution from "../../../../../modules/nodiaAi/components/ConfirmedExecution";
import useAuthStore from "../../../../../store/authStore";
import { nodiaAiKeys } from "../../../../../modules/nodiaAi/infrastructure/useServices";
import { chatId, conversation } from "../../infrastructure/fixtures";
import { execution } from "../../infrastructure/proposalFixtures";
import type { NodiaAiExecutionStatus } from "../../../../../modules/nodiaAi/infrastructure/types";
import i18n from "../../../../../translate";
import { dependentStepId, partialWorkflow } from "../../infrastructure/workflowFixtures";

const mocks = vi.hoisted(() => ({ getNodiaAiExecution: vi.fn(), controlNodiaAiExecution: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/services", async original => ({ ...await original<object>(), ...mocks }));
vi.mock("sileo", () => ({ sileo: { success: mocks.success, error: mocks.error } }));
let client: QueryClient;
const failed: NodiaAiExecutionStatus = { ...execution, revision: 3, state: "failed", can_resume: true, steps: [{ ...execution.steps[0], state: "failed" }] };
const completed: NodiaAiExecutionStatus = { ...execution, revision: 3, state: "completed", steps: [{ ...execution.steps[0], state: "completed", result_refs: [{ resource_key: "finance_movements", id: "9007199254740993" }] }] };
beforeEach(async () => {
  vi.clearAllMocks(); await i18n.changeLanguage("es");
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ user: { id: "9", name: "Synthetic" }, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false });
  client.setQueryData(nodiaAiKeys.detail(["9", 1], chatId), { conversation: { ...conversation, read_only: false }, current_run: null, active_execution: execution });
  mocks.getNodiaAiExecution.mockResolvedValue(execution);
  mocks.controlNodiaAiExecution.mockResolvedValue({ ...execution, state: "cancelled", revision: 2 });
});
afterEach(() => { client.clear(); useAuthStore.setState({ token: null, user: null, sessionStatus: "anonymous" }); });
function open() { return render(<QueryClientProvider client={client}><MemoryRouter><ConfirmedExecution conversationId={chatId} executionId={execution.execution_id} /></MemoryRouter></QueryClientProvider>); }
describe("confirmed execution observation and human controls", () => {
  it("exposes a human secure channel while paused and withholds generic resume/cancel", async () => {
    mocks.getNodiaAiExecution.mockResolvedValue({ ...execution, state: "waiting_for_user", can_resume: true,
      steps: [{ ...execution.steps[0], state: "waiting_for_user" }] });
    open();
    expect(await screen.findByRole("button", { name: "Abrir canal seguro" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Cancelar ejecución" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reanudar ejecución" })).not.toBeInTheDocument();
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
  it("withholds another owner's secure channel even when their execution is visible", async () => {
    client.setQueryData(nodiaAiKeys.detail(["9", 1], chatId), { conversation: { ...conversation, read_only: true }, current_run: null, active_execution: execution });
    mocks.getNodiaAiExecution.mockResolvedValue({ ...execution, state: "waiting_for_user", steps: [{ ...execution.steps[0], state: "waiting_for_user" }] });
    open(); await screen.findByText("Estado de la operación: Esperando tu respuesta");
    expect(screen.queryByRole("button", { name: "Abrir canal seguro" })).not.toBeInTheDocument();
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
  it("shows a historical opaque secure receipt and refreshes masked key/provider metadata", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...completed, steps: [{ ...completed.steps[0], result_refs: [{ resource_key: "secure_flows", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] }] });
    open();
    expect(await screen.findByText("Flujo seguro verificado: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBeInTheDocument();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ai-api-keys"] }));
    expect(screen.getByText(i18n.t("nodiaAi:execution.historical_receipt"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir canal seguro" })).not.toBeInTheDocument();
  });
  it.each([
    ["nodia_ai:ai_provider_model_unavailable", "El modelo no está disponible en la configuración o el descubrimiento de este modo. Revisa la selección."],
    ["nodia_ai:ai_provider_reasoning_unavailable", "La intensidad no está registrada para esta configuración. Revisa el valor antes de guardar."],
    ["nodia_ai:ai_provider_translation_removal_unsupported", "Las traducciones existentes se conservan. Puedes corregirlas o agregar claves, pero no eliminarlas desde esta operación."],
  ])("explains the %s failure without claiming a provider effect", async (code, description) => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...failed, can_resume: false, steps: [{ ...failed.steps[0], error: { code, message_key: code, field_errors: [], retry_action: "none", correlation_id: failed.steps[0].step_id } }] });
    open();
    expect(await screen.findByText(description)).toBeInTheDocument();
    expect(screen.queryByText(/Operación verificada/)).not.toBeInTheDocument();
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["ai-providers"] });
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
  it.each([
    ["ai_providers", "Conexión IA", "/ai-providers?provider=9007199254740993"],
    ["ai_provider_catalog", "Entrada del catálogo IA", "/ai-providers"],
  ])("shows %s history and refreshes configuration without changing the current chat selection", async (resource_key, label, route) => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    const detail = client.getQueryData(nodiaAiKeys.detail(["9", 1], chatId));
    mocks.getNodiaAiExecution.mockResolvedValue({ ...completed, steps: [{ ...completed.steps[0], result_refs: [{ resource_key, id: "9007199254740993" }] }] });
    open();
    expect(await screen.findByText(`Operación verificada · ${label}: 9007199254740993`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir proveedores IA" })).toHaveAttribute("href", route);
    expect(screen.getByText(/Guardar configuración no comprueba disponibilidad/)).toBeInTheDocument();
    await waitFor(() => expect(invalidation).toHaveBeenCalledWith({ queryKey: ["ai-providers"] }));
    for (const key of ["ai-provider-catalog", "ai-providers-health", "ai-selectable-models", "ai-supported-providers", "ai-provider-events"]) expect(invalidation).toHaveBeenCalledWith({ queryKey: [key] });
    expect(invalidation).toHaveBeenCalledWith({ queryKey: nodiaAiKeys.all(["9", 1]) });
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["ai-api-keys"] });
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["authorization", "context", "9"] });
    expect(client.getQueryData(nodiaAiKeys.detail(["9", 1], chatId))).toEqual(detail);
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
  it("does not refresh provider settings for a queued operation or invent an available model", async () => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    open(); await screen.findByText("Estado de la operación: En cola");
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["ai-providers"] });
    expect(screen.queryByRole("link", { name: "Abrir proveedores IA" })).not.toBeInTheDocument();
  });

  it.each([
    ["users", "Usuario", "/users"], ["roles", "Rol", "/roles"], ["actions", "Acción", "/actions"],
    ["business_actions", "Acción de negocio", "/actions"], ["modules", "Módulo", "/modules"], ["module_groups", "Grupo de módulos", "/modules"],
  ])("shows %s history and refreshes the current actor authority without granting it", async (resource_key, label, route) => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...completed, steps: [{ ...completed.steps[0], result_refs: [{ resource_key, id: "9007199254740993" }] }] });
    open();
    expect(await screen.findByText(`Operación verificada · ${label}: 9007199254740993`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir administración" })).toHaveAttribute("href", route);
    await waitFor(() => expect(invalidation).toHaveBeenCalledWith({ queryKey: ["authorization", "context", "9"] }));
    expect(invalidation).toHaveBeenCalledWith({ queryKey: nodiaAiKeys.all(["9", 1]) });
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["authorization", "context", "10"] });
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });

  it.each([
    ["rental_properties", "Alojamiento"], ["rental_collaborators", "Colaborador de alojamiento"], ["rental_cancellation_policies", "Política de cancelación"], ["rental_reservations", "Reserva"],
    ["rental_payments", "Cobro o devolución"], ["rental_expenses", "Gasto de alojamiento"], ["rental_blocks", "Bloqueo"], ["rental_turnovers", "Preparación"],
  ])("shows the exact %s receipt and invalidates the actor's native rental cache", async (resource_key, label) => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...completed, steps: [{ ...completed.steps[0], result_refs: [{ resource_key, id: "9007199254740993" }] }] });
    open();
    expect(await screen.findByText(`Operación verificada · ${label}: 9007199254740993`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir Reservas" })).toHaveAttribute("href", "/reservations");
    await waitFor(() => expect(invalidation).toHaveBeenCalledExactlyOnceWith({ queryKey: ["rental", "9"] }));
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
  it("shows a localized availability rejection without claiming a completed effect or invalidating rental data", async () => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...failed, can_resume: false, steps: [{ ...failed.steps[0], result_refs: [], error: { code: "rental:availability_conflict", message_key: "rental:availability_conflict", field_errors: [], retry_action: "manual_after_review", correlation_id: failed.steps[0].step_id } }] });
    open();
    expect(await screen.findByText("Las fechas coinciden con otra estadía o bloqueo.")).toBeInTheDocument();
    expect(screen.queryByText(/Operación verificada/)).not.toBeInTheDocument();
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["rental", "9"] });
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
  it.each(["failed", "partially_completed"] as const)("allows cancelling unfinished steps in %s even when changed preconditions prohibit resume", async state => {
    const stopped: NodiaAiExecutionStatus = { ...partialWorkflow, state, can_resume: false, steps: [partialWorkflow.steps[0], {
      ...partialWorkflow.steps[1], error: { ...partialWorkflow.steps[1].error!, code: "nodia_ai:preconditions_changed", message_key: "nodia_ai:preconditions_changed" },
    }, { step_id: "99999999-9999-4999-8999-999999999999", state: "blocked", result_refs: [], error: null }] };
    mocks.getNodiaAiExecution.mockResolvedValue(stopped);
    mocks.controlNodiaAiExecution.mockResolvedValue({ ...stopped, state: "partially_completed", revision: 4, steps: stopped.steps.map(step => step.state === "completed" ? step : { ...step, state: "cancelled", error: null }) });
    open();
    const cancel = await screen.findByRole("button", { name: "Cancelar ejecución" });
    expect(cancel).toBeEnabled(); expect(screen.queryByRole("button", { name: /Reanudar/ })).not.toBeInTheDocument();
    await userEvent.click(cancel);
    expect(mocks.controlNodiaAiExecution).toHaveBeenCalledExactlyOnceWith(execution.execution_id, "cancel", expect.objectContaining({ expected_execution_revision: 3 }));
    await screen.findByText("Paso 2: Cancelado");
    expect(screen.getByText("Paso 3: Cancelado")).toBeInTheDocument();
    expect(screen.getByText("Operación verificada · Proveedor: 9007199254740993")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar ejecución" })).not.toBeInTheDocument();
  });
  it("hides cancellation for a terminal partial sequence whose remaining steps were already cancelled or skipped", async () => {
    mocks.getNodiaAiExecution.mockResolvedValue({ ...partialWorkflow, can_resume: false, steps: [partialWorkflow.steps[0], { ...partialWorkflow.steps[1], state: "cancelled", error: null }, { step_id: "99999999-9999-4999-8999-999999999999", state: "skipped", result_refs: [], error: null }] });
    open();
    await screen.findByText("Estado de la operación: Completada parcialmente");
    expect(screen.getByText("Paso 2: Cancelado")).toBeInTheDocument();
    expect(screen.getByText("Paso 3: Omitido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar ejecución" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reanudar/ })).not.toBeInTheDocument();
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
  it("retains the committed supplier when a dependent contact fails and resumes only the same execution", async () => {
    mocks.getNodiaAiExecution.mockResolvedValue(partialWorkflow);
    mocks.controlNodiaAiExecution.mockResolvedValue({ ...partialWorkflow, revision: 4, state: "queued", can_resume: false, steps: [partialWorkflow.steps[0], { ...partialWorkflow.steps[1], state: "ready", error: null }] });
    open();
    expect(await screen.findByText("Operación verificada · Proveedor: 9007199254740993")).toBeInTheDocument();
    expect(screen.getByText(/Los pasos completados se conservan/)).toBeInTheDocument();
    expect(screen.getByText(/La reanudación continúa sólo los pasos pendientes/)).toBeInTheDocument();
    expect(screen.getByText("Paso 2: Fallido")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reanudar la operación confirmada" }));
    expect(mocks.controlNodiaAiExecution).toHaveBeenCalledExactlyOnceWith(execution.execution_id, "resume", expect.objectContaining({ expected_execution_revision: 3 }));
    expect(screen.getByText("Operación verificada · Proveedor: 9007199254740993")).toBeInTheDocument();
  });
  it("invalidates another committed step of the same resource after recovery, once per receipt", async () => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    const first: NodiaAiExecutionStatus = { ...partialWorkflow, steps: [partialWorkflow.steps[0], { ...partialWorkflow.steps[1], state: "ready", error: null }] };
    const next: NodiaAiExecutionStatus = { ...first, revision: 5, state: "completed", can_resume: false, steps: [...first.steps.slice(0, 1), { step_id: dependentStepId, state: "completed", result_refs: [{ resource_key: "providers", id: "9007199254740993" }], error: null }] };
    mocks.getNodiaAiExecution.mockResolvedValue(first);
    open(); await screen.findByText("Paso 2: Pendiente");
    await waitFor(() => expect(invalidation).toHaveBeenCalledTimes(3));
    mocks.getNodiaAiExecution.mockResolvedValue(next);
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    await screen.findByText("Paso 2: Completado");
    await waitFor(() => expect(invalidation).toHaveBeenCalledTimes(6));
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    await waitFor(() => expect(mocks.getNodiaAiExecution).toHaveBeenCalledTimes(3));
    expect(invalidation).toHaveBeenCalledTimes(6);
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
  it("preserves committed receipts when cancelling a partially executed sequence", async () => {
    mocks.getNodiaAiExecution.mockResolvedValue(partialWorkflow);
    mocks.controlNodiaAiExecution.mockResolvedValue({ ...partialWorkflow, revision: 4, state: "partially_completed", can_resume: false, steps: [partialWorkflow.steps[0], { ...partialWorkflow.steps[1], state: "cancelled", error: null }] });
    open(); await userEvent.click(await screen.findByRole("button", { name: "Cancelar ejecución" }));
    await screen.findByText("Paso 2: Cancelado");
    expect(screen.getByText("Estado de la operación: Completada parcialmente")).toBeInTheDocument();
    expect(screen.getByText("Operación verificada · Proveedor: 9007199254740993")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reanudar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar ejecución" })).not.toBeInTheDocument();
  });
  it.each([
    ["businesses", "Negocio", chatId, ["business"]],
    ["products", "Producto", "9007199254740993", ["products", "product-logs", "business"]],
    ["product_logs", "Registro histórico de producto", chatId, ["products", "product-logs"]],
    ["providers", "Proveedor", "9007199254740993", ["providers", "products", "business"]],
    ["provider_contacts", "Contacto de proveedor", "9007199254740993", ["provider-contacts", "providers"]],
    ["invoices", "Factura", "9007199254740993", ["invoices", "invoice-view-url"]],
  ] as const)("shows historical %s receipt with actual affected cache families and no financial invalidation", async (resource_key, label, id, prefixes) => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...completed, steps: [{ ...completed.steps[0], result_refs: [{ resource_key, id }] }] });
    open();
    expect(await screen.findByText(`Operación verificada · ${label}: ${id}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir Negocios" })).toHaveAttribute("href", "/business");
    await waitFor(() => expect(invalidation).toHaveBeenCalledTimes(prefixes.length));
    for (const prefix of prefixes) expect(invalidation).toHaveBeenCalledWith({ queryKey: prefix === "provider-contacts" ? [prefix, "9"] : [prefix] });
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["finance", "9"] });
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
  });
  it("does not invalidate the next actor's business data when an old response arrives after session replacement", async () => {
    let resolve: (value: NodiaAiExecutionStatus) => void = () => {};
    mocks.getNodiaAiExecution.mockReturnValue(new Promise<NodiaAiExecutionStatus>(done => { resolve = done; }));
    const invalidation = vi.spyOn(client, "invalidateQueries");
    const view = open();
    useAuthStore.setState({ user: { id: "10", name: "Next synthetic actor" }, sessionVersion: 2 });
    resolve({ ...completed, steps: [{ ...completed.steps[0], result_refs: [{ resource_key: "products", id: "3" }] }] });
    await waitFor(() => expect(mocks.getNodiaAiExecution).toHaveBeenCalled());
    view.unmount(); expect(invalidation).not.toHaveBeenCalled();
  });

  it.each([
    ["finance_movements", "Movimiento"], ["finance_categories", "Categoría"],
    ["finance_category_groups", "Grupo de categorías"], ["finance_obligations", "Préstamo o deuda"],
  ])("shows the historical %s receipt without promising current existence and invalidates only the actor Finance cache", async (resource_key, label) => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...completed, steps: [{ ...completed.steps[0], result_refs: [{ resource_key, id: "9007199254740993" }] }] });
    open();
    expect(await screen.findByText(`Operación verificada · ${label}: 9007199254740993`)).toBeInTheDocument();
    expect(screen.getByText(/El registro puede haber cambiado o haberse eliminado después/)).toBeInTheDocument();
    expect(screen.queryByText(/cread[oa]|actualizad[oa]|eliminad[oa]:/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir Finanzas" })).toHaveAttribute("href", "/finances-personal");
    await waitFor(() => expect(invalidation).toHaveBeenCalledWith({ queryKey: ["finance", "9"] }));
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["finance"] });
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
    expect(mocks.getNodiaAiExecution).toHaveBeenCalledTimes(1);
  });
  it.each(["queued", "unknown", "failed"] as const)("does not present uncommitted references as a verified effect in %s", async state => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...execution, state, steps: [{ ...execution.steps[0], state: state === "queued" ? "ready" : state, result_refs: [{ resource_key: "finance_obligations", id: "9" }] }] });
    open();
    await screen.findByRole("status");
    expect(screen.queryByText(/Operación verificada/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["finance", "9"] });
  });
  it("observes on mount without writing, deduplicates cancel clicks and binds the exact revision", async () => {
    let resolve: (value: NodiaAiExecutionStatus) => void = () => {};
    mocks.controlNodiaAiExecution.mockReturnValue(new Promise<NodiaAiExecutionStatus>(done => { resolve = done; }));
    open(); const cancel = await screen.findByRole("button", { name: "Cancelar ejecución" });
    expect(mocks.controlNodiaAiExecution).not.toHaveBeenCalled();
    fireEvent.click(cancel); fireEvent.click(cancel);
    await waitFor(() => expect(mocks.controlNodiaAiExecution).toHaveBeenCalledTimes(1));
    expect(cancel).toBeDisabled();
    expect(mocks.controlNodiaAiExecution).toHaveBeenCalledWith(execution.execution_id, "cancel", expect.objectContaining({ expected_execution_revision: 1, client_request_id: expect.any(String) }));
    resolve({ ...execution, revision: 2, state: "cancelled" });
    expect(await screen.findByText("Estado de la operación: Cancelada")).toBeInTheDocument();
    expect(mocks.success).toHaveBeenCalledWith({ title: "Estado de cancelación comprobado" });
  });
  it("allows explicit resume only from the server affordance", async () => {
    mocks.getNodiaAiExecution.mockResolvedValue(failed); mocks.controlNodiaAiExecution.mockResolvedValue({ ...execution, revision: 4 });
    open(); await userEvent.click(await screen.findByRole("button", { name: "Reanudar la operación confirmada" }));
    expect(mocks.controlNodiaAiExecution).toHaveBeenCalledWith(execution.execution_id, "resume", expect.objectContaining({ expected_execution_revision: 3 }));
    expect(mocks.success).toHaveBeenCalledWith({ title: "Reanudación admitida" });
  });
  it("recovers uncertain cancel using GET and retries only the same request after a separate click", async () => {
    mocks.controlNodiaAiExecution.mockRejectedValueOnce(new AxiosError("Synthetic lost response", "ERR_NETWORK")).mockResolvedValue({ ...execution, revision: 2, state: "cancelled" });
    open(); await userEvent.click(await screen.findByRole("button", { name: "Cancelar ejecución" }));
    expect(await screen.findByText(/No sabemos si se recibió/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar ejecución" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    const retry = await screen.findByRole("button", { name: "Reintentar la misma solicitud" });
    expect(mocks.controlNodiaAiExecution).toHaveBeenCalledTimes(1);
    await userEvent.click(retry);
    await waitFor(() => expect(mocks.controlNodiaAiExecution).toHaveBeenCalledTimes(2));
    expect(mocks.controlNodiaAiExecution.mock.calls[1]).toEqual(mocks.controlNodiaAiExecution.mock.calls[0]);
  });
  it("does not offer replay when status proves a completed commit and invalidates Finance only after its receipt", async () => {
    const invalidation = vi.spyOn(client, "invalidateQueries");
    mocks.controlNodiaAiExecution.mockRejectedValueOnce(new Error("Synthetic lost ack"));
    open(); await userEvent.click(await screen.findByRole("button", { name: "Cancelar ejecución" }));
    await screen.findByText(/No sabemos si se recibió/);
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: ["finance", "9"] });
    mocks.getNodiaAiExecution.mockResolvedValue(completed);
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    expect(await screen.findByText("Operación verificada · Movimiento: 9007199254740993")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir Finanzas" })).toHaveAttribute("href", "/finances-personal");
    expect(screen.queryByRole("button", { name: "Reintentar la misma solicitud" })).not.toBeInTheDocument();
    await waitFor(() => expect(invalidation).toHaveBeenCalledWith({ queryKey: ["finance", "9"] }));
    expect(mocks.controlNodiaAiExecution).toHaveBeenCalledTimes(1);
  });
  it("keeps unknown non-resumable and does not invent a result", async () => {
    mocks.getNodiaAiExecution.mockResolvedValue({ ...execution, state: "unknown" }); open();
    expect(await screen.findByText(/Se está comprobando el resultado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reanudar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("retains status on an outage, emits feedback and clears restricted content after revocation", async () => {
    mocks.getNodiaAiExecution.mockResolvedValue(completed); open();
    await screen.findByText(/Operación verificada/);
    mocks.getNodiaAiExecution.mockRejectedValueOnce(new Error("Synthetic outage"));
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    await screen.findByText(/No pudimos comprobar/); expect(screen.getByText(/Operación verificada/)).toBeInTheDocument();
    mocks.getNodiaAiExecution.mockRejectedValue(new AxiosError("Denied", "ERR_BAD_RESPONSE", undefined, undefined, { status: 403, data: { message: "Synthetic denied" }, headers: {}, config: {} as never, statusText: "Denied" }));
    await userEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    await waitFor(() => expect(screen.queryByText(/Operación verificada/)).not.toBeInTheDocument());
    expect(mocks.error).toHaveBeenCalled();
  });
  it("restricts controls for inspected foreign chats", async () => {
    client.setQueryData(nodiaAiKeys.detail(["9", 1], chatId), { conversation: { ...conversation, read_only: true }, current_run: null, active_execution: execution });
    open(); await screen.findByText("Estado de la operación: En cola");
    expect(screen.queryByRole("button", { name: "Cancelar ejecución" })).not.toBeInTheDocument();
  });
  it("discards a late result after changing session without success feedback", async () => {
    let resolve: (value: NodiaAiExecutionStatus) => void = () => {};
    mocks.controlNodiaAiExecution.mockReturnValue(new Promise<NodiaAiExecutionStatus>(done => { resolve = done; }));
    const view = open(); await userEvent.click(await screen.findByRole("button", { name: "Cancelar ejecución" }));
    view.unmount(); useAuthStore.setState({ sessionVersion: 2 }); resolve(completed);
    await waitFor(() => expect(mocks.controlNodiaAiExecution).toHaveBeenCalledTimes(1));
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("uses English native business receipt labels without changing bigint identity", async () => {
    await i18n.changeLanguage("en");
    mocks.getNodiaAiExecution.mockResolvedValue({ ...completed, steps: [{ ...completed.steps[0], result_refs: [{ resource_key: "invoices", id: "9007199254740993" }] }] });
    open(); expect(await screen.findByText("Verified operation · Invoice: 9007199254740993")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Businesses" })).toHaveAttribute("href", "/business");
  });
  it("uses English labels for recovery and preserves exact bigint references", async () => {
    await i18n.changeLanguage("en"); mocks.getNodiaAiExecution.mockResolvedValue(completed); open();
    expect(await screen.findByText("Verified operation · Movement: 9007199254740993")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh status" })).toBeInTheDocument();
  });
});
