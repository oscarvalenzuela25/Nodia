import { useEffect, useRef, useState } from "react";
import { Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { ActivityCanvas, ActivityShell } from "./styles";
import type { VoiceActivityProps } from "./types";

/** Measures the caller-owned stream; no recording, recognition, network or speaker output. */
export default function VoiceActivity({ stream }: VoiceActivityProps) {
  const { t } = useTranslation("core");
  const theme = useTheme();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const colors = useRef({ signal: theme.palette.primary.main, quiet: theme.palette.divider });
  const [observation, setObservation] = useState<{ stream: MediaStream; state: "ready" | "unavailable" } | null>(null);
  const state = stream && observation?.stream === stream ? observation.state : "waiting";
  useEffect(() => {
    colors.current = { signal: theme.palette.primary.main, quiet: theme.palette.divider };
  }, [theme.palette.primary.main, theme.palette.divider]);
  useEffect(() => {
    if (!stream) return;
    const element = canvas.current;
    if (!element) return;
    let disposed = false, released = false, ready = false;
    let context: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let frame: number | null = null;
    let observer: ResizeObserver | null = null;
    let drawing: CanvasRenderingContext2D | null = null;
    let width = 1;
    const tracks = stream.getAudioTracks();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let interval = motion.matches ? 125 : 1000 / 30;
    const onMotion = (event: MediaQueryListEvent) => { interval = event.matches ? 125 : 1000 / 30; };
    const resize = () => {
      width = Math.max(1, Math.min(2048, Math.round((element.parentElement ?? element).getBoundingClientRect().width)));
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      element.width = Math.round(width * dpr);
      element.height = Math.round(44 * dpr);
      drawing?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const release = () => {
      if (released) return;
      released = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      motion.removeEventListener("change", onMotion);
      tracks.forEach(track => track.removeEventListener("ended", unavailable));
      context?.removeEventListener("statechange", onState);
      source?.disconnect();
      analyser?.disconnect();
      drawing?.clearRect(0, 0, width, 44);
      if (context && context.state !== "closed") void context.close().catch(() => {});
    };
    const unavailable = () => {
      if (disposed) return;
      release();
      setObservation({ stream, state: "unavailable" });
    };
    const onState = () => {
      if (ready && context?.state !== "running") unavailable();
    };
    const initialize = async () => {
      // Keep setup/catch outside the synchronous effect, including unsupported Web Audio.
      await Promise.resolve();
      if (disposed) return;
      try {
        if (!tracks.some(track => track.readyState === "live")) throw new Error("no_live_audio_track");
        drawing = element.getContext("2d");
        if (!drawing) throw new Error("canvas_unavailable");
        context = new AudioContext();
        context.addEventListener("statechange", onState);
        await context.resume();
        if (disposed) { release(); return; }
        if (context.state !== "running") throw new Error("audio_context_unavailable");
        source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        // Deliberately never connect the analyser to context.destination: no microphone feedback.
        const samples = new Uint8Array(analyser.fftSize);
        resize();
        observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
        observer?.observe(element);
        window.addEventListener("resize", resize);
        motion.addEventListener("change", onMotion);
        tracks.forEach(track => track.addEventListener("ended", unavailable));
        ready = true;
        setObservation({ stream, state: "ready" });
        let previous = -Infinity;
        const paint = (time: number) => {
          if (disposed || released || !analyser || !drawing) return;
          if (time - previous >= interval) {
            previous = time;
            analyser.getByteTimeDomainData(samples);
            drawing.clearRect(0, 0, width, 44);
            drawing.fillStyle = colors.current.quiet;
            drawing.fillRect(0, 21.5, width, 1);
            drawing.fillStyle = colors.current.signal;
            const bars = Math.max(1, Math.min(32, Math.floor(width / 8)));
            const gap = bars > 1 ? 2 : 0;
            const barWidth = (width - gap * (bars - 1)) / bars;
            for (let bar = 0; bar < bars; bar++) {
              let amplitude = 0;
              for (let index = Math.floor(bar * samples.length / bars); index < Math.floor((bar + 1) * samples.length / bars); index++) {
                amplitude = Math.max(amplitude, Math.abs(samples[index] - 128) / 128);
              }
              const height = Math.min(44, amplitude * 44);
              if (height > 0) drawing.fillRect(bar * (barWidth + gap), (44 - height) / 2, barWidth, height);
            }
          }
          frame = window.requestAnimationFrame(paint);
        };
        frame = window.requestAnimationFrame(paint);
      } catch { unavailable(); }
    };
    void initialize();
    return () => {
      disposed = true;
      release();
    };
  }, [stream]);
  return <ActivityShell>
    <ActivityCanvas ref={canvas} role="img" aria-label={t("message_composer.dictation.activity_label")} hidden={state !== "ready"} />
    {state !== "ready" && <Typography variant="caption" role="status" color={state === "unavailable" ? "warning.main" : "text.secondary"}>
      {t(state === "unavailable" ? "message_composer.dictation.activity_unavailable" : "message_composer.dictation.activity_waiting")}
    </Typography>}
  </ActivityShell>;
}
