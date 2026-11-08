import type { QueryClient } from "@tanstack/react-query";

/** Refresh only authorities changed by the high-frequency study commands. */
export function refreshTeacherQueries(client: QueryClient, actor: readonly unknown[], commandPath?: string) {
  const cursor = commandPath?.match(/^(sessions\/[^/]+)\/cursor$/);
  const setupDraft = commandPath?.match(/^(sessions\/[^/]+)\/setup-draft$/);
  const attempt = commandPath?.match(/^((sessions\/[^/]+)\/attempts\/[^/]+)(?:\/.*)?$/);
  const attemptPath = attempt?.[1];
  const draftOnly = commandPath === `${attemptPath}/responses`;
  return client.invalidateQueries({
    queryKey: actor,
    predicate: query => {
      const path = query.queryKey[3];
      if (cursor) return path === cursor[1];
      if (setupDraft) return path === setupDraft[1];
      if (attemptPath && attempt) return typeof path === "string" && (
        (!draftOnly && path === attempt[2]) || path === attemptPath || path.startsWith(`${attemptPath}/questions/`)
      );
      return true;
    },
  });
}
