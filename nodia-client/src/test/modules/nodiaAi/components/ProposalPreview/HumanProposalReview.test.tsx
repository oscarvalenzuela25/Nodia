import { aiProviderProposal, aiProviderReview } from "../../infrastructure/aiProviderFixtures";
import { coreUserProposal, coreUserReview, coreRoleProposal, coreRoleReview, coreDeleteProposal, coreDeleteReview, coreArray } from "../../infrastructure/coreFixtures";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HumanProposalReview from "../../../../../modules/nodiaAi/components/ProposalPreview/HumanProposalReview";
import useAuthStore from "../../../../../store/authStore";
import { chatId } from "../../infrastructure/fixtures";
import { nodiaAiProposalKey } from "../../../../../modules/nodiaAi/infrastructure/useProposal";
import { editableProposal as proposal, editableReview as review, execution, stepId } from "../../infrastructure/proposalFixtures";
import { dependentStepId, workflowProposal, workflowReview } from "../../infrastructure/workflowFixtures";
import { rentalPolicyProposal, rentalPolicyReview } from "../../infrastructure/rentalFixtures";
import { rentalReservationProposal, rentalReservationReview, rentalCancellationProposal, rentalCancellationReview } from "../../infrastructure/rentalFixtures";
import { rentalPreparationProposal, rentalPreparationReview, rentalBlockProposal, rentalBlockReview, rentalPaymentProposal, rentalPaymentReview, rentalExpenseProposal, rentalExpenseReview } from "../../infrastructure/rentalMoneyPreparationFixtures";

const mocks = vi.hoisted(() => ({ challengeNodiaAiProposal: vi.fn(), confirmNodiaAiProposal: vi.fn(), getNodiaAiCurrentProposal: vi.fn(), getNodiaAiExecution: vi.fn(), updateNodiaAiProposal: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/services", async original => ({ ...await original<object>(), ...mocks }));
vi.mock("sileo", () => ({ sileo: { success: mocks.success, error: mocks.error } }));
let client: QueryClient;
const changed = vi.fn();
const challenge = { proposal_id: proposal.proposal_id, proposal_revision: 1, expected_hash: proposal.hash, confirmation_token: "A".repeat(43), expires_at: "2099-01-01T00:00:00Z" };
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ user: { id: "9", name: "Synthetic owner" }, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false });
  mocks.challengeNodiaAiProposal.mockResolvedValue(challenge);
  mocks.confirmNodiaAiProposal.mockResolvedValue(execution);
  mocks.getNodiaAiCurrentProposal.mockResolvedValue(proposal);
  mocks.getNodiaAiExecution.mockResolvedValue(execution);
});
afterEach(() => { client.clear(); useAuthStore.setState({ token: null, user: null, sessionStatus: "anonymous" }); });
function open(metadata = review, currentProposal = proposal) { return render(<QueryClientProvider client={client}><HumanProposalReview conversationId={chatId} proposal={currentProposal} metadata={metadata} onRevision={changed} disabled={false} /></QueryClientProvider>); }
function descriptionScenario(value: string | null) {
  return {
    currentProposal: { ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_finance_obligations_prepare_update", changes: [proposal.steps[0].changes.find(change => change.field_key === "name")!, { field_key: "description", before: value, after: value, before_present: true, after_present: true, origin: "user" as const }] }] },
    metadata: { ...review, editable_fields: [review.editable_fields.find(field => field.field_key === "name")!, { step_id: stepId, field_key: "description", label_key: "finance:description", kind: "text" as const, nullable: true, max_length: 5000, minimum: null, maximum: null, options: [] }] },
  };
}
const available = { ...review, confirmation: { available: true, reason: null } };
const serverError = (status: number, message = "Synthetic rejected") => new AxiosError(message, "ERR_BAD_RESPONSE", undefined, undefined, { status, data: { message }, headers: {}, config: {} as never, statusText: "Rejected" });
const protocolError = (status: number, code: string) => new AxiosError(code, "ERR_BAD_RESPONSE", undefined, undefined, { status, data: { error: { code, message_key: code, field_errors: [], retry_action: "none", correlation_id: stepId } }, headers: {}, config: {} as never, statusText: "Rejected" });

function integerScenario(value: number | null = 10) {
  return {
    currentProposal: { ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_products_prepare_update", changes: [{ field_key: "cost_price", before: value, after: value, before_present: true, after_present: true, origin: "user" as const }] }] },
    metadata: { ...review, editable_fields: [{ step_id: stepId, field_key: "cost_price", label_key: "nodiaAi:proposal.business_fields.cost_price", kind: "integer" as const, nullable: value === null, max_length: null, minimum: "-2147483648", maximum: "2147483647", options: [] }] },
  };
}
describe("human proposal confirmation and registered edits", () => {
  it("explains unsupported Core translation removal and keeps the submitted collection editable", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(400, "nodia_ai:core_translation_removal_unsupported"));
    open(coreRoleReview, coreRoleProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    await userEvent.click(screen.getByRole("button", { name: "Quitar traducción 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText("Las traducciones existentes se conservan. Puedes corregirlas o agregar claves, pero no eliminarlas desde esta operación.")).toBeInTheDocument();
    expect(screen.getByText("Sin traducciones. Puedes agregar una entrada.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar traducción" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: /^Clave/ })).toHaveValue("qa_role");
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "translates", value: coreArray([]) }] }));
    expect(mocks.error).toHaveBeenCalledOnce(); expect(changed).not.toHaveBeenCalled();
  });
  it.each([
    ["nodia_ai:ai_provider_model_unavailable", "El modelo no está disponible en la configuración o el descubrimiento de este modo. Revisa la selección.", false],
    ["nodia_ai:ai_provider_reasoning_unavailable", "La intensidad no está registrada para esta configuración. Revisa el valor antes de guardar.", true],
    ["nodia_ai:ai_provider_translation_removal_unsupported", "Las traducciones existentes se conservan. Puedes corregirlas o agregar claves, pero no eliminarlas desde esta operación.", false],
  ])("localizes %s and preserves the exact pending provider correction", async (code, description, envelope) => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(envelope ? protocolError(422, code) : serverError(400, code));
    open(aiProviderReview, aiProviderProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const name = screen.getByRole("textbox", { name: /^Nombre/ });
    fireEvent.change(name, { target: { value: "[QA] Corrected connection" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText(description)).toBeInTheDocument();
    expect(name).toHaveValue("[QA] Corrected connection");
    expect(screen.getByRole("textbox", { name: "Web · Modelo seleccionado" })).toHaveValue("[QA] persisted web model");
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ description }));
    expect(changed).not.toHaveBeenCalled();
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledOnce();
  });
  it("validates provider UTF-8 byte bounds and requires explicit null for an empty model", async () => {
    open(aiProviderReview, aiProviderProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const name = screen.getByRole("textbox", { name: /^Nombre/ });
    const web = screen.getByRole("textbox", { name: "Web · Modelo seleccionado" });
    fireEvent.change(name, { target: { value: "ñ".repeat(65) } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
    expect(name).toHaveValue("ñ".repeat(65));
    fireEvent.change(name, { target: { value: "ñ".repeat(64) } });
    fireEvent.change(web, { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Dejar Web · Modelo seleccionado sin valor (null)" }));
    mocks.updateNodiaAiProposal.mockResolvedValue({ ...aiProviderProposal, revision: 2, hash: "b".repeat(64) });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await waitFor(() => expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(aiProviderProposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "name", value: "ñ".repeat(64) }, { step_id: stepId, field_key: "token_plan_web.selected_model", value: null }] })));
  });
  it("preserves a mode-specific model correction after rejection without copying another mode", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "Synthetic model not found"));
    open(aiProviderReview, aiProviderProposal);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const web = screen.getByRole("textbox", { name: "Web · Modelo seleccionado" });
    const agentic = screen.getByRole("textbox", { name: "Agentic · Modelo seleccionado" });
    expect(web).toHaveValue("[QA] persisted web model"); expect(agentic).toHaveValue("");
    fireEvent.change(web, { target: { value: "[QA] newly discovered model" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText("Synthetic model not found")).toBeInTheDocument();
    expect(web).toHaveValue("[QA] newly discovered model"); expect(agentic).toHaveValue("");
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(aiProviderProposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "token_plan_web.selected_model", value: "[QA] newly discovered model" }] }));
    expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ description: "Synthetic model not found" }));
    expect(changed).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Confirmar revisión 1" })).toBeDisabled();
  });
  it("sends explicit null to clear only the requested model override", async () => {
    mocks.updateNodiaAiProposal.mockResolvedValue({ ...aiProviderProposal, revision: 2, hash: "b".repeat(64) });
    open(aiProviderReview, aiProviderProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    await userEvent.click(screen.getByRole("button", { name: "Dejar Web · Modelo seleccionado sin valor (null)" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await waitFor(() => expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(aiProviderProposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "token_plan_web.selected_model", value: null }] })));
    expect(mocks.success).toHaveBeenCalled();
  });
  it("confirms an exact Core deletion with an empty command and no editable fields", async () => {
    open(coreDeleteReview, coreDeleteProposal);
    expect(screen.queryByRole("button", { name: "Corregir propuesta" })).not.toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirmar revisión 1" });
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(mocks.confirmNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(coreDeleteProposal.proposal_id, expect.objectContaining({ proposal_revision: 1, expected_hash: coreDeleteProposal.hash, confirmation_token: challenge.confirmation_token })));
  });
  it("localizes last administrator protection and preserves the user's correction after rejection", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(403, "users:last_super_admin"));
    const proposalKey = nodiaAiProposalKey(["9", 1], chatId, { proposal_id: coreUserProposal.proposal_id, revision: coreUserProposal.revision, hash: coreUserProposal.hash });
    client.setQueryData(proposalKey, coreUserProposal);
    open(coreUserReview, coreUserProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Nombre/ }), { target: { value: "[QA] Revised" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText("Debe permanecer al menos un superadministrador activo.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Nombre/ })).toHaveValue("[QA] Revised");
    expect(client.getQueryData(proposalKey)).toEqual(coreUserProposal);
    expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ description: "Debe permanecer al menos un superadministrador activo." }));
  });
  it("revises a final role collection using exact IDs and preserves it after a server rejection", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "Synthetic invalid association"));
    open(coreUserReview, coreUserProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Agregar ID a Roles finales" }), { target: { value: "9007199254740996" } });
    await userEvent.click(screen.getAllByRole("button", { name: "Agregar ID" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await screen.findByText("Synthetic invalid association");
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "roles", value: coreArray(["9007199254740993", "9007199254740996"]) }] }));
    expect(screen.getByRole("button", { name: "Roles finales" })).toHaveTextContent("9007199254740996");
    expect(screen.getByRole("textbox", { name: /^Correo/ })).toHaveValue("synthetic@example.invalid");
  });
  it("edits an ES translation without changing its key, English value or other command fields", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422));
    open(coreRoleReview, coreRoleProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByDisplayValue("Rol sintético"), { target: { value: "Rol revisado" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "translates", value: { kind: "array", items: [{ kind: "object", fields: [{ field_key: "key", value: "name" }, { field_key: "es", value: "Rol revisado" }, { field_key: "en", value: "Synthetic role" }] }] } }] }));
    expect(screen.getByDisplayValue("Rol revisado")).toBeInTheDocument();
  });
  it("does not include an untouched translation when its public object fields arrived in a different order", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422));
    const current = { ...coreRoleProposal, steps: [{ ...coreRoleProposal.steps[0], changes: coreRoleProposal.steps[0].changes.map(change => change.field_key === "translates" ? { ...change, after: { kind: "array" as const, items: [{ kind: "object" as const, fields: [{ field_key: "en", value: "Synthetic role" }, { field_key: "es", value: "Rol sintético" }, { field_key: "key", value: "name" }] }] } } : change) }] };
    open(coreRoleReview, current); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Clave/ }), { target: { value: "qa_role_revised" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "key", value: "qa_role_revised" }] }));
  });
  it("keeps incomplete translations editable and blocks the revision request", async () => {
    open(coreRoleReview, coreRoleProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByDisplayValue("Synthetic role"), { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText("Completa clave, español e inglés sin claves repetidas.")).toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Rol sintético")).toBeInTheDocument();
  });

  it.each([[null, "Sin especificar"], [false, "No disponible"], [true, "Disponible"]] as const)("preserves the nullable linen value %s when another field is revised", async (linen, display) => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "rental:invalid_turnover_ready"));
    const current = { ...rentalPreparationProposal, steps: [{ ...rentalPreparationProposal.steps[0], changes: rentalPreparationProposal.steps[0].changes.map(change => change.field_key === "linen_ready" ? { ...change, after: linen } : change) }] };
    open(rentalPreparationReview, current); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    expect(within(screen.getByRole("button", { name: "Ropa de cama disponible" })).getByText(display)).toBeInTheDocument();
    const notes = screen.getByRole("textbox", { name: "Notas" }); fireEvent.change(notes, { target: { value: "[QA] Updated preparation" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "notes", value: "[QA] Updated preparation" }] }));
    await screen.findByText(/Revisa la limpieza, ropa de cama y hora de preparación realizada/);
    expect(notes).toHaveValue("[QA] Updated preparation");
    expect(within(screen.getByRole("button", { name: "Ropa de cama disponible" })).getByText(display)).toBeInTheDocument();
  });
  it.each([["No disponible", false], ["Disponible", true]] as const)("edits unspecified linen explicitly to %s without losing nullable readiness times", async (label, value) => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "rental:invalid_turnover_plan"));
    open(rentalPreparationReview, rentalPreparationProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    await userEvent.click(screen.getByRole("button", { name: "Ropa de cama disponible" }));
    await userEvent.click(screen.getByRole("option", { name: label }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "linen_ready", value }] }));
    await screen.findByText("El plan de preparación no es compatible con las estadías.");
    expect(screen.getByRole("group", { name: "Hora real de preparación" })).toBeInTheDocument();
  });
  it("clears true linen to null explicitly and preserves other fields", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422));
    const current = { ...rentalPreparationProposal, steps: [{ ...rentalPreparationProposal.steps[0], changes: rentalPreparationProposal.steps[0].changes.map(change => change.field_key === "linen_ready" ? { ...change, after: true } : change) }] };
    open(rentalPreparationReview, current); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    await userEvent.click(screen.getByRole("button", { name: "Ropa de cama disponible" })); await userEvent.click(screen.getByRole("option", { name: "Sin especificar" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "linen_ready", value: null }] }));
  });
  it("clears an optional planned instant without reserializing the other block/ready instants", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422));
    open(rentalPreparationReview, rentalPreparationProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    await userEvent.click(screen.getByRole("button", { name: "Dejar Hora prevista de preparación sin valor (null)" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "planned_ready_at", value: null }] }));
  });
  it("edits a block instant in the authoritative house zone and keeps the end offset exact", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "rental:availability_conflict"));
    open(rentalBlockReview, rentalBlockProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const start = within(screen.getByRole("group", { name: "Inicio del bloqueo" }));
    fireEvent.change(start.getByRole("textbox", { name: /Inicio del bloqueo.*Hora/ }), { target: { value: "16:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "starts_at", value: "2026-11-01T19:00:00.000Z" }] }));
    await screen.findByText("Las fechas coinciden con otra estadía o bloqueo.");
  });
  it("uses a civil-date editor for money and preserves a large amount without numeric conversion", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "rental:overpayment"));
    open(rentalPaymentReview, rentalPaymentProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const day = screen.getByRole("textbox", { name: /^Fecha efectiva/ });
    fireEvent.change(day, { target: { value: "2026-10-16" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "occurred_on", value: "2026-10-16" }] }));
    await screen.findByText("El cobro supera el importe pendiente de la reserva.");
    expect(screen.getByRole("textbox", { name: /^Importe/ })).toHaveValue("9007199254740993");
  });
  it("rejects a zero payment amount while preserving the draft", async () => {
    open(rentalPaymentReview, rentalPaymentProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const amount = screen.getByRole("textbox", { name: /^Importe/ }); fireEvent.change(amount, { target: { value: "0" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled(); expect(amount).toHaveValue("0");
  });
  it("preserves null expense association and payment day when only its name changes", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422));
    open(rentalExpenseReview, rentalExpenseProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Nombre/ }), { target: { value: "[QA] Renamed paid expense" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "name", value: "[QA] Renamed paid expense" }] }));
  });
  it("uses civil date/time controls and rejects impossible dates while keeping the reservation draft", async () => {
    open(rentalReservationReview, rentalReservationProposal);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const day = screen.getByRole("textbox", { name: /^Fecha de entrada/ });
    expect(day).toHaveValue("2026-11-01");
    expect(screen.getByRole("button", { name: /Fecha de entrada/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Hora de entrada/ })).toHaveValue("15:00");
    fireEvent.change(day, { target: { value: "2026-02-30" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText("Revisa este valor según el tipo y los límites del campo.")).toBeInTheDocument();
    expect(day).toHaveValue("2026-02-30"); expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("preserves the exact instant and integer zero while correcting another cancellation field, including after an error", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "rental:invalid_refund"));
    open(rentalCancellationReview, { ...rentalCancellationProposal, steps: [{ ...rentalCancellationProposal.steps[0], changes: rentalCancellationProposal.steps[0].changes.map(change => change.field_key === "cancelled_at" ? { ...change, after: "2026-10-17T09:30:00-03:00" } : change) }] });
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const group = within(screen.getByRole("group", { name: "Fecha efectiva de cancelación" }));
    expect(group.getByRole("textbox", { name: /Fecha efectiva de cancelación.*Fecha/ })).toHaveValue("2026-10-17");
    expect(group.getByRole("textbox", { name: /Fecha efectiva de cancelación.*Hora/ })).toHaveValue("09:30");
    expect(group.getByText("America/Santiago")).toBeInTheDocument();
    const note = screen.getByRole("textbox", { name: /^Resolución de la devolución/ });
    fireEvent.change(note, { target: { value: "[QA] Preserve exact instant" } });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 }); fireEvent(window, new Event("resize"));
    expect(note).toHaveValue("[QA] Preserve exact instant");
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await screen.findByText("Revisa el importe y la resolución de la devolución.");
    expect(note).toHaveValue("[QA] Preserve exact instant");
    expect(screen.getByRole("textbox", { name: /^Devolución aprobada/ })).toHaveValue("0");
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "resolution_note", value: "[QA] Preserve exact instant" }] }));
  });
  it("converts only an explicitly edited civil minute using the house timezone", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "rental:invalid_cancellation_time"));
    open(rentalCancellationReview, rentalCancellationProposal);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const group = within(screen.getByRole("group", { name: "Fecha efectiva de cancelación" }));
    fireEvent.change(group.getByRole("textbox", { name: /Fecha efectiva de cancelación.*Hora/ }), { target: { value: "10:15" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "cancelled_at", value: "2026-10-17T13:15:00.000Z" }] }));
    await screen.findByText(/La cancelación debe ser efectiva antes/);
  });
  it("blocks an instant editor without authoritative timezone instead of assuming the browser zone", async () => {
    open(rentalCancellationReview, { ...rentalCancellationProposal, steps: [{ ...rentalCancellationProposal.steps[0], changes: rentalCancellationProposal.steps[0].changes.filter(change => change.field_key !== "timezone") }] });
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    expect(screen.getByText(/No pudimos verificar la zona horaria/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /^Resolución de la devolución/ }), { target: { value: "Changed" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("keeps a nonexistent DST minute editable and blocks the write instead of choosing an offset", async () => {
    const current = { ...rentalCancellationProposal, steps: [{ ...rentalCancellationProposal.steps[0], changes: rentalCancellationProposal.steps[0].changes.map(change => change.field_key === "timezone" ? { ...change, after: "America/New_York" } : change.field_key === "cancelled_at" ? { ...change, after: "2026-03-08T06:30:00Z" } : change) }] };
    open(rentalCancellationReview, current);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const group = within(screen.getByRole("group", { name: "Fecha efectiva de cancelación" }));
    const hour = group.getByRole("textbox", { name: /Fecha efectiva de cancelación.*Hora/ });
    expect(hour).toHaveValue("01:30");
    fireEvent.change(hour, { target: { value: "02:30" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(hour).toHaveValue("02:30");
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
    expect(screen.getAllByText("Revisa este valor según el tipo y los límites del campo.").length).toBeGreaterThan(0);
  });
  it("keeps zero refund as an exact bigint string when the contract allows zero", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "rental:invalid_refund"));
    const current = { ...rentalCancellationProposal, steps: [{ ...rentalCancellationProposal.steps[0], changes: rentalCancellationProposal.steps[0].changes.map(change => change.field_key === "refund_amount" ? { ...change, after: "1" } : change) }] };
    open(rentalCancellationReview, current);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Devolución aprobada/ }), { target: { value: "0" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "refund_amount", value: "0" }] }));
    await screen.findByText("Revisa el importe y la resolución de la devolución.");
  });
  it.each(["-1", "0.5", "+1", "01", "1e3", "9223372036854775808"])("rejects noncanonical or overflowing CLP refund %s without losing the draft", async value => {
    open(rentalCancellationReview, rentalCancellationProposal);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const amount = screen.getByRole("textbox", { name: /^Devolución aprobada/ });
    fireEvent.change(amount, { target: { value } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText("Revisa este valor según el tipo y los límites del campo.")).toBeInTheDocument();
    expect(amount).toHaveValue(value); expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("edits policy rules as structured rows, preserves stable focus across resize/removal, and keeps the exact draft after a rejected revision", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "Synthetic policy rejected"));
    open(rentalPolicyReview, rentalPolicyProposal);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const second = within(screen.getByRole("group", { name: "Regla 2" }));
    const refund = second.getByRole("textbox", { name: /^Porcentaje de devolución/ });
    fireEvent.change(refund, { target: { value: "75.25" } }); refund.focus();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 }); fireEvent(window, new Event("resize"));
    expect(refund).toHaveFocus(); expect(refund).toHaveValue("75.25");
    await userEvent.click(screen.getByRole("button", { name: "Agregar regla" }));
    await userEvent.click(screen.getByRole("button", { name: "Quitar regla 3" }));
    expect(second.getByRole("textbox", { name: /^Porcentaje de devolución/ })).toBe(refund);
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "rules", value: { kind: "array", items: [
      { kind: "object", fields: [{ field_key: "min_days_before", value: 0 }, { field_key: "refund_percent", value: "0.00" }] },
      { kind: "object", fields: [{ field_key: "min_days_before", value: 7 }, { field_key: "refund_percent", value: "75.25" }] },
    ] } }] }));
    await screen.findByText("Synthetic policy rejected");
    expect(refund).toHaveValue("75.25"); expect(mocks.error).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Guardar nueva revisión" })).toBeEnabled();
    expect(mocks.challengeNodiaAiProposal).not.toHaveBeenCalled();
  });
  it.each([
    ["min_days_before", "0"], ["min_days_before", "36501"], ["min_days_before", "1e2"],
    ["refund_percent", "100.01"], ["refund_percent", "-1"], ["refund_percent", "1.001"], ["refund_percent", ""],
  ])("rejects invalid policy rule %s=%j before any request", async (field, value) => {
    open(rentalPolicyReview, rentalPolicyProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const row = within(screen.getByRole("group", { name: "Regla 2" }));
    fireEvent.change(row.getByRole("textbox", { name: field === "min_days_before" ? /^Días mínimos/ : /^Porcentaje/ }), { target: { value } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText(/Revisa los días y porcentajes/)).toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("requires the zero-day rule without imposing a monotonic refund rule absent from the native contract", async () => {
    open(rentalPolicyReview, rentalPolicyProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    await userEvent.click(screen.getByRole("button", { name: "Quitar regla 1" }));
    expect(screen.getByRole("button", { name: "Quitar regla 1" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText(/Revisa los días y porcentajes/)).toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("keeps repeated names attached to their exact step and preserves both drafts after a rejected workflow revision", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(409, "Synthetic material workflow conflict"));
    open(workflowReview, workflowProposal);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const supplier = within(screen.getByRole("group", { name: "Campos del paso 1" })).getByRole("textbox", { name: /^Nombre/ });
    const contact = within(screen.getByRole("group", { name: "Campos del paso 2" })).getByRole("textbox", { name: /^Nombre/ });
    fireEvent.change(contact, { target: { value: "Contact correction" } });
    contact.focus();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 }); fireEvent(window, new Event("resize"));
    expect(contact).toHaveFocus(); expect(supplier).toHaveValue("[QA] Synthetic supplier");
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledExactlyOnceWith(workflowProposal.proposal_id, expect.objectContaining({ expected_proposal_revision: 1, expected_hash: workflowProposal.hash, edits: [{ step_id: dependentStepId, field_key: "name", value: "Contact correction" }] }));
    await screen.findByText("Synthetic material workflow conflict");
    expect(contact).toHaveValue("Contact correction"); expect(supplier).toHaveValue("[QA] Synthetic supplier");
    expect(screen.getByRole("button", { name: "Guardar nueva revisión" })).toBeEnabled();
  });
  it.each([
    ["nodia_ai:invoice_file_move_requires_staging", /Para trasladar una factura con archivo/],
    ["nodia_ai:result_too_large", /La operación supera el límite/],
  ])("presents localized native rejection %s and preserves the correction form", async (code, message) => {
    mocks.updateNodiaAiProposal.mockRejectedValue(protocolError(400, code as string));
    open(); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const input = screen.getByRole("textbox", { name: /^Nombre/ }); fireEvent.change(input, { target: { value: "Preserved edit" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText(message as RegExp)).toBeInTheDocument(); expect(input).toHaveValue("Preserved edit");
    expect(mocks.error).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["rental:owner_required", /Esta operación requiere ser propietario/], ["rental:invalid_transition", /El estado actual no permite/],
    ["rental:agreement_immutable", /El acuerdo ya registrado/], ["rental:turnover_required", /Revisa y aprueba la preparación/],
  ])("localizes the registered rental rejection %s while retaining policy rows", async (code, description) => {
    mocks.updateNodiaAiProposal.mockRejectedValue(protocolError(409, code as string));
    open(rentalPolicyReview, rentalPolicyProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const refund = within(screen.getByRole("group", { name: "Regla 2" })).getByRole("textbox", { name: /^Porcentaje/ });
    fireEvent.change(refund, { target: { value: "60" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText(description as RegExp)).toBeInTheDocument();
    expect(refund).toHaveValue("60"); expect(mocks.error).toHaveBeenCalledOnce();
  });
  it("clears cached authority on a localized rental ownership rejection", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValue(protocolError(403, "rental:owner_required"));
    const key = nodiaAiProposalKey(["9", 1], chatId, { proposal_id: rentalPolicyProposal.proposal_id, revision: rentalPolicyProposal.revision, hash: rentalPolicyProposal.hash });
    client.setQueryData(key, rentalPolicyProposal);
    open(rentalPolicyReview, rentalPolicyProposal); await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(within(screen.getByRole("group", { name: "Regla 2" })).getByRole("textbox", { name: /^Porcentaje/ }), { target: { value: "60" } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await screen.findByText(/Esta operación requiere ser propietario/);
    expect(client.getQueryData(key)).toBeNull(); expect(mocks.error).toHaveBeenCalledOnce();
  });
  it("preserves native integer draft and focused control while metadata order and viewport change", async () => {
    const { currentProposal, metadata } = integerScenario();
    const view = open(metadata, currentProposal);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const input = screen.getByRole("textbox", { name: /^Precio de costo/ });
    fireEvent.change(input, { target: { value: "-100" } }); input.focus();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 }); fireEvent(window, new Event("resize"));
    view.rerender(<QueryClientProvider client={client}><HumanProposalReview conversationId={chatId} proposal={currentProposal} metadata={{ ...metadata, editable_fields: [...metadata.editable_fields].reverse() }} onRevision={changed} disabled={false} /></QueryClientProvider>);
    expect(input).toHaveValue("-100"); expect(input).toHaveFocus();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it.each(["0", "-2147483648", "2147483647"])("edits a native integer %s as an exact number and keeps the form after server rejection", async value => {
    const { currentProposal, metadata } = integerScenario();
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "Synthetic native integer rejected"));
    open(metadata, currentProposal); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const input = screen.getByRole("textbox", { name: /^Precio de costo/ });
    expect(input).toHaveValue("10");
    fireEvent.change(input, { target: { value } });
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "cost_price", value: Number(value) }] }));
    await screen.findByText("Synthetic native integer rejected");
    expect(input).toHaveValue(value);
    expect(screen.getByRole("heading", { name: "Corregir campos registrados" })).toBeInTheDocument();
    expect(mocks.challengeNodiaAiProposal).not.toHaveBeenCalled();
  });
  it.each(["", "-0", "00", "01", "+1", "1.0", "1e2", "NaN", " 1", "2147483648", "-2147483649"])("rejects a noncanonical or overflowing native integer %j without a request", async value => {
    const { currentProposal, metadata } = integerScenario(); open(metadata, currentProposal);
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const input = screen.getByRole("textbox", { name: /^Precio de costo/ }); fireEvent.change(input, { target: { value } });
    await userEvent.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText(/Revisa este valor/)).toBeInTheDocument(); expect(input).toHaveValue(value);
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });

  it("preserves an unchanged nullable description while editing another field", async () => {
    const { currentProposal, metadata } = descriptionScenario(null);
    mocks.updateNodiaAiProposal.mockResolvedValue({ ...currentProposal, revision: 2, hash: "b".repeat(64) });
    open(metadata, currentProposal); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    expect(screen.getByRole("textbox", { name: "Descripción" })).toHaveValue("");
    expect(screen.getByText("Sin valor (null)")).toBeInTheDocument();
    const name = screen.getByRole("textbox", { name: /^Nombre/ }); await user.clear(name); await user.type(name, "Changed name");
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "name", value: "Changed name" }] }));
  });
  it.each(["", "   "])("allows an explicit blank nullable description %j without converting it to null", async value => {
    const { currentProposal, metadata } = descriptionScenario("Old text");
    mocks.updateNodiaAiProposal.mockResolvedValue({ ...currentProposal, revision: 2, hash: "b".repeat(64) });
    open(metadata, currentProposal); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Descripción" }), { target: { value } });
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "description", value }] }));
  });
  it("supports an explicit null edit separately from blank text and preserves it on a rejected write", async () => {
    const { currentProposal, metadata } = descriptionScenario("Old text");
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "Synthetic description rejected"));
    open(metadata, currentProposal); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    await user.click(screen.getByRole("button", { name: "Dejar Descripción sin valor (null)" }));
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await screen.findByText("Synthetic description rejected");
    expect(screen.getByRole("textbox", { name: "Descripción" })).toHaveValue("");
    expect(screen.getByText("Sin valor (null)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Corregir campos registrados" })).toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "description", value: null }] }));
    expect(mocks.error).toHaveBeenCalledTimes(1);
  });
  it("accepts 5000 Unicode code points in description without truncation or whitespace normalization", async () => {
    const { currentProposal, metadata } = descriptionScenario(null);
    mocks.updateNodiaAiProposal.mockResolvedValue({ ...currentProposal, revision: 2, hash: "b".repeat(64) });
    open(metadata, currentProposal); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const value = ` ${"🍽".repeat(4998)} `;
    fireEvent.change(screen.getByRole("textbox", { name: "Descripción" }), { target: { value } });
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledWith(proposal.proposal_id, expect.objectContaining({ edits: [{ step_id: stepId, field_key: "description", value }] }));
  });
  it("rejects description longer than 5000 code points and keeps the full draft for correction", async () => {
    const { currentProposal, metadata } = descriptionScenario(null);
    open(metadata, currentProposal); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const value = "x".repeat(5001), input = screen.getByRole("textbox", { name: "Descripción" });
    fireEvent.change(input, { target: { value } });
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText(/Revisa este valor/)).toBeInTheDocument();
    expect(input).toHaveValue(value); expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("honors actual backend availability and never obtains a challenge on mount or edit", async () => {
    open();
    expect(screen.getByRole("button", { name: "Confirmar revisión 1" })).toBeDisabled();
    expect(screen.getByText(/La confirmación permanece deshabilitada/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    expect(mocks.challengeNodiaAiProposal).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Categoría")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Préstamo o deuda")).not.toBeInTheDocument();
  });
  it("retains edited strings, false and the form after a rejected PATCH then saves a new exact revision", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(serverError(422, "Synthetic invalid state")).mockResolvedValue({ ...proposal, revision: 2, hash: "b".repeat(64) });
    open(); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const amount = screen.getByRole("textbox", { name: /^Monto/ });
    await user.clear(amount); await user.type(amount, "9007199254740993");
    await user.click(screen.getByRole("switch", { name: "Activo" }));
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await screen.findByText("Synthetic invalid state");
    expect(amount).toHaveValue("9007199254740993");
    expect(screen.getByRole("switch", { name: "Activo" })).not.toBeChecked();
    expect(screen.getByRole("heading", { name: "Corregir campos registrados" })).toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledWith(proposal.proposal_id, { expected_proposal_revision: 1, expected_hash: proposal.hash,
      edits: [{ step_id: stepId, field_key: "amount", value: "9007199254740993" }, { step_id: stepId, field_key: "is_active", value: false }] });
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ revision: 2, hash: "b".repeat(64) })));
    expect(mocks.challengeNodiaAiProposal).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledTimes(1);
  });
  it.each(["", "0", "-1", "1.5", "9223372036854775808"])("blocks invalid integer amount %s without coercion or a request", async value => {
    open(); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const amount = screen.getByRole("textbox", { name: /^Monto/ }); await user.clear(amount); if (value) await user.type(amount, value);
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(await screen.findByText(/Revisa este valor/)).toBeInTheDocument();
    expect(mocks.updateNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("deduplicates clicks, binds the exact revision/hash and keeps the token outside query and mutation caches", async () => {
    let resolve: (value: typeof execution) => void = () => {};
    mocks.confirmNodiaAiProposal.mockReturnValue(new Promise<typeof execution>(done => { resolve = done; }));
    open(available); const button = screen.getByRole("button", { name: "Confirmar revisión 1" });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(mocks.confirmNodiaAiProposal).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    expect(mocks.challengeNodiaAiProposal).toHaveBeenCalledWith(proposal);
    expect(mocks.confirmNodiaAiProposal).toHaveBeenCalledWith(proposal.proposal_id, expect.objectContaining({ proposal_revision: 1, expected_hash: proposal.hash, confirmation_token: challenge.confirmation_token }));
    expect(JSON.stringify(client.getQueryCache().getAll().map(query => query.state.data))).not.toContain(challenge.confirmation_token);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    resolve(execution);
    expect(await screen.findByText("Estado de la operación: En cola")).toBeInTheDocument();
    expect(mocks.success).toHaveBeenCalledWith({ title: "Confirmación admitida. La operación todavía no ha terminado." });
  });
  it("recovers a lost response by checking the current proposal and reusing exactly the original confirmation on explicit intent", async () => {
    mocks.confirmNodiaAiProposal.mockRejectedValueOnce(new Error("Synthetic connection lost")).mockResolvedValue(execution);
    open(available); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Confirmar revisión 1" }));
    await screen.findByText(/No sabemos si se admitió/);
    expect(mocks.confirmNodiaAiProposal).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Recuperar estado" }));
    const replay = await screen.findByRole("button", { name: "Reintentar la misma confirmación" });
    expect(mocks.confirmNodiaAiProposal).toHaveBeenCalledTimes(1);
    await user.click(replay);
    await waitFor(() => expect(mocks.confirmNodiaAiProposal).toHaveBeenCalledTimes(2));
    expect(mocks.confirmNodiaAiProposal.mock.calls[0]).toEqual(mocks.confirmNodiaAiProposal.mock.calls[1]);
    expect(mocks.challengeNodiaAiProposal).toHaveBeenCalledTimes(1);
  });
  it("recovers an already accepted operation without any new POST", async () => {
    mocks.confirmNodiaAiProposal.mockRejectedValueOnce(new Error("Synthetic lost response"));
    mocks.getNodiaAiCurrentProposal.mockResolvedValue({ ...proposal, state: "confirmed", execution_id: execution.execution_id });
    open(available); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Confirmar revisión 1" }));
    await user.click(await screen.findByRole("button", { name: "Recuperar estado" }));
    await screen.findByText("Estado de la operación: En cola");
    expect(mocks.getNodiaAiExecution).toHaveBeenCalledWith(execution.execution_id);
    expect(mocks.confirmNodiaAiProposal).toHaveBeenCalledTimes(1);
  });
  it("keeps rejected exact previews for review without issuing a second automatic challenge", async () => {
    mocks.challengeNodiaAiProposal.mockRejectedValue(serverError(409, "Synthetic revision changed"));
    open(available); await userEvent.click(screen.getByRole("button", { name: "Confirmar revisión 1" }));
    await screen.findByText("Synthetic revision changed");
    expect(mocks.confirmNodiaAiProposal).not.toHaveBeenCalled();
    expect(mocks.challengeNodiaAiProposal).toHaveBeenCalledTimes(1);
  });
  it("reconciles another device's 409 with reads and does not resubmit under a new identity", async () => {
    mocks.confirmNodiaAiProposal.mockRejectedValueOnce(serverError(409, "nodia_ai:proposal_already_confirmed"));
    mocks.getNodiaAiCurrentProposal.mockResolvedValue({ ...proposal, state: "confirmed", execution_id: execution.execution_id });
    open(available); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Confirmar revisión 1" }));
    await user.click(await screen.findByRole("button", { name: "Recuperar estado" }));
    await screen.findByText("Estado de la operación: En cola");
    expect(mocks.confirmNodiaAiProposal).toHaveBeenCalledTimes(1);
    expect(mocks.getNodiaAiExecution).toHaveBeenCalledWith(execution.execution_id);
  });
  it("preserves uncertain edits without another PATCH until explicit status recovery", async () => {
    mocks.updateNodiaAiProposal.mockRejectedValueOnce(new Error("Synthetic PATCH response lost"));
    mocks.getNodiaAiCurrentProposal.mockResolvedValue({ ...proposal, revision: 2, hash: "b".repeat(64) });
    open(); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const amount = screen.getByRole("textbox", { name: /^Monto/ }); await user.clear(amount); await user.type(amount, "30000");
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    await screen.findByText(/No sabemos si se guardó/);
    expect(amount).toHaveValue("30000");
    expect(screen.getByRole("button", { name: "Guardar nueva revisión" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Recuperar estado" }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 })));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledTimes(1);
  });
  it("ignores a late challenge after the human panel is unmounted", async () => {
    let resolve: (value: typeof challenge) => void = () => {};
    mocks.challengeNodiaAiProposal.mockReturnValue(new Promise<typeof challenge>(done => { resolve = done; }));
    const view = open(available);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar revisión 1" }));
    view.unmount(); resolve(challenge);
    await waitFor(() => expect(mocks.challengeNodiaAiProposal).toHaveBeenCalledTimes(1));
    expect(mocks.confirmNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("never sends a locally expired challenge for confirmation", async () => {
    mocks.challengeNodiaAiProposal.mockResolvedValue({ ...challenge, expires_at: "2000-01-01T00:00:00Z" });
    open(available); await userEvent.click(screen.getByRole("button", { name: "Confirmar revisión 1" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    expect(mocks.confirmNodiaAiProposal).not.toHaveBeenCalled();
  });
  it("keeps edits attached to registered field identities when metadata order changes", async () => {
    mocks.updateNodiaAiProposal.mockResolvedValue({ ...proposal, revision: 2, hash: "b".repeat(64) });
    const view = open(); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const amount = screen.getByRole("textbox", { name: /^Monto/ }); await user.clear(amount); await user.type(amount, "40000");
    view.rerender(<QueryClientProvider client={client}><HumanProposalReview conversationId={chatId} proposal={proposal} metadata={{ ...review, editable_fields: [...review.editable_fields].reverse() }} onRevision={changed} disabled={false} /></QueryClientProvider>);
    expect(screen.getByRole("textbox", { name: /^Monto/ })).toHaveValue("40000");
    expect(screen.getByRole("textbox", { name: /^Nombre/ })).toHaveValue("Synthetic dinner");
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledWith(proposal.proposal_id, { expected_proposal_revision: 1, expected_hash: proposal.hash, edits: [{ step_id: stepId, field_key: "amount", value: "40000" }] });
  });
  it("uses Unicode code points for the backend text limit without truncating or normalizing submitted content", async () => {
    mocks.updateNodiaAiProposal.mockResolvedValue({ ...proposal, revision: 2, hash: "b".repeat(64) });
    open(); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    const value = "🍽".repeat(255);
    fireEvent.change(screen.getByRole("textbox", { name: /^Nombre/ }), { target: { value } });
    await user.click(screen.getByRole("button", { name: "Guardar nueva revisión" }));
    expect(mocks.updateNodiaAiProposal).toHaveBeenCalledWith(proposal.proposal_id, { expected_proposal_revision: 1, expected_hash: proposal.hash, edits: [{ step_id: stepId, field_key: "name", value }] });
  });
  it("keeps the exact preview after nonce403, clears replay state and requests a new challenge only on another human click", async () => {
    const key = nodiaAiProposalKey(["9", 1], chatId, { proposal_id: proposal.proposal_id, revision: 1, hash: proposal.hash });
    client.setQueryData(key, proposal);
    mocks.confirmNodiaAiProposal.mockRejectedValueOnce(new Error("Synthetic lost response")).mockRejectedValueOnce(protocolError(403, "nodia_ai:confirmation_invalid")).mockResolvedValue(execution);
    open(available); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Confirmar revisión 1" }));
    await user.click(await screen.findByRole("button", { name: "Recuperar estado" }));
    await user.click(await screen.findByRole("button", { name: "Reintentar la misma confirmación" }));
    await screen.findByText(/La verificación de confirmación ya no es válida/);
    expect(client.getQueryData(key)).toEqual(proposal);
    expect(screen.queryByRole("button", { name: "Reintentar la misma confirmación" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar revisión 1" })).toBeEnabled();
    expect(mocks.challengeNodiaAiProposal).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Corregir propuesta" }));
    expect(screen.getByRole("textbox", { name: /^Monto/ })).toHaveValue("20000");
    await user.click(screen.getByRole("button", { name: "Cerrar editor" }));
    await user.click(screen.getByRole("button", { name: "Confirmar revisión 1" }));
    await screen.findByText("Estado de la operación: En cola");
    expect(mocks.challengeNodiaAiProposal).toHaveBeenCalledTimes(2);
  });
  it("preserves the preview and requires another review after a typed precondition conflict without replaying", async () => {
    const key = nodiaAiProposalKey(["9", 1], chatId, { proposal_id: proposal.proposal_id, revision: 1, hash: proposal.hash });
    client.setQueryData(key, proposal);
    mocks.confirmNodiaAiProposal.mockRejectedValueOnce(protocolError(409, "nodia_ai:preconditions_changed"));
    open(available); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Confirmar revisión 1" }));
    await screen.findByText(/Los datos de la operación cambiaron/);
    expect(client.getQueryData(key)).toEqual(proposal);
    expect(screen.getByRole("button", { name: "Confirmar revisión 1" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Recuperar estado" }));
    await waitFor(() => expect(mocks.getNodiaAiCurrentProposal).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Reintentar la misma confirmación" })).not.toBeInTheDocument();
    expect(mocks.confirmNodiaAiProposal).toHaveBeenCalledTimes(1);
  });
});

