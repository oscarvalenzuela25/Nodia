import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import GeminiLoginViewer from "../../../../../../../modules/generalSettings/pages/AiProviders/components/GeminiLoginViewer";
import * as services from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";

vi.mock("../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services", () => ({
  getGeminiLoginFrame: vi.fn(), sendGeminiLoginInput: vi.fn(),
}));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const id = "a".repeat(32), frameId = "b".repeat(32);
const frame = { ready: true as const, frame_id: frameId, image: "/9j/2Q==", width: 1280 as const, height: 850 as const };
const showViewer = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(<QueryClientProvider client={client}><GeminiLoginViewer id={id} /></QueryClientProvider>);
  return { ...rendered, client };
};
const ready = async () => {
  const button = await screen.findByRole("button", { name: "Enviar texto" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Mostrar texto" })).toBeEnabled());
  return button;
};

describe("GeminiLoginViewer", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(services.getGeminiLoginFrame).mockResolvedValue(frame);
    vi.mocked(services.sendGeminiLoginInput).mockResolvedValue({ id, state: "running" });
  });

  it("sends masked text only to the current job, clears it on success and discards the mutation variables", async () => {
    const user = userEvent.setup(), { client } = showViewer(), send = await ready();
    const input = screen.getByLabelText("Texto para el campo seleccionado");
    expect(input).toHaveAttribute("type", "password");
    await user.type(input, "synthetic-only");
    await user.click(send);
    await waitFor(() => expect(services.sendGeminiLoginInput).toHaveBeenCalledWith({ id,
      input: { action: "text", text: "synthetic-only", frame_id: frameId } }, expect.anything()));
    await waitFor(() => expect(input).toHaveValue(""));
    expect(client.getMutationCache().getAll().some((mutation) => mutation.state.variables !== undefined)).toBe(false);
  });

  it("shows and hides the same draft with the eye and keeps only the text action", async () => {
    const user = userEvent.setup();
    showViewer(); await ready();
    const input = screen.getByLabelText("Texto para el campo seleccionado");
    await user.type(input, "texto visible de prueba");
    const eye = screen.getByRole("button", { name: "Mostrar texto" });
    await user.click(eye);
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("texto visible de prueba");
    expect(input).toHaveFocus();
    expect(screen.getByRole("button", { name: "Ocultar texto" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Ocultar texto" }));
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("texto visible de prueba");
    expect(input).toHaveAccessibleDescription(/Máximo 2048/);
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([
      "Pantalla interactiva de Gemini", "Mostrar texto", "Enviar texto",
    ]);
    expect(services.sendGeminiLoginInput).not.toHaveBeenCalled();
  });

  it("preserves the draft when input fails and never automatically repeats it", async () => {
    const user = userEvent.setup();
    vi.mocked(services.sendGeminiLoginInput).mockRejectedValueOnce(new Error("offline"));
    showViewer(); const send = await ready(), input = screen.getByLabelText("Texto para el campo seleccionado");
    await user.type(input, "review-me"); await user.click(send);
    await waitFor(() => expect(services.getGeminiLoginFrame).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(send).toBeEnabled());
    expect(input).toHaveValue("review-me");
    expect(services.sendGeminiLoginInput).toHaveBeenCalledOnce();
    await user.click(send);
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("scales screen clicks and offers keyboard input without exposing browser shortcuts", async () => {
    showViewer(); await ready();
    const screenButton = screen.getByRole("button", { name: "Pantalla interactiva de Gemini" });
    vi.spyOn(screenButton, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 640, height: 425 } as DOMRect);
    fireEvent.click(screenButton, { clientX: 320, clientY: 200, detail: 1 });
    await waitFor(() => expect(services.sendGeminiLoginInput).toHaveBeenCalledWith({ id,
      input: { action: "click", x: 640, y: 400, frame_id: frameId } }, expect.anything()));
    await waitFor(() => expect(screenButton).toBeEnabled());
    fireEvent.click(screenButton, { detail: 0 });
    await waitFor(() => expect(services.sendGeminiLoginInput).toHaveBeenLastCalledWith({ id,
      input: { action: "key", key: "Enter", frame_id: frameId } }, expect.anything()));
  });

  it("recovers screen reads every ten seconds with one toast per outage, without replaying inputs", async () => {
    vi.useFakeTimers();
    vi.mocked(services.getGeminiLoginFrame).mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("still offline")).mockResolvedValue(frame);
    const { client, unmount } = showViewer();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo actualizar la pantalla");
    expect(services.getGeminiLoginFrame).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(services.getGeminiLoginFrame).toHaveBeenCalledTimes(2);
    expect(sileo.error).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mostrar texto" })).toBeEnabled();
    expect(services.sendGeminiLoginInput).not.toHaveBeenCalled();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(client.getQueryData(["gemini-login-frame", id])).toBeUndefined();
  });
});
