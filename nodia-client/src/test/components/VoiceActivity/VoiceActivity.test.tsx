import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VoiceActivity from "../../../components/VoiceActivity";

let level = 128;
let pendingResume: Promise<void> | null = null;
const contexts: FakeContext[] = [];
const frames = new Map<number, FrameRequestCallback>();
const observers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
const drawing = { clearRect: vi.fn(), fillRect: vi.fn(), setTransform: vi.fn(), fillStyle: "" };
const dprDescriptor = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
let reduced = false;

class FakeContext extends EventTarget {
  state = "suspended";
  destination = { syntheticSpeaker: true };
  source = { connect: vi.fn(), disconnect: vi.fn() };
  analyser = { fftSize: 0, getByteTimeDomainData: vi.fn((samples: Uint8Array) => { samples.fill(level); }), disconnect: vi.fn() };
  resume = vi.fn(async () => {
    if (pendingResume) await pendingResume;
    if (this.state !== "closed") this.state = "running";
    this.dispatchEvent(new Event("statechange"));
  });
  close = vi.fn(async () => { this.state = "closed"; this.dispatchEvent(new Event("statechange")); });
  createMediaStreamSource = vi.fn(() => this.source);
  createAnalyser = vi.fn(() => this.analyser);
  constructor() { super(); contexts.push(this); }
}
function microphone() {
  const track = Object.assign(new EventTarget(), { readyState: "live", stop: vi.fn() });
  const stream = { getAudioTracks: () => [track] } as unknown as MediaStream;
  return { stream, track };
}
function frame(time: number) {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => { callbacks.forEach(callback => callback(time)); });
}
beforeEach(() => {
  level = 128; reduced = false; pendingResume = null;
  contexts.length = 0; observers.length = 0; frames.clear();
  vi.clearAllMocks();
  vi.stubGlobal("AudioContext", vi.fn(function () { return new FakeContext(); }));
  vi.stubGlobal("ResizeObserver", class {
    disconnect = vi.fn();
    readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) { this.callback = callback; observers.push(this); }
    observe() {}
    unobserve() {}
  });
  let serial = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { const id = ++serial; frames.set(id, callback); return id; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => { frames.delete(id); }));
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({
    matches: reduced, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 320, 44));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(drawing as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (dprDescriptor) Object.defineProperty(window, "devicePixelRatio", dprDescriptor);
});

// Synthetic microphone samples and Web Audio nodes; no real capture, output, files or recognition.
describe("VoiceActivity", () => {
  it("waits without creating a context or fake activity until a stream exists", () => {
    render(<VoiceActivity stream={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Esperando acceso al micrófono");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(AudioContext).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("draws actual amplitude with a 30fps ceiling, caps DPR, and never connects to speakers", async () => {
    const { stream, track } = microphone();
    const view = render(<VoiceActivity stream={stream} />);
    const canvas = await screen.findByRole("img", { name: "Actividad del micrófono" });
    expect(canvas).toHaveAttribute("width", "640");
    expect(canvas).toHaveAttribute("height", "88");
    const context = contexts[0];
    expect(context.createMediaStreamSource).toHaveBeenCalledExactlyOnceWith(stream);
    expect(context.source.connect).toHaveBeenCalledExactlyOnceWith(context.analyser);
    frame(0);
    expect(drawing.fillRect).toHaveBeenCalledExactlyOnceWith(0, 21.5, 320, 1);
    level = 192;
    frame(10); frame(20);
    expect(context.analyser.getByteTimeDomainData).toHaveBeenCalledTimes(1);
    frame(34);
    expect(context.analyser.getByteTimeDomainData).toHaveBeenCalledTimes(2);
    expect(drawing.fillRect).toHaveBeenCalledWith(expect.any(Number), 11, expect.any(Number), 22);
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 200, 44));
    act(() => { observers[0].callback([], observers[0] as unknown as ResizeObserver); });
    expect(canvas).toHaveAttribute("width", "400");
    expect(contexts).toHaveLength(1);
    view.unmount();
    expect(context.source.disconnect).toHaveBeenCalledTimes(1);
    expect(context.analyser.disconnect).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    expect(track.stop).not.toHaveBeenCalled();
  });

  it("closes the previous context and cancels its frames when the stream changes", async () => {
    const first = microphone(), second = microphone();
    const view = render(<VoiceActivity stream={first.stream} />);
    await screen.findByRole("img", { name: "Actividad del micrófono" });
    view.rerender(<VoiceActivity stream={second.stream} />);
    await waitFor(() => expect(contexts).toHaveLength(2));
    await screen.findByRole("img", { name: "Actividad del micrófono" });
    expect(contexts[0].close).toHaveBeenCalledTimes(1);
    expect(contexts[0].source.disconnect).toHaveBeenCalledTimes(1);
    expect(contexts[1].createMediaStreamSource).toHaveBeenCalledWith(second.stream);
    expect(frames.size).toBe(1);
    expect(first.track.stop).not.toHaveBeenCalled();
    expect(second.track.stop).not.toHaveBeenCalled();
  });

  it("slows measured updates under reduced motion instead of simulating or freezing activity", async () => {
    reduced = true;
    render(<VoiceActivity stream={microphone().stream} />);
    await screen.findByRole("img", { name: "Actividad del micrófono" });
    frame(0); frame(34); frame(120);
    expect(contexts[0].analyser.getByteTimeDomainData).toHaveBeenCalledTimes(1);
    frame(126);
    expect(contexts[0].analyser.getByteTimeDomainData).toHaveBeenCalledTimes(2);
  });

  it("degrades explicitly if Web Audio cannot start, without claiming that recording works", async () => {
    vi.stubGlobal("AudioContext", vi.fn(function () { throw new Error("synthetic unavailable"); }));
    const { stream, track } = microphone();
    render(<VoiceActivity stream={stream} />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No se pudo mostrar la actividad del micrófono."));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(track.stop).not.toHaveBeenCalled();
  });

  it("releases a pending context on unmount and ignores its late resume", async () => {
    let resume!: () => void;
    pendingResume = new Promise<void>(resolve => { resume = resolve; });
    const { stream, track } = microphone();
    const view = render(<VoiceActivity stream={stream} />);
    await waitFor(() => expect(contexts).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent("Esperando acceso al micrófono");
    view.unmount();
    await act(async () => { resume(); });
    expect(contexts[0].close).toHaveBeenCalledTimes(1);
    expect(contexts[0].createMediaStreamSource).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(track.stop).not.toHaveBeenCalled();
  });
});
