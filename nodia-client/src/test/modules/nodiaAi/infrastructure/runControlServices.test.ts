import { beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../config/api";
import { cancelNodiaAiRun } from "../../../../modules/nodiaAi/infrastructure/runControlServices";
import { chatId, run } from "./fixtures";

vi.mock("../../../../config/api", () => ({ mainInstance: { post: vi.fn() } }));
const request = { client_request_id: "88888888-8888-4888-8888-888888888888" };
const accepted = { status: "accepted", run: { ...run, state: "cancel_requested", revision: 2 } };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(mainInstance.post).mockResolvedValue({ data: accepted }); });
describe("human run cancellation transport", () => {
  it("posts only the UUID request body to the exact run using the current shared Axios session", async () => {
    const result = await cancelNodiaAiRun(run.run_id, chatId, request, new AbortController().signal);
    expect(result).toEqual(accepted);
    expect(mainInstance.post).toHaveBeenCalledWith(`/nodia-ai/runs/${run.run_id}/cancel`, request, { signal: expect.any(AbortSignal) });
  });
  it("rejects invalid/non-v4 identities and extra input before HTTP", async () => {
    for (const [runId, conversationId, body] of [
      ["https://example.invalid/run", chatId, request],
      [run.run_id, "11111111-1111-1111-8111-111111111111", request],
      [run.run_id, chatId, { ...request, expected_revision: 1 }],
      [run.run_id, chatId, { client_request_id: "88888888-8888-1888-8888-888888888888" }],
    ] as const) await expect(cancelNodiaAiRun(runId, conversationId, body as typeof request, new AbortController().signal)).rejects.toThrow();
    expect(mainInstance.post).not.toHaveBeenCalled();
  });
  it("rejects mismatched run/chat and inconsistent or expanded success responses", async () => {
    for (const data of [
      { ...accepted, run: { ...accepted.run, run_id: "99999999-9999-4999-8999-999999999999" } },
      { ...accepted, run: { ...accepted.run, conversation_id: "99999999-9999-4999-8999-999999999999" } },
      { ...accepted, run: { ...accepted.run, state: "running" } },
      { ...accepted, status: "already_terminal" },
      { ...accepted, provider_pid: 1 },
    ]) {
      vi.mocked(mainInstance.post).mockResolvedValueOnce({ data });
      await expect(cancelNodiaAiRun(run.run_id, chatId, request, new AbortController().signal)).rejects.toThrow();
    }
  });
  it("preserves an already-terminal race including unknown without claiming cancelled", async () => {
    vi.mocked(mainInstance.post).mockResolvedValueOnce({ data: { status: "already_terminal", run: { ...run, state: "unknown" } } });
    expect((await cancelNodiaAiRun(run.run_id, chatId, request, new AbortController().signal)).run.state).toBe("unknown");
  });
  it("does not dispatch an aborted request or accept a late response after abort", async () => {
    const initial = new AbortController(); initial.abort();
    await expect(cancelNodiaAiRun(run.run_id, chatId, request, initial.signal)).rejects.toThrow();
    expect(mainInstance.post).not.toHaveBeenCalled();
    const late = new AbortController();
    vi.mocked(mainInstance.post).mockImplementationOnce(async () => { late.abort(); return { data: accepted }; });
    await expect(cancelNodiaAiRun(run.run_id, chatId, request, late.signal)).rejects.toThrow();
  });
});
