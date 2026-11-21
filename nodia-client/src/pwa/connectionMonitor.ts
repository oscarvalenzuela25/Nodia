import { isAxiosError, isCancel } from "axios";
import envs from "../config/.envs";
import { apiPath } from "../config/apiPath";

type ConnectionStatus = "available" | "offline" | "server-unavailable";
type Issue = Exclude<ConnectionStatus, "available">;
type Snapshot = Readonly<{ status: ConnectionStatus; checking: boolean }>;

export const offlineRequestCode = "NODIA_OFFLINE_REQUEST";
export const isBrowserOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export function getConnectionIssue(error: unknown, offline = isBrowserOffline()): Issue | undefined {
  if (!isAxiosError(error) || isCancel(error)) return;
  const status = error.response?.status;
  if (status !== undefined) return status >= 500 && status < 600 ? "server-unavailable" : undefined;
  if (error.code === offlineRequestCode) return "offline";
  if (error.code === "ERR_NETWORK" || error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
    return offline ? "offline" : "server-unavailable";
  }
}

type Dependencies = {
  isOffline: () => boolean;
  probe: (signal: AbortSignal) => Promise<boolean>;
};

export function createConnectionMonitor({ isOffline, probe }: Dependencies) {
  const listeners = new Set<() => void>();
  let snapshot: Snapshot = { status: isOffline() ? "offline" : "available", checking: false };
  let relevantFailures = 0;
  let pending: { controller: AbortController; result: Promise<void> } | undefined;

  function publish(status: ConnectionStatus, checking: boolean) {
    if (snapshot.status === status && snapshot.checking === checking) return;
    snapshot = { status, checking };
    for (const listener of listeners) listener();
  }

  function offline() {
    pending?.controller.abort();
    pending = undefined;
    publish("offline", false);
  }

  function observeFailure(error: unknown) {
    const issue = getConnectionIssue(error, isOffline());
    if (!issue) return;
    // Ignore a delayed failure from a request refused during a previous offline period.
    if (issue === "offline" && !isOffline()) return;
    relevantFailures++;
    if (isOffline()) offline();
    else publish(issue, snapshot.checking);
  }

  function retry(recoverReads: () => Promise<void>): Promise<void> {
    if (isOffline()) {
      offline();
      return Promise.resolve();
    }
    if (pending) return pending.result;

    const controller = new AbortController();
    const start = relevantFailures;
    publish(snapshot.status, true);
    const result = Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      try {
        const reachable = await probe(controller.signal);
        if (controller.signal.aborted) return;
        if (!reachable) {
          publish("server-unavailable", false);
          return;
        }
        await recoverReads();
        if (controller.signal.aborted) return;
        if (isOffline()) offline();
        else publish(start === relevantFailures ? "available" : "server-unavailable", false);
      } catch {
        if (!controller.signal.aborted) {
          if (isOffline()) offline();
          else publish("server-unavailable", false);
        }
      } finally {
        if (pending?.controller === controller) pending = undefined;
      }
    });
    pending = { controller, result };
    return result;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    observeFailure,
    offline,
    retry,
  };
}

async function probeApi(signal: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 6_000);
  try {
    const base = envs.API_URL.replace(/\/$/, "");
    const response = await fetch(base + apiPath(""), {
      cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal,
    });
    // Reject an SPA fallback or captive portal that also answers HTTP 200.
    return response.ok && (await response.text()).trim() === "Hello World!";
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export const connectionMonitor = createConnectionMonitor({ isOffline: isBrowserOffline, probe: probeApi });
