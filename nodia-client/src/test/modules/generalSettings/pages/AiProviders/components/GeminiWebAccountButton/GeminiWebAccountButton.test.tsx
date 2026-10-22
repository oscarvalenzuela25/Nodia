import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import GeminiWebAccountButton from "../../../../../../../modules/generalSettings/pages/AiProviders/components/GeminiWebAccountButton";
import { disconnectGeminiWeb } from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";

vi.mock("../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services", () => ({ disconnectGeminiWeb: vi.fn() }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const setup = (disabled = false) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onLogin = vi.fn();
  const result = render(<QueryClientProvider client={client}><GeminiWebAccountButton disabled={disabled} onLogin={onLogin} /></QueryClientProvider>);
  return { ...result, client, onLogin, user: userEvent.setup() };
};

describe("Gemini Web account change", () => {
  beforeEach(() => vi.resetAllMocks());
  it("requires confirmation and cancellation preserves the account", async () => {
    const { user, onLogin } = setup();
    await user.click(screen.getByRole("button", { name: "Cambiar cuenta" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("todas las conexiones Gemini Web");
    expect(disconnectGeminiWeb).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onLogin).not.toHaveBeenCalled();
  });
  it("invalidates health and models and opens login only after successful cleanup", async () => {
    vi.mocked(disconnectGeminiWeb).mockResolvedValue({ status: "disconnected" });
    const { user, onLogin, client } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await user.click(screen.getByRole("button", { name: "Cambiar cuenta" }));
    await user.click(screen.getByRole("button", { name: "Limpiar sesión y continuar" }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(disconnectGeminiWeb).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ai-providers-health"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ai-selectable-models"] });
    expect(sileo.success).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps confirmation open after server failure and permits retry", async () => {
    const error = new AxiosError("busy", "ERR_BAD_RESPONSE", undefined, undefined, {
      status: 409, statusText: "Conflict", headers: {}, config: { headers: new AxiosHeaders() },
      data: { message: "La sesión Web está ocupada." },
    });
    vi.mocked(disconnectGeminiWeb).mockRejectedValueOnce(error).mockResolvedValueOnce({ status: "disconnected" });
    const { user, onLogin } = setup();
    await user.click(screen.getByRole("button", { name: "Cambiar cuenta" }));
    await user.click(screen.getByRole("button", { name: "Limpiar sesión y continuar" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalledWith(expect.objectContaining({ description: "La sesión Web está ocupada." })));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Limpiar sesión y continuar" }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
  });
  it("blocks duplicate requests and discards login opening after leaving the context", async () => {
    let finish!: (data: { status: "disconnected" }) => void;
    vi.mocked(disconnectGeminiWeb).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user, onLogin, unmount } = setup();
    await user.click(screen.getByRole("button", { name: "Cambiar cuenta" }));
    await user.click(screen.getByRole("button", { name: "Limpiar sesión y continuar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Limpiar sesión y continuar" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    unmount();
    finish({ status: "disconnected" });
    await waitFor(() => expect(sileo.success).toHaveBeenCalled());
    expect(onLogin).not.toHaveBeenCalled();
  });
  it("blocks entry during another operation", () => {
    setup(true);
    expect(screen.getByRole("button", { name: "Cambiar cuenta" })).toBeDisabled();
  });
});
