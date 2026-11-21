import { preparePwaRegistration } from "./pushRegistration";

const releaseFormat = /^[a-f0-9]{24}$/;

export function getPageRelease(): string | undefined {
  const version = document.querySelector<HTMLMetaElement>('meta[name="nodia-release"]')?.content;
  if (version && releaseFormat.test(version)) return version;
}

export async function readPublishedRelease(signal?: AbortSignal): Promise<string | undefined> {
  const request = new AbortController();
  function cancel() { request.abort(); }
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = window.setTimeout(cancel, 8_000);
  try {
    const response = await fetch("/pwa-release.json", { cache: "no-store", signal: request.signal });
    if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) return;
    const info: unknown = await response.json();
    if (info && typeof info === "object" && "version" in info && typeof info.version === "string" &&
      releaseFormat.test(info.version)) return info.version;
  } finally {
    signal?.removeEventListener("abort", cancel);
    window.clearTimeout(timer);
  }
}

function waitForWorker(worker: ServiceWorker, states: ReadonlyArray<ServiceWorkerState>): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => finish(false), 8_000);
    function finish(ready: boolean) {
      window.clearTimeout(timeout);
      worker.removeEventListener("statechange", check);
      resolve(ready);
    }
    function check() {
      if (states.includes(worker.state)) finish(true);
      else if (worker.state === "redundant") finish(false);
    }
    worker.addEventListener("statechange", check);
    check();
  });
}

function readWorkerRelease(worker: ServiceWorker): Promise<unknown> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => finish(undefined), 1_500);
    function finish(version: unknown) {
      window.clearTimeout(timeout);
      channel.port1.close();
      resolve(version);
    }
    channel.port1.onmessage = (event: MessageEvent<unknown>) => finish(event.data);
    try {
      worker.postMessage({ type: "nodia:pwa-release" }, [channel.port2]);
    } catch {
      finish(undefined);
    }
  });
}

async function workerForRelease(registration: ServiceWorkerRegistration, version: string) {
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (worker && await waitForWorker(worker, ["installed", "activating", "activated"]) &&
    await readWorkerRelease(worker) === version) return worker;
}

export async function prepareReleaseWorker(version: string): Promise<ServiceWorker | undefined> {
  const registration = await preparePwaRegistration();
  const candidate = await workerForRelease(registration, version);
  if (candidate) return candidate;
  await registration.update();
  return workerForRelease(registration, version);
}

export async function activateRelease(version: string): Promise<boolean> {
  const worker = await prepareReleaseWorker(version);
  if (!worker) return false;
  if (worker.state === "installed") worker.postMessage({ type: "nodia:pwa-activate", version });
  return waitForWorker(worker, ["activated"]);
}
