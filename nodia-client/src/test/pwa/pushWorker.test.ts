import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const script = readFileSync(resolve(import.meta.dirname, "../../../public/service-worker.js"), "utf8");
const origin = "https://example.invalid";
const payload = {
  version: 1,
  kind: "provider_visit",
  path: "/business/2ce10550-2e2a-4991-b6d1-d6eb85ee9335",
  notificationId: "delivery_42",
};
const destination = origin + payload.path;

type TeacherReader = { html: string; assets: Array<{ path: string; bytes: number; sha256: string }> };

function startWorker({ language = "es-CL", windows = [] as object[], version = "", online = true,
  teacherReader, cacheStorage = new Map<string, Map<string, Response>>(),
}: { language?: string; windows?: object[]; version?: string; online?: boolean;
  teacherReader?: TeacherReader; cacheStorage?: Map<string, Map<string, Response>>;
} = {}) {
  const listeners = new Map<string, (event: object) => void>();
  const showNotification = vi.fn();
  const openWindow = vi.fn();
  const skipWaiting = vi.fn();
  const matchAll = vi.fn().mockResolvedValue(windows);
  const networkFetch = vi.fn();
  const cacheOpen = vi.fn(async (name: string) => {
    const records = cacheStorage.get(name) ?? new Map<string, Response>();
    cacheStorage.set(name, records);
    const key = (url: string | Request) => new URL(typeof url === "string" ? url : url.url, origin).pathname;
    return {
      match: async (url: string | Request) => records.get(key(url))?.clone(),
      put: async (url: string | Request, response: Response) => { records.set(key(url), response.clone()); },
    };
  });
  runInNewContext(script, {
    URL,
    Response,
    Request,
    AbortController,
    crypto: webcrypto,
    fetch: networkFetch,
    setTimeout,
    clearTimeout,
    nodiaRelease: version ? { version, entry: [], assets: [], teacherReader } : undefined,
    caches: { has: async (name: string) => cacheStorage.has(name), open: cacheOpen,
      keys: async () => [...cacheStorage.keys()], delete: async (name: string) => cacheStorage.delete(name) },
    self: {
      location: { origin },
      navigator: { language, onLine: online },
      registration: { showNotification },
      clients: { matchAll, openWindow },
      skipWaiting,
      addEventListener: (type: string, listener: (event: object) => void) => { listeners.set(type, listener); },
    },
  });

  async function dispatch(type: string, event: object = {}) {
    const waits: Promise<unknown>[] = [];
    const listener = listeners.get(type);
    if (!listener) throw new Error(`Missing listener for ${type}`);
    listener({ ...event, waitUntil: (value: Promise<unknown>) => waits.push(value) });
    await Promise.all(waits);
  }

  return {
    dispatch, listeners, showNotification, openWindow, matchAll, skipWaiting,
    networkFetch, cacheOpen, cacheStorage,
    request: async (request: object) => {
      const respondWith = vi.fn<(response: Promise<Response>) => void>();
      await dispatch("fetch", { request, respondWith });
      return respondWith.mock.calls[0]?.[0];
    },
    push: (value: unknown) => dispatch("push", { data: { json: () => value } }),
    click: (value: unknown, close = vi.fn()) => dispatch("notificationclick", { notification: { data: value, close } }),
  };
}

describe("provider-visit service worker", () => {
  it.each([
    ["es-CL", "es", "Recordatorio de visita de proveedor", "Abre Nodia para ver los detalles."],
    ["en-US", "en", "Provider visit reminder", "Open Nodia to see the details."],
  ])("displays the fixed generic notification in %s and deduplicates by ID", async (language, lang, title, body) => {
    const worker = startWorker({ language });
    await worker.push(payload);
    expect(worker.showNotification).toHaveBeenCalledExactlyOnceWith(title, {
      lang, body, tag: "nodia-provider-visit-delivery_42", icon: "/icons/icon-192.png", data: payload,
    });
  });

  it("rejects malformed or unsupported payloads both upon push and upon notification click", async () => {
    const worker = startWorker();
    await worker.dispatch("push", { data: { json: () => { throw new SyntaxError("invalid JSON"); } } });
    const invalid = [
      undefined, null, [], {}, { ...payload, version: 2 }, { ...payload, kind: "other" },
      { ...payload, notificationId: "" }, { ...payload, body: "external text" },
      ...[
        destination, `//evil.invalid${payload.path}`, `https://evil.invalid${payload.path}`,
        payload.path + "?redirect=//evil.invalid", payload.path + "#fragment", payload.path + "/",
        "/business/../settings", "/business/2ce10550%2f2e2a-4991-b6d1-d6eb85ee9335",
        "/business\\2ce10550-2e2a-4991-b6d1-d6eb85ee9335", payload.path.toUpperCase(), `${payload.path}\n`,
      ].map((path) => ({ ...payload, path })),
    ];
    const close = vi.fn();
    for (const value of invalid) {
      await worker.push(value);
      await worker.click(value, close);
    }
    expect(close).toHaveBeenCalledTimes(invalid.length);
    expect(worker.showNotification).not.toHaveBeenCalled();
    expect(worker.matchAll).not.toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("reopens the exact destination so the app resolves session and access before showing business data", async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn().mockResolvedValue({ focus });
    const other = { url: origin + "/business/44013048-fbc8-4d5d-83ac-c331b99ec2b6", navigate: vi.fn() };
    const worker = startWorker({ windows: [other, { url: destination, navigate }] });
    await worker.click(payload);
    expect(worker.matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
    expect(navigate).toHaveBeenCalledExactlyOnceWith(destination);
    expect(focus).toHaveBeenCalledOnce();
    expect(other.navigate).not.toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("opens the same-origin destination if the exact tab is missing or closed while navigating", async () => {
    const missing = startWorker({ windows: [{ url: destination + "?details=1" }] });
    await missing.click(payload);
    expect(missing.openWindow).toHaveBeenCalledExactlyOnceWith(destination);

    const navigate = vi.fn().mockRejectedValue(new Error("closed"));
    const closed = startWorker({ windows: [{ url: destination, navigate }] });
    await closed.click(payload);
    expect(closed.openWindow).toHaveBeenCalledExactlyOnceWith(destination);
  });

  it("keeps the fallback push-only worker and signals tabs without private subscription data", async () => {
    const postMessage = vi.fn();
    const worker = startWorker({ windows: [{ postMessage }] });
    await worker.dispatch("install");
    await worker.dispatch("pushsubscriptionchange", { newSubscription: { endpoint: "private" } });
    expect(worker.skipWaiting).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "nodia:push-subscription-changed" });
    expect(worker.listeners.has("fetch")).toBe(false);
  });

  it("waits for an explicit matching release from a Nodia window before activating and still delivers push", async () => {
    const version = "111111111111111111111111";
    const worker = startWorker({ version });
    const source = { type: "window" };
    const activation = { type: "nodia:pwa-activate", version };
    await worker.dispatch("install");
    await worker.dispatch("message", { origin: "https://other.invalid", source, data: activation });
    await worker.dispatch("message", { origin, source, data: { ...activation, version: "stale" } });
    expect(worker.skipWaiting).not.toHaveBeenCalled();

    const reply = vi.fn();
    await worker.dispatch("message", { origin, source, ports: [{ postMessage: reply }], data: { type: "nodia:pwa-release" } });
    expect(reply).toHaveBeenCalledExactlyOnceWith(version);
    await worker.dispatch("message", { origin, source, data: activation });
    expect(worker.skipWaiting).toHaveBeenCalledOnce();
    await worker.dispatch("push", { data: { json: () => payload } });
    expect(worker.showNotification).toHaveBeenCalledOnce();
  });
});

describe("offline startup in the versioned worker", () => {
  const version = "111111111111111111111111";
  const document = {
    method: "GET", mode: "navigate", destination: "document", url: `${destination}?tab=providers`,
    headers: new Headers({ Accept: "text/html,application/xhtml+xml" }),
  };

  it.each([200, 401, 403, 404, 410, 503])("preserves the origin's HTTP %i document without caching it", async (status) => {
    const worker = startWorker({ version, online: false });
    const response = new Response("origin response", { status });
    worker.networkFetch.mockResolvedValueOnce(response);

    await expect(worker.request(document)).resolves.toBe(response);
    expect(worker.networkFetch).toHaveBeenCalledExactlyOnceWith(document);
    expect(worker.cacheOpen).not.toHaveBeenCalled();
  });

  it.each([
    [false, "es-CL", "es", "Sin conexión a internet"],
    [true, "en-US", "en", "Nodia could not open"],
  ])("offers a localized explicit retry only after a navigation transport failure (online=%s)", async (online, language, lang, heading) => {
    const worker = startWorker({ version, online, language });
    worker.networkFetch.mockRejectedValueOnce(new TypeError("Network error"));

    const response = await worker.request(document);
    const html = await response?.text();
    const retryScript = html?.match(/<script>(.*?)<\/script>/)?.[1];
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Content-Language")).toBe(lang);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html).not.toContain(destination);
    expect(retryScript).toContain('addEventListener("click", () => location.reload())');
    expect(response?.headers.get("Content-Security-Policy")).toContain(`'sha256-${createHash("sha256").update(retryScript ?? "").digest("base64")}'`);
    expect(worker.cacheOpen).not.toHaveBeenCalled();
  });

  it("passes API, OAuth, non-document and cross-origin traffic through untouched", async () => {
    const worker = startWorker({ version });
    const requests = [
      { url: `${origin}/api/v1/auth/me` },
      { url: `${origin}/oauth/callback` },
      { url: `${origin}/login?code=oauth-code&state=oauth-state` },
      { url: `${origin}/public/export.csv` },
      { url: "https://another.invalid/business" },
      { method: "POST" },
      { destination: "iframe" },
      { headers: new Headers({ Accept: "application/json" }) },
    ];
    for (const request of requests) {
      await expect(worker.request({ ...document, ...request })).resolves.toBeUndefined();
    }
    expect(worker.networkFetch).not.toHaveBeenCalled();
    expect(worker.cacheOpen).not.toHaveBeenCalled();
  });
});

describe("Teacher offline reader shell", () => {
  const version = "111111111111111111111111";
  const path = "/nodia-teacher/downloads";
  const scriptPath = "/assets/downloads-12345678.js";
  const source = "export {};";
  const html = `<main>Teacher reader</main><script type="module" src="${scriptPath}"></script>`;
  const teacherReader = { html, assets: [{ path: scriptPath, bytes: source.length,
    sha256: createHash("sha256").update(source).digest("hex") }] };
  const document = { method: "GET", mode: "navigate", destination: "document", url: `${origin}${path}?unit=fixture`,
    headers: new Headers({ Accept: "text/html" }) };
  function scriptResponse(body: string) {
    return Object.defineProperty(new Response(body, { headers: { "Content-Type": "text/javascript" } }), "type", { value: "basic" });
  }
  async function requestReadiness(worker: ReturnType<typeof startWorker>, sender = origin) {
    const reply = vi.fn();
    await worker.dispatch("message", { origin: sender, source: { type: "window" }, ports: [{ postMessage: reply }],
      data: { type: "nodia:teacher-offline-ready" } });
    return reply;
  }

  it("prepares only verified public files and opens the reader from that cache without a connection", async () => {
    const worker = startWorker({ version, teacherReader });
    worker.networkFetch.mockResolvedValueOnce(scriptResponse(source));
    const ignored = await requestReadiness(worker, "https://another.invalid");
    expect(ignored).not.toHaveBeenCalled();
    expect(worker.networkFetch).not.toHaveBeenCalled();

    expect(await requestReadiness(worker)).toHaveBeenCalledExactlyOnceWith(true);
    const request = worker.networkFetch.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(origin + scriptPath);
    expect(request.credentials).toBe("omit");
    expect(request.headers.has("Authorization")).toBe(false);

    worker.networkFetch.mockRejectedValue(new TypeError("offline"));
    const reader = await worker.request(document);
    expect(reader?.status).toBe(200);
    expect(await reader?.text()).toBe(html);
    const cachedScript = await worker.request({ ...document, url: origin + scriptPath, destination: "script", mode: "cors" });
    expect(await cachedScript?.text()).toBe(source);
    expect(worker.networkFetch).toHaveBeenCalledTimes(2);
    const fallback = await worker.request({ ...document, url: `${origin}/` });
    expect(await fallback?.text()).toContain(`href="${path}">Descargas de Teacher`);
  });

  it("does not complete a reader with bad bytes or replace a reachable HTTP error", async () => {
    const worker = startWorker({ version, teacherReader });
    worker.networkFetch.mockResolvedValueOnce(scriptResponse("export 0;;"));
    expect(await requestReadiness(worker)).toHaveBeenCalledExactlyOnceWith(false);
    expect(worker.cacheStorage.size).toBe(0);
    const denied = new Response("denied", { status: 403 });
    worker.networkFetch.mockResolvedValueOnce(denied);
    await expect(worker.request(document)).resolves.toBe(denied);
    worker.networkFetch.mockRejectedValueOnce(new TypeError("offline"));
    const unavailable = await worker.request(document);
    expect(unavailable?.status).toBe(503);
    expect(await unavailable?.text()).not.toContain(`href="${path}"`);
  });

  it("continues reading the last completed shell after a new release activates", async () => {
    const previous = startWorker({ version, teacherReader });
    previous.networkFetch.mockResolvedValueOnce(scriptResponse(source));
    expect(await requestReadiness(previous)).toHaveBeenCalledExactlyOnceWith(true);
    const current = startWorker({ version: "222222222222222222222222", teacherReader, cacheStorage: previous.cacheStorage });
    current.networkFetch.mockRejectedValueOnce(new TypeError("offline"));
    expect(await (await current.request(document))?.text()).toBe(html);
  });
});
