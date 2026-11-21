import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { refreshSession, restoreSession } from "../../config/api";
import { queryClient } from "../../config/reactQuery";
import useAuthStore, { hasActiveSession } from "../../store/authStore";
import { needsPushReconciliation } from "../../modules/notifications/infrastructure/pushOwnership";
import { PUSH_SUBSCRIPTION_CHANGED } from "../../pwa/pushRegistration";

export default function useSessionLifecycle() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const token = useAuthStore((state) => state.token);
  const expiresAt = useAuthStore((state) => state.expiresAt);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const isRefreshing = useAuthStore((state) => state.isRefreshing);
  const userId = useAuthStore((state) => state.user?.id);
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
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

  useEffect(() => {
    if (!userId || sessionStatus !== "authenticated" || isRefreshing) return;
    let stopped = false;
    let pending = false;
    const reconcile = () => {
      if (pending || document.visibilityState === "hidden" || !needsPushReconciliation(userId)) return;
      const actor = { userId, sessionVersion };
      const isCurrent = () => {
        const auth = useAuthStore.getState();
        return !stopped && hasActiveSession(auth) && auth.user?.id === userId && auth.sessionVersion === sessionVersion;
      };
      if (!isCurrent()) return;
      pending = true;
      void import("../../modules/notifications/infrastructure/useServices")
        .then(({ pushDeviceQueryOptions }) => {
          if (isCurrent()) return queryClient.fetchQuery(pushDeviceQueryOptions(actor, language));
        })
        .catch(() => undefined)
        .finally(() => { pending = false; });
    };
    const onPushMessage = (event: MessageEvent) => {
      if (event.data?.type === PUSH_SUBSCRIPTION_CHANGED) reconcile();
    };

    reconcile();
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("online", reconcile);
    navigator.serviceWorker?.addEventListener("message", onPushMessage);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("online", reconcile);
      navigator.serviceWorker?.removeEventListener("message", onPushMessage);
    };
  }, [isRefreshing, language, sessionStatus, sessionVersion, userId]);

  return { sessionStatus };
}
