import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { z } from "zod";
import { sileo } from "sileo";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import { readTeacher, readTeacherData, readTeacherReceipt, sendTeacher, type TeacherCommand } from "./services";
import { attemptSchema, jobSchema, materialSchema, messagesSchema, planSchema, questionSchema, sessionSchema, sessionsSchema } from "./schemas";
import { canPollJob } from "./presentation";
import { forgetRequest, pendingRequest, rememberRequest } from "./recovery";
import { refreshTeacherQueries } from "./refresh";
import { sessionListPollInterval } from "./sessionList";

export function useTeacherQuery<T>(path: string, schema: z.ZodType<T>, params?: Record<string, unknown>, enabled = true,
  observationOptions?: { staleTime: number; refetchOnWindowFocus: false; refetchOnReconnect: false }) {
  const userId = useAuthStore((state) => state.user?.id);
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const authenticated = useAuthStore((state) => state.sessionStatus === "authenticated");
  const query = useQuery({ queryKey: ["teacher", userId, sessionVersion, path, params], queryFn: ({ signal }) => readTeacherData(path, signal, params), select: (data) => schema.parse(data), enabled: Boolean(userId && authenticated && enabled), retry: false, ...observationOptions });
  useEffect(() => { if (query.error) notifyHttpError(query.error); }, [query.error]);
  return query;
}
export function useTeacherSessions(page: number, q: string, archived: boolean) {
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const listener = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, []);
  const userId = useAuthStore(state => state.user?.id);
  const sessionVersion = useAuthStore(state => state.sessionVersion);
  const authenticated = useAuthStore(state => state.sessionStatus === "authenticated");
  const params = { page, limit: 10, q, archived };
  const query = useQuery({ queryKey: ["teacher", userId, sessionVersion, "sessions", params],
    queryFn: ({ signal }) => readTeacherData("sessions", signal, params), select: data => sessionsSchema.parse(data),
    enabled: Boolean(userId && authenticated), retry: false, refetchIntervalInBackground: false,
    refetchInterval: query => query.state.error ? false : sessionListPollInterval(query.state.data, visible),
  });
  useEffect(() => { if (query.error) notifyHttpError(query.error); }, [query.error]);
  return query;
}
export const useTeacherSession = (id?: string) => useTeacherQuery(`sessions/${id}`, sessionSchema, undefined, Boolean(id));
export const useTeacherMessages = (id: string, page = 1) => useTeacherQuery(`sessions/${id}/messages`, messagesSchema, { page, limit: 50 });
export const useTeacherProposal = (id: string, proposalId: string | null) => useTeacherQuery(`sessions/${id}/plan-proposals/${proposalId}`, planSchema, undefined, Boolean(proposalId));
export const useTeacherMaterial = (id: string, unitId: string | null, planRevisionId: string | null) => useTeacherQuery(`sessions/${id}/units/${unitId}`, materialSchema, { plan_revision_id: planRevisionId }, Boolean(unitId && planRevisionId));
export const useTeacherAttempt = (id: string, attemptId: string | null) => useTeacherQuery(`sessions/${id}/attempts/${attemptId}`, attemptSchema, undefined, Boolean(attemptId));
export const useTeacherQuestion = (id: string, attemptId: string | null, questionId: string | null) => useTeacherQuery(`sessions/${id}/attempts/${attemptId}/questions/${questionId}`, questionSchema, undefined, Boolean(attemptId && questionId));

export function useTeacherJob(jobId: string | null, paused: boolean) {
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const listener = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, []);
  const userId = useAuthStore((state) => state.user?.id);
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const authenticated = useAuthStore((state) => state.sessionStatus === "authenticated");
  const query = useQuery({ queryKey: ["teacher", userId, sessionVersion, "jobs", jobId], queryFn: ({ signal }) => readTeacher(`jobs/${jobId}`, jobSchema, signal), enabled: Boolean(userId && authenticated && jobId), retry: false, refetchIntervalInBackground: false, refetchInterval: (query) => {
    const job = query.state.data;
    return job && canPollJob(job.state, visible, paused) ? job.retry_after_ms ?? false : false;
  } });
  useEffect(() => { if (query.error) notifyHttpError(query.error); }, [query.error]);
  return query;
}

/** One immutable command per intent. An uncertain POST is reconciled by GET only. */
export function useTeacherCommand() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const sessionActive = useAuthStore(hasActiveSession);
  const actorKey = `${userId}:${sessionVersion}`;
  const inFlight = useRef(false);
  const [uncertainState, setUncertain] = useState<{actor:string;command:TeacherCommand} | null>(() => { const command = pendingRequest(actorKey); return command ? { actor: actorKey, command } : null; });
  const uncertain = uncertainState?.actor === actorKey ? uncertainState.command : null;
  const [recovering, setRecovering] = useState(false);
  const [executing, setExecuting] = useState(false);
  const isCurrentActor = (actor: string) => { const state = useAuthStore.getState(); return `${state.user?.id}:${state.sessionVersion}` === actor; };
  const mutation = useMutation({ mutationFn: sendTeacher, retry: false });
  const refresh = useCallback((path?: string) => refreshTeacherQueries(queryClient, ["teacher", userId, sessionVersion], path), [queryClient, userId, sessionVersion]);

  const execute = async (path: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST") => {
    if (inFlight.current || uncertain || !hasActiveSession(useAuthStore.getState())) return null;
    const command: TeacherCommand = { path, body: structuredClone(body), method, requestKey: crypto.randomUUID() };
    const actor = actorKey;
    inFlight.current = true;
    setExecuting(true);
    rememberRequest(actor, command);
    try {
      const result = await mutation.mutateAsync(command);
      if (!isCurrentActor(actor)) return null;
      forgetRequest();
      sileo.success({ title: i18n.t("teacher:operation_saved") });
      await refresh(command.path);
      return result;
    } catch (error) {
      if (!isCurrentActor(actor)) return null;
      // Validation/parser errors after a response also require the original receipt.
      if (!isAxiosError(error) || !error.response || [408, 500, 502, 504].includes(error.response.status)) setUncertain({ actor, command });
      else forgetRequest();
      notifyHttpError(error);
      if (isAxiosError(error) && error.response?.status === 409) await refresh(command.path);
      return null;
    } finally { inFlight.current = false; if (isCurrentActor(actor)) setExecuting(false); }
  };
  const reconcile = async () => {
    if (!uncertain || recovering) return null;
    const actor = actorKey;
    setRecovering(true);
    try {
      const receipt = await readTeacherReceipt(uncertain.requestKey);
      const result = receipt.receipt;
      if (!isCurrentActor(actor)) return null;
      if (result) {
        setUncertain(null);
        forgetRequest();
        sileo.success({ title: i18n.t("teacher:operation_recovered") });
        await refresh(uncertain.path);
        return result;
      }
      return null;
    } catch (error) { notifyHttpError(error); return null; }
    finally { if (isCurrentActor(actor)) setRecovering(false); }
  };
  return { execute, reconcile, refresh, uncertain, isPending: executing || mutation.isPending || recovering, blocked: !sessionActive || Boolean(uncertain) || executing || mutation.isPending || recovering };
}
