export type OfflineStudyScope = Readonly<{ ownerId: string; sessionId: string }>;

export const offlineStudyGrantKey = "nodia.teacher.offline.grant";
const authKey = "authStore";
const revisionKey = "nodia.teacher.offline.revision";
const changeEvent = "nodia:teacher-offline-changed";
const accountId = /^\d{1,32}$/;
export const offlineStudyUuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export type OfflineStudyGrant = OfflineStudyScope & Readonly<{ grantId: string }>;

export const isStudyRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function sameOfflineStudyScope(a: OfflineStudyScope | null, b: OfflineStudyScope | null): boolean {
  return Boolean(a && b && a.ownerId === b.ownerId && a.sessionId === b.sessionId);
}

export function offlineStudyScope(token: string | null, userId?: string | null): OfflineStudyScope | null {
  if (!token || !userId || !accountId.test(userId) || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    // The claims identify an already-authorized local grant. Parsing never authenticates a session.
    const claims: unknown = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!isStudyRecord(claims) || claims.sub !== userId || claims.token_use !== "access" ||
      typeof claims.sid !== "string" || !offlineStudyUuid.test(claims.sid)) return null;
    return { ownerId: userId, sessionId: claims.sid.toLowerCase() };
  } catch {
    return null;
  }
}

function storedValue(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function readOfflineStudyAccount(): { scope: OfflineStudyScope; token: string } | null {
  try {
    const saved: unknown = JSON.parse(storedValue(authKey) ?? "null");
    if (!isStudyRecord(saved) || saved.version !== 1 || !isStudyRecord(saved.state)) return null;
    const { token, user } = saved.state;
    if (typeof token !== "string" || !isStudyRecord(user) || typeof user.id !== "string") return null;
    const scope = offlineStudyScope(token, user.id);
    return scope ? { scope, token } : null;
  } catch {
    return null;
  }
}

function parseGrant(raw: string | null): OfflineStudyGrant | null {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!isStudyRecord(value) || typeof value.ownerId !== "string" || !accountId.test(value.ownerId) ||
      typeof value.sessionId !== "string" || !offlineStudyUuid.test(value.sessionId) ||
      typeof value.grantId !== "string" || !offlineStudyUuid.test(value.grantId)) return null;
    return { ownerId: value.ownerId, sessionId: value.sessionId, grantId: value.grantId };
  } catch {
    return null;
  }
}

export function offlineStudyGrantSnapshot(): { raw: string | null; grant: OfflineStudyGrant | null } {
  const raw = storedValue(offlineStudyGrantKey);
  return { raw, grant: parseGrant(raw) };
}

export function notifyOfflineStudyChange(): void {
  try { localStorage.setItem(revisionKey, crypto.randomUUID()); } catch { /* Optional cross-tab refresh. */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(changeEvent));
}

export function subscribeOfflineStudyChanges(listener: () => void, includeSameTab = true): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === authKey || event.key === offlineStudyGrantKey || event.key === revisionKey) listener();
  }
  window.addEventListener("storage", onStorage);
  if (includeSameTab) window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    if (includeSameTab) window.removeEventListener(changeEvent, listener);
  };
}

export function clearOfflineStudyGrant(expected?: OfflineStudyScope): void {
  const { raw, grant } = offlineStudyGrantSnapshot();
  const current = grant ?? readOfflineStudyAccount()?.scope;
  if (expected && current && !sameOfflineStudyScope(current, expected)) return;
  try {
    // A tombstone also fences a download that started before any grant existed.
    localStorage.setItem(offlineStudyGrantKey, `revoked:${crypto.randomUUID()}`);
  } catch {
    if (raw !== null) {
      try { localStorage.removeItem(offlineStudyGrantKey); } catch { /* Storage may already be inaccessible. */ }
    }
  }
  notifyOfflineStudyChange();
  if (grant) void import("./offlineStudy").then(store => store.deleteOfflineStudyGrant(grant.grantId)).catch(() => undefined);
}
