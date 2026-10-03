import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RemoteLoginModal from "../../../../../../../modules/generalSettings/pages/AiProviders/components/RemoteLoginModal/RemoteLoginModal";
import * as aiServices from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";

vi.mock(
  "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services",
  () => ({
    startGeminiLogin: vi.fn(),
    getGeminiLoginStatus: vi.fn(),
    cancelGeminiLogin: vi.fn(),
  })
);

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}));

const renderModal = (onClose = vi.fn(), onSuccess = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RemoteLoginModal open onClose={onClose} onSuccess={onSuccess} />
    </QueryClientProvider>
  );
  return { onClose, onSuccess, queryClient };
};

describe("RemoteLoginModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows cancelling a running login job once the start request has completed", async () => {
    const user = userEvent.setup();
    const job = { id: "a".repeat(32), state: "running" as const };
    vi.mocked(aiServices.startGeminiLogin).mockResolvedValue(job);
    vi.mocked(aiServices.getGeminiLoginStatus).mockResolvedValue(job);
    vi.mocked(aiServices.cancelGeminiLogin).mockResolvedValue({ ...job, state: "cancelled" });
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: /Iniciar navegador local/i }));
    await waitFor(() => expect(aiServices.startGeminiLogin).toHaveBeenCalledOnce());
    await waitFor(() => expect(aiServices.getGeminiLoginStatus).toHaveBeenCalledWith(job.id));
    
    const cancelButton = screen.getByRole("button", { name: /Cancelar login/i });
    await waitFor(() => expect(cancelButton).toBeEnabled());
    await user.click(cancelButton);
    await waitFor(() => expect(aiServices.cancelGeminiLogin).toHaveBeenCalledWith(job.id, expect.anything()));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the modal open if starting login fails", async () => {
    const user = userEvent.setup();
    vi.mocked(aiServices.startGeminiLogin).mockRejectedValue(new Error("offline"));
    const { onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: /Iniciar navegador local/i }));
    await waitFor(() => expect(aiServices.startGeminiLogin).toHaveBeenCalledOnce());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/Mantén abierto este panel/i)).toBeInTheDocument();
  });

  it("refreshes provider health and closes after a successful login", async () => {
    const user = userEvent.setup();
    const jobId = "b".repeat(32);
    vi.mocked(aiServices.startGeminiLogin).mockResolvedValue({
      id: jobId,
      state: "running",
    });
    vi.mocked(aiServices.getGeminiLoginStatus).mockResolvedValue({
      id: jobId,
      state: "succeeded",
    });
    const { onClose, onSuccess, queryClient } = renderModal();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(screen.getByRole("button", { name: /Iniciar navegador local/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ai-providers-health"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["gemini-engines"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ai-providers"] });
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("keeps a running job open when cancellation fails, allowing a retry", async () => {
    const user = userEvent.setup(), job = { id: "c".repeat(32), state: "running" as const };
    vi.mocked(aiServices.startGeminiLogin).mockResolvedValue(job);
    vi.mocked(aiServices.getGeminiLoginStatus).mockResolvedValue(job);
    vi.mocked(aiServices.cancelGeminiLogin).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ...job, state: "cancelled" });
    const { onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: /Iniciar navegador local/i }));
    const cancel = await screen.findByRole("button", { name: /Cancelar login/i });
    await waitFor(() => expect(cancel).toBeEnabled()); await user.click(cancel);
    await waitFor(() => expect(aiServices.cancelGeminiLogin).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(cancel).toBeEnabled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Iniciar navegador local/i })).toBeDisabled();
    await user.click(cancel); await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
