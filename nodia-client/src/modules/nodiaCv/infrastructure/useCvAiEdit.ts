import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../config/httpFeedback";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import i18n from "../../../translate";
import type { NodiaAiSelection } from "../../nodiaAi/infrastructure/types";
import { cvAiEditChanges, matchesAiEdit, requestCvAiEdit, type CvAiEditRequest } from "./cvAiEdit";
import {
  clearCvAiEditReceipt,
  cvAiEditRequestKey,
  discardOtherCvAiEditReceipts,
  rememberCvAiEditReceipt,
} from "./cvAiEditReceiptStorage";
import {
  cvGenerationQueryKey,
  restoreCvGeneration,
  useCvGenerationStatus,
  useCvHttpNotice,
  type TrackedCvGeneration,
} from "./generations";
import { cvInputIdentity, type CvGeneration, type CvGenerationInput } from "./generationSchema";
import { profileAccessDenied, profileWriteMayHaveCommitted, useProfileScope } from "./profiles";
import { cvHttpStatus, type CvGenerationView } from "./useCvGenerationWorkflow";

type PendingEdit = { key: string; request?: CvAiEditRequest };
type Action = "propose" | "check" | "apply";
export type CvAiEditApplyResult = "applied" | "stale" | "unavailable";

export function useCvAiEdit(base: CvGenerationView, selection: NodiaAiSelection, onDenial: () => void) {
  const { scope, active } = useProfileScope();
  const [, owner, sessionVersion] = scope;
  const target = { baseId: base.receipt.id, revision: base.receipt.review?.revision ?? 0 };
  const cache = useQueryClient();
  const [pending, setPending] = useState<PendingEdit | null>(() => {
    const key = cvAiEditRequestKey(owner, target);
    return key ? { key } : null;
  });
  const [tracked, setTracked] = useState<TrackedCvGeneration | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [missing, setMissing] = useState(false);
  const [stale, setStale] = useState(false);
  const [applyUnavailable, setApplyUnavailable] = useState(false);
  const flight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const status = useCvGenerationStatus(tracked, active);
  const mutation = useMutation({
    mutationFn: ({ request, intent }: { request: CvAiEditRequest; intent: CvGenerationInput }) =>
      requestCvAiEdit(target, request, intent, sessionVersion),
    retry: false,
    gcTime: 0,
  });

  useEffect(() => {
    mounted.current = true;
    discardOtherCvAiEditReceipts(owner);
    return () => {
      mounted.current = false;
      flight.current?.abort();
    };
  }, [owner, sessionVersion]);
  useCvHttpNotice(status.error, onDenial);

  const latest = status.data ?? tracked?.receipt ?? null;
  const valid = Boolean(latest && tracked && matchesAiEdit(latest, target, tracked.intent));
  const changes = valid && latest?.state === "ready" ? cvAiEditChanges(base.receipt, latest) : null;
  const invalid = latest !== null && (!valid || (latest.state === "ready" && !changes));
  const proposal = !invalid && tracked && latest && changes?.changed
    ? { intent: tracked.intent, receipt: latest } : null;
  const working = valid && (latest?.state === "queued" || latest?.state === "running");
  const unresolved = valid && latest?.state === "unknown";
  const failed = valid && latest?.state === "failed";
  const canEdit = active && target.revision > 0 && action === null && !invalid && !working && !unresolved && !proposal &&
    (!pending || missing && !pending.request || failed || changes?.changed === false);
  const canPropose = canEdit || (active && action === null && missing && Boolean(pending?.request));

  const authorized = () => {
    const auth = useAuthStore.getState();
    return mounted.current && auth.user?.id === owner && auth.sessionVersion === sessionVersion && hasActiveSession(auth);
  };
  const begin = (kind: Action) => {
    if (flight.current || !authorized()) return null;
    const controller = new AbortController();
    flight.current = controller;
    setAction(kind);
    setError(null);
    return controller;
  };
  const finish = () => {
    flight.current = null;
    if (authorized()) setAction(null);
  };
  const report = (reason: unknown) => {
    setError(reason);
    if (profileAccessDenied(reason)) onDenial();
    notifyHttpError(reason);
  };
  const forget = (key: string) => {
    if (owner) clearCvAiEditReceipt(owner, target, key);
  };
  const intentOf = (key: string, model = selection): CvGenerationInput => ({
    ...base.intent, request_key: key, selection: model,
  });
  const accept = (intent: CvGenerationInput, receipt: CvGeneration) => {
    cache.setQueryData(cvGenerationQueryKey(scope, receipt.id), receipt);
    setTracked({ intent, receipt });
    setPending({ key: intent.request_key });
    setMissing(false);
  };

  const propose = async (instructions: string) => {
    if (!canPropose) return;
    const controller = begin("propose");
    if (!controller) return;
    const previousKey = missing ? pending?.key : undefined;
    const key = previousKey ?? crypto.randomUUID();
    const request = pending?.request && missing
      ? pending.request : { request_key: key, revision: target.revision, instructions, selection };
    const intent = intentOf(key);
    if (pending && !previousKey) forget(pending.key);
    if (owner) rememberCvAiEditReceipt(owner, target, key);
    setPending({ key, request });
    setTracked(null);
    setMissing(false);
    setStale(false);
    setApplyUnavailable(false);
    try {
      const receipt = await mutation.mutateAsync({ request, intent });
      if (!authorized() || controller.signal.aborted) return;
      accept(intent, receipt);
      sileo.success({ title: i18n.t("nodiaCv:ai_edit.submitted") });
    } catch (reason) {
      if (!authorized() || controller.signal.aborted) return;
      if (!profileWriteMayHaveCommitted(reason)) {
        if (!previousKey) forget(key);
        setPending(previousKey ? { key: previousKey } : null);
      }
      report(reason);
    } finally {
      mutation.reset();
      finish();
    }
  };

  const check = async () => {
    if (!pending) return;
    const controller = begin("check");
    if (!controller) return;
    setMissing(false);
    try {
      const recovered = await restoreCvGeneration(pending.key, sessionVersion, controller.signal);
      if (!authorized() || controller.signal.aborted) return;
      const recoveredModel = base.intent.source_version && !pending.request ? recovered.input.selection : null;
      const intent = intentOf(pending.key, recoveredModel ?? selection);
      if (!matchesAiEdit(recovered.receipt, target, intent) ||
          cvInputIdentity(recovered.input) !== cvInputIdentity(intent)) {
        throw new Error("Unexpected recovered Nodia CV edit identity");
      }
      accept(intent, recovered.receipt);
    } catch (reason) {
      if (!authorized() || controller.signal.aborted) return;
      const code = cvHttpStatus(reason);
      if (code === 404 && !tracked) setMissing(true);
      if (code === 410) {
        forget(pending.key);
        setPending(null);
        setTracked(null);
      }
      report(reason);
    } finally {
      finish();
    }
  };

  const apply = async (onApply: (result: TrackedCvGeneration) => Promise<CvAiEditApplyResult>) => {
    if (!proposal || stale || status.isError || status.isFetching) return false;
    const controller = begin("apply");
    if (!controller) return false;
    setApplyUnavailable(false);
    try {
      const result = await onApply(proposal);
      if (!authorized() || controller.signal.aborted) return false;
      if (result === "applied") {
        forget(proposal.intent.request_key);
        sileo.success({ title: i18n.t("nodiaCv:ai_edit.applied") });
        return true;
      }
      if (result === "stale") setStale(true);
      else setApplyUnavailable(true);
    } catch (reason) {
      if (authorized()) report(reason);
    } finally {
      finish();
    }
    return false;
  };

  const dismiss = () => {
    if (flight.current) return false;
    if (pending && valid && (latest?.state === "ready" || latest?.state === "failed")) {
      forget(pending.key);
    }
    return true;
  };

  return {
    action, error: error ?? status.error, missing, stale, applyUnavailable, invalid, changes, proposal,
    pending: pending !== null, tracked: tracked !== null, working, unresolved, failed,
    failedCode: failed ? latest?.error_code : null,
    observedModel: (working || unresolved || proposal) ? tracked?.intent.selection : null,
    canEdit, canPropose, checkingResult: status.isFetching,
    propose, check, apply, dismiss,
  };
}
