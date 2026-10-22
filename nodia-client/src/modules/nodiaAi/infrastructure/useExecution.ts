import { nodiaAiProviderResources } from "./aiProviderPresentation";
import { nodiaAiCoreResources } from "./corePresentation";
import { authorizationKeys } from "../../../services/authorizationService";
import { businessKeys, productKeys, providerKeys, invoiceKeys, productLogKeys } from "../../business/infrastructure/queryKeys";
import { nodiaAiBusinessResources } from "./businessPresentation";
import { nodiaAiRentalResources } from "./rentalPresentation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ZodError } from "zod";
import { sileo } from "sileo";
import useAuth from "../../../hooks/useAuth";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import { getNodiaAiExecution, controlNodiaAiExecution, getNodiaAiConversation } from "./services";
import { isNodiaAiExecutionActive, nodiaAiKeys } from "./useServices";
import type { NodiaAiDetail, NodiaAiExecutionControlInput, NodiaAiExecutionStatus } from "./types";
import { nodiaAiFinanceResources } from "./financePresentation";

export const nodiaAiExecutionKey = (scope: readonly [string | null, number], id: string) => [...nodiaAiKeys.all(scope), "execution", id] as const;

/** Observation never resends a write. An uncertain control keeps its exact request until explicit retry. */
export function useNodiaAiExecution(conversationId: string, executionId: string, observed = true) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const client = useQueryClient();
  const scope = [user?.id ?? null, sessionVersion] as const;
  const key = nodiaAiExecutionKey(scope, executionId);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const pending = useRef<{ action: "cancel" | "resume"; input: NodiaAiExecutionControlInput } | null>(null);
  const active = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; pending.current = null; }; }, []);
  const current = () => {
    const auth = useAuthStore.getState();
    return observed && active.current && auth.user?.id === user?.id && auth.sessionVersion === sessionVersion && hasActiveSession(auth);
  };
  // Subscribe to the page's authority without issuing another detail request.
  const chat = useQuery<NodiaAiDetail>({ queryKey: nodiaAiKeys.detail(scope, conversationId),
    queryFn: ({ signal }) => getNodiaAiConversation(conversationId, signal), enabled: false, retry: false });
  const query = useQuery<NodiaAiExecutionStatus | null>({
    queryKey: key,
    queryFn: async ({ signal, queryKey }) => {
      try { return await getNodiaAiExecution(executionId, signal); }
      catch (error) {
        if (error instanceof ZodError || error instanceof Error && error.message === "nodia_ai:invalid_response"
          || isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0)) client.setQueryData(queryKey, null);
        throw error;
      }
    }, enabled: observed && isSessionActive && Boolean(user?.id), retry: false, gcTime: 0, staleTime: 0,
    meta: { errorNotification: "handled-locally" },
    refetchInterval: observation => observed && !observation.state.error && isNodiaAiExecutionActive(observation.state.data?.state) ? 2000 : false,
  });
  const notified = useRef<unknown>(null);
  useEffect(() => { if (query.error && notified.current !== query.error) { notified.current = query.error; notifyHttpError(query.error); } }, [query.error]);
  const completedReceipts = JSON.stringify(query.data?.steps.filter(step => step.state === "completed")
    .flatMap(step => step.result_refs.map(ref => [step.step_id, ref.resource_key, ref.id])) ?? []);
  const invalidated = useRef(new Set<string>());
  useEffect(() => {
    // A validated receipt proves an effect. A late response from a previous
    // actor/session must never touch the current domain cache.
    const auth = useAuthStore.getState();
    if (!active.current || auth.user?.id !== user?.id || auth.sessionVersion !== sessionVersion || !hasActiveSession(auth)) return;
    const receipts = JSON.parse(completedReceipts) as [string, string, string][];
    const resources = new Set<string>();
    for (const receipt of receipts) {
      const identity = JSON.stringify(receipt);
      if (invalidated.current.has(identity)) continue;
      invalidated.current.add(identity);
      resources.add(receipt[1]);
    }
    const pendingKeys: (readonly unknown[])[] = [];
    for (const resource of resources) {
      if (resource === "nodia_ai_preferences") pendingKeys.push([...nodiaAiKeys.all([user?.id ?? null, sessionVersion]), "preferences"]);
      if (resource === "secure_flows") {
        pendingKeys.push(...["ai-api-keys", "ai-providers", "ai-providers-health", "ai-selectable-models", "ai-enabled-web-providers", "ai-provider-catalog", "ai-provider-events"].map(key => [key]));
      }
      if (nodiaAiProviderResources.some(item => item === resource)) {
        pendingKeys.push(...["ai-providers", "ai-provider-catalog", "ai-providers-health", "ai-selectable-models", "ai-enabled-web-providers", "ai-supported-providers", "ai-provider-events"].map(key => [key]), nodiaAiKeys.all([user?.id ?? null, sessionVersion]));
      }
      if (nodiaAiCoreResources.some(item => item === resource)) {
        // Core associations can affect navigation and downstream access. Re-read
        // the current actor context; receipts never grant authority locally.
        pendingKeys.push(["users"], ["roles"], ["actions"], ["business-actions"], ["modules"], ["module-groups"], [...authorizationKeys.context(), user?.id], nodiaAiKeys.all([user?.id ?? null, sessionVersion]));
      }
      if (nodiaAiFinanceResources.some(item => item === resource)) pendingKeys.push(["finance", user?.id]);
      // The native rental cache is actor-scoped; configuration/access changes
      // affect property lists, permissions, availability, summaries and selectors.
      if (nodiaAiRentalResources.some(item => item === resource)) pendingKeys.push(["rental", user?.id]);
      if (!nodiaAiBusinessResources.some(item => item === resource)) continue;
      if (resource === "businesses") pendingKeys.push(businessKeys.all);
      if (resource === "products") pendingKeys.push(productKeys.all, productLogKeys.all, businessKeys.all);
      if (resource === "product_logs") pendingKeys.push(productLogKeys.all, productKeys.all);
      if (resource === "providers") pendingKeys.push(providerKeys.all, productKeys.all, businessKeys.all);
      if (resource === "provider_contacts") pendingKeys.push(["provider-contacts", user?.id], providerKeys.all);
      if (resource === "invoices") pendingKeys.push(invoiceKeys.all, ["invoice-view-url"]);
    }
    const unique = new Map(pendingKeys.map(queryKey => [JSON.stringify(queryKey), queryKey]));
    for (const queryKey of unique.values()) void client.invalidateQueries({ queryKey });
  }, [client, completedReceipts, user?.id, sessionVersion]);
  const readOnly = !observed || chat.data?.conversation.read_only !== false || chat.isError;
  const control = async (action: "cancel" | "resume", retry = false) => {
    if (inFlight.current || !current() || readOnly || query.isFetching || !query.data) return;
    if (!retry && uncertain || retry && !canRetry) return;
    const request = retry ? pending.current : { action, input: { client_request_id: crypto.randomUUID(), expected_execution_revision: query.data.revision } };
    if (!request) return;
    pending.current = request; inFlight.current = true; setBusy(true); setCanRetry(false);
    try {
      const result = await controlNodiaAiExecution(executionId, request.action, request.input);
      if (!current()) return;
      client.setQueryData(key, result); pending.current = null; setUncertain(false);
      sileo.success({ title: i18n.t(`nodiaAi:execution.${request.action === "cancel" ? "cancel_checked" : "resumed"}`) });
      void client.invalidateQueries({ queryKey: nodiaAiKeys.detail(scope, conversationId) });
    } catch (error) {
      if (!current()) return;
      notifyHttpError(error);
      setUncertain(true);
      // Before another POST, even a rejected revision needs a fresh, read-only observation.
      if (isAxiosError(error) && error.response && error.response.status < 500) pending.current = null;
    } finally { inFlight.current = false; if (current()) setBusy(false); }
  };
  const recover = async () => {
    if (inFlight.current || !current()) return;
    inFlight.current = true; setBusy(true);
    try {
      const result = await query.refetch();
      if (!current() || !result.data || result.isError) return;
      const request = pending.current;
      const same = request && result.data.revision === request.input.expected_execution_revision;
      setCanRetry(Boolean(same));
      if (!same) { pending.current = null; setUncertain(false); }
    } finally { inFlight.current = false; if (current()) setBusy(false); }
  };
  return { data: query.data, isLoading: query.isLoading, isFetching: query.isFetching, isError: query.isError,
    busy, uncertain, canRetry, readOnly, control, recover, retry: () => pending.current && control(pending.current.action, true) };
}
