import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceDictation } from "../../hooks/useVoiceDictation";
import type { BrowserSpeechRecognition, BrowserSpeechResultEvent } from "../../hooks/useVoiceDictation";

type Options = Parameters<typeof useVoiceDictation>[0];
let recognizers: FakeRecognition[];
class FakeRecognition implements BrowserSpeechRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((event: BrowserSpeechResultEvent) => void) | null = null;
  onerror: ((event: {error: string}) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() { recognizers.push(this); }
}
const resultEvent = (...entries: [string, boolean][]): BrowserSpeechResultEvent => ({
  results: entries.map(([transcript, isFinal]) => ({0:{transcript},length:1,isFinal})),
});
const makeStream = () => {
  const tracks = [{stop:vi.fn()},{stop:vi.fn()}];
  return {stream:{getTracks:()=>tracks} as unknown as MediaStream,tracks};
};
const options = (extra: Partial<Options> = {}): Options => ({
  enabled:true,scopeKey:"synthetic-actor/chat",language:"es-CL",text:"Borrador",maxBytes:32768,
  onTextChange:vi.fn(),onError:vi.fn(),...extra,
});
let mediaDescriptor: PropertyDescriptor | undefined;
let media: ReturnType<typeof makeStream>;
const recognition = () => recognizers.at(-1)!;
async function listen(start: () => Promise<void>) {
  await act(start);
  act(() => recognition().onstart?.());
  return recognition();
}
beforeEach(() => {
  recognizers=[];
  media=makeStream();
  mediaDescriptor=Object.getOwnPropertyDescriptor(navigator,"mediaDevices");
  vi.stubGlobal("SpeechRecognition",FakeRecognition);
  vi.stubGlobal("webkitSpeechRecognition",undefined);
  Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue(media.stream)}});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if(mediaDescriptor)Object.defineProperty(navigator,"mediaDevices",mediaDescriptor);
  else Reflect.deleteProperty(navigator,"mediaDevices");
});

describe("browser voice dictation", () => {
  it("enforces the caller's UTF-16 character bound independently of its UTF-8 byte budget", async () => {
    const config=options({text:"A",maxBytes:8192,maxLength:4});
    const {result}=renderHook(()=>useVoiceDictation(config));
    const native=await listen(result.current.start);
    act(()=>native.onresult?.(resultEvent(["🙂",false])));
    expect(config.onTextChange).toHaveBeenLastCalledWith("A 🙂");
    act(()=>native.onresult?.(resultEvent(["🙂x",true])));
    expect(config.onTextChange).toHaveBeenCalledOnce();
    expect(config.onError).toHaveBeenCalledExactlyOnceWith("text_too_large");
    expect(native.abort).toHaveBeenCalledOnce(); expect(result.current.state).toBe("idle");
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
  });
  it("honors a tightened character limit during capture without replacing the accepted text", async () => {
    const initial=options({text:"A",maxBytes:8192,maxLength:8});
    const {result,rerender}=renderHook(props=>useVoiceDictation(props),{initialProps:initial});
    const native=await listen(result.current.start);
    act(()=>native.onresult?.(resultEvent(["hi",false])));
    rerender({...initial,text:"A hi",maxLength:4});
    act(()=>native.onresult?.(resultEvent(["hello",true])));
    expect(initial.onTextChange).toHaveBeenCalledExactlyOnceWith("A hi");
    expect(initial.onError).toHaveBeenCalledExactlyOnceWith("text_too_large");
    expect(native.abort).toHaveBeenCalledOnce();
  });
  it("starts only from intent, uses the selected language and tracks actual listening duration", async () => {
    vi.useFakeTimers();
    const {result}=renderHook(()=>useVoiceDictation(options({language:"en-GB"})));
    expect(result.current.supported).toBe(true);
    expect(recognizers).toHaveLength(0);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    await act(()=>result.current.start());
    expect(result.current.state).toBe("requesting");
    expect(recognition().lang).toBe("en-GB");
    expect(recognition().continuous&&recognition().interimResults).toBe(true);
    expect(recognition().start).toHaveBeenCalledOnce();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({audio:true});
    expect(result.current.stream).toBe(media.stream);
    act(()=>recognition().onstart?.());
    act(()=>vi.advanceTimersByTime(2250));
    expect(result.current.state).toBe("listening");
    expect(result.current.seconds).toBe(2);
    act(()=>recognition().onend?.());
    expect(result.current.state).toBe("idle");
    expect(result.current.stream).toBeNull();
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
  });

  it("replaces interims with finals from the complete result snapshot without duplicating the captured base", async () => {
    const initial=options({text:"Nota \n"});
    const {result,rerender}=renderHook(props=>useVoiceDictation(props),{initialProps:initial});
    const native=await listen(result.current.start);
    act(()=>native.onresult?.(resultEvent(["hol",false])));
    expect(initial.onTextChange).toHaveBeenLastCalledWith("Nota \nhol");
    rerender({...initial,text:"Nota \nhol"});
    act(()=>native.onresult?.(resultEvent(["hola",true],[" mun",false])));
    expect(initial.onTextChange).toHaveBeenLastCalledWith("Nota \nhola mun");
    const complete=resultEvent(["hola",true],[" mundo",true],[".",true]);
    act(()=>native.onresult?.(complete));
    act(()=>native.onresult?.(complete));
    expect(initial.onTextChange).toHaveBeenLastCalledWith("Nota \nhola mundo.");
    expect(initial.onTextChange).toHaveBeenCalledTimes(3);
    act(()=>native.onend?.());
    expect(initial.onError).not.toHaveBeenCalled();
  });

  it("rejects an entire oversized UTF-8 result, preserving the last accepted text without truncation", async () => {
    const config=options({text:"á ",maxBytes:8});
    const {result}=renderHook(()=>useVoiceDictation(config));
    const native=await listen(result.current.start),late=native.onresult!;
    act(()=>native.onresult?.(resultEvent(["🙂x",false]))); // 3-byte base + 5-byte transcript.
    expect(config.onTextChange).toHaveBeenLastCalledWith("á 🙂x");
    act(()=>native.onresult?.(resultEvent(["🙂xy",true])));
    expect(config.onTextChange).toHaveBeenCalledOnce();
    expect(config.onError).toHaveBeenCalledExactlyOnceWith("text_too_large");
    expect(native.abort).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("idle");
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
    act(()=>late(resultEvent(["late",true])));
    expect(config.onTextChange).toHaveBeenCalledOnce();
  });

  it("does not start capture when the existing text already exceeds the byte limit", async () => {
    const config=options({text:"🙂",maxBytes:3});
    const {result}=renderHook(()=>useVoiceDictation(config));
    await act(()=>result.current.start());
    expect(config.onError).toHaveBeenCalledWith("text_too_large");
    expect(recognizers).toHaveLength(0);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("releases microphone immediately on stop but accepts the same capture's final result until end", async () => {
    const config=options();
    const {result}=renderHook(()=>useVoiceDictation(config));
    const native=await listen(result.current.start);
    act(()=>native.onresult?.(resultEvent(["hol",false])));
    act(()=>result.current.stop());
    act(()=>result.current.stop());
    expect(native.stop).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("stopping");
    expect(result.current.stream).toBeNull();
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
    act(()=>native.onresult?.(resultEvent(["hola",true])));
    expect(config.onTextChange).toHaveBeenLastCalledWith("Borrador hola");
    act(()=>native.onend?.());
    expect(result.current.state).toBe("idle");
    expect(config.onError).not.toHaveBeenCalled();
  });

  it("closes the local stopping window at five seconds without erasing accepted partial text or restarting", async () => {
    vi.useFakeTimers();
    const config=options();
    const {result}=renderHook(()=>useVoiceDictation(config));
    const native=await listen(result.current.start),late=native.onresult!;
    act(()=>native.onresult?.(resultEvent(["parcial",false])));
    act(()=>result.current.stop());
    act(()=>vi.advanceTimersByTime(5000));
    expect(result.current.state).toBe("idle");
    expect(config.onError).toHaveBeenCalledWith("dictation_stop_timeout");
    expect(native.abort).toHaveBeenCalledOnce();
    expect(config.onTextChange).toHaveBeenLastCalledWith("Borrador parcial");
    act(()=>late(resultEvent(["tardío",true])));
    expect(config.onTextChange).toHaveBeenCalledOnce();
    expect(recognizers).toHaveLength(1);
  });

  it.each([
    ["not-allowed","microphone_denied"],["network","dictation_network"],
    ["service-not-allowed","dictation_service_unavailable"],["no-speech","dictation_no_speech"],
    ["language-not-supported","dictation_language_unsupported"],["audio-capture","dictation_audio_capture"],
    ["unexpected-browser-error","dictation_failed"],
  ])("maps %s without retry and keeps the accepted transcript", async (error,code) => {
    const config=options();
    const {result}=renderHook(()=>useVoiceDictation(config));
    const native=await listen(result.current.start);
    act(()=>native.onresult?.(resultEvent(["conservado",false])));
    act(()=>native.onerror?.({error}));
    expect(config.onError).toHaveBeenCalledExactlyOnceWith(code);
    expect(config.onTextChange).toHaveBeenCalledExactlyOnceWith("Borrador conservado");
    expect(result.current.state).toBe("idle");
    expect(result.current.stream).toBeNull();
    expect(native.abort).toHaveBeenCalledOnce();
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
    expect(recognizers).toHaveLength(1);
  });

  it("reports microphone permission denial and aborts native recognition without inventing text", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException("Synthetic denied","NotAllowedError"));
    const config=options();
    const {result}=renderHook(()=>useVoiceDictation(config));
    await act(()=>result.current.start());
    expect(config.onError).toHaveBeenCalledWith("microphone_denied");
    expect(config.onTextChange).not.toHaveBeenCalled();
    expect(recognition().abort).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("idle");
  });

  it("releases a synchronous native start failure before requesting the visual microphone stream", async () => {
    vi.stubGlobal("SpeechRecognition",class extends FakeRecognition {
      override start=vi.fn(()=>{throw new DOMException("Synthetic native denial","NotAllowedError");});
    });
    const config=options();
    const {result}=renderHook(()=>useVoiceDictation(config));
    await act(()=>result.current.start());
    expect(config.onError).toHaveBeenCalledExactlyOnceWith("microphone_denied");
    expect(result.current.state).toBe("idle");
    expect(recognition().abort).toHaveBeenCalledOnce();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("locks same-tick start intent while microphone permission is pending", async () => {
    let resolve!: (stream:MediaStream)=>void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(()=>new Promise(done=>{resolve=done;}));
    const {result}=renderHook(()=>useVoiceDictation(options()));
    let pending!:Promise<void>;
    act(()=>{pending=result.current.start();void result.current.start();});
    expect(recognizers).toHaveLength(1);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    await act(async()=>{resolve(media.stream);await pending;});
    act(()=>result.current.cancel());
    expect(recognition().abort).toHaveBeenCalledOnce();
  });

  it("releases a stream granted after unmount without changing text or reporting a stale error", async () => {
    let resolve!: (stream:MediaStream)=>void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(()=>new Promise(done=>{resolve=done;}));
    const config=options();
    const {result,unmount}=renderHook(()=>useVoiceDictation(config));
    let pending!:Promise<void>;
    act(()=>{pending=result.current.start();});
    const native=recognition(),late=native.onerror!;
    unmount();
    await act(async()=>{resolve(media.stream);await pending;late({error:"network"});});
    expect(native.abort).toHaveBeenCalledOnce();
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
    expect(config.onTextChange).not.toHaveBeenCalled();
    expect(config.onError).not.toHaveBeenCalled();
  });

  it("stops pending capture without attaching a late granted stream or reopening on a late native start", async () => {
    let resolve!: (stream:MediaStream)=>void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(()=>new Promise(done=>{resolve=done;}));
    const config=options();
    const {result}=renderHook(()=>useVoiceDictation(config));
    let pending!:Promise<void>;
    act(()=>{pending=result.current.start();});
    const native=recognition();
    act(()=>result.current.stop());
    act(()=>native.onstart?.());
    await act(async()=>{resolve(media.stream);await pending;});
    expect(result.current.state).toBe("stopping");
    expect(result.current.stream).toBeNull();
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
    act(()=>native.onend?.());
    expect(result.current.state).toBe("idle");
    expect(config.onError).not.toHaveBeenCalled();
  });

  it("fails closed on malformed browser results while preserving the preceding accepted partial text", async () => {
    const config=options();
    const {result}=renderHook(()=>useVoiceDictation(config));
    const native=await listen(result.current.start);
    act(()=>native.onresult?.(resultEvent(["conservado",false])));
    act(()=>native.onresult?.({results:[{length:0,isFinal:false}]}));
    expect(config.onTextChange).toHaveBeenCalledExactlyOnceWith("Borrador conservado");
    expect(config.onError).toHaveBeenCalledWith("dictation_failed");
    expect(native.abort).toHaveBeenCalledOnce();
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
  });

  it("releases late permission results after a scope change and ignores old callbacks during a new capture and unmount", async () => {
    let resolve!: (stream:MediaStream)=>void;
    const second=makeStream(),config=options();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockResolvedValueOnce(second.stream);
    const {result,rerender,unmount}=renderHook(props=>useVoiceDictation(props),{initialProps:config});
    let pending!:Promise<void>;
    act(()=>{pending=result.current.start();});
    const previous=recognition(),oldResult=previous.onresult!,oldEnd=previous.onend!,oldError=previous.onerror!;
    rerender({...config,scopeKey:"another-user/another-chat"});
    expect(previous.abort).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("idle");
    const next=await listen(result.current.start),nextResult=next.onresult!;
    await act(async()=>{resolve(media.stream);await pending;});
    act(()=>{oldResult(resultEvent(["private late",true]));oldEnd();oldError({error:"network"});});
    expect(result.current.state).toBe("listening");
    expect(result.current.stream).toBe(second.stream);
    expect(config.onTextChange).not.toHaveBeenCalled();
    expect(config.onError).not.toHaveBeenCalled();
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
    second.tracks.forEach(track=>expect(track.stop).not.toHaveBeenCalled());
    unmount();
    expect(next.abort).toHaveBeenCalledOnce();
    second.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
    act(()=>nextResult(resultEvent(["after unmount",true])));
    expect(config.onTextChange).not.toHaveBeenCalled();
  });

  it("cancels immediately when interaction is revoked and suppresses late results", async () => {
    const config=options();
    const {result,rerender}=renderHook(props=>useVoiceDictation(props),{initialProps:config});
    const native=await listen(result.current.start),late=native.onresult!;
    rerender({...config,enabled:false});
    expect(result.current.state).toBe("idle");
    expect(native.abort).toHaveBeenCalledOnce();
    media.tracks.forEach(track=>expect(track.stop).toHaveBeenCalledOnce());
    act(()=>late(resultEvent(["forbidden",true])));
    await act(()=>result.current.start());
    expect(config.onTextChange).not.toHaveBeenCalled();
    expect(recognizers).toHaveLength(1);
  });

  it("uses only the browser's prefixed recognition alias when necessary and reports missing APIs", async () => {
    vi.stubGlobal("SpeechRecognition",undefined);
    vi.stubGlobal("webkitSpeechRecognition",FakeRecognition);
    const config=options();
    const {result,rerender}=renderHook(()=>useVoiceDictation(config));
    await listen(result.current.start);
    act(()=>result.current.cancel());
    vi.stubGlobal("webkitSpeechRecognition",undefined);
    rerender();
    expect(result.current.supported).toBe(false);
    await act(()=>result.current.start());
    expect(config.onError).toHaveBeenCalledWith("dictation_unavailable");
    expect(recognizers).toHaveLength(1);
  });
});
