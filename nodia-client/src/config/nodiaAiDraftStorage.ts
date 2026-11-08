export const nodiaAiDraftStoragePrefix = "nodia-ai:unsent:v1:";

/** Available to auth before the lazy chat route loads; no feature imports. */
export function clearNodiaAiDraftStorage(target?: Storage | null) {
  try {
    const storage = target === undefined ? (typeof window === "undefined" ? null : window.sessionStorage) : target;
    if (storage) for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(nodiaAiDraftStoragePrefix)) storage.removeItem(key);
    }
  } catch { /* Disabled storage must not interrupt logout. */ }
}
