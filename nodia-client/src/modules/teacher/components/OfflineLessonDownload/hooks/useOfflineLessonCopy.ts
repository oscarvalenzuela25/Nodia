import { useEffect, useState } from "react";
import type { DownloadLessonInput } from "../../../infrastructure/downloadLesson";
import { openOfflineStudy } from "../../../infrastructure/offlineStudy";
import {
  readOfflineStudyAccount,
  subscribeOfflineStudyChanges,
  type OfflineStudyScope,
} from "../../../infrastructure/offlineStudyIdentity";

type CopyState = "current" | "legacy" | "outdated" | null;

export function offlineScopeKey(scope: OfflineStudyScope | null | undefined) {
  return scope ? `${scope.ownerId}:${scope.sessionId}` : null;
}

export function useOfflineLessonCopy(copyId: string, scope: string | null, lesson: DownloadLessonInput) {
  const { planRevisionId, contentVersionId } = lesson;
  const supportsReadingPoint = Boolean(lesson.readingContext);
  const [result, setResult] = useState<{ copy: CopyState; checking: boolean }>({ copy: null, checking: Boolean(scope) });

  useEffect(() => {
    if (!scope) return;
    let revision = 0;
    let expiry: number | undefined;
    const currentScope = () => offlineScopeKey(readOfflineStudyAccount()?.scope) === scope;

    function refresh() {
      const requested = ++revision;
      window.clearTimeout(expiry);
      if (!currentScope()) {
        setResult({ copy: null, checking: false });
        return;
      }
      setResult(previous => previous.checking ? previous : { ...previous, checking: true });
      void openOfflineStudy(copyId).then((copy) => {
        if (requested !== revision) return;
        if (!currentScope() || !copy || copy.expiresAt <= Date.now()) {
          setResult({ copy: null, checking: false });
          return;
        }
        const matches = copy.planRevisionId === planRevisionId && copy.contentVersionId === contentVersionId;
        const status = !matches ? "outdated" : supportsReadingPoint && !copy.readingContext ? "legacy" : "current";
        setResult({ copy: status, checking: false });
        expiry = window.setTimeout(refresh, copy.expiresAt - Date.now());
      }).catch(() => {
        if (requested === revision) setResult({ copy: null, checking: false });
      });
    }

    const unsubscribe = subscribeOfflineStudyChanges(refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    refresh();
    return () => {
      revision += 1;
      window.clearTimeout(expiry);
      unsubscribe();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [contentVersionId, copyId, planRevisionId, scope, supportsReadingPoint]);

  return result;
}
