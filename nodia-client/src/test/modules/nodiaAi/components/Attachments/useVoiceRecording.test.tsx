import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceRecording } from "../../../../../modules/nodiaAi/components/Attachments/hooks/useVoiceRecording";

const stopTrack = vi.fn();
const acquired = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
let recorders: FakeRecorder[];
class FakeRecorder {
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { recorders.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["synthetic audio"], { type: this.mimeType }) }); this.onstop?.(); }
}
beforeEach(() => { recorders = []; stopTrack.mockClear(); vi.stubGlobal("MediaRecorder", FakeRecorder); Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: vi.fn().mockResolvedValue(acquired) }, configurable: true }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("voice capture lifecycle", () => {
  it("does not request microphone until intent and stops every track on stop", async () => {
    const accepted = vi.fn();
    const { result } = renderHook(() => useVoiceRecording(accepted, vi.fn()));
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    await act(() => result.current.start());
    expect(result.current.state).toBe("recording");
    act(() => result.current.stop());
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(accepted).toHaveBeenCalledOnce();
    expect(accepted.mock.calls[0]?.[0]).toBeInstanceOf(File);
    expect(result.current.state).toBe("idle");
  });
  it("keeps errors actionable for permission denial without inventing a transcript", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException("Synthetic permission denied", "NotAllowedError"));
    const accepted = vi.fn(), error = vi.fn();
    const { result } = renderHook(() => useVoiceRecording(accepted, error));
    await act(() => result.current.start());
    expect(error).toHaveBeenCalledWith("microphone_denied");
    expect(accepted).not.toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });
  it("releases a late permission result after context disposal", async () => {
    let resolve!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(() => new Promise<MediaStream>(done => { resolve = done; }));
    const accepted = vi.fn();
    const { result, unmount } = renderHook(() => useVoiceRecording(accepted, vi.fn()));
    act(() => { void result.current.start(); });
    unmount();
    await act(async () => { resolve(acquired); });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(recorders).toHaveLength(0);
    expect(accepted).not.toHaveBeenCalled();
  });
  it("auto stops at five minutes and discards on unmount", async () => {
    vi.useFakeTimers();
    const accepted = vi.fn();
    const { result, unmount } = renderHook(() => useVoiceRecording(accepted, vi.fn()));
    await act(() => result.current.start());
    act(() => vi.advanceTimersByTime(300000));
    expect(result.current.state).toBe("idle");
    expect(accepted).toHaveBeenCalledOnce();
    await act(() => result.current.start());
    unmount();
    expect(stopTrack).toHaveBeenCalledTimes(2);
    expect(accepted).toHaveBeenCalledOnce();
  });
  it("reports unavailable APIs without calling getUserMedia", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    const { result } = renderHook(() => useVoiceRecording(vi.fn(), vi.fn()));
    expect(result.current.supported).toBe(false);
    await act(() => result.current.start());
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled());
  });
  it("stops capture immediately when permission to interact is revoked", async () => {
    const accepted = vi.fn();
    const { result, rerender } = renderHook(({ enabled }) => useVoiceRecording(accepted, vi.fn(), enabled), { initialProps: { enabled: true } });
    await act(() => result.current.start());
    rerender({ enabled: false });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("idle");
    expect(accepted).not.toHaveBeenCalled();
  });
  it("does not create duplicate permission prompts from concurrent start intent", async () => {
    let resolve!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(() => new Promise(done => { resolve = done; }));
    const { result } = renderHook(() => useVoiceRecording(vi.fn(), vi.fn()));
    let first!: Promise<void>;
    act(() => { first = result.current.start(); void result.current.start(); });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    await act(async () => { resolve(acquired); await first; });
    act(() => result.current.stop());
  });
  it("ignores an old recorder stop event after capture has restarted", async () => {
    const firstStop = vi.fn(), secondStop = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce({ getTracks: () => [{ stop: firstStop }] } as unknown as MediaStream).mockResolvedValueOnce({ getTracks: () => [{ stop: secondStop }] } as unknown as MediaStream);
    const accepted = vi.fn();
    const { result } = renderHook(() => useVoiceRecording(accepted, vi.fn()));
    await act(() => result.current.start());
    const previous = recorders[0]!;
    act(() => previous.onerror?.());
    await act(() => result.current.start());
    act(() => previous.onstop?.());
    expect(secondStop).not.toHaveBeenCalled();
    expect(result.current.state).toBe("recording");
    expect(accepted).not.toHaveBeenCalled();
    act(() => result.current.stop());
    expect(secondStop).toHaveBeenCalledOnce();
    expect(accepted).toHaveBeenCalledOnce();
  });
});
