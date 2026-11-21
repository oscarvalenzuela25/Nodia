import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import i18n from "../../../translate";
import { offlineStudyGrantSnapshot, offlineStudyScope, sameOfflineStudyScope } from "../infrastructure/offlineStudyIdentity";
import { refreshTeacherQueries } from "../infrastructure/refresh";

export function useOfflineReadingSync(): void {
  const userId = useAuthStore((state) => state.user?.id);
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const token = useAuthStore((state) => state.token);
  const active = useAuthStore(hasActiveSession);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!active || !userId) return;
    const scope = offlineStudyScope(token, userId);
    if (!scope) return;
    let stopped = false;
    async function sync() {
      if (navigator.onLine === false || !sameOfflineStudyScope(offlineStudyGrantSnapshot().grant, scope)) return;
      const { syncOfflineReadingProgress } = await import("../infrastructure/syncOfflineReading");
      if (stopped) return;
      const studies = await syncOfflineReadingProgress();
      if (stopped || !studies.length) return;
      sileo.success({ title: i18n.t("teacher:offline_study.reading_synced") });
      for (const id of studies) {
        void refreshTeacherQueries(queryClient, ["teacher", userId, sessionVersion], `sessions/${id}/cursor`);
      }
    }
    const onOnline = () => { void sync().catch(() => undefined); };
    onOnline();
    window.addEventListener("online", onOnline);
    return () => { stopped = true; window.removeEventListener("online", onOnline); };
  }, [active, queryClient, sessionVersion, token, userId]);
}
