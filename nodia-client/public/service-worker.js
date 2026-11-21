const businessPath = /^\/business\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const notificationId = /^[A-Za-z0-9_-]{1,128}$/;
const notice = {
  en: ["Provider visit reminder", "Open Nodia to see the details."],
  es: ["Recordatorio de visita de proveedor", "Abre Nodia para ver los detalles."],
};

const release = typeof nodiaRelease === "undefined" ? null : nodiaRelease;
const assetCachePrefix = "nodia-static-v1-";
const assetCache = release && assetCachePrefix + release.version;
const publicAssets = new Set(release?.assets);
const hashedAsset = /^\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2)$/;
const teacherReaderPath = "/nodia-teacher/downloads";
const teacherCachePrefix = "nodia-teacher-reader-v1-";
const teacherCache = release && teacherCachePrefix + release.version;
const teacherAssetsHeader = "X-Nodia-Reader-Assets";
let preparingTeacherReader;
const documentPath = /^\/(?:[A-Za-z0-9-]+\/)*[A-Za-z0-9-]*$/;
const reservedPath = /\/(?:api|auth|oauth2?|callback|assets|cdn-cgi)(?:\/|$)/i;
const offlineRetryScript = 'document.getElementById("retry").addEventListener("click", () => location.reload());';
const offlineCopy = {
  en: {
    offlineTitle: "No internet connection",
    offlineBody: "Check your connection and try opening Nodia again.",
    unavailableTitle: "Nodia could not open",
    unavailableBody: "This browser could not reach Nodia. Please try again.",
    retry: "Try again",
    manualRetry: "Reload this page to try again.",
    teacherDownloads: "Teacher downloads",
  },
  es: {
    offlineTitle: "Sin conexión a internet",
    offlineBody: "Revisa tu conexión y vuelve a intentar abrir Nodia.",
    unavailableTitle: "No se pudo abrir Nodia",
    unavailableBody: "Este navegador no pudo acceder a Nodia. Vuelve a intentarlo.",
    retry: "Reintentar",
    manualRetry: "Recarga esta página para volver a intentarlo.",
    teacherDownloads: "Descargas de Teacher",
  },
};

function teacherCacheNames(names) {
  return names.filter((name) => /^nodia-teacher-reader-v1-[a-f0-9]{24}$/.test(name)).reverse();
}

async function cachedTeacherReader(cache) {
  const response = await cache.match(teacherReaderPath);
  const metadata = response?.headers.get(teacherAssetsHeader);
  if (!metadata) return;
  const paths = metadata.split(",");
  if (paths.length > 32 || !paths.every((path) => hashedAsset.test(path))) return;
  const assets = await Promise.all(paths.map((path) => cache.match(path)));
  if (assets.every(Boolean)) return response;
}

async function readTeacherReader() {
  try {
    const knownCaches = teacherCacheNames(await caches.keys());
    const ordered = knownCaches.includes(teacherCache)
      ? [teacherCache, ...knownCaches.filter((name) => name !== teacherCache)]
      : knownCaches;
    for (const name of ordered) {
      const reader = await cachedTeacherReader(await caches.open(name));
      if (reader) return reader;
    }
  } catch {
    // Keep the generic offline page available if Cache Storage is unavailable.
  }
}

async function cacheTeacherAsset(cache, asset, signal) {
  const request = new Request(new URL(asset.path, self.location.origin), {
    cache: "no-store", credentials: "omit", redirect: "error", signal,
  });
  const response = await fetch(request);
  if (!isPublicAssetResponse(response, asset.path)) throw new Error("Unavailable Teacher reader asset");
  const body = await response.arrayBuffer();
  if (body.byteLength !== asset.bytes) throw new Error("Unexpected Teacher reader asset size");
  const digest = await crypto.subtle.digest("SHA-256", body);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== asset.sha256) throw new Error("Unexpected Teacher reader asset content");
  await cache.put(asset.path, new Response(body, { headers: { "Content-Type": response.headers.get("Content-Type") } }));
}

async function prepareTeacherReader() {
  if (!release?.teacherReader) return false;
  const { html, assets } = release.teacherReader;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const cache = await caches.open(teacherCache);
    if (await cachedTeacherReader(cache)) return true;
    const results = await Promise.allSettled(assets.map((asset) => cacheTeacherAsset(cache, asset, controller.signal)));
    if (results.some((result) => result.status === "rejected")) {
      await caches.delete(teacherCache);
      return false;
    }
    // Write the document last so a partial download never becomes a usable reader.
    await cache.put(teacherReaderPath, new Response(html, { headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https:; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      [teacherAssetsHeader]: assets.map(({ path }) => path).join(","),
    } }));
    // Keep the current reader and one complete previous version. Generic PWA cleanup excludes these caches.
    const previous = teacherCacheNames(await caches.keys()).filter((name) => name !== teacherCache);
    await Promise.allSettled(previous.slice(1).map((name) => caches.delete(name)));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isAppNavigation(request, url) {
  return request.mode === "navigate" && request.destination === "document" &&
    request.headers.get("Accept")?.includes("text/html") && documentPath.test(url.pathname) &&
    !reservedPath.test(url.pathname) &&
    !(url.searchParams.has("state") && (url.searchParams.has("code") || url.searchParams.has("error")));
}

async function readDocument(request) {
  try {
    return await fetch(request);
  } catch {
    // An HTTP response, including an error, is authoritative. This fallback only handles failed connections.
    const isTeacherReader = new URL(request.url).pathname === teacherReaderPath;
    if (isTeacherReader && release?.teacherReader) {
      const reader = await readTeacherReader();
      if (reader) return reader;
    }
    const lang = /^en(?:-|$)/i.test(self.navigator.language) ? "en" : "es";
    const copy = offlineCopy[lang];
    const offline = self.navigator.onLine === false;
    const title = offline ? copy.offlineTitle : copy.unavailableTitle;
    const description = offline ? copy.offlineBody : copy.unavailableBody;
    const teacherLink = release?.teacherReader && !isTeacherReader
      ? `<p><a href="${teacherReaderPath}">${copy.teacherDownloads}</a></p>`
      : "";
    const html = `<!doctype html><html lang="${lang}">
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Nodia</title>
<style>
  :root { color-scheme: light dark; font: 100% / 1.5 system-ui, sans-serif; }
  body { color: CanvasText; background: Canvas; margin: 0; min-height: 100vh; display: grid; place-items: center; }
  main { max-width: 32rem; padding: 1.5rem; }
  h1 { margin: 0; font-size: clamp(1.5rem, 5vw, 2rem); }
  button { min-height: 44px; padding: .5rem 1rem; font: inherit; }
</style>
<main><h1>${title}</h1><p>${description}</p>
  <button id="retry" type="button">${copy.retry}</button><noscript><p>${copy.manualRetry}</p></noscript>
  ${teacherLink}</main><script>${offlineRetryScript}</script></html>`;
    return new Response(html, { status: 503, headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Language": lang,
      "Cache-Control": "no-store",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      // The only permitted script is the fixed retry handler above.
      "Content-Security-Policy": "default-src 'none'; script-src 'sha256-T2i20Mt38ORYWWSHl2Yk9ZgIpYVuW9cT4BZi0Lxk6qo='; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    } });
  }
}

function isPublicAssetResponse(response, path) {
  const mime = (response.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  if (response.status !== 200 || response.redirected || response.type !== "basic") return false;
  if (path.endsWith(".js")) return /^(?:application|text)\/(?:x-)?javascript$/.test(mime);
  if (path.endsWith(".css")) return mime === "text/css";
  return mime === "font/woff2" || mime === "application/octet-stream";
}

async function preloadEntryAssets() {
  // Verify the published entry before making this worker available for activation.
  const existingCache = await caches.has(assetCache).catch(() => false);
  const cache = await caches.open(assetCache).catch(() => undefined);
  const results = await Promise.allSettled(release.entry.map(async (path) => {
    const request = new Request(new URL(path, self.location.origin), { redirect: "error" });
    const response = await fetch(request);
    if (!isPublicAssetResponse(response, path)) throw new Error("Unavailable PWA entry resource");
    // Consume each response as it arrives to free the network connection.
    if (cache) await cache.put(request, response).catch(() => {});
    else await response.arrayBuffer();
  }));
  if (results.some((result) => result.status === "rejected")) {
    if (cache && !existingCache) await caches.delete(assetCache).catch(() => {});
    throw new Error("Unavailable PWA entry resources");
  }
}

async function nodiaAssetCaches() {
  return (await caches.keys()).filter((name) => /^nodia-static-v1-[a-f0-9]{24}$/.test(name));
}

async function activateRelease() {
  try {
    const previous = (await nodiaAssetCaches()).filter((name) => name !== assetCache).reverse();
    await Promise.all(previous.slice(2).map((name) => caches.delete(name)));
  } catch {
    // The application and push can continue without Cache Storage.
  }
  await self.clients.claim();
}

async function readAsset(event, path) {
  try {
    const names = await caches.keys();
    const appCaches = names.filter((name) => /^nodia-static-v1-[a-f0-9]{24}$/.test(name)).reverse();
    for (const name of [...appCaches, ...teacherCacheNames(names)]) {
      const cache = await caches.open(name);
      const response = await cache.match(event.request);
      if (response) return response;
    }
  } catch {
    // Fetch the public asset from the origin if the cache is unavailable.
  }
  const response = await fetch(event.request);
  if (publicAssets.has(path) && isPublicAssetResponse(response, path)) {
    const copy = response.clone();
    event.waitUntil(caches.open(assetCache).then((cache) => cache.put(event.request, copy)).catch(() => {}));
  }
  return response;
}

function isProviderVisit(value) {
  return value && !Array.isArray(value) && typeof value === "object" &&
    Object.keys(value).length === 4 && value.version === 1 && value.kind === "provider_visit" &&
    typeof value.path === "string" && businessPath.test(value.path) &&
    typeof value.notificationId === "string" && notificationId.test(value.notificationId);
}

function withLocaleStore(mode, operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("nodia-push", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("settings");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      try {
        const transaction = database.transaction("settings", mode);
        const result = operation(transaction.objectStore("settings"));
        transaction.oncomplete = () => { database.close(); resolve(result.result); };
        transaction.onabort = () => { database.close(); reject(transaction.error); };
      } catch (error) {
        database.close();
        reject(error);
      }
    };
  });
}

async function notificationLocale() {
  const browserLocale = /^en(?:-|$)/i.test(self.navigator.language) ? "en" : "es";
  let timer;
  try {
    const locale = await Promise.race([
      withLocaleStore("readonly", (store) => store.get("locale")),
      new Promise((resolve) => { timer = setTimeout(resolve, 250); }),
    ]);
    return locale === "en" || locale === "es" ? locale : browserLocale;
  } catch {
    return browserLocale;
  } finally {
    clearTimeout(timer);
  }
}

async function showProviderVisit(payload) {
  const lang = await notificationLocale();
  const [title, body] = notice[lang];
  await self.registration.showNotification(title, {
    body,
    lang,
    icon: "/icons/icon-192.png",
    tag: `nodia-provider-visit-${payload.notificationId}`,
    data: payload,
  });
}

async function openBusiness(path) {
  const destination = new URL(path, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const existing = windows.find((client) => client.url === destination);
  if (existing) {
    let navigated;
    try {
      // Reload the destination so the application resolves the current session and access.
      navigated = await existing.navigate(destination);
    } catch {
      // The window may have closed while the notification was opened.
    }
    if (navigated) {
      await navigated.focus().catch(() => {});
      return;
    }
  }
  return self.clients.openWindow(destination);
}

self.addEventListener("install", (event) => {
  event.waitUntil(release ? preloadEntryAssets() : self.skipWaiting());
});

if (release) {
  self.addEventListener("activate", (event) => {
    event.waitUntil(activateRelease());
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET" || request.headers.has("Authorization") || request.headers.has("Range")) return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (isAppNavigation(request, url)) {
      event.respondWith(readDocument(request));
      return;
    }
    if (!["script", "style", "font"].includes(request.destination) || url.search || !hashedAsset.test(url.pathname)) return;
    event.respondWith(readAsset(event, url.pathname));
  });
}

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch {
    return;
  }
  if (isProviderVisit(payload)) event.waitUntil(showProviderVisit(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = event.notification.data;
  if (isProviderVisit(payload)) event.waitUntil(openBusiness(payload.path));
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) client.postMessage({ type: "nodia:push-subscription-changed" });
  }));
});

self.addEventListener("message", (event) => {
  if (event.origin !== self.location.origin || event.source?.type !== "window") return;
  if (event.data?.type === "nodia:teacher-offline-ready" && event.ports[0]) {
    preparingTeacherReader ??= prepareTeacherReader().finally(() => { preparingTeacherReader = undefined; });
    event.waitUntil(preparingTeacherReader.then((ready) => event.ports[0].postMessage(ready)));
    return;
  }
  if (release && event.data?.type === "nodia:pwa-release") {
    event.ports[0]?.postMessage(release.version);
    return;
  }
  if (release && event.data?.type === "nodia:pwa-activate" && event.data.version === release.version) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type !== "nodia:push-worker-locale") return;
  const { locale } = event.data;
  if (locale === "en" || locale === "es") {
    event.waitUntil(withLocaleStore("readwrite", (store) => store.put(locale, "locale")).catch(() => {}));
  }
});
