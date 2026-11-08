import type { CodexSession } from "./codexSession";

export type CodexConnectionState =
  | "connected"
  | "disconnected"
  | "unknown"
  | "busy"
  | "unavailable";

/** Authentication is independent of inference qualification and usage limits. */
export function codexConnectionState(session?: CodexSession): CodexConnectionState {
  if (session?.reason === "codex_profile_busy") return "busy";
  if (!session || session.reason === "codex_runtime_unverified") return "unknown";
  if (session.available && session.authenticated === true) return "connected";
  if (session.available && session.authenticated === false) return "disconnected";
  return session.available === false ? "unavailable" : "unknown";
}

/** A session check certifies auth only; it cannot make inference "healthy". */
export function codexDetailStatus(session?: CodexSession): "unverified" | "expired" | "degraded" {
  const state = codexConnectionState(session);
  if (state === "disconnected") return "expired";
  if (state === "unavailable" || session?.usageAllowed === false) return "degraded";
  return "unverified";
}

/** Account and model metadata use the same exclusive Native profile lease. */
export function codexModelObservationEnabled(
  session: CodexSession | undefined,
  query: { isSuccess: boolean; isFetching: boolean },
): boolean {
  return query.isSuccess && !query.isFetching && codexConnectionState(session) === "connected";
}

/** A newer dated health read can supersede an older modal/detail observation. */
export function selectCodexSession(
  observation?: CodexSession,
  health?: CodexSession,
): CodexSession | undefined {
  if (!observation) return health;
  const observedAt = observation.checkedAt ? Date.parse(observation.checkedAt) : NaN;
  const healthAt = health?.checkedAt ? Date.parse(health.checkedAt) : NaN;
  return Number.isFinite(healthAt) && Number.isFinite(observedAt) && healthAt > observedAt
    ? health
    : observation;
}
