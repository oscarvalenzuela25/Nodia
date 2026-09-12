import { useEffect, useRef } from "react";
import { refreshSession, restoreSession } from "../../config/api";
import useAuthStore from "../../store/authStore";

export default function useSessionLifecycle() {
  const token = useAuthStore((state) => state.token);
  const expiresAt = useAuthStore((state) => state.expiresAt);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const isRefreshing = useAuthStore((state) => state.isRefreshing);
  const lastAttemptAt = useRef(0);

  useEffect(() => {
    if (token && sessionStatus === "restoring" && !isRefreshing) {
      void restoreSession().catch(() => undefined);
    }
  }, [token, sessionStatus, isRefreshing]);

  useEffect(() => {
    if (!token || sessionStatus !== "authenticated") return;
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout>;
    const renew = () => {
      lastAttemptAt.current = Date.now();
      void refreshSession().catch(() => {
        if (!stopped && useAuthStore.getState().sessionStatus === "authenticated") {
          timeout = setTimeout(renew, Math.max(0, Math.min(30_000, (expiresAt ?? 0) - Date.now())));
        }
      });
    };
    // Near the absolute session deadline, refresh can return the same expiry.
    // Wait until that deadline instead of repeatedly refreshing immediately.
    const expiry = expiresAt ?? 0;
    const nextAttempt = Math.min(expiry, Math.max(expiry - 30_000, lastAttemptAt.current + 30_000));
    timeout = setTimeout(renew, Math.max(0, nextAttempt - Date.now()));
    const onFocus = () => {
      if ((useAuthStore.getState().expiresAt ?? 0) <= Date.now() + 30_000 && Date.now() - lastAttemptAt.current >= 30_000) {
        clearTimeout(timeout);
        renew();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => { stopped = true; clearTimeout(timeout); window.removeEventListener("focus", onFocus); };
  }, [token, expiresAt, sessionStatus]);

  useEffect(() => {
    const syncSession = (event: StorageEvent) => {
      if (event.key !== "authStore" && event.key !== null) return;
      if (!event.newValue) {
        if (useAuthStore.getState().token) useAuthStore.getState().logout();
      }
      else void useAuthStore.persist.rehydrate();
    };
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  return { sessionStatus };
}
