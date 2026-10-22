import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "requesting" | "recording";

/** A microphone is requested only on explicit intent; every acquired track is released. */
export function useVoiceRecording(onRecorded: (file: File) => void, onError: (code: string) => void, enabled = true, limits = { audio_seconds: 300, file_bytes: 20 * 1024 * 1024 }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [seconds, setSeconds] = useState(0);
  const current = useRef(true);
  const active = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const requesting = useRef(false);
  const callbacks = useRef({ onRecorded, onError });
  useEffect(() => { callbacks.current = { onRecorded, onError }; });
  const release = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }, []);
  useEffect(() => {
    if (enabled) return;
    generation.current += 1;
    const recorder = active.current;
    if (recorder?.state !== "inactive") recorder?.stop();
    release();
  }, [enabled, release]);
  useEffect(() => {
    current.current = true;
    return () => {
      current.current = false;
      generation.current += 1;
      const recorder = active.current;
      if (recorder?.state !== "inactive") recorder?.stop();
      release();
    };
  }, [release]);
  const supported = typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
  const start = async () => {
    if (!enabled || !supported || state !== "idle" || active.current || requesting.current) return;
    requesting.current = true;
    const request = ++generation.current;
    setState("requesting");
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      requesting.current = false;
      if (!current.current || request !== generation.current) { acquired.getTracks().forEach(track => track.stop()); if (current.current) setState("idle"); return; }
      stream.current = acquired;
      const recorder = new MediaRecorder(acquired);
      active.current = recorder;
      const chunks: Blob[] = [];
      let bytes = 0;
      let oversized = false;
      recorder.ondataavailable = event => {
        bytes += event.data.size;
        if (bytes > limits.file_bytes) { oversized = true; if (recorder.state !== "inactive") recorder.stop(); }
        else chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (active.current !== recorder) return;
        generation.current += 1;
        active.current = null;
        release();
        if (current.current) { setState("idle"); callbacks.current.onError("recording_failed"); }
      };
      recorder.onstop = () => {
        // A previous recorder may stop after an error and a new capture begins.
        // Its late event owns only its own tracks, never the current recording.
        if (active.current !== recorder) { acquired.getTracks().forEach(track => track.stop()); return; }
        active.current = null;
        release();
        if (current.current) setState("idle");
        if (!current.current || request !== generation.current) return;
        if (oversized) { callbacks.current.onError("file_too_large"); return; }
        const mime = recorder.mimeType || chunks.find(chunk => chunk.type)?.type;
        if (!mime || !bytes) { callbacks.current.onError("recording_failed"); return; }
        const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        callbacks.current.onRecorded(new File(chunks, `voice.${extension}`, { type: mime }));
      };
      const started = Date.now();
      recorder.start(1000);
      setSeconds(0);
      setState("recording");
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(Math.min(elapsed, limits.audio_seconds));
        if (elapsed >= limits.audio_seconds && recorder.state !== "inactive") recorder.stop();
      }, 250);
    } catch (error) {
      requesting.current = false;
      active.current = null;
      release();
      if (current.current && request === generation.current) {
        setState("idle");
        callbacks.current.onError(error instanceof DOMException && error.name === "NotAllowedError" ? "microphone_denied" : "recording_failed");
      }
    }
  };
  const stop = () => { if (active.current?.state === "recording") active.current.stop(); };
  return { state: enabled ? state : "idle" as VoiceState, seconds, supported, start, stop };
}
