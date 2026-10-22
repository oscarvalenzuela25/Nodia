import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import useAuth from "../../../hooks/useAuth";
import { notifyHttpError } from "../../../config/httpFeedback";
import { getNodiaAiEvents, getNodiaAiObservation, getNodiaAiReport, getNodiaAiRun } from "./services";
import type { NodiaAiReport } from "./reportSchemas";
import { isNodiaAiAccessDenied, isNodiaAiRunActive, nodiaAiKeys } from "./useServices";
import type { NodiaAiEvent, NodiaAiRun, NodiaAiToolObservation, NodiaAiToolResultRef } from "./types";

interface ObservationWindow { items: NodiaAiEvent[]; cursor: string | null; hasMore: boolean; reset: boolean }

/** Deduplication is local to this observer. Reading never acknowledges an event globally. */
export function mergeNodiaAiEvents(previous: NodiaAiEvent[], incoming: NodiaAiEvent[]): NodiaAiEvent[] {
  const ids = new Set<string>();
  const sequences = new Set<string>();
  return [...previous, ...incoming].filter(item => {
    if (ids.has(item.event_id) || sequences.has(item.seq)) return false;
    ids.add(item.event_id); sequences.add(item.seq); return true;
  }).sort((a, b) => BigInt(a.seq) < BigInt(b.seq) ? -1 : 1).slice(-256);
}

function useOutageNotification(key: string, error: unknown, successful: boolean) {
  const episode = useRef({ key, notified: false });
  useEffect(() => {
    if (episode.current.key !== key) episode.current = { key, notified: false };
    if (successful) episode.current.notified = false;
    if (error && !episode.current.notified) { episode.current.notified = true; notifyHttpError(error); }
  }, [key, error, successful]);
}

export function useNodiaAiEvents(conversationId: string, run: NodiaAiRun, observed = true) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const client = useQueryClient();
  const userId = user?.id ?? null;
  const scope = useMemo(() => [userId, sessionVersion] as const, [userId, sessionVersion]);
  const key = useMemo(() => [...nodiaAiKeys.all(scope), "events", conversationId, run.run_id] as const, [scope, conversationId, run.run_id]);
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal, queryKey }): Promise<ObservationWindow> => {
      const previous = client.getQueryData<ObservationWindow>(queryKey);
      let page;
      try { page = await getNodiaAiEvents(run.run_id, conversationId, previous?.cursor ?? undefined, signal); }
      catch (error) {
        if (isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0)) {
          client.setQueryData<ObservationWindow>(queryKey, { items: [], cursor: null, reset: false, hasMore: false });
          client.removeQueries({ queryKey: [...nodiaAiKeys.all(scope), "observation"] });
          client.removeQueries({ queryKey: [...nodiaAiKeys.all(scope), "proposal"] });
          client.removeQueries({ queryKey: [...nodiaAiKeys.all(scope), "proposal-review"] });
        }
        throw error;
      }
      let reset = page.cursor_state === "reset_required";
      if (reset) {
        // A changed authority/cursor invalidates references as well as the cursor.
        client.setQueryData<ObservationWindow>(queryKey, { items: [], cursor: null, reset: true, hasMore: false });
        client.removeQueries({ queryKey: [...nodiaAiKeys.all(scope), "observation"] });
        client.removeQueries({ queryKey: [...nodiaAiKeys.all(scope), "proposal"] });
        client.removeQueries({ queryKey: [...nodiaAiKeys.all(scope), "proposal-review"] });
        await Promise.all([
          client.invalidateQueries({ queryKey: nodiaAiKeys.detail(scope, conversationId) }),
          client.invalidateQueries({ queryKey: nodiaAiKeys.messages(scope, conversationId) }),
        ]);
        page = await getNodiaAiEvents(run.run_id, conversationId, undefined, signal);
      }
      reset = reset || page.cursor_state === "reset_required";
      return {
        items: page.cursor_state === "reset_required" ? [] : mergeNodiaAiEvents(reset ? [] : previous?.items ?? [], page.items),
        cursor: page.next_cursor,
        hasMore: page.has_more,
        reset: page.cursor_state === "reset_required",
      };
    },
    enabled: observed && isSessionActive && Boolean(user?.id), retry: false,
    meta: { errorNotification: "handled-locally" },
    refetchInterval: queryState => !observed || queryState.state.error || queryState.state.data?.reset ? false
      : queryState.state.data?.hasMore ? 100 : isNodiaAiRunActive(run.state) ? 2000 : false,
  });
  const previousState = useRef({ runId: run.run_id, state: run.state, revision: run.revision });
  useEffect(() => {
    const previous = previousState.current;
    previousState.current = { runId: run.run_id, state: run.state, revision: run.revision };
    if (previous.runId === run.run_id && !isNodiaAiRunActive(run.state)
      && (isNodiaAiRunActive(previous.state) || previous.revision !== run.revision || previous.state !== run.state))
      void client.invalidateQueries({ queryKey: key });
  }, [client, key, run.run_id, run.state, run.revision]);
  useOutageNotification(JSON.stringify(key), query.error, query.isSuccess);
  return { data: query.data, error: query.error, isSuccess: query.isSuccess, isError: query.isError, isLoading: query.isLoading, isFetching: query.isFetching, refetch: query.refetch };
}

export function useNodiaAiObservation(ref: NodiaAiToolResultRef, opened: boolean) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const client = useQueryClient();
  const key = [...nodiaAiKeys.all([user?.id ?? null, sessionVersion]), "observation", ref] as const;
  const query = useQuery<NodiaAiToolObservation | null>({
    queryKey: key, queryFn: async ({ signal, queryKey }) => {
      try { return await getNodiaAiObservation(ref, signal); }
      catch (error) {
        if (isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0))
          client.setQueryData<NodiaAiToolObservation | null>(queryKey, null);
        throw error;
      }
    },
    enabled: opened && isSessionActive && Boolean(user?.id), retry: false, staleTime: 0, gcTime: 0,
    meta: { errorNotification: "handled-locally" },
  });
  useOutageNotification(JSON.stringify(key), query.error, query.isSuccess);
  const accessRejected = isAxiosError(query.error) && [401, 403, 404, 410].includes(query.error.response?.status ?? 0);
  return { data: accessRejected ? undefined : query.data ?? undefined, error: query.error, isSuccess: query.isSuccess, isError: query.isError, isLoading: query.isLoading, isFetching: query.isFetching, refetch: query.refetch, accessRejected };
}

export function useNodiaAiHistoricalRun(conversationId: string, runId: string, observed = true) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const client = useQueryClient();
  const query = useQuery<NodiaAiRun | null>({
    queryKey: [...nodiaAiKeys.all([user?.id ?? null, sessionVersion]), "run", conversationId, runId],
    queryFn: async ({ signal, queryKey }) => {
      try { return await getNodiaAiRun(runId, conversationId, signal); }
      catch (error) {
        if (isNodiaAiAccessDenied(error)) client.setQueryData(queryKey, null);
        throw error;
      }
    },
    enabled: observed && isSessionActive && Boolean(user?.id), retry: false, gcTime: 0, staleTime: 0,
  });
  const accessRejected = isNodiaAiAccessDenied(query.error);
  return { data: accessRejected ? undefined : query.data ?? undefined, accessRejected, error: query.error,
    isLoading: query.isLoading, isFetching: query.isFetching, isError: query.isError, isSuccess: query.isSuccess, refetch: query.refetch };
}

export function useNodiaAiReport(ref: NodiaAiToolResultRef) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const client = useQueryClient();
  // Nest under observation so feed revocation/reset invalidates every saved report too.
  const key = [...nodiaAiKeys.all([user?.id ?? null, sessionVersion]), "observation", "report", ref] as const;
  const query = useQuery<NodiaAiReport | null>({
    queryKey: key, queryFn: async ({ signal, queryKey }) => {
      try { return await getNodiaAiReport(ref, signal); }
      catch (error) {
        if (isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0))
          client.setQueryData<NodiaAiReport | null>(queryKey, null);
        throw error;
      }
    },
    enabled: isSessionActive && Boolean(user?.id), retry: false, staleTime: 0, gcTime: 0,
    meta: { errorNotification: "handled-locally" },
  });
  useOutageNotification(JSON.stringify(key), query.error, query.isSuccess);
  const accessRejected = isAxiosError(query.error) && [401, 403, 404, 410].includes(query.error.response?.status ?? 0);
  return { data: accessRejected ? undefined : query.data ?? undefined, isLoading: query.isLoading, isFetching: query.isFetching, isError: query.isError, accessRejected, refetch: query.refetch };
}
