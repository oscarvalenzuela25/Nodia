import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import { isAxiosError } from "axios";
import { getHttpErrorMessage, notifyHttpError } from "../../../../../../../config/httpFeedback";
import type { CodexSession } from "../../../infrastructure/codexSession";
import {
  cancelCodexLogin,
  codexJobActive,
  getCodexLogin,
  getCurrentCodexLogin,
  logoutCodex,
  startCodexLogin,
} from "../../../infrastructure/codexSession";
import { useCodexSessionObservation } from "../../../infrastructure/useCodexSessionObservation";
import { codexConnectionState, selectCodexSession } from "../../../infrastructure/codexSessionState";
import useAuthStore, { hasValidatedSession } from "../../../../../../../store/authStore";

export const useCodexSession = (providerId: string, disabled: boolean, session?: CodexSession) => {
  const authenticated = useAuthStore(hasValidatedSession);
  const { t } = useTranslation(["ai_providers", "core"]);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [disconnect, setDisconnect] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () => startCodexLogin(providerId),
    retry: false,
    gcTime: 0,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelCodexLogin(providerId, id),
    retry: false,
    gcTime: 0,
  });
  const logout = useMutation({
    mutationFn: () => logoutCodex(providerId),
    retry: false,
  });
  const current = useQuery({
    queryKey: ["codex-login", providerId, "current"],
    queryFn: () => getCurrentCodexLogin(providerId),
    enabled: authenticated && open && !jobId,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  // This panel mounts only for the selected OpenAI Agentic detail, so mounting
  // it is the read intent. Opening a login modal is not required to inspect auth.
  const sessionObservation = useCodexSessionObservation(providerId);
  const effectiveId = jobId ?? current.data?.id ?? null;
  const status = useQuery({
    queryKey: ["codex-login", providerId, effectiveId],
    queryFn: () => getCodexLogin(providerId, effectiveId!),
    enabled: authenticated && open && !!effectiveId,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (q) =>
      !hasValidatedSession(useAuthStore.getState()) || q.state.error
        ? false
        : !q.state.data || codexJobActive(q.state.data)
          ? 2000
          : false,
  });
  const job =
    status.data ?? (start.data?.id === effectiveId ? start.data : current.data);
  const active = !!effectiveId && (!job || codexJobActive(job));
  const busy =
    !authenticated || disabled ||
    start.isPending ||
    cancel.isPending ||
    logout.isPending ||
    current.isFetching ||
    status.isFetching ||
    sessionObservation.isFetching;
  const currentSession = selectCodexSession(sessionObservation.data, session);
  const connectionState = codexConnectionState(currentSession);
  const runtimeStartError = isAxiosError<{ code?: string }>(start.error) &&
    start.error.response?.data?.code === "codex_runtime_unavailable";
  const runtimeUnavailable = connectionState === "unavailable" || runtimeStartError;
  const canConnect = currentSession?.available === true && connectionState !== "busy" && !runtimeUnavailable &&
    !current.isError && !status.isError && !sessionObservation.isError;
  const notified = useRef<string | null>(null);
  const refresh = async () => {
    // Both session and model discovery lease the same physical profile. Finish
    // the auth read first instead of racing two Native observations.
    await client.invalidateQueries({ queryKey: ["ai-selectable-models"], refetchType: "none" });
    await client.invalidateQueries({ queryKey: ["codex-session", providerId] });
    await client.invalidateQueries({ queryKey: ["ai-providers-health"] });
  };
  useEffect(() => {
    if (sessionObservation.data) void client.invalidateQueries({ queryKey: ["ai-providers-health"] });
  }, [sessionObservation.data, client]);
  useEffect(() => {
    if (current.isError) notifyHttpError(current.error);
    if (status.isError) notifyHttpError(status.error);
    if (sessionObservation.isError) notifyHttpError(sessionObservation.error);
  }, [
    current.isError,
    current.error,
    status.isError,
    status.error,
    sessionObservation.isError,
    sessionObservation.error,
  ]);
  useEffect(() => {
    if (
      !job ||
      codexJobActive(job) ||
      notified.current === `${job.id}:${job.state}`
    )
      return;
    notified.current = `${job.id}:${job.state}`;
    if (job.state === "succeeded") {
      sileo.success({ title: t("ai_providers:codex.success") });
      void client.invalidateQueries({ queryKey: ["ai-selectable-models"], refetchType: "none" })
        .then(() => client.invalidateQueries({ queryKey: ["codex-session", providerId] }))
        .then(() => client.invalidateQueries({ queryKey: ["ai-providers-health"] }));
    } else if (job.state === "failed")
      sileo.error({
        title: t("ai_providers:codex.failed"),
        description: t("ai_providers:codex.failure_description"),
      });
  }, [job, client, providerId, t]);
  const connect = async () => {
    if (busy || active || !canConnect) return;
    try {
      const result = await start.mutateAsync();
      client.setQueryData(["codex-login", providerId, result.id], result);
      setJobId(result.id);
      sileo.success({ title: t("ai_providers:codex.started") });
    } catch (error) {
      notifyHttpError(error);
      await current.refetch();
    }
  };
  const close = async () => {
    if (busy) return;
    if (active && effectiveId) {
      try {
        const result = await cancel.mutateAsync(effectiveId);
        client.setQueryData(["codex-login", providerId, effectiveId], result);
        sileo.success({ title: t("ai_providers:codex.cancelled") });
      } catch (error) {
        notifyHttpError(error);
        return;
      }
    }
    setOpen(false);
    setJobId(null);
    start.reset();
  };
  const handleLogout = async () => {
    if (busy) return;
    try {
      await logout.mutateAsync();
      sileo.success({ title: t("ai_providers:codex.disconnected") });
      setDisconnect(false);
      await refresh();
    } catch (error) {
      notifyHttpError(error);
    }
  };
  const manage = () => {
    if (busy) return;
    start.reset();
    setJobId(null);
    setOpen(true);
  };
  const checkSession = async () => {
    if (busy) return;
    const result = await sessionObservation.refetch();
    if (!result.isError && result.data?.available) start.reset();
  };
  return {
    t,
    currentSession,
    connectionState,
    runtimeUnavailable,
    canConnect,
    startError: start.isError ? getHttpErrorMessage(start.error) : null,
    checkSession,
    sessionObservation,
    open,
    disconnect,
    setDisconnect,
    busy,
    current,
    status,
    job,
    active,
    effectiveId,
    connect,
    close,
    handleLogout,
    manage,
  };
};
