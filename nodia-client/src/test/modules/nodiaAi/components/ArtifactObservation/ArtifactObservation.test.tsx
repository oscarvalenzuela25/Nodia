import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import useAuthStore from "../../../../../store/authStore";
import ArtifactObservation from "../../../../../modules/nodiaAi/components/ArtifactObservation";
import ExecutionObservation from "../../../../../modules/nodiaAi/components/ExecutionObservation";
import { downloadNodiaAiArtifact } from "../../../../../modules/nodiaAi/infrastructure/artifactServices";
import { chatId, run } from "../../infrastructure/fixtures";
import { toolEvent } from "../../infrastructure/observationFixtures";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/artifactServices", () => ({ downloadNodiaAiArtifact: vi.fn() }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/useObservation", () => ({
  useNodiaAiEvents: () => ({ data: { items: [{ ...toolEvent, payload: { ...toolEvent.payload, result_ref: resultRef } }] }, isFetching: false, isLoading: false, isError: false }),
  useNodiaAiObservation: () => { throw new Error("Artifact must not use the summary observation endpoint"); },
  useNodiaAiHistoricalRun: vi.fn(),
}));
const resultRef = { tool_call_id: "77777777-7777-4777-8777-777777777777", tool_name: "nodia_products_export_csv", contract_hash: "a".repeat(64) };
const file = { blob: new Blob(["synthetic CSV"]), filename: "products.csv", mime: "text/csv;charset=utf-8" };
let click: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: "9", name: "Synthetic owner" }, token: "synthetic", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:synthetic-private") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.mocked(downloadNodiaAiArtifact).mockResolvedValue(file);
});
afterEach(() => { vi.useRealTimers(); click.mockRestore(); useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" }); });
describe("artifact download by human intent", () => {
  it("routes the completed tool receipt to the download control only after showing its result", async () => {
    render(<ExecutionObservation conversationId={chatId} run={{ ...run, state: "completed" }} />);
    expect(screen.queryByRole("button", { name: "Descargar archivo privado" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver resultado de consulta" }));
    expect(screen.getByRole("button", { name: "Descargar archivo privado" })).toBeEnabled();
    expect(downloadNodiaAiArtifact).not.toHaveBeenCalled();
  });
  it("does no I/O or toast on mount and downloads only a server-named Blob after clicking", async () => {
    const view = render(<StrictMode><ArtifactObservation conversationId={chatId} resultRef={resultRef} /></StrictMode>);
    expect(downloadNodiaAiArtifact).not.toHaveBeenCalled();
    expect(sileo.success).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Descargar archivo privado" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(click.mock.instances[0]).toHaveAttribute("download", "products.csv");
    expect(click.mock.instances[0]).toHaveAttribute("href", "blob:synthetic-private");
    expect(sileo.success).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-private");
  });
  it("blocks duplicate clicks and retries a failed read locally without remounting or automatic replay", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(downloadNodiaAiArtifact).mockReturnValueOnce(new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    render(<ArtifactObservation conversationId={chatId} resultRef={resultRef} />);
    const button = screen.getByRole("button", { name: "Descargar archivo privado" });
    fireEvent.click(button); fireEvent.click(button);
    expect(downloadNodiaAiArtifact).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    await act(async () => reject(new Error("Synthetic failure")));
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos descargar");
    expect(sileo.error).toHaveBeenCalledOnce();
    expect(click).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar descarga" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(downloadNodiaAiArtifact).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("releases the completed download URL on its bounded timer without retaining it for unmount", async () => {
    vi.useFakeTimers();
    const view = render(<ArtifactObservation conversationId={chatId} resultRef={resultRef} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Descargar archivo privado" })));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it.each(["owner", "session", "inactive", "conversation", "reference", "unmount"] as const)("aborts and ignores a late response after %s changes", async change => {
    let resolve!: (value: typeof file) => void;
    vi.mocked(downloadNodiaAiArtifact).mockReturnValueOnce(new Promise(resolvePromise => { resolve = resolvePromise; }));
    const view = render(<ArtifactObservation conversationId={chatId} resultRef={resultRef} />);
    await userEvent.click(screen.getByRole("button", { name: "Descargar archivo privado" }));
    const signal = vi.mocked(downloadNodiaAiArtifact).mock.calls[0][1];
    if (change === "owner") act(() => useAuthStore.setState({ user: { id: "10", name: "Other synthetic owner" } }));
    if (change === "session") act(() => useAuthStore.setState({ sessionVersion: 2 }));
    if (change === "inactive") act(() => useAuthStore.setState({ sessionStatus: "unavailable" }));
    if (change === "conversation") view.rerender(<ArtifactObservation conversationId="88888888-8888-4888-8888-888888888888" resultRef={resultRef} />);
    if (change === "reference") view.rerender(<ArtifactObservation conversationId={chatId} resultRef={{ ...resultRef, tool_call_id: "88888888-8888-4888-8888-888888888888" }} />);
    if (change === "unmount") view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(file));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });
  it("does not expose a download for an arbitrary tool or a missing active session", () => {
    const view = render(<ArtifactObservation conversationId={chatId} resultRef={{ ...resultRef, tool_name: "nodia_users_list" }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    act(() => useAuthStore.setState({ sessionStatus: "anonymous" }));
    view.rerender(<ArtifactObservation conversationId={chatId} resultRef={resultRef} />);
    expect(screen.getByRole("button", { name: "Descargar archivo privado" })).toBeDisabled();
    expect(downloadNodiaAiArtifact).not.toHaveBeenCalled();
  });
});
