import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../../store/authStore";
import RunCancellation from "../../../../../modules/nodiaAi/components/RunCancellation";
import { cancelNodiaAiRun } from "../../../../../modules/nodiaAi/infrastructure/runControlServices";
import { chatId, run } from "../../infrastructure/fixtures";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/runControlServices", () => ({ cancelNodiaAiRun: vi.fn() }));
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks(); client = new QueryClient();
  useAuthStore.setState({ user: { id: "9", name: "Synthetic owner" }, token: "synthetic", sessionStatus: "authenticated", sessionVersion: 1, expiresAt: Date.now() + 600000, isRefreshing: false });
});
afterEach(() => { client.clear(); useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" }); });
describe("stop response control", () => {
  it("shows a waiting disabled action for cancel_requested and no Stop for non-generating states", () => {
    const view = render(<QueryClientProvider client={client}><RunCancellation conversationId={chatId} run={{ ...run, state: "queued" }} authorized readOnly={false} /></QueryClientProvider>);
    expect(screen.getByRole("button", { name: "Detener respuesta" })).toBeEnabled();
    view.rerender(<QueryClientProvider client={client}><RunCancellation conversationId={chatId} run={{ ...run, state: "cancel_requested" }} authorized readOnly={false} /></QueryClientProvider>);
    expect(screen.getByRole("button", { name: "Solicitud de detención enviada" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Esperando que termine el cierre");
    for (const state of ["waiting_for_user", "unknown", "completed", "failed", "cancelled"] as const) {
      view.rerender(<QueryClientProvider client={client}><RunCancellation conversationId={chatId} run={{ ...run, state }} authorized readOnly={false} /></QueryClientProvider>);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    }
    expect(cancelNodiaAiRun).not.toHaveBeenCalled();
  });
  it("shows a local check-state action after uncertainty, with no automatic resend", async () => {
    vi.mocked(cancelNodiaAiRun).mockRejectedValueOnce(new Error("Synthetic uncertainty"));
    render(<QueryClientProvider client={client}><RunCancellation conversationId={chatId} run={{ ...run, state: "running" }} authorized readOnly={false} /></QueryClientProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Detener respuesta" }));
    expect(await screen.findByRole("button", { name: "Comprobar estado del turno" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Detener respuesta" })).not.toBeInTheDocument();
    expect(cancelNodiaAiRun).toHaveBeenCalledOnce();
  });
  it("keeps Stop disabled when only cached authority exists and removes it for read-only views", () => {
    const view = render(<QueryClientProvider client={client}><RunCancellation conversationId={chatId} run={{ ...run, state: "running" }} authorized={false} readOnly={false} /></QueryClientProvider>);
    expect(screen.getByRole("button", { name: "Detener respuesta" })).toBeDisabled();
    act(() => useAuthStore.setState({ sessionStatus: "anonymous" }));
    view.rerender(<QueryClientProvider client={client}><RunCancellation conversationId={chatId} run={{ ...run, state: "running" }} authorized readOnly /></QueryClientProvider>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
