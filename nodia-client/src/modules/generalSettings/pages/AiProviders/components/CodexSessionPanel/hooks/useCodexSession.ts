import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../../../../../config/httpFeedback";
import {
  cancelCodexLogin,
  codexJobActive,
  getCodexLogin,
  getCodexSession,
  getCurrentCodexLogin,
  logoutCodex,
  startCodexLogin,
} from "../../../infrastructure/codexSession";

export const useCodexSession = (providerId: string, disabled: boolean) => {
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
    enabled: open && !jobId,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const sessionObservation = useQuery({
    queryKey: ["codex-session", providerId],
    queryFn: () => getCodexSession(providerId),
    enabled: open,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const effectiveId = jobId ?? current.data?.id ?? null;
  const status = useQuery({
    queryKey: ["codex-login", providerId, effectiveId],
    queryFn: () => getCodexLogin(providerId, effectiveId!),
    enabled: open && !!effectiveId,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (q) =>
      q.state.error
        ? false
        : !q.state.data || codexJobActive(q.state.data)
          ? 2000
          : false,
  });
  const job =
    status.data ?? (start.data?.id === effectiveId ? start.data : current.data);
  const active = !!effectiveId && (!job || codexJobActive(job));
  const busy =
    disabled ||
    start.isPending ||
    cancel.isPending ||
    logout.isPending ||
    current.isFetching ||
    status.isFetching ||
    sessionObservation.isFetching;
  const notified = useRef<string | null>(null);
  const refresh = () =>
    Promise.all(
      ["ai-providers-health", "ai-selectable-models", "codex-session"].map(
        (key) => client.invalidateQueries({ queryKey: [key] }),
      ),
    );
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
      void client.invalidateQueries({ queryKey: ["ai-providers-health"] });
      void client.invalidateQueries({ queryKey: ["ai-selectable-models"] });
      void client.invalidateQueries({ queryKey: ["codex-session", providerId] });
    } else if (job.state === "failed")
      sileo.error({
        title: t("ai_providers:codex.failed"),
        description: t("ai_providers:codex.failure_description"),
      });
  }, [job, client, providerId, t]);
  const connect = async () => {
    if (busy || active) return;
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
    start.reset();
    setJobId(null);
    setOpen(true);
  };
  return {
    t,
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
