import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import { getServerErrorCode } from "../../../../../config/axiosInstance";
import { claimHttpErrorNotification, getHttpErrorMessage, notifyHttpError } from "../../../../../config/httpFeedback";
import { offlineRequestCode } from "../../../../../pwa/connectionMonitor";
import useAuthStore from "../../../../../store/authStore";
import { disconnectGeminiAgentic } from "./services";
import type { AiProvidersHealthResponse } from "./types";

const healthKey = ["ai-providers-health"];
const topbarKey = ["ai-topbar-status"];
const logoutMessages = new Map([
  ["ai_provider:gemini_logout_busy", "ai_providers:agentic_login.disconnect_busy"],
  ["ai_provider:gemini_logout_unavailable", "ai_providers:agentic_login.disconnect_unavailable"],
  ["ai_provider:gemini_logout_unknown", "ai_providers:agentic_login.disconnect_uncertain"],
]);
const accountQueries = {
  predicate: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const [resource, params, , action] = queryKey;
    return resource === "gemini-agentic-login" ||
      (resource === "ai-selectable-models" &&
        (!(params && typeof params === "object" && "mode" in params) || params.mode !== "api_key")) ||
      (resource === "nodia-ai" && (action === "connections" || action === "eligibility")) ||
      (resource === "nodiaCv" && (action === "generation-catalog" || action === "generation-eligibility"));
  },
};

export function useGeminiAgenticDisconnect(
  refetchHealth: () => Promise<AiProvidersHealthResponse | undefined>,
) {
  const { t } = useTranslation("ai_providers");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (sessionVersion: number) => disconnectGeminiAgentic(sessionVersion),
    retry: false,
    networkMode: "always",
    gcTime: 0,
  });
  const pending = useRef(false);
  const [isWorking, setIsWorking] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [lastObservation, setLastObservation] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const observationCount = () => client.getQueryState(healthKey)?.dataUpdateCount ?? 0;
  const awaitingObservation = lastObservation !== null && observationCount() <= lastObservation;

  const invalidateAccountObservations = async () => {
    await Promise.all([
      client.cancelQueries(accountQueries),
      client.cancelQueries({ queryKey: healthKey }),
      client.cancelQueries({ queryKey: topbarKey }),
    ]);
    setLastObservation(observationCount());
    await Promise.all([
      client.invalidateQueries({ ...accountQueries, refetchType: "none" }),
      client.invalidateQueries({ queryKey: healthKey, refetchType: "none" }),
      client.invalidateQueries({ queryKey: topbarKey, refetchType: "none" }),
    ]);
  };

  const refreshAccountObservations = () => Promise.all([
    client.invalidateQueries({ queryKey: topbarKey }),
    client.invalidateQueries(accountQueries),
  ]);
  const complete = () => {
    setOpen(false);
    setNeedsCheck(false);
    setCompleted(true);
    sileo.success({ title: t("agentic_login.disconnected") });
  };

  const confirm = async () => {
    if (pending.current || needsCheck) return;
    pending.current = true;
    setIsWorking(true);
    setError(null);
    const sessionVersion = useAuthStore.getState().sessionVersion;
    try {
      await mutation.mutateAsync(sessionVersion);
      await invalidateAccountObservations();
      complete();
      try {
        await refetchHealth();
      } catch (cause) {
        notifyHttpError(cause);
      }
      void refreshAccountObservations();
    } catch (cause) {
      if (useAuthStore.getState().sessionVersion !== sessionVersion) return;
      const response = isAxiosError(cause) ? cause.response : undefined;
      const code = getServerErrorCode(cause) ?? response?.data?.message;
      const key = typeof code === "string" ? logoutMessages.get(code) : undefined;
      const rejected = key === "ai_providers:agentic_login.disconnect_busy" ||
        key === "ai_providers:agentic_login.disconnect_unavailable" ||
        (isAxiosError(cause) && cause.code === offlineRequestCode) ||
        [400, 401, 403, 404, 429].includes(response?.status ?? 0);
      const message = key ? t(key) : getHttpErrorMessage(cause);
      setError(message);
      if (claimHttpErrorNotification(cause)) {
        sileo.error({ title: t("agentic_login.disconnect_failed"), description: message });
      }
      if (!rejected) {
        setNeedsCheck(true);
        await invalidateAccountObservations();
      }
    } finally {
      pending.current = false;
      setIsWorking(false);
    }
  };

  const check = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsWorking(true);
    try {
      const data = await refetchHealth();
      void refreshAccountObservations();
      const agentic = data?.engines?.agentic;
      if (agentic?.available !== true || typeof agentic.authenticated !== "boolean") return;
      setError(null);
      setNeedsCheck(false);
      if (!agentic.authenticated) complete();
    } catch (cause) {
      notifyHttpError(cause);
    } finally {
      pending.current = false;
      setIsWorking(false);
    }
  };

  return {
    awaitingObservation,
    cancel: () => setOpen(false),
    check,
    completed,
    confirm,
    error,
    isWorking,
    needsCheck,
    open,
    show: () => {
      if (!needsCheck) setError(null);
      setCompleted(false);
      setOpen(true);
    },
  };
}
