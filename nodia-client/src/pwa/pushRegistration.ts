export const PUSH_SUBSCRIPTION_CHANGED = "nodia:push-subscription-changed";

const workerPath = "/service-worker.js";
const workerScope = "/";

let registrationInProgress: Promise<ServiceWorkerRegistration> | undefined;

export function supportsPwaRegistration(): boolean {
  return import.meta.env.PROD && typeof window !== "undefined" &&
    window.isSecureContext && "serviceWorker" in navigator;
}

export function supportsPushRegistration(): boolean {
  return supportsPwaRegistration() && "PushManager" in window && "Notification" in window;
}

function hasRootScope(registration: ServiceWorkerRegistration): boolean {
  return registration.scope === new URL(workerScope, window.location.origin).href;
}

function isNodiaPushRegistration(registration: ServiceWorkerRegistration): boolean {
  const scriptUrl = new URL(workerPath, window.location.origin).href;
  const workers = [registration.active, registration.waiting, registration.installing].filter(Boolean);
  return hasRootScope(registration) && workers.length > 0 && workers.every((worker) => worker?.scriptURL === scriptUrl);
}

export async function getPushRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration(workerScope);
  return registration && isNodiaPushRegistration(registration) ? registration : undefined;
}

export async function waitForActivation(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active?.state === "activated") return;
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) throw new Error("Push service worker is unavailable");

  await new Promise<void>((resolve, reject) => {
    function finish(error?: Error) {
      clearTimeout(timer);
      worker?.removeEventListener("statechange", onStateChange);
      if (error) reject(error);
      else resolve();
    }
    function onStateChange() {
      if (worker?.state === "activated") finish();
      if (worker?.state === "redundant") finish(new Error("Push service worker installation failed"));
    }
    const timer = setTimeout(() => finish(new Error("Push service worker activation timed out")), 10_000);
    worker.addEventListener("statechange", onStateChange);
    onStateChange();
  });
}

async function registerNodiaWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(workerScope);
  if (existing && hasRootScope(existing)) {
    if (!isNodiaPushRegistration(existing)) throw new Error("The root service worker scope is already in use");
    return existing;
  }
  const registration = await navigator.serviceWorker.register(workerPath, {
    scope: workerScope,
    updateViaCache: "none",
  });
  if (!isNodiaPushRegistration(registration)) throw new Error("Nodia service worker is unavailable");
  return registration;
}

export function preparePwaRegistration(): Promise<ServiceWorkerRegistration> {
  if (!supportsPwaRegistration()) return Promise.reject(new Error("Service workers are unavailable"));
  registrationInProgress ??= registerNodiaWorker().finally(() => { registrationInProgress = undefined; });
  return registrationInProgress;
}

export async function preparePushRegistration(): Promise<ServiceWorkerRegistration> {
  if (!supportsPushRegistration()) throw new Error("Web Push is unavailable");
  const registration = await preparePwaRegistration();
  await waitForActivation(registration);
  if (!isNodiaPushRegistration(registration) || !registration.active) throw new Error("Push service worker is unavailable");
  return registration;
}

export function setPushWorkerLocale(registration: ServiceWorkerRegistration, locale: string): void {
  const language = /^en(?:-|$)/i.test(locale) ? "en" : "es";
  try {
    registration.active?.postMessage({ type: "nodia:push-worker-locale", locale: language });
  } catch {
    // A worker update can replace the active instance while the page sends the locale.
  }
}
