import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import useAuth from "../../../../../../hooks/useAuth";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import { useAiProvidersHealth } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useServices";
import { codexSessionObservationOptions, useCodexSessionObservation } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useCodexSessionObservation";
import { selectCodexSession } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSessionState";
import type { AiProviderHealthItem } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";
import { enabledModes } from "../modeHealth";

const observesCodex = (provider?: AiProviderHealthItem) => typeof provider?.key === "string" && provider.key.toLowerCase() === "openai"
  && provider.isActive === true && enabledModes(provider).includes("agentic");

/** Aggregate health is a snapshot; account metadata is a separate bounded read. */
export function useIndicatorHealth() {
  const { t } = useTranslation("layout");
  const { isSessionValid, sessionVersion } = useAuth();
  const client = useQueryClient();
  const health = useAiProvidersHealth({ enabled: isSessionValid });
  const provider = health.data?.providers.find(item => item.is_default === true);
  const observeSession = isSessionValid && observesCodex(provider);
  const session = useCodexSessionObservation(provider?.id ?? "", observeSession);
  const pending = useRef(false);
  const currentIntent = useRef<number | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  useEffect(() => {
    currentIntent.current = isSessionValid ? sessionVersion : null;
    return () => { currentIntent.current = null; };
  }, [isSessionValid, sessionVersion]);
  useEffect(() => {
    if (observeSession && session.error) notifyHttpError(session.error);
  }, [observeSession, session.error]);

  const isFetching = health.isFetching || (observeSession && session.isFetching) || manualRefreshing;
  const refreshHealth = async () => {
    if (!isSessionValid || isFetching || pending.current) return;
    pending.current = true;
    setManualRefreshing(true);
    try {
      const result = await health.refetch({ cancelRefetch: false });
      if (!result.isSuccess || currentIntent.current !== sessionVersion) return;
      const target = result.data.providers.find(item => item.is_default === true);
      if (target && observesCodex(target)) {
        // staleTime zero forces a new read for this explicit intent; an in-flight
        // consumer of the same exact instance still shares the existing request.
        await client.fetchQuery({ ...codexSessionObservationOptions(target.id, sessionVersion), staleTime: 0 });
      }
      if (currentIntent.current === sessionVersion) sileo.success({ title: t("ai_indicators.refreshed") });
    } catch (error) {
      if (currentIntent.current === sessionVersion) notifyHttpError(error);
    } finally {
      pending.current = false;
      setManualRefreshing(false);
    }
  };
  return {
    data: health.data,
    provider: observeSession && provider ? { ...provider, codexSession: session.data
      ? selectCodexSession(session.data, provider.codexSession) : undefined } : provider,
    isFetching,
    isError: health.isError || (observeSession && session.isError),
    refreshHealth,
    isSessionValid,
  };
}
