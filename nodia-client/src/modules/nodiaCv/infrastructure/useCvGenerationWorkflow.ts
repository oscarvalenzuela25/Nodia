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
  recoverCvGeneration,
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
import { clearCvReceipt, cvRecoveryKey, discardOtherCvReceipt, rememberCvReceipt } from "./receiptStorage";
import { profileAccessDenied, profileWriteMayHaveCommitted, useProfileScope } from "./profiles";

type Intent = { input: CvGenerationInput; profile: ProfileRecord };
export type CvGenerationView = TrackedCvGeneration & { profile: ProfileRecord };
export type CvReviewTarget = Pick<CvGenerationView, "intent" | "receipt">;
type UncertainAdmission = { intent: Intent; receiptMissing: boolean };

export function cvHttpStatus(error: unknown) {
  return isAxiosError(error) ? (error.response?.status ?? null) : null;
}

export function useCvGenerationWorkflow(active: boolean, onDenial: () => void) {
  const queryClient = useQueryClient();
  const { scope } = useProfileScope();
  const actorId = scope[1];
  const [tracked, setTracked] = useState<CvGenerationView | null>(null);
  const [presentedTerminal, setPresentedTerminal] = useState<string | null>(null);
  const [dismissedRequest, setDismissedRequest] = useState<string | null>(null);
  const [closedUnknown, setClosedUnknown] = useState<ReadonlySet<string>>(() => new Set());
  const [uncertain, setUncertain] = useState<UncertainAdmission | null>(null);
  const [admissionError, setAdmissionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [restorable, setRestorable] = useState(() => cvRecoveryKey(scope[1]));
  const [restoreMissing, setRestoreMissing] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const mounted = useRef(true);
  const lock = useRef(false);
  const recovering = useRef<AbortController | null>(null);
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

  useEffect(() => discardOtherCvReceipt(actorId), [actorId]);

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
  const currentUnknown = receipt?.state === "unknown" && tracked ? cvInputIdentity(tracked.intent) : null;
  const hasUnknown = (identity: string) => identity === currentUnknown || closedUnknown.has(identity);

  useEffect(() => {
    if (dismissedRequest) clearCvReceipt(dismissedRequest);
  }, [dismissedRequest]);

  const terminal = receipt?.state === "ready" || receipt?.state === "failed";
  if (active && terminal && presentedTerminal !== receipt.id) setPresentedTerminal(receipt.id);

  if (!active && !busy && !uncertain && !restorable) {
    if (admissionError !== null) setAdmissionError(null);
    if (tracked && receipt?.state !== "unknown") {
      // Keep unresolved submissions recoverable by the same key after leaving the tab.
      if (working || (terminal && presentedTerminal !== receipt.id)) setRestorable(tracked.intent.request_key);
      else setDismissedRequest(tracked.intent.request_key);
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
  const startLock = () => {
    if (lock.current || !sameActor() || !hasActiveSession(useAuthStore.getState())) return false;
    lock.current = true;
    setBusy(true);
    return true;
  };
  const releaseLock = () => {
    lock.current = false;
    if (sameActor()) setBusy(false);
  };
  const accept = (intent: Intent, value: CvGeneration) => {
    queryClient.setQueryData(cvGenerationQueryKey(scope, value.id), value);
    setTracked({ intent: intent.input, profile: intent.profile, receipt: value });
    setUncertain(null);
    setRestorable(null);
    setRestoreMissing(false);
    setAdmissionError(null);
  };

  const submit = async (intent: Intent) => {
    if (!startLock()) return;
    if (scope[1]) rememberCvReceipt(scope[1], intent.input.request_key);
    setAdmissionError(null);
    try {
      const value = await startRequest.mutateAsync(intent.input);
      if (!sameActor()) return;
      accept(intent, value);
      sileo.success({ title: i18n.t("nodiaCv:generation_accepted") });
    } catch (error) {
      if (!sameActor()) return;
      setAdmissionError(error);
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
      if (profileWriteMayHaveCommitted(error)) setUncertain({ intent, receiptMissing: false });
      else if (!uncertain) {
        if (scope[1] && tracked) rememberCvReceipt(scope[1], tracked.intent.request_key);
        else clearCvReceipt(intent.input.request_key);
      }
      // A prior ambiguous submission remains recoverable even if a subsequent
      // retry was rejected before reaching the original receipt lookup.
      reportError(error);
    } finally {
      startRequest.reset();
      releaseLock();
    }
  };

  const generate = (input: Omit<CvGenerationInput, "request_key">, profile: ProfileRecord) => {
    if (uncertain || restorable || working || hasUnknown(cvInputIdentity(input))) return;
    if (currentUnknown) setClosedUnknown((priorUnknown) => new Set(priorUnknown).add(currentUnknown));
    void submit({ input: { ...input, request_key: crypto.randomUUID() }, profile });
  };

  const recover = async () => {
    const key = uncertain?.intent.input.request_key ?? restorable;
    if (!key || !startLock()) return;
    const controller = new AbortController();
    recovering.current = controller;
    setAdmissionError(null);
    try {
      if (uncertain) {
        const value = await recoverCvGeneration(uncertain.intent.input, scope[2], controller.signal);
        if (sameActor()) accept(uncertain.intent, value);
        return;
      }
      const restored = await restoreCvGeneration(key, scope[2], controller.signal);
      if (!sameActor()) return;
      accept(restored, restored.receipt);
      return restored.input;
    } catch (error) {
      if (!sameActor() || controller.signal.aborted) return;
      setAdmissionError(error);
      if (cvHttpStatus(error) === 404) {
        if (uncertain) setUncertain({ intent: uncertain.intent, receiptMissing: true });
        else setRestoreMissing(true);
      }
      if (cvHttpStatus(error) === 410) {
        clearCvReceipt(key);
        setRestorable(null);
        setUncertain(null);
      }
      reportError(error);
    } finally {
      recovering.current = null;
      releaseLock();
    }
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
    restorable,
    restoreMissing,
    expired,
    discardRestorable: () => {
      if (!restorable || !restoreMissing || lock.current) return;
      clearCvReceipt(restorable);
      setRestorable(null);
      setRestoreMissing(false);
      setAdmissionError(null);
    },
    hasUnknown,
    generate,
    recover,
    review,
    reloadReview,
    reportError,
    resend: () => {
      if (uncertain?.receiptMissing) void submit(uncertain.intent);
    },
  };
}
