import { isNodiaAiInteger } from "./integerReview";
import { validNodiaAiCancellationRules } from "./cancellationRulesReview";
import { validCoreReviewValue } from "./coreReview";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ZodError } from "zod";
import useAuth from "../../../hooks/useAuth";
import { notifyHttpError } from "../../../config/httpFeedback";
import { getNodiaAiProposal, getNodiaAiProposalReview } from "./services";
import { nodiaAiKeys } from "./useServices";
import type { NodiaAiProposalRef, NodiaAiPublicProposal, NodiaAiProposalReview } from "./types";

export const nodiaAiProposalKey = (scope: readonly [string | null, number], conversationId: string, ref: NodiaAiProposalRef, metadata = false) =>
  [...nodiaAiKeys.all(scope), metadata ? "proposal-review" : "proposal", conversationId, ref] as const;

export function useNodiaAiProposal(conversationId: string, ref: NodiaAiProposalRef, enabled = true) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const client = useQueryClient();
  const key = nodiaAiProposalKey([user?.id ?? null, sessionVersion], conversationId, ref);
  const query = useQuery<NodiaAiPublicProposal | null>({
    queryKey: key,
    queryFn: async ({ signal, queryKey }) => {
      try { return await getNodiaAiProposal(ref, signal); }
      catch (error) {
        if (error instanceof ZodError || error instanceof Error && error.message === "nodia_ai:invalid_response"
          || isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0))
          client.setQueryData<NodiaAiPublicProposal | null>(queryKey, null);
        throw error;
      }
    },
    enabled: enabled && isSessionActive && Boolean(user?.id), retry: false, staleTime: 0, gcTime: 0,
    meta: { errorNotification: "handled-locally" },
  });
  const identity = JSON.stringify(key);
  const notified = useRef({ identity, error: false });
  useEffect(() => {
    if (notified.current.identity !== identity) notified.current = { identity, error: false };
    if (query.isSuccess) notified.current.error = false;
    if (query.error && !notified.current.error) { notified.current.error = true; notifyHttpError(query.error); }
  }, [identity, query.error, query.isSuccess]);
  const accessRejected = isAxiosError(query.error) && [401, 403, 404, 410].includes(query.error.response?.status ?? 0);
  const invalidResponse = query.error instanceof ZodError || query.error?.message === "nodia_ai:invalid_response";
  return { data: accessRejected || invalidResponse ? undefined : query.data ?? undefined, accessRejected,
    error: query.error, isError: query.isError, isLoading: query.isLoading, isFetching: query.isFetching, refetch: query.refetch };
}

export function useNodiaAiProposalReview(conversationId: string, ref: NodiaAiProposalRef, proposal: NodiaAiPublicProposal | undefined, enabled = true) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const client = useQueryClient();
  const key = nodiaAiProposalKey([user?.id ?? null, sessionVersion], conversationId, ref, true);
  const query = useQuery<NodiaAiProposalReview | null>({ queryKey: key,
    queryFn: async ({ signal, queryKey }) => {
      try {
        const result = await getNodiaAiProposalReview(ref, signal);
        return result;
      }
      catch (error) {
        if (error instanceof ZodError || error instanceof Error && error.message === "nodia_ai:invalid_response"
          || isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0)) {
          client.setQueryData(queryKey, null);
          client.setQueryData(nodiaAiProposalKey([user?.id ?? null, sessionVersion], conversationId, ref), null);
        }
        throw error;
      }
    }, enabled: enabled && Boolean(proposal) && isSessionActive && Boolean(user?.id), retry: false, staleTime: 0, gcTime: 0,
    meta: { errorNotification: "handled-locally" },
  });
  const notified = useRef<unknown>(null);
  const [invalidError] = useState(() => new Error("nodia_ai:invalid_response"));
  const invalid = Boolean(query.data && proposal && query.data.editable_fields.some(field => {
    const step = proposal.steps.find(item => item.step_id === field.step_id);
    const change = step?.changes.find(item => item.field_key === field.field_key);
    const value = change?.after;
    return !change?.after_present || step?.output_bindings.some(binding => binding.target_field_key === field.field_key)
      || (value === null ? !field.nullable : field.kind === "core_id_list" || field.kind === "core_translations" ? !validCoreReviewValue(field.kind, value) : field.kind === "rental_cancellation_rules" ? value === undefined || !validNodiaAiCancellationRules(value) : field.kind === "boolean" ? typeof value !== "boolean" : field.kind === "integer" ? !isNodiaAiInteger(value, field.minimum, field.maximum) : typeof value !== "string")
      || field.kind === "enum" && value !== null && !field.options.some(option => option.value === value);
  }));
  const error = invalid ? invalidError : query.error;
  useEffect(() => {
    if (error && notified.current !== error) { notified.current = error; notifyHttpError(error); }
  }, [error]);
  return { data: invalid ? undefined : query.data, error, isError: query.isError || invalid,
    isFetching: query.isFetching, isLoading: query.isLoading, refetch: query.refetch };
}
