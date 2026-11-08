import { useCallback, useLayoutEffect, useRef, useState } from "react";

export type DictationState = "idle" | "requesting" | "listening" | "stopping";
export interface BrowserSpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}
export interface BrowserSpeechResultEvent {
  readonly results: { readonly length: number; readonly [index: number]: BrowserSpeechResult };
}
export interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechConstructor = new () => BrowserSpeechRecognition;
interface DictationOptions {
  enabled: boolean;
  scopeKey: string;
  language: string;
  text: string;
  maxBytes: number;
  maxLength?: number;
  onTextChange: (text: string) => void;
  onError: (code: string) => void;
}
interface Capture {
  generation: number;
  scopeKey: string;
  phase: Exclude<DictationState, "idle">;
  recognition: BrowserSpeechRecognition | null;
  stream: MediaStream | null;
  baseText: string;
  acceptedText: string;
  maxBytes: number;
  maxLength: number | undefined;
  startedAt: number | null;
  clock: ReturnType<typeof setInterval> | null;
  stopTimeout: ReturnType<typeof setTimeout> | null;
}

function speechConstructor(): SpeechConstructor | null {
  if (typeof window === "undefined") return null;
  const browser = window as Window & {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return typeof browser.SpeechRecognition === "function" ? browser.SpeechRecognition
    : typeof browser.webkitSpeechRecognition === "function" ? browser.webkitSpeechRecognition : null;
}

/** Preserve existing whitespace; only supply a missing word boundary between browser results. */
function appendSpeech(left: string, right: string) {
  if (!left || !right || /\s$/u.test(left) || /^\s|^[.,!?;:…)}\]»]/u.test(right) || /[({[¿¡«]$/u.test(left))
    return left + right;
  return `${left} ${right}`;
}

function readSpeech(event: BrowserSpeechResultEvent): string | null {
  if (!event?.results || !Number.isSafeInteger(event.results.length) || event.results.length < 0) return null;
  let text = "";
  for (let index = 0; index < event.results.length; index++) {
    const transcript = event.results[index]?.[0]?.transcript;
    if (typeof transcript !== "string") return null;
    text = appendSpeech(text, transcript);
  }
  return text;
}

function errorCode(error: string) {
  switch (error) {
    case "not-allowed": case "NotAllowedError": case "SecurityError": return "microphone_denied";
    case "network": return "dictation_network";
    case "service-not-allowed": return "dictation_service_unavailable";
    case "no-speech": return "dictation_no_speech";
    case "language-not-supported": return "dictation_language_unsupported";
    case "audio-capture": case "NotFoundError": case "NotReadableError": return "dictation_audio_capture";
    default: return "dictation_failed";
  }
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => {
    try { track.stop(); } catch { /* Continue releasing the remaining tracks. */ }
  });
}

/** Browser dictation only. A recognition service may be remote; no Nodia provider or attachment is used. */
export function useVoiceDictation(options: DictationOptions) {
  const [state, setState] = useState<DictationState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const latest = useRef(options);
  const alive = useRef(true);
  const generation = useRef(0);
  const active = useRef<Capture | null>(null);
  useLayoutEffect(() => { latest.current = options; });

  const current = useCallback((capture: Capture) => alive.current && active.current === capture
    && generation.current === capture.generation && latest.current.enabled
    && latest.current.scopeKey === capture.scopeKey, []);

  const releaseMicrophone = useCallback((capture: Capture) => {
    const owned = capture.stream;
    capture.stream = null;
    stopTracks(owned);
    if (alive.current && active.current === capture) setStream(null);
  }, []);

  const finish = useCallback((capture: Capture, abort: boolean) => {
    if (capture.clock !== null) clearInterval(capture.clock);
    if (capture.stopTimeout !== null) clearTimeout(capture.stopTimeout);
    capture.clock = null;
    capture.stopTimeout = null;
    releaseMicrophone(capture);
    const recognition = capture.recognition;
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    }
    if (active.current === capture) {
      active.current = null;
      generation.current += 1;
      if (alive.current) setState("idle");
    }
    if (abort) {
      try { recognition?.abort(); } catch { /* Local cleanup does not claim remote cancellation. */ }
    }
  }, [releaseMicrophone]);

  const cancel = useCallback(() => {
    const capture = active.current;
    if (capture) finish(capture, true);
  }, [finish]);

  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const capture = active.current;
      if (capture) finish(capture, true);
    };
  }, [finish]);
  useLayoutEffect(() => {
    const capture = active.current;
    if (capture && (!options.enabled || capture.scopeKey !== options.scopeKey)) finish(capture, true);
  }, [options.enabled, options.scopeKey, finish]);

  const start = useCallback(async () => {
    const selected = latest.current;
    if (!alive.current || !selected.enabled || active.current) return;
    const Constructor = speechConstructor();
    if (!Constructor || typeof navigator === "undefined" || typeof navigator.mediaDevices?.getUserMedia !== "function") {
      selected.onError("dictation_unavailable");
      return;
    }
    if (!Number.isSafeInteger(selected.maxBytes) || selected.maxBytes < 1) {
      selected.onError("dictation_failed");
      return;
    }
    if ((selected.maxLength !== undefined && (!Number.isSafeInteger(selected.maxLength) || selected.maxLength < 0))
      || new TextEncoder().encode(selected.text).length > selected.maxBytes
      || (selected.maxLength !== undefined && selected.text.length > selected.maxLength)) {
      selected.onError("text_too_large");
      return;
    }
    const capture: Capture = {
      generation: ++generation.current, scopeKey: selected.scopeKey, phase: "requesting", recognition: null,
      stream: null, baseText: selected.text, acceptedText: selected.text, maxBytes: selected.maxBytes, maxLength: selected.maxLength,
      startedAt: null, clock: null, stopTimeout: null,
    };
    active.current = capture; // Lock before either native permission request, including same-tick double starts.
    setSeconds(0);
    setState("requesting");
    try {
      const recognition = new Constructor();
      capture.recognition = recognition;
      recognition.lang = selected.language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onstart = () => {
        if (!current(capture) || capture.phase !== "requesting") return;
        capture.phase = "listening";
        capture.startedAt = Date.now();
        setState("listening");
        capture.clock = setInterval(() => {
          if (current(capture) && capture.startedAt !== null)
            setSeconds(Math.max(0, Math.floor((Date.now() - capture.startedAt) / 1000)));
        }, 250);
      };
      recognition.onresult = event => {
        if (!current(capture)) return;
        // results is the complete session snapshot: finals followed by replaceable interim hypotheses.
        // Rebuild from the captured base rather than appending repeated result events or resultIndex deltas.
        const dictated = readSpeech(event);
        const latestLimit = latest.current.maxBytes;
        const latestLength = latest.current.maxLength;
        if (dictated === null || !Number.isSafeInteger(latestLimit) || latestLimit < 1
          || (latestLength !== undefined && (!Number.isSafeInteger(latestLength) || latestLength < 0))) {
          finish(capture, true);
          latest.current.onError("dictation_failed");
          return;
        }
        const candidate = appendSpeech(capture.baseText, dictated);
        if (new TextEncoder().encode(candidate).length > Math.min(capture.maxBytes, latestLimit)
          || (capture.maxLength !== undefined && candidate.length > capture.maxLength)
          || (latestLength !== undefined && candidate.length > latestLength)) {
          finish(capture, true);
          latest.current.onError("text_too_large");
          return;
        }
        if (candidate !== capture.acceptedText) {
          capture.acceptedText = candidate;
          latest.current.onTextChange(candidate);
        }
      };
      recognition.onerror = event => {
        if (!current(capture)) return;
        const stoppedIntentionally = capture.phase === "stopping" && event.error === "aborted";
        finish(capture, true);
        if (!stoppedIntentionally) latest.current.onError(errorCode(event.error));
      };
      recognition.onend = () => { if (current(capture)) finish(capture, false); };
      // Invoke native start within the explicit user gesture, without a track argument or provider fallback.
      recognition.start();
      if (!current(capture)) return;
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!current(capture) || capture.phase === "stopping") { stopTracks(acquired); return; }
      capture.stream = acquired;
      setStream(acquired);
    } catch (error) {
      if (!current(capture)) return;
      const stoppedIntentionally = capture.phase === "stopping";
      finish(capture, true);
      const name = error !== null && typeof error === "object" && "name" in error ? error.name : null;
      if (!stoppedIntentionally) latest.current.onError(errorCode(typeof name === "string" ? name : ""));
    }
  }, [current, finish]);

  const stop = useCallback(() => {
    const capture = active.current;
    if (!capture || !current(capture) || capture.phase === "stopping") return;
    capture.phase = "stopping";
    if (capture.clock !== null) clearInterval(capture.clock);
    capture.clock = null;
    releaseMicrophone(capture);
    setState("stopping");
    capture.stopTimeout = setTimeout(() => {
      if (!current(capture)) return;
      finish(capture, true);
      latest.current.onError("dictation_stop_timeout");
    }, 5000);
    try { capture.recognition?.stop(); }
    catch {
      finish(capture, true);
      latest.current.onError("dictation_failed");
    }
  }, [current, finish, releaseMicrophone]);

  const supported = speechConstructor() !== null && typeof navigator !== "undefined"
    && typeof navigator.mediaDevices?.getUserMedia === "function";
  return { state, seconds, stream, supported, start, stop, cancel };
}
