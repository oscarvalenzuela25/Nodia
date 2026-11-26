import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import {
  cvEligibilityQueryKey,
  cvGenerationQueryKey,
  readCvGeneration,
  restoreCvGeneration,
  saveCvReview,
  startCvGeneration,
  useCvGenerationStatus,
  type TrackedCvGeneration,
} from "./generations";
import {
  cvInputIdentity,
  type CvGeneration,
  type CvGenerationInput,
  type CvReviewSave,
} from "./generationSchema";
import type { ProfileRecord } from "./profileSchema";
import { clearCvReceipt, cvRecoveryKeys, discardOtherCvReceipt, rememberCvReceipt } from "./receiptStorage";
import { profileAccessDenied, profileWriteMayHaveCommitted, useProfileScope } from "./profiles";

type Intent = { input: CvGenerationInput; profile: ProfileRecord };
export type CvGenerationView = TrackedCvGeneration & { profile: ProfileRecord };
export type CvReviewTarget = Pick<CvGenerationView, "intent" | "receipt">;
type UncertainAdmission = { intent: Intent; receiptMissing: boolean };
type PriorRequest = { state: "working" | "unknown" } | { state: "missing"; key: string };

export function cvHttpStatus(error: unknown) {
  return isAxiosError(error) ? (error.response?.status ?? null) : null;
}

export function useCvGenerationWorkflow(active: boolean, onDenial: () => void) {
  const queryClient = useQueryClient();
  const { scope } = useProfileScope();
  const actorId = scope[1];
  const [tracked, setTracked] = useState<CvGenerationView | null>(null);
  const [dismissedRequest, setDismissedRequest] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<UncertainAdmission | null>(null);
  const [admissionError, setAdmissionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [priorRequest, setPriorRequest] = useState<PriorRequest | null>(null);
  const [clock, setClock] = useState(Date.now);
  const mounted = useRef(true);
  const lock = useRef(false);
  const recovering = useRef<AbortController | null>(null);
  const localReceipts = useRef(new Set<string>());
  const status = useCvGenerationStatus(tracked, active);
  const startRequest = useMutation({
    mutationFn: (input: CvGenerationInput) => startCvGeneration(input, scope[2]),
    retry: false,
    gcTime: 0,
  });
  const reviewRequest = useMutation({
    mutationFn: ({ view, input }: { view: CvReviewTarget; input: CvReviewSave }) =>
      saveCvReview(view.receipt.id, view.intent, input, scope[2]),
    retry: false,
    gcTime: 0,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recovering.current?.abort();
    };
  }, []);

  useEffect(() => {
    localReceipts.current.clear();
    discardOtherCvReceipt(actorId);
  }, [actorId]);

  useEffect(() => {
    if (!active) recovering.current?.abort();
  }, [active]);

  const known = status.data ?? tracked?.receipt ?? null;
  const deadline = known ? Date.parse(known.expires_at) : 0;
  const nextDeadline = deadline > clock ? deadline : null;
  useEffect(() => {
    if (nextDeadline === null) return;
    const timer = window.setTimeout(() => setClock(Date.now()), Math.max(0, nextDeadline - Date.now() + 1));
    const refresh = () => {
      if (document.visibilityState === "visible") setClock(Date.now());
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [nextDeadline]);

  const expired = Boolean(known && Date.parse(known.expires_at) <= clock);
  const receiptUnavailable = expired || [404, 410].includes(cvHttpStatus(status.error) ?? 0);
  const receipt = receiptUnavailable ? null : known;
  const visible = active && tracked && receipt?.state === "ready" ? { ...tracked, receipt } : null;
  const working = receipt?.state === "queued" || receipt?.state === "running";
  const hasUnknown = (identity: string) =>
    receipt?.state === "unknown" && Boolean(tracked && cvInputIdentity(tracked.intent) === identity);

  useEffect(() => {
    if (actorId && dismissedRequest) {
      localReceipts.current.delete(dismissedRequest);
      clearCvReceipt(actorId, dismissedRequest);
    }
  }, [actorId, dismissedRequest]);

  if (!active) {
    if (admissionError !== null) setAdmissionError(null);
    if (priorRequest) setPriorRequest(null);
    if (uncertain) setUncertain(null);
    if (tracked) {
      if (receipt?.state === "ready" || receipt?.state === "failed" || expired) {
        setDismissedRequest(tracked.intent.request_key);
      }
      setTracked(null);
    }
  }

  const sameActor = () => {
    const state = useAuthStore.getState();
    return mounted.current && state.sessionVersion === scope[2] && state.user?.id === scope[1];
  };
  const reportError = (error: unknown) => {
    if (!sameActor()) return;
    if (profileAccessDenied(error)) onDenial();
    notifyHttpError(error);
  };
  const beginCommand = () => {
    if (!active || lock.current || !sameActor() || !hasActiveSession(useAuthStore.getState())) return null;
    const controller = new AbortController();
    lock.current = true;
    recovering.current = controller;
    setBusy(true);
    return controller;
  };
  const finishCommand = () => {
    recovering.current = null;
    lock.current = false;
    if (sameActor()) setBusy(false);
  };
  const accept = (intent: Intent, value: CvGeneration) => {
    queryClient.setQueryData(cvGenerationQueryKey(scope, value.id), value);
    setTracked({ intent: intent.input, profile: intent.profile, receipt: value });
    setUncertain(null);
    setAdmissionError(null);
  };
  const forget = (key: string) => {
    localReceipts.current.delete(key);
    if (actorId) clearCvReceipt(actorId, key);
  };

  const submit = async (intent: Intent, signal: AbortSignal, keepKeyOnFailure = false) => {
    localReceipts.current.add(intent.input.request_key);
    if (actorId) rememberCvReceipt(actorId, intent.input.request_key);
    setAdmissionError(null);
    try {
      const value = await startRequest.mutateAsync(intent.input);
      if (!sameActor()) return;
      if (!signal.aborted) accept(intent, value);
      else if (value.state === "ready" || value.state === "failed") forget(intent.input.request_key);
      sileo.success({ title: i18n.t("nodiaCv:generation_accepted") });
    } catch (error) {
      if (!sameActor()) return;
      if (!signal.aborted) setAdmissionError(error);
      const message: unknown = isAxiosError(error) ? error.response?.data?.message : null;
      if (intent.input.selection.mode === "agentic" && (
        message === "nodiaCv:generation_selection_unqualified" ||
        message === "nodiaCv:configuration_unavailable" ||
        message === "nodiaCv:agentic_transport_unavailable"
      )) {
        void queryClient.invalidateQueries({
          queryKey: cvEligibilityQueryKey(scope, intent.input.selection),
          exact: true,
        });
      }
      if (profileWriteMayHaveCommitted(error)) {
        if (!signal.aborted) setUncertain({ intent, receiptMissing: false });
      } else if (message === "nodiaCv:request_key_conflict") {
        if (!signal.aborted) setUncertain(null);
      } else if (!uncertain && !keepKeyOnFailure) {
        forget(intent.input.request_key);
      }
      reportError(error);
    } finally {
      startRequest.reset();
    }
  };

  const startGeneration = async (input: Omit<CvGenerationInput, "request_key">, profile: ProfileRecord, resumeKey?: string) => {
    const identity = cvInputIdentity(input);
    if (uncertain || working || hasUnknown(identity)) return;
    const controller = beginCommand();
    if (!controller) return;
    setPriorRequest(null);
    setAdmissionError(null);
    try {
      let verifiedMissingKey: string | undefined;
      const keys = new Set([...cvRecoveryKeys(actorId), ...localReceipts.current]);
      for (const key of keys) {
        let previous: { input: CvGenerationInput; receipt: CvGeneration };
        try {
          previous = receipt && key === tracked?.intent.request_key
            ? { input: tracked.intent, receipt }
            : await restoreCvGeneration(key, scope[2], controller.signal);
        } catch (error) {
          if (!sameActor() || controller.signal.aborted) return;
          if (cvHttpStatus(error) === 410) {
            forget(key);
            continue;
          }
          if (cvHttpStatus(error) === 404) {
            // The earlier request can still commit. Explicit continuation uses
            // its own key so the server can recognize or reject that intent.
            if (key === resumeKey) {
              verifiedMissingKey = key;
              continue;
            }
            setPriorRequest({ state: "missing", key });
          } else {
            setAdmissionError(error);
          }
          reportError(error);
          return;
        }
        if (!sameActor() || controller.signal.aborted) return;
        const state = previous.receipt.state;
        if (state === "ready" || state === "failed") forget(key);
        else if (cvInputIdentity(previous.input) === identity) {
          setPriorRequest({ state: state === "unknown" ? "unknown" : "working" });
          return;
        }
      }
      if (!controller.signal.aborted) {
        await submit({
          input: { ...input, request_key: verifiedMissingKey ?? crypto.randomUUID() },
          profile,
        }, controller.signal, Boolean(verifiedMissingKey));
      }
    } finally {
      finishCommand();
    }
  };

  const recover = async () => {
    if (!uncertain) return;
    const controller = beginCommand();
    if (!controller) return;
    const { intent } = uncertain;
    setAdmissionError(null);
    try {
      const recovered = await restoreCvGeneration(intent.input.request_key, scope[2], controller.signal);
      if (!sameActor() || controller.signal.aborted) return;
      if (cvInputIdentity(recovered.input) !== cvInputIdentity(intent.input)) {
        // A different original request won a reused legacy key.
        setUncertain(null);
        return;
      }
      accept(intent, recovered.receipt);
    } catch (error) {
      if (!sameActor() || controller.signal.aborted) return;
      setAdmissionError(error);
      if (cvHttpStatus(error) === 404) {
        setUncertain({ intent, receiptMissing: true });
      }
      if (cvHttpStatus(error) === 410) {
        forget(intent.input.request_key);
        setUncertain(null);
      }
      reportError(error);
    } finally {
      finishCommand();
    }
  };

  const discardDraft = () => {
    if (!visible || !sameActor()) return;
    const id = visible.receipt.id;
    const latest = queryClient.getQueryData<CvGeneration>(cvGenerationQueryKey(scope, id)) ?? visible.receipt;
    if (latest.state !== "ready" || latest.review?.revision !== visible.receipt.review?.revision) return;
    forget(visible.intent.request_key);
    setTracked(current => current?.receipt.id === id ? null : current);
  };

  const reloadReview = async (view: CvReviewTarget) => {
    const value = await readCvGeneration(view.receipt.id, view.intent, scope[2]);
    if (!sameActor()) throw new Error("Session changed");
    queryClient.setQueryData(cvGenerationQueryKey(scope, view.receipt.id), value);
    return value.review;
  };

  const review = async (view: CvReviewTarget, input: CvReviewSave) => {
    if (!sameActor()) return;
    const queryKey = cvGenerationQueryKey(scope, view.receipt.id);
    await queryClient.cancelQueries({ queryKey, exact: true });
    try {
      const value = await reviewRequest.mutateAsync({ view, input });
      if (!sameActor()) return;
      await queryClient.cancelQueries({ queryKey, exact: true });
      if (!sameActor()) return;
      queryClient.setQueryData(queryKey, value);
      sileo.success({ title: i18n.t("nodiaCv:review_saved") });
    } catch (error) {
      reportError(error);
      throw error;
    } finally {
      reviewRequest.reset();
    }
  };

  return {
    busy,
    working,
    receipt,
    tracked,
    visible,
    status,
    admissionError,
    uncertain,
    priorRequest: priorRequest?.state ?? null,
    expired,
    discardDraft,
    hasUnknown,
    generate: (input: Omit<CvGenerationInput, "request_key">, profile: ProfileRecord) => startGeneration(input, profile),
    resumeMissing: (input: Omit<CvGenerationInput, "request_key">, profile: ProfileRecord) => {
      if (priorRequest?.state === "missing") return startGeneration(input, profile, priorRequest.key);
    },
    recover,
    review,
    reloadReview,
    reportError,
    resend: () => {
      if (!uncertain?.receiptMissing) return;
      const controller = beginCommand();
      if (controller) void submit(uncertain.intent, controller.signal).finally(finishCommand);
    },
  };
}
