import { clearNodiaAiDraftStorage, nodiaAiDraftStoragePrefix as prefix } from "../../../config/nodiaAiDraftStorage";
type Draft = { text: string; expiresAt: number };
type Scope = { actorId: string; conversationId: string };
const keyOf = ({ actorId, conversationId }: Scope) => prefix + JSON.stringify([actorId, conversationId]);

/** Tab-local, unsubmitted text only. Storage denial never prevents editing. */
export function createConversationDrafts(storage: () => Storage | null, maxTextBytes: number, now = Date.now) {
  const memory = new Map<string, Draft>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const bytes = (text: string) => new TextEncoder().encode(text).length;
  const maxSerializedChars = JSON.stringify({ text: "", expiresAt: Number.MAX_SAFE_INTEGER }).length + maxTextBytes * 6;
  const decode = (raw: string | null): Draft | null => {
    if (!raw || raw.length > maxSerializedChars) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === "object" && Object.keys(parsed).length === 2
        && "text" in parsed && typeof parsed.text === "string" && parsed.text.length > 0 && bytes(parsed.text) <= maxTextBytes
        && "expiresAt" in parsed && typeof parsed.expiresAt === "number" && Number.isSafeInteger(parsed.expiresAt)
        && parsed.expiresAt > now() ? { text: parsed.text, expiresAt: parsed.expiresAt } : null;
    } catch { return null; }
  };
  const remove = (key: string) => {
    memory.delete(key);
    try { storage()?.removeItem(key); } catch { /* Private mode / disabled storage. */ }
  };
  const get = (scope: Scope, maximumExpiresAt?: string): string => {
    const key = keyOf(scope);
    let entry: Draft | null | undefined = memory.get(key);
    if (entry === undefined) {
      try {
        entry = decode(storage()?.getItem(key) ?? null);
      } catch { entry = null; }
      if (entry) memory.set(key, entry);
    }
    if (!entry || entry.expiresAt <= now()
      || (maximumExpiresAt !== undefined && entry.expiresAt > Date.parse(maximumExpiresAt))) { remove(key); return ""; }
    return entry.text;
  };
  const prune = () => {
    for (const [key, entry] of memory) if (entry && entry.expiresAt <= now()) remove(key);
    try {
      const target = storage();
      if (target) for (let i = target.length - 1; i >= 0; i--) {
        const key = target.key(i);
        if (!key?.startsWith(prefix)) continue;
        if (!decode(target.getItem(key))) remove(key);
      }
    } catch { /* Storage may be unavailable. */ }
    notify();
  };
  prune();
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    get,
    prune,
    hasTimeRemaining(expiresAt: string) { return Date.parse(expiresAt) > now(); },
    set(scope: Scope, text: string, expiresAt: string) {
      const key = keyOf(scope), expiry = Date.parse(expiresAt);
      if (!text || !Number.isFinite(expiry) || expiry <= now()) remove(key);
      else {
        const entry = { text, expiresAt: expiry };
        memory.set(key, entry);
        try {
          if (bytes(text) <= maxTextBytes) storage()?.setItem(key, JSON.stringify(entry));
          else storage()?.removeItem(key); // Over-limit editing remains in memory only.
        } catch {
          // Do not leave the prior persisted revision available after a quota
          // failure. Both operations may be denied; editing still works.
          try { storage()?.removeItem(key); } catch { /* Best effort only. */ }
        }
      }
      notify();
    },
    remove(scope: Scope) { remove(keyOf(scope)); notify(); },
    clear() {
      memory.clear();
      try { clearNodiaAiDraftStorage(storage()); } catch { /* Storage may be unavailable. */ }
      notify();
    },
  };
}
