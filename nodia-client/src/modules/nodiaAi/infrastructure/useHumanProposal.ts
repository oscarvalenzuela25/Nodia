import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { sileo } from "sileo";
import useAuth from "../../../hooks/useAuth";
import { getHttpErrorMessage, notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import { challengeNodiaAiProposal, confirmNodiaAiProposal, getNodiaAiCurrentProposal, getNodiaAiExecution, updateNodiaAiProposal } from "./services";
import { nodiaAiProposalKey } from "./useProposal";
import { nodiaAiKeys } from "./useServices";
import { nodiaAiErrorResponseSchema } from "./schemas";
import { nodiaAiRentalErrorKey } from "./rentalPresentation";
import { nodiaAiCoreErrorKey } from "./corePresentation";
import { nodiaAiProviderErrorKey } from "./aiProviderPresentation";
import type { NodiaAiConfirmationRequest, NodiaAiExecutionStatus, NodiaAiProposalUpdate, NodiaAiPublicProposal } from "./types";

const uncertainFailure = (error: unknown) => !isAxiosError(error) || !error.response || error.response.status >= 500;

/** Deliberately outside mutation caches: the challenge and nonce live only in this mounted human panel. */
export function useHumanProposal(conversationId: string, proposal: NodiaAiPublicProposal, onRevision: (proposal: NodiaAiPublicProposal) => void) {
  const { user, sessionVersion } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<"edit" | "confirm" | null>(null);
  const [execution, setExecution] = useState<NodiaAiExecutionStatus | null>(null);
  const [canReplay, setCanReplay] = useState(false);
  const [requiresReview, setRequiresReview] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);
  const pending = useRef<NodiaAiConfirmationRequest | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; pending.current = null; }; }, []);
  const success = (key: string) => sileo.success({ title: i18n.t(`nodiaAi:proposal.${key}`) });
  const adopt = (value: NodiaAiPublicProposal) => {
    client.setQueryData(nodiaAiProposalKey([user?.id ?? null, sessionVersion], conversationId, { proposal_id: value.proposal_id, revision: value.revision, hash: value.hash }), value);
    onRevision(value);
    void client.invalidateQueries({ queryKey: [...nodiaAiKeys.all([user?.id ?? null, sessionVersion]), "events", conversationId] });
    void client.invalidateQueries({ queryKey: nodiaAiKeys.detail([user?.id ?? null, sessionVersion], conversationId) });
  };
  const fail = (cause: unknown) => {
    if (!active.current) return;
    const parsed = isAxiosError<unknown>(cause) ? nodiaAiErrorResponseSchema.safeParse(cause.response?.data) : null;
    const code = parsed?.success ? parsed.data.error.code : null;
    const nativeMessage: unknown = isAxiosError(cause) ? cause.response?.data?.message : null;
    const coreCode = nodiaAiCoreErrorKey(code) ?? nodiaAiCoreErrorKey(nativeMessage);
    const rentalCode = nodiaAiProviderErrorKey(code) ?? nodiaAiProviderErrorKey(nativeMessage) ?? coreCode ?? nodiaAiRentalErrorKey(code) ?? nodiaAiRentalErrorKey(nativeMessage);
    const challengeInvalid = isAxiosError(cause) && cause.response?.status === 403 && code === "nodia_ai:confirmation_invalid";
    const changed = isAxiosError(cause) && cause.response?.status === 409 && (code === "nodia_ai:preconditions_changed" || code === "nodia_ai:revision_conflict");
    if (challengeInvalid || changed) {
      pending.current = null; setCanReplay(false); setUncertain(changed ? "confirm" : null);
      if (changed) setRequiresReview(true);
      const description = i18n.t(`nodiaAi:proposal.${challengeInvalid ? "challenge_invalid" : code === "nodia_ai:preconditions_changed" ? "preconditions_changed" : "revision_conflict"}`);
      setError(description); sileo.error({ title: i18n.t("core:server_error_toast"), description });
      return;
    }
    if (code === "nodia_ai:invoice_file_move_requires_staging" || code === "nodia_ai:result_too_large") {
      const description = i18n.t(`nodiaAi:proposal.${code === "nodia_ai:invoice_file_move_requires_staging" ? "invoice_file_move_requires_staging" : "result_too_large"}`);
      setError(description); sileo.error({ title: i18n.t("core:server_error_toast"), description }); return;
    }
    if (rentalCode) {
      const description = i18n.t(rentalCode);
      setError(description); sileo.error({ title: i18n.t("core:server_error_toast"), description });
    } else { setError(getHttpErrorMessage(cause)); notifyHttpError(cause); }
    const protectedCoreRule = coreCode !== undefined && isAxiosError(cause) && cause.response?.status === 403;
    if (!protectedCoreRule && isAxiosError(cause) && [401, 403, 404, 410].includes(cause.response?.status ?? 0)) {
      pending.current = null;
      setCanReplay(false);
      client.setQueryData(nodiaAiProposalKey([user?.id ?? null, sessionVersion], conversationId, { proposal_id: proposal.proposal_id, revision: proposal.revision, hash: proposal.hash }), null);
      void client.invalidateQueries({ queryKey: nodiaAiProposalKey([user?.id ?? null, sessionVersion], conversationId, { proposal_id: proposal.proposal_id, revision: proposal.revision, hash: proposal.hash }, true) });
    }
  };
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || !active.current) return;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inFlight.current = true; setBusy(true); setError(null);
    try { await action(); } catch (cause) { fail(cause); }
    finally {
      inFlight.current = false;
      if (active.current) {
        setBusy(false);
        if (focused?.isConnected && document.activeElement === document.body) queueMicrotask(() => { if (active.current && focused.isConnected) focused.focus(); });
      }
    }
  };
  const save = (edits: NodiaAiProposalUpdate["edits"]) => run(async () => {
    pending.current = null;
    try {
      const result = await updateNodiaAiProposal(proposal.proposal_id, { expected_proposal_revision: proposal.revision, expected_hash: proposal.hash, edits });
      if (!active.current) return;
      success("saved"); adopt(result);
    } catch (cause) { if (active.current && uncertainFailure(cause)) setUncertain("edit"); throw cause; }
  });
  const accept = (result: NodiaAiExecutionStatus) => {
    pending.current = null; setUncertain(null); setCanReplay(false); setExecution(result); success("accepted");
    // Admission is not a completed business effect. No domain cache invalidation.
    adopt({ ...proposal, state: "confirmed", execution_id: result.execution_id });
  };
  const confirm = () => run(async () => {
    const challenge = await challengeNodiaAiProposal(proposal).catch(cause => {
      if (active.current && isAxiosError(cause) && cause.response?.status === 409) setUncertain("confirm");
      throw cause;
    });
    if (!active.current) return;
    if (Date.parse(challenge.expires_at) <= Date.now()) throw new Error("nodia_ai:proposal_expired");
    success("challenge_ready");
    pending.current = { client_request_id: crypto.randomUUID(), proposal_revision: proposal.revision, expected_hash: proposal.hash, confirmation_token: challenge.confirmation_token };
    try {
      const result = await confirmNodiaAiProposal(proposal.proposal_id, pending.current);
      if (active.current) accept(result);
    } catch (cause) {
      if (active.current) {
        if (uncertainFailure(cause) || isAxiosError(cause) && cause.response?.status === 409) setUncertain("confirm");
        else pending.current = null;
      }
      throw cause;
    }
  });
  const recover = () => run(async () => {
    const current = await getNodiaAiCurrentProposal(proposal.proposal_id);
    if (!active.current) return;
    if (current.state === "confirmed" && current.execution_id) {
      const result = await getNodiaAiExecution(current.execution_id);
      if (!active.current) return;
      pending.current = null; setExecution(result); setUncertain(null); setCanReplay(false); success("recovered"); adopt(current); return;
    }
    if (uncertain === "confirm" && current.state === "ready" && current.revision === proposal.revision && current.hash === proposal.hash && pending.current) {
      setCanReplay(true); success("ready_to_retry");
      return;
    }
    pending.current = null; setUncertain(null); setCanReplay(false); success("recovered"); adopt(current);
  });
  const replay = () => run(async () => {
    if (!canReplay || !pending.current || uncertain !== "confirm") return;
    const result = await confirmNodiaAiProposal(proposal.proposal_id, pending.current);
    if (active.current) accept(result);
  });
  return { busy, error, uncertain, execution, canReplay, requiresReview, save, confirm, recover, replay };
}
