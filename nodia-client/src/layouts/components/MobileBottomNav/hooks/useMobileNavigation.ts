import { useEffect } from "react";
import { sileo } from "sileo";
import useAuth from "../../../../hooks/useAuth";
import useAuthStore, { hasActiveSession } from "../../../../store/authStore";
import { mobileStorageKey, useMobileNavigationStore } from "../../../../store/mobileNavigationStore";
import type { MobilePreferences } from "../../../../store/mobileNavigationStore";
import i18n from "../../../../translate";

export default function useMobileNavigation() {
  const { user, isSessionValid, isSessionActive, sessionVersion } = useAuth();
  const ownerId = isSessionValid ? user?.id ?? null : null;
  const storedOwner = useMobileNavigationStore(state => state.ownerId);
  const preferences = useMobileNavigationStore(state => state.preferences);
  const readError = useMobileNavigationStore(state => state.readError);
  const hydrate = useMobileNavigationStore(state => state.hydrate);
  const write = useMobileNavigationStore(state => state.write);
  useEffect(() => {
    hydrate(ownerId);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || (ownerId && event.key === mobileStorageKey(ownerId))) hydrate(ownerId);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      // The layout unmounts this observer on logout or when leaving mobile.
      hydrate(null);
    };
  }, [ownerId, hydrate]);
  useEffect(() => {
    if (storedOwner === ownerId && readError) sileo.error({ title: i18n.t("layout:mobile_nav.storage_error") });
  }, [ownerId, storedOwner, readError]);
  const hydrated = Boolean(ownerId && storedOwner === ownerId);
  const ready = hydrated && isSessionActive;
  const persist = (next: MobilePreferences, successKey: string) => {
    const current = useAuthStore.getState();
    if (!ready || !ownerId || !hasActiveSession(current) || current.user?.id !== ownerId || current.sessionVersion !== sessionVersion) return false;
    try {
      write(ownerId, next);
      sileo.success({ title: i18n.t(successKey) });
      return true;
    } catch {
      sileo.error({ title: i18n.t("layout:mobile_nav.storage_error") });
      return false;
    }
  };
  return { ownerId, sessionVersion, preferences, ready, hydrated, readError: storedOwner === ownerId && readError, persist };
}
