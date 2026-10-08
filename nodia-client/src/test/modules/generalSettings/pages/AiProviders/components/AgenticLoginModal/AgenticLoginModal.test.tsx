import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sileo } from "sileo";
import AgenticLoginModal from "../../../../../../../modules/generalSettings/pages/AiProviders/components/AgenticLoginModal";
import * as services from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";
import { currentGeminiAgenticLoginSchema, geminiAgenticLoginSchema } from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/agenticLogin";

vi.mock("../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services", () => ({
  startGeminiAgenticLogin: vi.fn(), getCurrentGeminiAgenticLogin: vi.fn(), getGeminiAgenticLoginStatus: vi.fn(),
  submitGeminiAgenticCode: vi.fn(), cancelGeminiAgenticLogin: vi.fn(),
}));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const id = "ab".repeat(16);
const url = "https://accounts.google.com/o/oauth2/auth?" + new URLSearchParams({
  client_id: "synthetic-client", state: "synthetic-state", response_type: "code", code_challenge_method: "S256",
  redirect_uri: "https://antigravity.google/oauth-callback", scope: "openid", code_challenge: "synthetic",
});
const waiting = { id, state: "waiting_code" as const, authorization_url: url, reason: null };
const verifying = { id, state: "verifying" as const, authorization_url: null, reason: null };
const succeeded = { id, state: "succeeded" as const, authorization_url: null, reason: null };
const cancelled = { id, state: "cancelled" as const, authorization_url: null, reason: null };
const failed = { id, state: "failed" as const, authorization_url: null, reason: "agentic_login_timeout" as const };

const renderModal = () => {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AgenticLoginModal onClose={onClose} /></QueryClientProvider>);
  return { onClose, client, user: userEvent.setup() };
};

describe("AgenticLoginModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(services.getCurrentGeminiAgenticLogin).mockResolvedValue(null);
    vi.mocked(services.startGeminiAgenticLogin).mockResolvedValue(waiting);
    vi.mocked(services.getGeminiAgenticLoginStatus).mockResolvedValue(waiting);
    vi.mocked(services.submitGeminiAgenticCode).mockResolvedValue(verifying);
    vi.mocked(services.cancelGeminiAgenticLogin).mockResolvedValue(cancelled);
  });

  it("offers a remote production login link and submits a code without closing prematurely", async () => {
    const { user, onClose, client } = renderModal();
    expect(screen.getByText(/compartida por las conexiones Gemini/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Conectar cuenta Google" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Conectar cuenta Google" }));
    expect(await screen.findByRole("link", { name: "Abrir inicio de sesión Google" })).toHaveAttribute("href", url);
    await waitFor(() => expect(screen.getByLabelText(/Código de autorización/)).toBeEnabled());
    await user.type(screen.getByLabelText(/Código de autorización/), "4/synthetic-code");
    await user.click(screen.getByRole("button", { name: "Validar código" }));
    expect(services.submitGeminiAgenticCode).toHaveBeenCalledWith({ id, code: "4/synthetic-code" }, expect.anything());
    expect(onClose).not.toHaveBeenCalled();
    expect(sileo.success).toHaveBeenCalledWith(expect.objectContaining({ title: "Código enviado para verificar la sesión" }));
    client.setQueryData(["gemini-agentic-login", id], succeeded);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(sileo.success).toHaveBeenCalledWith(expect.objectContaining({ title: "Sesión Gemini Agentic verificada" }));
  });

  it("resumes the same administrator's active job after reopening", async () => {
    vi.mocked(services.getCurrentGeminiAgenticLogin).mockResolvedValue(waiting);
    renderModal();
    expect(await screen.findByRole("link", { name: "Abrir inicio de sesión Google" })).toHaveAttribute("href", url);
    expect(services.startGeminiAgenticLogin).not.toHaveBeenCalled();
  });

  it("submits a pasted code with Enter, trims its edges and clears mutation variables after acceptance", async () => {
    vi.mocked(services.getCurrentGeminiAgenticLogin).mockResolvedValue(waiting);
    const { user, client } = renderModal();
    const input = await screen.findByLabelText(/Código de autorización/);
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, "  4/synthetic-code  ");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(services.submitGeminiAgenticCode).toHaveBeenCalledWith(
      { id, code: "4/synthetic-code" }, expect.anything(),
    ));
    await waitFor(() => expect(client.getMutationCache().getAll().some(
      (mutation) => JSON.stringify(mutation.state.variables ?? null).includes("4/synthetic-code"),
    )).toBe(false));
  });

  it("keeps the modal and pasted code after a rejected submission", async () => {
    vi.mocked(services.getCurrentGeminiAgenticLogin).mockResolvedValue(waiting);
    vi.mocked(services.submitGeminiAgenticCode).mockRejectedValue(new Error("synthetic failure"));
    const { user, onClose } = renderModal();
    const input = await screen.findByLabelText(/Código de autorización/);
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, "4/synthetic-code");
    await user.click(screen.getByRole("button", { name: "Validar código" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalled());
    expect(input).toHaveValue("4/synthetic-code");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not close when cancellation fails and allows retry", async () => {
    vi.mocked(services.getCurrentGeminiAgenticLogin).mockResolvedValue(waiting);
    vi.mocked(services.cancelGeminiAgenticLogin).mockRejectedValueOnce(new Error("synthetic failure"));
    const { user, onClose } = renderModal();
    await screen.findByRole("link", { name: "Abrir inicio de sesión Google" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar autenticación" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Cancelar autenticación" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar autenticación" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("shows session lookup errors and permits recovery", async () => {
    vi.mocked(services.getCurrentGeminiAgenticLogin).mockRejectedValueOnce(new Error("service unavailable"));
    const { user } = renderModal();
    expect(await screen.findByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Conectar cuenta Google" })).toBeDisabled());
    await user.click(await screen.findByRole("button", { name: /Reintentar/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Conectar cuenta Google" })).toBeEnabled());
  });

  it("shows timeout without marking the session connected or losing the dialog", async () => {
    vi.mocked(services.getCurrentGeminiAgenticLogin).mockResolvedValue(waiting);
    vi.mocked(services.getGeminiAgenticLoginStatus).mockResolvedValue(failed);
    const { onClose } = renderModal();
    expect(await screen.findByText(/El intento de autenticación superó/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(sileo.error).toHaveBeenCalled();
  });

  it("keeps actions disabled during a mutation", async () => {
    let resolve!: (value: typeof waiting) => void;
    vi.mocked(services.startGeminiAgenticLogin).mockReturnValue(new Promise((done) => { resolve = done; }));
    const { user } = renderModal();
    await waitFor(() => expect(screen.getByRole("button", { name: "Conectar cuenta Google" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Conectar cuenta Google" }));
    expect(screen.getByRole("button", { name: "Conectar cuenta Google" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
    resolve(waiting);
    await screen.findByRole("link", { name: "Abrir inicio de sesión Google" });
  });

  it("rejects missing fields and unsafe provider authorization links", () => {
    for (const value of [{}, { ...waiting, authorization_url: "javascript:alert(1)" },
      { ...waiting, authorization_url: url.replace("accounts.google.com", "evil.test") },
      { ...waiting, authorization_url: url + "&access_token=synthetic-secret" },
      { ...waiting, authorization_url: url + "&state=duplicate" },
      { ...waiting, authorization_url: url.replace("code_challenge=synthetic", "code_challenge=") },
      { ...waiting, state: "succeeded" }]) {
      expect(geminiAgenticLoginSchema.safeParse(value).success).toBe(false);
    }
    expect(geminiAgenticLoginSchema.safeParse(waiting).success).toBe(true);
  });
  it('requires explicit JSON for an absent attempt instead of accepting an empty HTTP body', () => {
    expect(currentGeminiAgenticLoginSchema.parse({ job: null })).toEqual({ job: null });
    for (const value of [undefined, '', {}, null]) {
      expect(currentGeminiAgenticLoginSchema.safeParse(value).success).toBe(false);
    }
  });
});
