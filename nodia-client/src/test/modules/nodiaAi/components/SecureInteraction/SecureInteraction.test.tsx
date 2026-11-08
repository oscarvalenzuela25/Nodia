import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SecureInteraction from "../../../../../modules/nodiaAi/components/SecureInteraction";
import useAuthStore from "../../../../../store/authStore";
import i18n from "../../../../../translate";
import { secureFlowFixture } from "../../infrastructure/secureFlowFixtures";
import { execution } from "../../infrastructure/proposalFixtures";
import { chatId } from "../../infrastructure/fixtures";
const mocks = vi.hoisted(() => ({ getNodiaAiSecureFlow: vi.fn(), actNodiaAiSecureFlow: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/secureFlow", async original => ({ ...await original<object>(), ...mocks }));
vi.mock("sileo", () => ({ sileo: { success: mocks.success, error: mocks.error } }));
let client: QueryClient;
beforeEach(async () => {
  vi.clearAllMocks(); await i18n.changeLanguage("es");
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ user: { id: "9", name: "Synthetic" }, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false });
  mocks.getNodiaAiSecureFlow.mockResolvedValue(secureFlowFixture);
  mocks.actNodiaAiSecureFlow.mockResolvedValue({ flow: { ...secureFlowFixture.flow, status: "completed", revision: 4 } });
});
afterEach(() => { client.clear(); useAuthStore.setState({ token: null, user: null, sessionStatus: "anonymous" }); });
const open = (disabled = false) => render(<QueryClientProvider client={client}><SecureInteraction conversationId={chatId} executionId={execution.execution_id} disabled={disabled} /></QueryClientProvider>);
const enter = async () => { await userEvent.click(screen.getByRole("button", { name: "Abrir canal seguro" })); return screen.findByLabelText("API key", { exact: false }); };
describe("NodiaAI human secure channel", () => {
  it("applies confirmed key metadata without requiring or sending a replacement secret", async () => {
    const flow = { ...secureFlowFixture.flow, kind: "api_key_update", key_id: "9007199254740994" };
    mocks.getNodiaAiSecureFlow.mockResolvedValue({ flow });
    mocks.actNodiaAiSecureFlow.mockResolvedValue({ flow: { ...flow, status: "completed", revision: 4 } });
    open(); const input = await enter();
    expect(input).not.toBeRequired(); expect(screen.getByText(/Opcional: deja vacío para conservar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios de credencial" }));
    expect(mocks.actNodiaAiSecureFlow).toHaveBeenCalledExactlyOnceWith(execution.execution_id, flow, "key", expect.any(String), {});
    await screen.findByText(/Flujo completado/);
  });
  it("requires an actual secret to create a key", async () => {
    open(); await enter();
    await userEvent.click(screen.getByRole("button", { name: "Guardar credencial" }));
    await screen.findByText("Completa este campo para continuar.");
    expect(mocks.actNodiaAiSecureFlow).not.toHaveBeenCalled();
  });
  it("preserves a metadata-only form when the backend rejects a no-content update", async () => {
    const flow = { ...secureFlowFixture.flow, kind: "api_key_update", key_id: "9007199254740994" };
    const config = { headers: new AxiosHeaders() };
    mocks.getNodiaAiSecureFlow.mockResolvedValue({ flow });
    mocks.actNodiaAiSecureFlow.mockRejectedValue(new AxiosError("No content", "ERR_BAD_REQUEST", config, undefined, { config, status: 422, statusText: "Invalid", headers: {}, data: { message: "No changes provided" } }));
    open(); const input = await enter();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios de credencial" }));
    await screen.findByText(/El formulario conserva/); expect(input).toHaveValue(""); expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ description: "No changes provided" }));
  });
  it("loads only on human intent and never caches a credential or human descriptor", async () => {
    open(); expect(mocks.getNodiaAiSecureFlow).not.toHaveBeenCalled();
    const input = await enter();
    expect(screen.getByText("Conexión: 9007199254740993")).toBeInTheDocument();
    await userEvent.type(input, "synthetic-secret");
    await userEvent.click(screen.getByRole("button", { name: "Guardar credencial" }));
    expect(mocks.actNodiaAiSecureFlow).toHaveBeenCalledExactlyOnceWith(execution.execution_id, secureFlowFixture.flow, "key", expect.any(String), { secret: "synthetic-secret" });
    await screen.findByText(/Flujo completado/);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(JSON.stringify(client.getQueryCache().getAll())).not.toContain("synthetic-secret");
    expect(screen.queryByLabelText("API key", { exact: false })).not.toBeInTheDocument();
  });
  it("preserves the modal and password after a rejected save and allows an explicit retry", async () => {
    const config = { headers: new AxiosHeaders() };
    mocks.actNodiaAiSecureFlow.mockRejectedValueOnce(new AxiosError("Invalid", "ERR_BAD_REQUEST", config, undefined, { config, status: 422, statusText: "Invalid", headers: {}, data: { message: "Synthetic validation failure" } }));
    open(); const input = await enter(); await userEvent.type(input, "retry-value");
    await userEvent.click(screen.getByRole("button", { name: "Guardar credencial" }));
    await screen.findByText(/El formulario conserva/);
    expect(input).toHaveValue("retry-value"); expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ description: "Synthetic validation failure" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar credencial" }));
    await screen.findByText(/Flujo completado/); expect(mocks.actNodiaAiSecureFlow).toHaveBeenCalledTimes(2);
  });
  it("keeps an uncertain secret and blocks retransmission until observation", async () => {
    mocks.actNodiaAiSecureFlow.mockRejectedValueOnce(new Error("Network unavailable"));
    open(); const input = await enter(); await userEvent.type(input, "uncertain-value");
    await userEvent.click(screen.getByRole("button", { name: "Guardar credencial" }));
    await screen.findByText(/El resultado es incierto/);
    expect(input).toHaveValue("uncertain-value"); expect(screen.getByRole("button", { name: "Guardar credencial" })).toBeDisabled();
    expect(mocks.actNodiaAiSecureFlow).toHaveBeenCalledTimes(1);
    mocks.getNodiaAiSecureFlow.mockResolvedValue({ flow: { ...secureFlowFixture.flow, status: "unknown", revision: 4 } });
    await userEvent.click(screen.getByRole("button", { name: "Recuperar estado del flujo" }));
    expect(screen.getByRole("button", { name: "Guardar credencial" })).toBeDisabled();
  });
  it("blocks double submit while saving and clears private values only on explicit close or success", async () => {
    let finish!: (value: unknown) => void;
    mocks.actNodiaAiSecureFlow.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    open(); const input = await enter(); await userEvent.type(input, "in-flight-value");
    await userEvent.dblClick(screen.getByRole("button", { name: "Guardar credencial" }));
    expect(mocks.actNodiaAiSecureFlow).toHaveBeenCalledTimes(1); expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cerrar formulario" })).toBeDisabled();
    finish({ flow: { ...secureFlowFixture.flow, status: "completed", revision: 4 } });
    await screen.findByText(/Flujo completado/);
  });
  it.each(["completed", "cancelled", "expired"])("never shows the password form for %s", async status => {
    mocks.getNodiaAiSecureFlow.mockResolvedValue({ flow: { ...secureFlowFixture.flow, status } });
    open(); await userEvent.click(screen.getByRole("button", { name: "Abrir canal seguro" }));
    await screen.findByText("Conexión: 9007199254740993");
    expect(screen.queryByLabelText("API key", { exact: false })).not.toBeInTheDocument();
  });
  it.each([
    ["api_key_delete", "Eliminar credencial confirmada", "delete"], ["sync_models", "Sincronizar modelos del modo confirmado", "sync"],
    ["codex_logout", "Cerrar sesión del proveedor", "logout"],
  ])("requires human intent for %s without logging out the Nodia actor", async (kind, name, action) => {
    const flow = { ...secureFlowFixture.flow, kind };
    mocks.getNodiaAiSecureFlow.mockResolvedValue({ flow });
    mocks.actNodiaAiSecureFlow.mockResolvedValue({ flow: { ...flow, status: "completed", revision: 4 } });
    open(); await userEvent.click(screen.getByRole("button", { name: "Abrir canal seguro" }));
    const button = await screen.findByRole("button", { name }); expect(mocks.actNodiaAiSecureFlow).not.toHaveBeenCalled();
    await userEvent.click(button);
    expect(mocks.actNodiaAiSecureFlow).toHaveBeenCalledWith(execution.execution_id, flow, action, expect.any(String), undefined);
    await screen.findByText(/Flujo completado/); expect(useAuthStore.getState().token).toBe("synthetic-only");
  });
  it("shows a load error with recovery while no credential form is mounted", async () => {
    mocks.getNodiaAiSecureFlow.mockRejectedValue(new Error("offline"));
    open(); await userEvent.click(screen.getByRole("button", { name: "Abrir canal seguro" }));
    await screen.findByText(/El formulario conserva/); expect(screen.queryByLabelText("API key", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recuperar estado del flujo" })).toBeEnabled();
  });
  it("recovers a pending login after reopening without offering a second start", async () => {
    mocks.getNodiaAiSecureFlow.mockResolvedValue({ flow: { ...secureFlowFixture.flow, kind: "connection_login", mode: "agentic", status: "pending" } });
    open(); await userEvent.click(screen.getByRole("button", { name: "Abrir canal seguro" }));
    expect(await screen.findByRole("button", { name: "Iniciar login" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Consultar login" })).toBeEnabled();
    expect(mocks.actNodiaAiSecureFlow).not.toHaveBeenCalled();
  });
  it("preserves a key on 403 but blocks stale authority until a fresh human read succeeds", async () => {
    const config = { headers: new AxiosHeaders() };
    mocks.actNodiaAiSecureFlow.mockRejectedValue(new AxiosError("Forbidden", "ERR_BAD_REQUEST", config, undefined, { config, status: 403, statusText: "Forbidden", headers: {}, data: { message: "Access revoked" } }));
    open(); const input = await enter(); await userEvent.type(input, "preserved-private-value");
    await userEvent.click(screen.getByRole("button", { name: "Guardar credencial" }));
    await screen.findByText(/El acceso o la vigencia del flujo cambió/);
    expect(input).toHaveValue("preserved-private-value"); expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar credencial" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Recuperar estado del flujo" })).toBeEnabled();
  });
  it("opens only the official Gemini authorization and keeps a rejected code outside caches", async () => {
    const flow = { ...secureFlowFixture.flow, kind: "connection_login", mode: "agentic" };
    const authorization_url = "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fantigravity.google%2Foauth-callback&response_type=code&code_challenge_method=S256&client_id=synthetic&state=synthetic&code_challenge=synthetic&scope=synthetic";
    mocks.getNodiaAiSecureFlow.mockResolvedValue({ flow });
    mocks.actNodiaAiSecureFlow.mockResolvedValueOnce({ flow: { ...flow, status: "pending", revision: 4 }, interaction: { kind: "gemini_agentic", data: { id: "a".repeat(32), state: "waiting_code", authorization_url, reason: null } } });
    open(); await userEvent.click(screen.getByRole("button", { name: "Abrir canal seguro" }));
    await userEvent.click(await screen.findByRole("button", { name: "Iniciar login" }));
    expect(await screen.findByRole("link", { name: "Abrir autorización oficial" })).toHaveAttribute("href", authorization_url);
    const input = screen.getByLabelText("Código de autorización", { exact: false }); await userEvent.type(input, "synthetic-code");
    mocks.actNodiaAiSecureFlow.mockRejectedValueOnce(new Error("offline"));
    await userEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByText(/El resultado es incierto/); expect(input).toHaveValue("synthetic-code");
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(mocks.actNodiaAiSecureFlow).toHaveBeenLastCalledWith(execution.execution_id, expect.objectContaining({ revision: 4 }), "code", expect.any(String), { code: "synthetic-code" });
  });
  it("shows a Codex device code only in the human modal and clears it after observed completion", async () => {
    const flow = { ...secureFlowFixture.flow, kind: "connection_login", provider_key: "openai", mode: "agentic" };
    mocks.getNodiaAiSecureFlow.mockResolvedValue({ flow });
    mocks.actNodiaAiSecureFlow.mockResolvedValueOnce({ flow: { ...flow, status: "pending", revision: 4 }, interaction: { kind: "codex", data: { id: chatId, state: "waiting_authorization", verificationUrl: "https://auth.openai.com/codex/device", userCode: "SYNTH-123", reason: null } } });
    open(); await userEvent.click(screen.getByRole("button", { name: "Abrir canal seguro" }));
    await userEvent.click(await screen.findByRole("button", { name: "Iniciar login" }));
    expect(await screen.findByText("Código de dispositivo: SYNTH-123")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir autorización oficial" })).toHaveAttribute("href", "https://auth.openai.com/codex/device");
    mocks.actNodiaAiSecureFlow.mockResolvedValueOnce({ flow: { ...flow, status: "completed", revision: 5 } });
    await userEvent.click(screen.getByRole("button", { name: "Consultar login" }));
    await screen.findByText(/Flujo completado/); expect(screen.queryByText(/SYNTH-123/)).not.toBeInTheDocument();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });
  it("clears only the current Nodia session after its logout effect completes", async () => {
    const flow = { ...secureFlowFixture.flow, kind: "nodia_logout", provider_id: null, provider_key: null, mode: null };
    mocks.getNodiaAiSecureFlow.mockResolvedValue({ flow });
    mocks.actNodiaAiSecureFlow.mockResolvedValueOnce({ flow: { ...flow, status: "completed", revision: 4 } });
    open(); await userEvent.click(screen.getByRole("button", { name: "Abrir canal seguro" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cerrar mi sesión de Nodia" }));
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
  });
  it("ignores a descriptor returned after the authenticated session changes", async () => {
    let finish!: (value: unknown) => void;
    mocks.getNodiaAiSecureFlow.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    open(); await userEvent.click(screen.getByRole("button", { name: "Abrir canal seguro" }));
    useAuthStore.setState({ user: { id: "10", name: "Other" }, sessionVersion: 2 });
    finish(secureFlowFixture);
    await waitFor(() => expect(screen.queryByLabelText("API key", { exact: false })).not.toBeInTheDocument());
  });
});
