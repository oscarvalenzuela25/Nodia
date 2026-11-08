import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import useAuth from "../../../hooks/useAuth";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { getHttpErrorMessage, notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import { getNodiaAiRun } from "./services";
import { cancelNodiaAiRun } from "./runControlServices";
import { nodiaAiKeys } from "./useServices";
import type { NodiaAiDetail, NodiaAiRun } from "./types";

type Phase = "idle" | "sending" | "uncertain" | "checking" | "retry_ready" | "accepted" | "finished" | "rejected";
interface Pending { scopeKey: string; requestId: string }
const canCancel = (run: NodiaAiRun) => run.state === "queued" || run.state === "running";
const knownRejection = (error: unknown) => isAxiosError(error) && [400, 401, 403, 404, 409, 410, 422, 429].includes(error.response?.status ?? 0);

/** The request key lives only in this human panel. Recovery reads never replay a mutation. */
export function useRunCancellation(conversationId: string, run: NodiaAiRun, authorized: boolean, readOnly: boolean) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const client = useQueryClient();
  const ownerId = user?.id ?? null;
  const scope = [ownerId, sessionVersion] as const;
  const scopeKey = `${ownerId}:${sessionVersion}:${conversationId}:${run.run_id}`;
  const [state, setState] = useState<{ scopeKey: string; phase: Phase; error: string | null }>({ scopeKey, phase: "idle", error: null });
  if (state.scopeKey !== scopeKey) setState({ scopeKey, phase: "idle", error: null });
  const phase = state.scopeKey === scopeKey ? state.phase : "idle";
  const pending = useRef<Pending | null>(null);
  const operation = useRef<{ scopeKey: string; controller: AbortController } | null>(null);
  const activeScope = useRef<string | null>(null);
  useLayoutEffect(() => {
    activeScope.current = scopeKey;
    return () => {
      if (activeScope.current === scopeKey) activeScope.current = null;
      if (operation.current?.scopeKey === scopeKey) operation.current.controller.abort();
      if (pending.current?.scopeKey === scopeKey) pending.current = null;
    };
  }, [scopeKey]);
  const mutation = useMutation({
    mutationKey: [...nodiaAiKeys.all(scope), "run-cancellation", conversationId, run.run_id],
    mutationFn: ({ requestId, signal, runId, chatId }: { requestId: string; signal: AbortSignal; runId: string; chatId: string }) => cancelNodiaAiRun(runId, chatId, { client_request_id: requestId }, signal),
    retry: false, networkMode: "always", gcTime: 0,
  });
  const current = () => {
    const auth = useAuthStore.getState();
    return activeScope.current === scopeKey && hasActiveSession(auth) && auth.user?.id === ownerId && auth.sessionVersion === sessionVersion;
  };
  const transition = (next: Phase, error: string | null = null) => { if (current()) setState({ scopeKey, phase: next, error }); };
  const invalidate = () => {
    void Promise.all([
      client.invalidateQueries({ queryKey: nodiaAiKeys.detail(scope, conversationId) }),
      client.invalidateQueries({ queryKey: nodiaAiKeys.messages(scope, conversationId) }),
      client.invalidateQueries({ queryKey: [...nodiaAiKeys.all(scope), "events", conversationId] }),
      client.invalidateQueries({ queryKey: [...nodiaAiKeys.all(scope), "run", conversationId, run.run_id] }),
    ]);
  };
  const adopt = (value: NodiaAiRun) => {
    if (!current() || value.revision < run.revision) throw new Error("nodia_ai:invalid_response");
    // A response may update this same current run, but cannot create a detail grant or replace a newer/different run.
    client.setQueryData<NodiaAiDetail | null>(nodiaAiKeys.detail(scope, conversationId), cached => !cached || cached.conversation.read_only
      || cached.conversation.conversation_id !== conversationId || cached.current_run?.run_id !== value.run_id || cached.current_run.revision > value.revision
      ? cached : { ...cached, current_run: value });
    invalidate();
  };
  const fail = (error: unknown, uncertain: boolean) => {
    if (!current()) return;
    transition(uncertain ? "uncertain" : "rejected", getHttpErrorMessage(error));
    notifyHttpError(error);
  };
  const enabled = isSessionActive && Boolean(ownerId) && authorized && !readOnly && run.conversation_id === conversationId;
  const dispatch = async (retry: boolean) => {
    if (!enabled || !current() || !canCancel(run) || operation.current?.scopeKey === scopeKey
      || (retry ? phase !== "retry_ready" : phase !== "idle" && phase !== "rejected")) return;
    const saved = pending.current?.scopeKey === scopeKey ? pending.current : null;
    if (retry && !saved) return;
    const request = saved ?? { scopeKey, requestId: crypto.randomUUID() };
    pending.current = request;
    const controller = new AbortController();
    const owned = { scopeKey, controller };
    operation.current = owned;
    transition("sending");
    try {
      const result = await mutation.mutateAsync({ requestId: request.requestId, signal: controller.signal, runId: run.run_id, chatId: conversationId });
      if (!current() || controller.signal.aborted) return;
      adopt(result.run);
      pending.current = null;
      transition(result.status === "accepted" ? "accepted" : "finished");
      sileo.success({ title: i18n.t(`nodiaAi:run_control.${result.status === "accepted" ? "requested" : "already_terminal"}`) });
    } catch (error) {
      if (!current() || controller.signal.aborted) return;
      const rejected = knownRejection(error);
      if (rejected) { pending.current = null; invalidate(); }
      fail(error, !rejected);
    } finally { if (operation.current === owned) operation.current = null; }
  };
  const recover = async () => {
    if (!enabled || !current() || phase !== "uncertain" || pending.current?.scopeKey !== scopeKey || operation.current?.scopeKey === scopeKey) return;
    const controller = new AbortController();
    const owned = { scopeKey, controller };
    operation.current = owned;
    transition("checking");
    try {
      const observed = await getNodiaAiRun(run.run_id, conversationId, controller.signal);
      if (!current() || controller.signal.aborted) return;
      adopt(observed);
      if (canCancel(observed)) transition("retry_ready");
      else { pending.current = null; transition(observed.state === "cancel_requested" ? "accepted" : "finished"); }
    } catch (error) {
      if (!current() || controller.signal.aborted) return;
      const denied = knownRejection(error);
      if (denied) { pending.current = null; invalidate(); }
      fail(error, !denied);
    } finally { if (operation.current === owned) operation.current = null; }
  };
  return {
    phase, error: state.scopeKey === scopeKey ? state.error : null, enabled,
    busy: phase === "sending" || phase === "checking", request: () => dispatch(false), retry: () => dispatch(true), recover,
  };
}
