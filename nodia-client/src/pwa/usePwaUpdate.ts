import { useEffect, useRef, useState } from "react";
import { queryClient } from "../config/reactQuery";
import { preparePwaRegistration, supportsPwaRegistration } from "./pushRegistration";
import { hasOpenUpdateDraft, watchUpdateDrafts } from "./updateDraftGuard";
import { activateRelease, getPageRelease, prepareReleaseWorker, readPublishedRelease } from "./updateRegistration";

const checkIntervalMs = 60_000;
const postponeMs = 10 * 60_000;

export function usePwaUpdate() {
  const edited = useRef(new Set<Element>());
  const applying = useRef(false);
  const lifecycle = useRef<AbortController>(null);
  const [release, setRelease] = useState<string>();
  const [postponed, setPostponed] = useState<string>();
  const [state, setState] = useState<"idle" | "applying" | "error" | "keep-tab">("idle");

  useEffect(() => {
    const pageRelease = getPageRelease();
    if (!pageRelease || !supportsPwaRegistration()) return;
    const abort = new AbortController();
    lifecycle.current = abort;
    const stopWatchingDrafts = watchUpdateDrafts(document, edited.current);
    let checking = false;

    async function check() {
      if (abort.signal.aborted || checking || applying.current || document.hidden) return;
      checking = true;
      try {
        const latest = await readPublishedRelease(abort.signal);
        if (abort.signal.aborted) return;
        if (latest && latest !== pageRelease) {
          const candidate = await prepareReleaseWorker(latest);
          if (!abort.signal.aborted && !applying.current) setRelease(candidate ? latest : undefined);
        } else {
          if (!applying.current) setRelease(undefined);
          await preparePwaRegistration();
        }
      } catch {
        // A check from a background tab or a transient outage must leave the app usable.
      } finally {
        checking = false;
      }
    }

    if (document.readyState === "complete") void check();
    else window.addEventListener("load", check, { once: true });
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    navigator.serviceWorker.addEventListener("controllerchange", check);
    const timer = window.setInterval(check, checkIntervalMs);
    return () => {
      abort.abort();
      stopWatchingDrafts();
      window.removeEventListener("load", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
      navigator.serviceWorker.removeEventListener("controllerchange", check);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!postponed) return;
    const timer = window.setTimeout(() => setPostponed(undefined), postponeMs);
    return () => window.clearTimeout(timer);
  }, [postponed]);

  function postpone() {
    setPostponed(release);
    setState("idle");
  }

  async function apply() {
    const signal = lifecycle.current?.signal;
    if (!release || applying.current || !signal || signal.aborted) return;
    const url = window.location.href;
    applying.current = true;
    setState("applying");
    try {
      if (await readPublishedRelease(signal) !== release || !await activateRelease(release) ||
        await readPublishedRelease(signal) !== release) {
        throw new Error("Version unavailable");
      }
      if (signal.aborted) return;
      if (window.location.href !== url || hasOpenUpdateDraft(document, edited.current) || queryClient.isMutating()) {
        setState("keep-tab");
        return;
      }
      window.location.reload();
      setState("idle");
    } catch {
      if (!signal.aborted) setState("error");
    } finally {
      applying.current = false;
    }
  }

  return { available: Boolean(release && release !== postponed), state, postpone, apply };
}
