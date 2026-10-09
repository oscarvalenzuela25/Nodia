import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryFunctionContext } from "@tanstack/react-query";
import { isAxiosError, isCancel, type AxiosProgressEvent } from "axios";
import { sileo } from "sileo";
import useAuth from "../../../../../hooks/useAuth";
import i18n from "../../../../../translate";
import { notifyHttpError } from "../../../../../config/httpFeedback";
import { reserveObservation, readObservation, type RequestedContext } from "./services";
import type { ConsoleEvent, ConsolePhase, ConsoleView, LocalStage, Snapshot } from "../types";

type Execution = { id: string | null; scope: string; epoch: number; phase: ConsolePhase; startedAt: number; events: ConsoleEvent[]; uploadPercent: number | null };
async function readAggregate(client: QueryClient, key: readonly unknown[], signal: AbortSignal): Promise<Snapshot> {
  const id = key[3];
  if (typeof id !== 'string') throw new Error('Missing observation');
  const previous = client.getQueryData<Snapshot>(key);
  const snapshot = await readObservation(id, previous?.lastSequence ?? 0, signal);
  return { ...snapshot, gap: snapshot.gap || previous?.gap === true,
    events: [...(previous?.events ?? []), ...snapshot.events].slice(-256) };
}
function observationReader(client: QueryClient) {
  return ({ queryKey, signal }: QueryFunctionContext) => readAggregate(client, queryKey, signal);
}
export function useAnalysisObservation(businessId: string) {
  const { user, isSessionActive, isAuthenticated, sessionVersion } = useAuth();
  const sessionAvailable = isAuthenticated && Boolean(user?.id);
  const scope = `${user?.id ?? ''}:${sessionVersion ?? 0}:${businessId}`;
  const [execution, setExecution] = useState<Execution | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(false);
  const principal = useRef<AbortController | null>(null);
  const inProgress = useRef(false);
  const currentRun = useRef<{ id: string; scope: string; token: number } | null>(null);
  const failures = useRef(0);
  const queryClient = useQueryClient();
  const reader = useMemo(() => observationReader(queryClient), [queryClient]);
  const active = execution?.scope === scope && sessionAvailable ? execution : null;
  const key = ["invoice", "analysis-observation", scope, active?.id] as const;
  const reserve = useMutation({ mutationFn: ({ context, signal }: { context: RequestedContext; signal: AbortSignal }) => reserveObservation(context, signal),
    retry: false,
    onSuccess: () => sileo.success({ title: i18n.t("business:analysis_console_reserved") }),
    onError: notifyHttpError,
  });
  const query = useQuery({
    queryKey: key,
    meta: { errorNotification: 'handled-locally' },
    enabled: Boolean(isSessionActive && active?.id && active.phase === 'analyzing'),
    retry: false, refetchOnWindowFocus: false, staleTime: 0, gcTime: 300000,
    queryFn: reader,
    refetchInterval: query => {
      if (query.state.data && !['running', 'reserved'].includes(query.state.data.state)) return false;
      const error = query.state.error;
      if (isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0)) return false;
      return Math.min(2000 * 2 ** Math.min(failures.current, 3), 16000);
    },
    refetchIntervalInBackground: false,
  });
  const episode = useRef(false);
  useEffect(() => {
    if (query.isError) failures.current++;
    if (query.isSuccess) failures.current = 0;
    if (active?.id && query.isError && !episode.current) { episode.current = true; notifyHttpError(query.error); }
    if (query.isSuccess) episode.current = false;
  }, [active?.id, query.isError, query.isSuccess, query.error, query.errorUpdatedAt, query.dataUpdatedAt]);
  const dispose = useCallback(() => {
    mounted.current = false; epoch.current++; principal.current?.abort(); inProgress.current = false;
    const run = currentRun.current;
    if (run) void queryClient.cancelQueries({ queryKey: ['invoice', 'analysis-observation', run.scope, run.id] });
  }, [queryClient]);
  useEffect(() => {
    mounted.current = true;
    return dispose;
  }, [dispose]);
  useEffect(() => {
    if (!sessionAvailable || (execution && execution.scope !== scope)) {
      epoch.current++; principal.current?.abort(); inProgress.current = false;
      if (execution?.id) void queryClient.cancelQueries({ queryKey: ["invoice", "analysis-observation", execution.scope, execution.id] });
    }
  }, [scope, sessionAvailable, execution, queryClient]);
  const update = useCallback((token: number, action: (entry: Execution) => Execution) => {
    if (!mounted.current || epoch.current !== token) return;
    setExecution(entry => entry?.epoch === token ? action(entry) : entry);
  }, []);
  const start = async (context: RequestedContext) => {
    if (!isSessionActive || inProgress.current) throw new Error("Analysis unavailable");
    inProgress.current = true;
    principal.current?.abort();
    const token = ++epoch.current;
    const controller = new AbortController();
    principal.current = controller;
    episode.current = false;
    failures.current = 0;
    setExecution({ id: null, scope, epoch: token, phase: 'reserving', startedAt: Date.now(), events: [], uploadPercent: null });
    try {
      const result = await reserve.mutateAsync({ context, signal: controller.signal });
      if (!mounted.current || epoch.current !== token) { controller.abort(); throw new DOMException("Aborted", "AbortError"); }
      currentRun.current = { id: result.id, scope, token };
      update(token, entry => ({ ...entry, id: result.id, phase: 'analyzing', events: [
        { key: 'local-upload', occurredAt: new Date().toISOString(), stage: 'upload_started', severity: 'info' }] }));
      return {
        analysisId: result.id, signal: controller.signal,
        isCurrent: () => mounted.current && epoch.current === token && !controller.signal.aborted,
        onUploadProgress: (event: AxiosProgressEvent) => {
          if (!event.total || event.total <= 0 || !Number.isFinite(event.loaded)) return;
          const percentage = Math.min(100, Math.max(0, Math.floor(event.loaded / event.total * 100)));
          update(token, entry => entry.uploadPercent === percentage ? entry : ({ ...entry, uploadPercent: percentage,
            events: percentage === 100 && !entry.events.some(event => event.stage === 'upload_completed')
              ? [...entry.events, { key: 'local-upload-complete', occurredAt: new Date().toISOString(), stage: 'upload_completed', severity: 'info' }] : entry.events }));
        },
      };
    } catch (error) {
      update(token, entry => ({ ...entry, phase: isCancel(error) || controller.signal.aborted ? 'cancelled' : 'failed' }));
      if (epoch.current === token) inProgress.current = false;
      throw error;
    }
  };
  const emit = (stage: LocalStage) => update(epoch.current, entry => ({ ...entry, events: [...entry.events,
    { key: `local-${entry.events.length}`, occurredAt: new Date().toISOString(), stage, severity: stage === 'history_unavailable' ? 'warning' as const : 'info' as const }].slice(-64) }));
  const preparing = () => update(epoch.current, entry => ({ ...entry, phase: 'preparing' }));
  const finish = (error?: unknown) => {
    inProgress.current = false;
    const phase: ConsolePhase = error ? principal.current?.signal.aborted || isCancel(error) ? 'cancelled'
      : isAxiosError(error) && !error.response ? 'uncertain' : 'failed' : 'ready';
    update(epoch.current, entry => ({ ...entry, phase }));
    const run = currentRun.current;
    if (run && run.token === epoch.current && mounted.current && !principal.current?.signal.aborted) {
      const queryKey = ['invoice', 'analysis-observation', run.scope, run.id];
      // Fetch once after the result, even if preparation already disabled periodic polling.
      void queryClient.cancelQueries({ queryKey }).then(() => {
        if (!mounted.current || run.token !== epoch.current) return;
        return queryClient.fetchQuery({ queryKey, staleTime: 0, retry: false, queryFn: reader, meta: { errorNotification: 'handled-locally' } });
      })
        .catch(error => { if (mounted.current && run.token === epoch.current && !episode.current) { episode.current = true; notifyHttpError(error); } });
    }
  };
  const serverEvents: ConsoleEvent[] = query.data?.events.map(event => ({ ...event, key: `server-${event.sequence}` })) ?? [];
  const view: ConsoleView = {
    phase: active?.phase ?? 'idle', startedAt: active?.startedAt ?? null,
    events: active ? [...serverEvents, ...active.events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)) : [],
    identity: active ? query.data?.identity ?? null : null, observationError: Boolean(active?.id && query.isError),
    gap: query.data?.gap ?? false, uploadPercent: active?.uploadPercent ?? null, correlation: active?.id ?? null,
    isFetching: query.isFetching, resume: () => { void query.refetch(); },
  };
  return { start, emit, preparing, finish, view };
}

