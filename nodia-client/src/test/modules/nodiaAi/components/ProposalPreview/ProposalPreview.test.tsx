import { aiProviderProposal, aiProviderReview } from "../../infrastructure/aiProviderFixtures";
import { coreUserProposal, coreUserReview, coreDeleteProposal, coreArray } from "../../infrastructure/coreFixtures";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExecutionObservation from "../../../../../modules/nodiaAi/components/ExecutionObservation";
import type { NodiaAiPublicProposal } from "../../../../../modules/nodiaAi/infrastructure/types";
import useAuthStore from "../../../../../store/authStore";
import { chatId, run } from "../../infrastructure/fixtures";
import { proposal, proposalEvent, stepId, readonlyReview, editableProposal, editableReview } from "../../infrastructure/proposalFixtures";
import { workflowProposal, workflowReview } from "../../infrastructure/workflowFixtures";
import { rentalPolicyProposal, rentalPolicyReview, rentalReservationProposal, rentalReservationReview, rentalCancellationProposal } from "../../infrastructure/rentalFixtures";
import i18n from "../../../../../translate";
import { rentalPaymentProposal, rentalRefundProposal, rentalVoidProposal, rentalExpensePayProposal, rentalBlockProposal, rentalApprovalProposal } from "../../infrastructure/rentalMoneyPreparationFixtures";

const mocks = vi.hoisted(() => ({ getNodiaAiEvents: vi.fn(), getNodiaAiProposal: vi.fn(), getNodiaAiProposalReview: vi.fn(), updateNodiaAiProposal: vi.fn(), challengeNodiaAiProposal: vi.fn(), confirmNodiaAiProposal: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/services", async original => ({ ...await original<object>(), ...mocks }));
vi.mock("sileo", () => ({ sileo: { error: mocks.error, success: mocks.success } }));
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ user: { id: "9", name: "Synthetic owner" }, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false });
  mocks.getNodiaAiEvents.mockResolvedValue({ conversation_id: chatId, items: [proposalEvent], next_cursor: "synthetic-checkpoint", cursor_state: "current", has_more: false });
  mocks.getNodiaAiProposal.mockResolvedValue(proposal);
  mocks.getNodiaAiProposalReview.mockResolvedValue(readonlyReview);
});
afterEach(() => { client.clear(); useAuthStore.setState({ token: null, user: null, sessionStatus: "anonymous" }); });
function open() { return render(<QueryClientProvider client={client}><MemoryRouter><ExecutionObservation conversationId={chatId} run={{ ...run, state: "completed" }} /></MemoryRouter></QueryClientProvider>); }
async function preview() { const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "Ver propuesta" })); return user; }

describe("NodiaAI immutable proposal previews", () => {
  it("presents expired sales snapshots without changing their values or reviving retired writes, and reveals identity only on intent", async () => {
    const historical: NodiaAiPublicProposal = {
      ...proposal, state: "expired", expires_at: "2026-10-28T23:33:00.000Z",
      steps: [{
        ...proposal.steps[0], tool_name: "nodia_sales_prepare_create", effect_key: "sales.create",
        changes: [{
          field_key: "sale_pricing_snapshot", before: null, before_present: false, after_present: true, origin: "database",
          after: { kind: "object", fields: [
            { field_key: "payment_method", value: "cash" },
            { field_key: "total_amount", value: "1200" },
            { field_key: "lines", value: { kind: "array", items: [{ kind: "object", fields: [
              { field_key: "product_id", value: "9007199254740993" },
              { field_key: "name", value: "[QA] Historical product" },
              { field_key: "quantity", value: 0 },
              { field_key: "is_offer_enabled", value: false },
              { field_key: "offer_price", value: null },
              { field_key: "synthetic_unknown_field", value: "[QA] Unchanged unknown value" },
            ] }] } },
          ] },
        }],
      }],
    };
    mocks.getNodiaAiProposal.mockResolvedValue(historical);
    open(); const user = await preview();
    expect(await screen.findByText("Paso 1: Crear borrador de venta")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getNodiaAiProposalReview).toHaveBeenCalledOnce());
    expect(screen.getByText("Expirada")).toBeInTheDocument();
    for (const text of ["Precios y condiciones guardados", "Detalle de productos", "[QA] Historical product", "9007199254740993", "1200", "synthetic_unknown_field", "[QA] Unchanged unknown value"]) {
      expect(screen.getByText(text)).toBeVisible();
    }
    for (const [field, value] of [
      ["Medio de pago", i18n.t("business:pos.payment_cash")],
      ["Cantidad", "0"], ["Oferta activa", i18n.t("nodiaAi:proposal.false_value")],
      ["Precio de oferta", i18n.t("nodiaAi:proposal.null_value")],
    ]) {
      expect(within(screen.getByText(field).parentElement!).getByText(value)).toBeVisible();
    }
    expect(screen.queryByText("sales.create")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corregir propuesta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar revisión/ })).not.toBeInTheDocument();
    const identity = screen.getByText(`Identidad del contenido: ${historical.hash}`);
    expect(identity).not.toBeVisible();
    await user.click(screen.getByText("Detalles de la propuesta"));
    expect(identity).toBeVisible();
    expect(identity).toHaveTextContent(historical.hash);
    expect(mocks.getNodiaAiProposal).toHaveBeenCalledOnce();
    expect(mocks.getNodiaAiProposalReview).toHaveBeenCalledOnce();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
    expect(mocks.challengeNodiaAiProposal).not.toHaveBeenCalled();
    expect(mocks.confirmNodiaAiProposal).not.toHaveBeenCalled();
  });
  it.each([
    ["nodia_secure_flows_prepare_api_key_create", "api_key_create"], ["nodia_secure_flows_prepare_api_key_update", "api_key_update"],
    ["nodia_api_keys_prepare_delete", "api_key_delete"], ["nodia_secure_flows_prepare_connection_login", "connection_login"],
    ["nodia_secure_flows_prepare_nodia_logout", "nodia_logout"], ["nodia_ai_providers_prepare_codex_logout", "codex_logout"],
    ["nodia_ai_providers_prepare_sync_models", "sync_models"],
  ])("shows the exact safe target and human action for %s", async (tool_name, kind) => {
    await i18n.changeLanguage("es");
    mocks.getNodiaAiProposal.mockResolvedValue({ ...proposal, steps: [{ ...proposal.steps[0], tool_name, kind: "secure_flow",
      target: { resource_key: "ai_providers", id: "9007199254740993", label: "[QA] Same provider" },
      changes: [{ field_key: "secure_operation", before: null, before_present: false, after: kind, after_present: true, origin: "user" }] }] });
    open(); await preview();
    expect(await screen.findByText("Registro: [QA] Same provider · 9007199254740993")).toBeInTheDocument();
    expect(screen.getByText(`Paso 1: ${i18n.t(`nodiaAi:secure.kinds.${kind}`)}`)).toBeInTheDocument();
    expect(screen.getByText("Operación segura")).toBeInTheDocument();
    expect(screen.getByText(/Después debes completar la acción en un canal humano separado/)).toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it.each([
    ["create", "Crear conexión IA"], ["update", "Actualizar conexión IA"],
    ["catalog_create", "Crear entrada del catálogo IA"], ["catalog_update", "Actualizar entrada del catálogo IA"],
  ])("labels provider operation %s and distinguishes configuration from availability", async (operation, label) => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...aiProviderProposal, steps: [{ ...aiProviderProposal.steps[0], tool_name: `nodia_ai_providers_prepare_${operation}` }] });
    open(); await preview();
    expect(await screen.findByText(`Paso 1: ${label}`)).toBeInTheDocument();
    expect(screen.getByText("Registro: [QA] Same provider · 9007199254740993")).toBeInTheDocument();
    expect(screen.getByText(/Guardar configuración no comprueba disponibilidad/)).toBeInTheDocument();
    expect(screen.getByText("API · Modelo seleccionado")).toBeInTheDocument();
    expect(screen.getByText("Agentic · Modelo seleccionado")).toBeInTheDocument();
    expect(screen.getByText("Catálogo resuelto")).toBeInTheDocument();
    expect(screen.getByText("Disponibilidad")).toBeInTheDocument();
    expect(screen.getByText("Desconocida")).toBeInTheDocument();
    expect(screen.getByText("Cambia la selección de este chat")).toBeInTheDocument();
    expect(screen.getByText("Preferencias de intensidad resultantes")).toBeInTheDocument();
    expect(screen.getByText("Intensidad general del modo")).toBeInTheDocument();
    expect(screen.getByText("Preferencia booleana histórica")).toBeInTheDocument();
    expect(screen.getByText(/Dejar la intensidad sin valor elimina/)).toBeInTheDocument();
    expect(screen.queryByText("agentic.selected_model")).not.toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("accepts an explicit null default mode from a saved provider proposal", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(aiProviderProposal); mocks.getNodiaAiProposalReview.mockResolvedValue(aiProviderReview);
    open(); await preview();
    expect(await screen.findByRole("button", { name: "Confirmar revisión 1" })).toBeEnabled();
    expect(screen.queryByText(/No pudimos verificar las acciones permitidas/)).not.toBeInTheDocument();
  });

  it.each([
    ["users", "create", "Crear usuario"], ["users", "update", "Actualizar usuario"],
    ["roles", "create", "Crear rol"], ["roles", "update", "Actualizar rol"], ["roles", "delete", "Eliminar rol"],
    ["actions", "create", "Crear acción"], ["actions", "update", "Actualizar acción"], ["actions", "delete", "Eliminar acción"],
    ["business_actions", "create", "Crear acción de negocio"], ["business_actions", "update", "Actualizar acción de negocio"], ["business_actions", "delete", "Eliminar acción de negocio"],
    ["modules", "create", "Crear módulo"], ["modules", "update", "Actualizar módulo"], ["modules", "delete", "Eliminar módulo"],
    ["module_groups", "create", "Crear grupo de módulos"], ["module_groups", "update", "Actualizar grupo de módulos"], ["module_groups", "delete", "Eliminar grupo de módulos"],
  ])("labels the registered %s/%s operation", async (resource, operation, label) => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...coreUserProposal, steps: [{ ...coreUserProposal.steps[0], tool_name: `nodia_${resource}_prepare_${operation}` }] });
    open(); await preview();
    expect(await screen.findByText(`Paso 1: ${label}`)).toBeInTheDocument();
  });
  it("shows access loss and affected users before confirmation without editable authority fields", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(coreDeleteProposal);
    open(); await preview();
    expect(await screen.findByText(/Esta eliminación puede retirar asociaciones y acceso/)).toBeInTheDocument();
    expect(screen.getByText("Registro: [QA] reservations · 9007199254740995")).toBeInTheDocument();
    expect(screen.getByText("Usuarios afectados")).toBeInTheDocument();
    expect(screen.getByText("Módulos retirados")).toBeInTheDocument();
    expect(screen.getByText("9007199254740995")).toBeInTheDocument();
    expect(screen.getByText("Eliminar registro")).toBeInTheDocument();
  });
  it.each([coreArray(["01"]), coreArray(["1", "1"]), coreArray([9007199254740992])])("rejects malformed saved Core collections before exposing human controls", async value => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...coreUserProposal, steps: [{ ...coreUserProposal.steps[0], changes: coreUserProposal.steps[0].changes.map(change => change.field_key === "roles" ? { ...change, after: value } : change) }] });
    mocks.getNodiaAiProposalReview.mockResolvedValue(coreUserReview);
    open(); await preview();
    expect(await screen.findByText(/No pudimos verificar las acciones permitidas/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar revisión/ })).not.toBeInTheDocument();
  });

  it("renders nested policy rules with localized field labels and registered structured editing", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(rentalPolicyProposal); mocks.getNodiaAiProposalReview.mockResolvedValue(rentalPolicyReview);
    open(); await preview();
    expect(await screen.findByText("Paso 1: Crear política de cancelación")).toBeInTheDocument();
    expect(screen.getAllByText("Días mínimos de anticipación")).toHaveLength(2);
    expect(screen.getAllByText("Porcentaje de devolución")).toHaveLength(2);
    expect(screen.queryByText("min_days_before")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Corregir propuesta" })).toBeEnabled();
  });
  it.each([
    { kind: "array", items: [] },
    { kind: "array", items: [{ kind: "object", fields: [{ field_key: "min_days_before", value: 7 }, { field_key: "refund_percent", value: "50.00" }] }] },
    { kind: "array", items: [{ kind: "object", fields: [{ field_key: "min_days_before", value: 0 }, { field_key: "refund_percent", value: "100.01" }] }] },
  ])("refuses registered editing and confirmation when saved policy rules are invalid: %j", async rules => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...rentalPolicyProposal, steps: [{ ...rentalPolicyProposal.steps[0], changes: [{ ...rentalPolicyProposal.steps[0].changes[1], after: rules }] }] });
    mocks.getNodiaAiProposalReview.mockResolvedValue({ ...rentalPolicyReview, editable_fields: [rentalPolicyReview.editable_fields[1]] });
    open(); await preview();
    expect(await screen.findByText(/No pudimos verificar las acciones permitidas/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar revisión/ })).not.toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it.each([
    ["rental_reservations_prepare_create", "Crear borrador de reserva"], ["rental_reservations_prepare_update", "Actualizar reserva"],
    ["rental_reservations_prepare_confirm", "Confirmar reserva"], ["rental_reservations_prepare_start", "Iniciar estadía"],
    ["rental_reservations_prepare_complete", "Completar estadía"], ["rental_reservations_prepare_cancel", "Cancelar reserva"],
    ["rental_properties_prepare_create", "Crear alojamiento"], ["rental_properties_prepare_update", "Actualizar alojamiento"],
    ["rental_collaborators_prepare_create", "Agregar colaborador al alojamiento"], ["rental_collaborators_prepare_update", "Actualizar colaborador del alojamiento"],
    ["rental_cancellation_policies_prepare_update", "Actualizar política de cancelación"],
    ["rental_payments_prepare_create", "Registrar cobro o devolución"], ["rental_payments_prepare_void", "Anular registro monetario"],
    ["rental_expenses_prepare_create", "Crear gasto de alojamiento"], ["rental_expenses_prepare_update", "Actualizar gasto de alojamiento"],
    ["rental_expenses_prepare_pay", "Registrar pago de gasto"], ["rental_expenses_prepare_void", "Anular gasto de alojamiento"],
    ["rental_blocks_prepare_create", "Crear bloqueo"], ["rental_blocks_prepare_update", "Actualizar bloqueo"],
    ["rental_turnovers_prepare_update", "Actualizar preparación"], ["rental_turnovers_prepare_approve_same_day", "Aprobar preparación del mismo día"],
  ])("labels rental operation %s without exposing the tool name", async (tool, label) => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...proposal, steps: [{ ...proposal.steps[0], tool_name: `nodia_${tool}`, changes: [] }] });
    open(); await preview(); expect(await screen.findByText(`Paso 1: ${label}`)).toBeInTheDocument();
  });
  it("shows received money, exact CLP and platform terms without implying an external collection", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...rentalPaymentProposal, steps: [{ ...rentalPaymentProposal.steps[0], changes: [...rentalPaymentProposal.steps[0].changes, { field_key: "platform_policy", before: null, after: { kind: "object", fields: [{ field_key: "reference", value: "[QA] Platform terms" }, { field_key: "description", value: "[QA] Captured conditions" }] }, before_present: false, after_present: true, origin: "user" }] }] });
    open(); await preview();
    expect(await screen.findByText("Paso 1: Registrar cobro o devolución")).toBeInTheDocument();
    for (const text of ["9007199254740993", "9007199254740994", "2026-10-17", "Cobro", "Importes en CLP.", "[QA] Captured conditions"]) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    expect(screen.getByText(/Registra dinero ya recibido o devuelto; no realiza cobros/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it.each([[rentalRefundProposal, "Devolución efectiva"], [rentalVoidProposal, "Anular registro monetario"]])("distinguishes actual refund and void with historical semantics", async (current, expected) => {
    mocks.getNodiaAiProposal.mockResolvedValue(current); open(); await preview();
    expect((await screen.findAllByText(new RegExp(expected))).length).toBeGreaterThan(0);
    expect(screen.getByText(/Anular conserva el historial y no registra una devolución/)).toBeInTheDocument();
    expect(screen.queryByText(/Transferencia ejecutada/)).not.toBeInTheDocument();
  });
  it("records full payment of the existing expense without describing a new expense or duplicate collection", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(rentalExpensePayProposal); open(); await preview();
    expect(await screen.findByText("Paso 1: Registrar pago de gasto")).toBeInTheDocument();
    expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.getByText(/Pagar registra el pago completo del gasto pendiente existente/)).toBeInTheDocument();
    expect(screen.getByText("25000")).toBeInTheDocument();
  });
  it("renders native captured policy metadata recursively as localized readonly facts", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...rentalPaymentProposal, steps: [{ ...rentalPaymentProposal.steps[0], changes: [...rentalPaymentProposal.steps[0].changes, { field_key: "policy_snapshot", before: null, after: { kind: "object", fields: [
      { field_key: "schema_version", value: 1 }, { field_key: "kind", value: "direct" }, { field_key: "policy_id", value: "9007199254740997" }, { field_key: "policy_name", value: "[QA] Direct policy" }, { field_key: "days_basis", value: "local_calendar_days" }, { field_key: "refund_basis", value: "confirmed_received_amount" }, { field_key: "rounding", value: "floor_clp" },
    ] }, before_present: false, after_present: true, origin: "database" }] }] });
    open(); await preview(); await screen.findByText("Condiciones de cancelación capturadas");
    for (const value of ["9007199254740997", "Acuerdo directo", "Días civiles de la casa", "Cobros recibidos confirmados", "Redondeo hacia abajo a pesos CLP"]) expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.queryByText("schema_version")).not.toBeInTheDocument(); expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("shows affected preparations and explicit same-day approval separately from actual readiness", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(rentalBlockProposal); open(); await preview();
    expect(await screen.findByText("Paso 1: Actualizar bloqueo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Preparaciones afectadas" })).toBeInTheDocument();
    expect(screen.getByText("9007199254740995")).toBeInTheDocument();
  });
  it("does not present same-day approval as completed cleaning or actual readiness", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(rentalApprovalProposal); open(); await preview();
    expect(await screen.findByText("Paso 1: Aprobar preparación del mismo día")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText(/La hora prevista y la aprobación del mismo día no acreditan preparación realizada/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hora real de preparación" })).toBeInTheDocument();
  });
  it("localizes money and preparation enums in English without modifying values", async () => {
    await i18n.changeLanguage("en"); mocks.getNodiaAiProposal.mockResolvedValue(rentalRefundProposal); open();
    await userEvent.click(await screen.findByRole("button", { name: "View proposal" }));
    expect(await screen.findByText("Step 1: Record payment or refund")).toBeInTheDocument();
    expect(screen.getByText("Actual refund")).toBeInTheDocument();
    expect(screen.getByText("Amounts in CLP.")).toBeInTheDocument();
    expect(screen.getByText(/Records money already received or refunded/)).toBeInTheDocument();
  });
  it("shows draft, native civil dates/times, house zone and exact integer money without implying a payment or confirmed availability", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(rentalReservationProposal); mocks.getNodiaAiProposalReview.mockResolvedValue(rentalReservationReview);
    open(); await preview(); await screen.findByText("Paso 1: Crear borrador de reserva");
    for (const name of ["Nombre del huésped", "Contacto del huésped", "Cantidad de huéspedes", "Fecha de entrada", "Fecha de salida", "Hora de entrada", "Hora de salida", "Tarifa por noche", "Anticipo acordado", "Total acordado", "Zona horaria"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    for (const value of ["2026-11-01", "2026-11-03", "15:00", "11:00", "America/Santiago", "9007199254740993", "18014398509481986", "0", "Borrador", "WhatsApp"]) expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    expect(screen.queryByText("whatsapp")).not.toBeInTheDocument();
    expect(screen.getByText("Importes en CLP.")).toBeInTheDocument();
    expect(screen.queryByText(/Pago registrado|Disponibilidad garantizada/)).not.toBeInTheDocument();
  });
  it("renders platform agreement and approvals as readonly structured facts with bigint IDs", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...rentalReservationProposal, steps: [{ ...rentalReservationProposal.steps[0], tool_name: "nodia_rental_reservations_prepare_confirm", changes: [
      { field_key: "status", before: "draft", after: "confirmed", before_present: true, after_present: true, origin: "database" },
      { field_key: "same_day_approvals", before: null, after: { kind: "array", items: ["9007199254740993"] }, before_present: false, after_present: true, origin: "user" },
      { field_key: "platform_policy", before: null, after: { kind: "object", fields: [{ field_key: "reference", value: "[QA] Platform reference" }, { field_key: "description", value: "[QA] Exact agreed terms" }] }, before_present: false, after_present: true, origin: "user" },
    ] }] });
    open(); await preview(); await screen.findByText("Paso 1: Confirmar reserva");
    for (const value of ["Borrador", "Confirmada", "9007199254740993", "Referencia", "Descripción", "[QA] Exact agreed terms"]) expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corregir propuesta" })).not.toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("distinguishes cancelling the commercial agreement from paying an approved refund", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(rentalCancellationProposal);
    open(); await preview(); await screen.findByText("Paso 1: Cancelar reserva");
    for (const name of ["Devolución aprobada", "Devolución calculada esperada", "Devolución pendiente tras cancelar", "Saldo pendiente tras cancelar", "Importe retenido", "Fecha efectiva de cancelación"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument(); expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.getByText("2026-10-17T12:30:00.000Z")).toBeInTheDocument();
    expect(screen.queryByText(/Devolución pagada/)).not.toBeInTheDocument();
  });
  it("uses English reservation action, field, enum and currency labels with the same exact values", async () => {
    await i18n.changeLanguage("en");
    mocks.getNodiaAiProposal.mockResolvedValue(rentalCancellationProposal);
    open(); await userEvent.click(await screen.findByRole("button", { name: "View proposal" }));
    expect(await screen.findByText("Step 1: Cancel reservation")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Approved refund" })).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument(); expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Amounts in CLP.")).toBeInTheDocument();
    expect(screen.getByText("2026-10-17T12:30:00.000Z")).toBeInTheDocument();
    expect(screen.queryByText("refund_amount")).not.toBeInTheDocument();
  });
  it("shows supplier-to-contact as a future registered ID, preserving the exact order without inventing a supplier", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(workflowProposal);
    mocks.getNodiaAiProposalReview.mockResolvedValue(workflowReview);
    open(); await preview();
    expect(await screen.findByText("Paso 1: Crear proveedor")).toBeInTheDocument();
    expect(screen.getByText("Paso 2: Crear contacto de proveedor")).toBeInTheDocument();
    expect(screen.getByText("Proveedor usará ID creado del paso 1 cuando se complete.")).toBeInTheDocument();
    expect(screen.getByText("Referencia al registro que se creará en el paso 1.")).toBeInTheDocument();
    expect(screen.getByText("Depende de los pasos: 1")).toBeInTheDocument();
    expect(screen.queryByText("provider_id")).not.toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("rejects metadata that attempts to expose a future-bound supplier ID as an editable field", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue(workflowProposal);
    mocks.getNodiaAiProposalReview.mockResolvedValue({ ...workflowReview, editable_fields: [...workflowReview.editable_fields, { ...workflowReview.editable_fields[1], field_key: "provider_id", kind: "bigint", nullable: true }] });
    open(); await preview();
    expect(await screen.findByText(/No pudimos verificar las acciones permitidas/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar revisión/ })).not.toBeInTheDocument();
  });
  it.each([
    ["businesses_prepare_create", "Crear negocio"], ["businesses_prepare_update", "Actualizar negocio"], ["businesses_prepare_set_collaborators", "Gestionar colaboradores"],
    ["products_prepare_create", "Crear producto"], ["products_prepare_update", "Actualizar producto"],
    ["product_logs_prepare_create", "Crear registro histórico de producto"], ["product_logs_prepare_update", "Actualizar registro histórico de producto"],
    ["providers_prepare_create", "Crear proveedor"], ["providers_prepare_update", "Actualizar proveedor"],
    ["provider_contacts_prepare_create", "Crear contacto de proveedor"], ["provider_contacts_prepare_update", "Actualizar contacto de proveedor"], ["provider_contacts_prepare_set_active", "Cambiar actividad de contacto"],
    ["invoices_prepare_create", "Crear factura"], ["invoices_prepare_update", "Actualizar factura"],
  ])("labels the registered %s native effect", async (tool, title) => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...proposal, steps: [{ ...proposal.steps[0], tool_name: `nodia_${tool}`, scope: { business_id: chatId }, changes: [] }] });
    open(); await preview(); expect(await screen.findByText(`Paso 1: ${title}`)).toBeInTheDocument();
    expect(screen.queryByText(`nodia_${tool}`)).not.toBeInTheDocument();
  });
  it("shows automatic product history, collaborator access changes, translations, transfers and file state with nested labels and exact zero/false/null", async () => {
    const values = [
      { field_key: "product_snapshot", after: { kind: "object", fields: [{ field_key: "sale_price", value: 0 }, { field_key: "stock", value: 0 }] } },
      { field_key: "collaborator_effects", after: { kind: "array", items: [{ kind: "object", fields: [{ field_key: "user_id", value: "9007199254740993" }, { field_key: "is_active", value: false }, { field_key: "position", value: null }] }] } },
      { field_key: "translation_effects", after: { kind: "array", items: [{ kind: "object", fields: [{ field_key: "locale", value: "es" }, { field_key: "value", value: "Preserved description" }] }] } },
      { field_key: "destination_business_id", after: chatId }, { field_key: "file_attached", after: false },
    ];
    mocks.getNodiaAiProposal.mockResolvedValue({ ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_products_prepare_update", changes: values.map(value => ({ ...value, before: null, before_present: false, after_present: true, origin: "database" })) }] });
    open(); await preview(); await screen.findByText("Paso 1: Actualizar producto");
    for (const name of ["Registro histórico automático del producto", "Cambios de acceso de colaboradores", "Traducciones resultantes", "Negocio de destino", "Tiene archivo adjunto"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(2); expect(screen.getAllByText("Falso")).toHaveLength(2);
    expect(screen.getByText("Sin valor (null)")).toBeInTheDocument(); expect(screen.getByText("Precio de venta")).toBeInTheDocument();
    expect(screen.queryByText("Permisos del negocio")).not.toBeInTheDocument();
    expect(screen.getByText("9007199254740993")).toBeInTheDocument();
  });
  it.each(["1", null, 1.5, 2147483648])("blocks review metadata bound to an invalid native integer %j", async value => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...editableProposal, steps: [{ ...editableProposal.steps[0], tool_name: "nodia_products_prepare_update", changes: [{ field_key: "stock", before: null, before_present: false, after: value, after_present: true, origin: "user" }] }] });
    mocks.getNodiaAiProposalReview.mockResolvedValue({ ...editableReview, editable_fields: [{ step_id: stepId, field_key: "stock", label_key: "nodiaAi:proposal.business_fields.stock", kind: "integer", nullable: false, minimum: "0", maximum: "2147483647", max_length: null, options: [] }] });
    open(); await preview(); expect(await screen.findByText(/No pudimos verificar las acciones permitidas sobre esta revisión/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar revisión/ })).not.toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });

  it.each([
    ["movements", "Eliminar movimiento", "El movimiento se eliminará."],
    ["categories", "Eliminar categoría", "Se eliminarán la categoría y sus asociaciones con grupos."],
    ["category_groups", "Eliminar grupo de categorías", "Las categorías y los movimientos se conservarán."],
    ["obligations", "Eliminar préstamo o deuda", "Se eliminarán la obligación y su movimiento inicial."],
  ])("identifies the exact %s deletion, target and consequences before confirmation", async (resource, title, warning) => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...proposal, steps: [{ ...proposal.steps[0], tool_name: `nodia_finance_${resource}_prepare_delete`, target: { resource_key: `finance_${resource}`, id: "9007199254740993", label: "Synthetic target" }, changes: [{ field_key: "name", before: "Synthetic target", before_present: true, after: null, after_present: false, origin: "user" }] }] });
    open(); await preview();
    await screen.findByText(`Paso 1: ${title}`);
    expect(screen.getByText((text) => text.includes(warning))).toBeInTheDocument();
    expect(screen.getByText(/Synthetic target/, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Campo ausente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar revisión/ })).not.toBeInTheDocument();
  });
  it("shows structured automatic initial movement and balance effects with financial labels and exact strings", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_finance_obligations_prepare_create", changes: [
      { field_key: "initial_movement", before: null, before_present: false, after_present: true, origin: "contract_default", after: { kind: "object", fields: [{ field_key: "type", value: "expense" }, { field_key: "status", value: "paid" }, { field_key: "amount", value: "9007199254740993" }, { field_key: "is_active", value: false }] } },
      { field_key: "paid_amount", before: null, before_present: false, after: "0", after_present: true, origin: "contract_default" },
      { field_key: "remaining_amount", before: null, before_present: false, after: "9007199254740993", after_present: true, origin: "contract_default" },
    ] }] });
    open(); await preview();
    await screen.findByText("Paso 1: Crear préstamo o deuda");
    expect(screen.getByRole("heading", { name: "Movimiento inicial" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Liquidado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pendiente de liquidar" })).toBeInTheDocument();
    expect(screen.getByText("Gasto")).toBeInTheDocument(); expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.getByText("Falso")).toBeInTheDocument(); expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getAllByText("9007199254740993")).toHaveLength(2);
    expect(screen.queryByText("expense")).not.toBeInTheDocument(); expect(screen.queryByText("paid")).not.toBeInTheDocument();
  });
  it("loads the event's exact revision only on intent and never offers execution or raw tools", async () => {
    open(); await screen.findByRole("button", { name: "Ver propuesta" });
    expect(mocks.getNodiaAiProposal).not.toHaveBeenCalled();
    await preview();
    expect(await screen.findByText("Revisión 1")).toBeInTheDocument();
    expect(mocks.getNodiaAiProposal).toHaveBeenCalledWith(proposalEvent.payload, expect.any(AbortSignal));
    expect(screen.queryByRole("button", { name: /confirmar|eliminar|ejecutar/i })).not.toBeInTheDocument();
    expect(screen.queryByText("synthetic_prepare")).not.toBeInTheDocument();
    expect(await screen.findByText(/Esta revisión se conserva como referencia/)).toBeInTheDocument();
  });
  it("preserves absence, explicit null, zero, false, empty values, collection order and exact money strings", async () => {
    open(); await preview(); await screen.findByText("Revisión 1");
    expect(screen.getByText("9007199254740993.01")).toBeInTheDocument();
    expect(screen.getByText("Campo ausente")).toBeInTheDocument();
    expect(screen.getAllByText("Sin valor (null)")).toHaveLength(2);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Falso")).toBeInTheDocument();
    expect(screen.getByText("Texto vacío")).toBeInTheDocument();
    expect(screen.getByText("Lista vacía")).toBeInTheDocument();
    expect(screen.getByText("Objeto vacío")).toBeInTheDocument();
    const ordered = screen.getByRole("list");
    expect(within(ordered).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Second named item", "First named item"]);
  });
  it("shows the immutable step order, registered future bindings, scopes and historical state", async () => {
    mocks.getNodiaAiProposal.mockResolvedValue({ ...proposal, state: "superseded", steps: [...proposal.steps, { ...proposal.steps[0], step_id: "77777777-7777-4777-8777-777777777777", effect_key: "Dependent effect", depends_on: [stepId], output_bindings: [{ target_field_key: "Synthetic supplier", from_step_id: stepId, output_key: "Synthetic created ID" }], changes: [] }] });
    open(); await preview(); await screen.findByText("Reemplazada");
    expect(screen.getByText(/Esta revisión no está lista/)).toBeInTheDocument();
    expect(screen.getByText("Depende de los pasos: 1")).toBeInTheDocument();
    expect(screen.getByText("Synthetic supplier usará Synthetic created ID del paso 1 cuando se complete.")).toBeInTheDocument();
    expect(screen.getAllByText("Usuario destinatario: 9")).toHaveLength(2);
  });
  it("uses existing finance labels only for the registered movement preparer without globally translating field names", async () => {
    const values = { name: "Synthetic dinner", amount: "20000", type: "expense", status: "paid", category_id: "9007199254740993", obligation_id: null, is_active: true };
    mocks.getNodiaAiProposal.mockResolvedValue({ ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_finance_movements_prepare_create", effect_key: "finance_movement.create", changes: Object.entries(values).map(([field_key, after]) => ({ field_key, before: null, after, before_present: false, after_present: true, origin: "user" })) }] });
    open(); await preview();
    await screen.findByText("Paso 1: Crear movimiento");
    for (const name of ["Nombre", "Monto", "Tipo", "Estado", "Categoría", "Préstamo o deuda", "Activo"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(screen.getByText("Gasto")).toBeInTheDocument();
    expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.getByText("20000")).toBeInTheDocument();
    expect(screen.getByText("9007199254740993")).toBeInTheDocument();
  });
  it("keeps the panel open and recovers a failed GET without repeating a turn", async () => {
    mocks.getNodiaAiProposal.mockRejectedValueOnce(new Error("Synthetic network unavailable")).mockResolvedValue(proposal);
    open(); const user = await preview();
    expect(await screen.findByText(/No pudimos recuperar esta revisión exacta/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar propuesta" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Revisión 1");
    expect(mocks.getNodiaAiProposal).toHaveBeenCalledTimes(2);
    expect(mocks.getNodiaAiEvents).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledTimes(1);
  });
  it("removes an already visible proposal after current access is revoked", async () => {
    open(); await preview(); await screen.findByText("9007199254740993.01");
    const denied = new AxiosError("Synthetic revoked");
    denied.response = { status: 403, data: {}, headers: {}, config: {} as never, statusText: "Forbidden" };
    mocks.getNodiaAiProposal.mockRejectedValue(denied);
    await client.invalidateQueries({ predicate: query => query.queryKey.includes("proposal") });
    await screen.findByText(/Esta propuesta ya no está disponible/);
    await waitFor(() => expect(screen.queryByText("9007199254740993.01")).not.toBeInTheDocument());
  });
  it("loads the newly saved exact revision and metadata instead of confirming an old event's content", async () => {
    const updated = { ...editableProposal, revision: 2, hash: "b".repeat(64), steps: [{ ...editableProposal.steps[0], step_id: "77777777-7777-4777-8777-777777777777", changes: editableProposal.steps[0].changes.map(change => change.field_key === "amount" ? { ...change, after: "30000" } : change) }] };
    mocks.getNodiaAiProposal.mockImplementation(ref => Promise.resolve(ref.revision === 2 ? updated : editableProposal));
    mocks.getNodiaAiProposalReview.mockImplementation(ref => Promise.resolve(ref.revision === 2 ? { ...editableReview, revision: 2, hash: updated.hash, editable_fields: editableReview.editable_fields.map(field => ({ ...field, step_id: updated.steps[0].step_id })) } : editableReview));
    mocks.updateNodiaAiProposal.mockResolvedValue(updated);
    open(); const user = await preview();
    await user.click(await screen.findByRole("button", { name: "Corregir propuesta" }));
    const amount = screen.getByRole("textbox", { name: /^Monto/ }); await user.clear(amount); await user.type(amount, "30000");
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await screen.findByText("Revisión 2");
    expect(await screen.findByRole("button", { name: "Confirmar revisión 2" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Confirmar revisión 1" })).not.toBeInTheDocument();
    expect(screen.getByText("30000")).toBeInTheDocument();
    expect(mocks.getNodiaAiProposalReview).toHaveBeenLastCalledWith({ proposal_id: proposal.proposal_id, revision: 2, hash: updated.hash }, expect.any(AbortSignal));
  });
  it("refuses action metadata for fields absent from the frozen preview", async () => {
    mocks.getNodiaAiProposalReview.mockResolvedValue(editableReview);
    open(); await preview();
    await screen.findByText(/No pudimos verificar las acciones permitidas/);
    expect(screen.queryByRole("button", { name: "Corregir propuesta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar revisión/ })).not.toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledTimes(1);
  });
});
