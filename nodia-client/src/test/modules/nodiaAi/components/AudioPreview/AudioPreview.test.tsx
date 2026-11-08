import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AudioPreview from "../../../../../modules/nodiaAi/components/AudioPreview";

const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
const createUrl = vi.fn();
const revokeUrl = vi.fn();
beforeEach(() => {
  let serial = 0;
  createUrl.mockReset().mockImplementation(() => `blob:synthetic-audio-${++serial}`);
  revokeUrl.mockReset();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeUrl });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
  vi.restoreAllMocks();
});

// Synthetic Blob bytes; these tests exercise local resource ownership, not codec support or AI formats.
describe("AudioPreview", () => {
  it("offers named native controls for the exact local Blob without autoplay and releases its source on unmount", () => {
    const blob = new Blob(["synthetic audio"], { type: "audio/webm" });
    const view = render(<AudioPreview blob={blob} name="voice.webm" />);
    const audio = screen.getByLabelText("Reproductor de audio: voice.webm");
    expect(audio.tagName).toBe("AUDIO");
    expect(audio).toHaveAttribute("controls");
    expect(audio).toHaveAttribute("preload", "metadata");
    expect(audio).not.toHaveAttribute("autoplay");
    expect(audio).toHaveAttribute("src", "blob:synthetic-audio-1");
    expect(createUrl).toHaveBeenCalledExactlyOnceWith(blob);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    view.unmount();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(audio).not.toHaveAttribute("src");
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith("blob:synthetic-audio-1");
  });

  it("pauses and revokes old bytes when the Blob changes without using the old source for the new file", () => {
    const first = new Blob(["first synthetic audio"], { type: "audio/webm" });
    const second = new Blob(["second synthetic audio"], { type: "audio/ogg" });
    const view = render(<AudioPreview blob={first} name="first.webm" />);
    view.rerender(<AudioPreview blob={second} name="second.ogg" />);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith("blob:synthetic-audio-1");
    expect(createUrl).toHaveBeenNthCalledWith(2, second);
    expect(screen.getByLabelText("Reproductor de audio: second.ogg")).toHaveAttribute("src", "blob:synthetic-audio-2");
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledWith("blob:synthetic-audio-2");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("shows native playback failure and recreates only a local source on explicit retry", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["synthetic unsupported audio"], { type: "audio/webm" });
    render(<AudioPreview blob={blob} name="voice.webm" />);
    fireEvent.error(screen.getByLabelText("Reproductor de audio: voice.webm"));
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo reproducir este audio en este navegador.");
    expect(createUrl).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Reintentar reproducción" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(revokeUrl).toHaveBeenCalledWith("blob:synthetic-audio-1");
    expect(createUrl).toHaveBeenNthCalledWith(2, blob);
    expect(screen.getByLabelText("Reproductor de audio: voice.webm")).toHaveAttribute("src", "blob:synthetic-audio-2");
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("does not carry an old Blob failure into another Blob or accept a stale-source error", () => {
    const first = new Blob(["first"], { type: "audio/webm" });
    const second = new Blob(["second"], { type: "audio/webm" });
    const view = render(<AudioPreview blob={first} name="voice.webm" />);
    const audio = screen.getByLabelText("Reproductor de audio: voice.webm");
    fireEvent.error(audio);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    view.rerender(<AudioPreview blob={second} name="voice.webm" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    Object.defineProperty(audio, "currentSrc", { configurable: true, value: "blob:synthetic-audio-1" });
    fireEvent.error(audio);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    Object.defineProperty(audio, "currentSrc", { configurable: true, value: "blob:synthetic-audio-2" });
    fireEvent.error(audio);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("keeps the same source when only its accessible filename changes", () => {
    const blob = new Blob(["synthetic audio"], { type: "audio/webm" });
    const view = render(<AudioPreview blob={blob} name="before.webm" />);
    view.rerender(<AudioPreview blob={blob} name="after.webm" />);
    expect(screen.getByLabelText("Reproductor de audio: after.webm")).toHaveAttribute("src", "blob:synthetic-audio-1");
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(revokeUrl).not.toHaveBeenCalled();
  });
});
