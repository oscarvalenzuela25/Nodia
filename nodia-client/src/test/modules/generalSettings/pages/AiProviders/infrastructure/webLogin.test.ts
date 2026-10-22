import { beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../../../config/api";
import { getGeminiLoginFrame, getGeminiLoginStatus, sendGeminiLoginInput, disconnectGeminiWeb } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services";

vi.mock("../../../../../../config/api", () => ({ mainInstance: { defaults: { baseURL: "/api/v1" }, get: vi.fn(), post: vi.fn() } }));
const id = "a".repeat(32);
const frame = { ready: true, frame_id: id, image: "/9j/2Q==", width: 1280, height: 850 };

describe("Gemini Web login transport", () => {
  beforeEach(() => vi.resetAllMocks());
  it("accepts only a confirmed logout response through the authenticated transport", async () => {
    for (const data of [{}, { status: "success" }, { status: "disconnected", cookies: "synthetic" }]) {
      vi.mocked(mainInstance.post).mockResolvedValue({ data });
      await expect(disconnectGeminiWeb()).rejects.toThrow();
    }
    vi.mocked(mainInstance.post).mockResolvedValue({ data: { status: "disconnected" } });
    await expect(disconnectGeminiWeb()).resolves.toEqual({ status: "disconnected" });
    expect(mainInstance.post).toHaveBeenLastCalledWith("/ai-providers/gemini-session/logout", undefined, { timeout: 20_000 });
  });
  it("accepts an explicit not-ready screen without inventing pixels", async () => {
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { ...frame, ready: false, frame_id: null, image: null } });
    await expect(getGeminiLoginFrame(id)).resolves.toMatchObject({ ready: false, image: null });
  });
  it("rejects corrupted, oversized or unexpected frame data", async () => {
    for (const data of [{ ...frame, image: 'not-jpeg' }, { ...frame, width: 640 },
      { ...frame, image: '/9j/' + 'a'.repeat(1_048_576) }, { ...frame, cookies: 'synthetic-secret' }]) {
      vi.mocked(mainInstance.get).mockResolvedValue({ data });
      await expect(getGeminiLoginFrame(id)).rejects.toThrow();
    }
  });
  it("forwards cancellation to the authenticated transport and rejects invalid job states", async () => {
    const signal = new AbortController().signal;
    vi.mocked(mainInstance.get).mockResolvedValue({ data: frame });
    await getGeminiLoginFrame(id, signal);
    expect(mainInstance.get).toHaveBeenCalledWith(`/ai-providers/gemini-login/${id}/frame`, { signal, timeout: 7000 });
    vi.mocked(mainInstance.get).mockResolvedValue({ data: { id, state: ['running'] } });
    await expect(getGeminiLoginStatus(id)).rejects.toThrow();
  });
  it("sends text only in the request body to the selected job", async () => {
    vi.mocked(mainInstance.post).mockResolvedValue({ data: { id, state: 'running' } });
    const input = { frame_id: id, action: 'text' as const, text: 'synthetic-text' };
    await sendGeminiLoginInput({ id, input });
    expect(mainInstance.post).toHaveBeenCalledWith(`/ai-providers/gemini-login/${id}/input`, input, { timeout: 7000 });
  });
});
