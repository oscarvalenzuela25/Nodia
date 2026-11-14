import type { QueryClient } from "@tanstack/react-query";

/** Refresh only authorities changed by the high-frequency study commands. */
export function refreshTeacherQueries(client: QueryClient, actor: readonly unknown[], commandPath?: string) {
  const cursor = commandPath?.match(/^(sessions\/[^/]+)\/cursor$/);
  const setupDraft = commandPath?.match(/^(sessions\/[^/]+)\/setup-draft$/);
  const attempt = commandPath?.match(/^((sessions\/[^/]+)\/attempts\/[^/]+)(?:\/.*)?$/);
  const attemptPath = attempt?.[1];
  const draftOnly = commandPath === `${attemptPath}/responses`;
  // Teacher commands edit sessions, never provider configuration. A new session
  // selection has its own query key; bulk native refetches can contend with the
  // worker or each other. The selection panel owns explicit serial refresh.
  const completesAttempt = Boolean(attemptPath && (
    commandPath === attemptPath || commandPath === `${attemptPath}/submit` ||
    commandPath === `${attemptPath}/close-pending`
  ));
  return client.invalidateQueries({
    queryKey: actor,
    predicate: query => {
      const path = query.queryKey[3];
      if (typeof path === "string" && (
        path === "connections" || path.startsWith("connections/")
      )) return false;
      if (cursor) return path === cursor[1];
      if (setupDraft) return path === setupDraft[1];
      if (attemptPath && attempt) return typeof path === "string" && (
        path === attemptPath || path.startsWith(`${attemptPath}/questions/`) ||
        (!draftOnly && (path === attempt[2] || path === `${attempt[2]}/learning` ||
          path === `${attempt[2]}/enrichment` || path.startsWith(`${attempt[2]}/enrichment/`))) ||
        (completesAttempt && (path === "sessions" || path.startsWith(`${attempt[2]}/units/`)))
      );
      return true;
    },
  });
}
