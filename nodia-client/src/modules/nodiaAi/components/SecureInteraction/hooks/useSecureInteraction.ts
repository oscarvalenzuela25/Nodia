import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import useAuthStore, { hasActiveSession } from "../../../../../store/authStore";
import useAuth from "../../../../../hooks/useAuth";
import { notifyHttpError } from "../../../../../config/httpFeedback";
import i18n from "../../../../../translate";
import { actNodiaAiSecureFlow, getNodiaAiSecureFlow, type SecureFlowAction, type SecureFlowPayload, type SecureFlowResponse } from "../../../infrastructure/secureFlow";
import { nodiaAiExecutionKey } from "../../../infrastructure/useExecution";
import { nodiaAiKeys } from "../../../infrastructure/useServices";

export function useSecureInteraction(conversationId: string, executionId: string) {
  const { user, sessionVersion } = useAuth();
  const client = useQueryClient();
  const [value, setValue] = useState<SecureFlowResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [denied, setDenied] = useState(false);
  const active = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const current = () => {
    const auth = useAuthStore.getState();
    return active.current && auth.user?.id === user?.id && auth.sessionVersion === sessionVersion && hasActiveSession(auth);
  };
  const refreshExecution = () => {
    const scope = [user?.id ?? null, sessionVersion] as const;
    void client.invalidateQueries({ queryKey: nodiaAiExecutionKey(scope, executionId) });
    void client.invalidateQueries({ queryKey: nodiaAiKeys.detail(scope, conversationId) });
  };
  const load = async () => {
    if (inFlight.current || !current()) return;
    inFlight.current = true; setBusy(true);
    try {
      const result = await getNodiaAiSecureFlow(executionId);
      if (!current()) return;
      setValue(result); setFailed(false); setDenied(false);
      // Observation does not authorize repeating a dispatch whose result is unknown.
      setUncertain(result.flow.status === "unknown" || result.flow.status === "invoking");
    } catch (error) { if (current()) { setFailed(true); if (isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0)) setDenied(true); notifyHttpError(error); } }
    finally { inFlight.current = false; if (current()) setBusy(false); }
  };
  const act = async (action: SecureFlowAction, payload?: SecureFlowPayload) => {
    if (!value || denied || inFlight.current || !current() || uncertain && !["status", "cancel"].includes(action)) return null;
    inFlight.current = true; setBusy(true);
    try {
      const result = await actNodiaAiSecureFlow(executionId, value.flow, action, crypto.randomUUID(), payload);
      if (!current()) return null;
      setValue(previous => ["completed", "cancelled", "expired", "failed"].includes(result.flow.status) ? { flow: result.flow } : ({ ...previous, ...result })); setFailed(false);
      setUncertain(["unknown", "invoking"].includes(result.flow.status));
      sileo.success({ title: i18n.t("nodiaAi:secure.updated") });
      if (result.flow.status === "completed" || result.flow.status === "cancelled") {
        if (action === "logout" && result.flow.kind === "nodia_logout") useAuthStore.getState().logout();
        else refreshExecution();
      }
      return result;
    } catch (error) {
      if (!current()) return null;
      setFailed(true); notifyHttpError(error);
      if (isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0)) setDenied(true);
      if (!["status"].includes(action) && !(isAxiosError(error) && error.response && error.response.status < 500)) setUncertain(true);
      return null;
    } finally { inFlight.current = false; if (current()) setBusy(false); }
  };
  return { value, busy, failed, uncertain, denied, load, act, clear: () => { if (!inFlight.current) { setValue(null); setFailed(false); setUncertain(false); setDenied(false); } } };
}
