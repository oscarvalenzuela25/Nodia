import { useLayoutEffect, useRef, useState } from "react";
import useAuth from "../../../hooks/useAuth";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import type { NodiaAiDetail } from "./types";
import { isNodiaAiExecutionActive } from "./useServices";

interface StatusReaders {
  conversationId: string | null;
  runId: string | undefined;
  detail: () => Promise<{ isSuccess: boolean; data?: NodiaAiDetail | null }>;
  history: () => Promise<unknown>;
  eligibility: () => Promise<unknown>;
}

/** An explicit GET recovery, never an admission or a provider-operation replay. */
export function useNodiaAiStatusRefresh(readers: StatusReaders) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const actorId = user?.id ?? null;
  const key = JSON.stringify([actorId, sessionVersion, readers.conversationId, readers.runId]);
  const [scope, setScope] = useState({ key, epoch: 0 });
  if (scope.key !== key) setScope({ key, epoch: scope.epoch + 1 });
  const context = useRef(scope);
  useLayoutEffect(() => {
    context.current = scope;
    return () => { context.current = { key: "", epoch: scope.epoch }; };
  }, [scope]);
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<{ key: string; epoch: number } | null>(null);

  const refresh = async () => {
    const source = { ...context.current };
    const flightKey = JSON.stringify(source);
    const current = () => {
      const auth = useAuthStore.getState();
      return context.current.key === source.key && context.current.epoch === source.epoch
        && hasActiveSession(auth) && auth.user?.id === actorId && auth.sessionVersion === sessionVersion;
    };
    if (!isSessionActive || !actorId || !readers.conversationId || !readers.runId || !current() || inFlight.current.has(flightKey)) return;
    inFlight.current.add(flightKey);
    setPending(source);
    try {
      // The authorized detail GET contains the current run. Do not observe the
      // profile while its native work is active or still pending reconciliation.
      const detail = await readers.detail();
      if (!current() || !detail.isSuccess || !detail.data || detail.data.conversation.read_only
        || detail.data.conversation.conversation_id !== readers.conversationId
        || detail.data.current_run?.run_id !== readers.runId
        || isNodiaAiExecutionActive(detail.data.active_execution?.state)
        || !["completed", "failed", "cancelled"].includes(detail.data.current_run.state)) return;
      // Existing query owners retain their own errors/feedback. A failed read
      // leaves the editor blocked; neither a cache write nor this hook grants it.
      await Promise.allSettled([readers.history(), readers.eligibility()]);
    } catch {
      // Query observers own HTTP feedback; a rejected refresh never authorizes
      // a secondary read or automatically repeats a request.
    } finally {
      inFlight.current.delete(flightKey);
      if (current()) setPending(value => value?.key === source.key && value.epoch === source.epoch ? null : value);
    }
  };
  return { refresh, isRefreshing: pending?.key === scope.key && pending.epoch === scope.epoch };
}
