import { useEffect } from "react";
import { z } from "zod";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { mainInstance } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import { notifyHttpError } from "../../../config/httpFeedback";
import type { NodiaAiSelection } from "../../nodiaAi/infrastructure/types";
import {
  cvCatalogSchema,
  cvEligibilitySchema,
  cvGenerationSchema,
  cvOfferSchema,
  cvPollInterval,
  receivedCvIntent,
  sameCvSelection,
  type CvGeneration,
  type CvGenerationInput,
  type CvReviewSave,
} from "./generationSchema";
import { fetchCvProfilesPage, profileAccessDenied, useProfileScope } from "./profiles";
import { profileRecordSchema, profilesPageSize } from "./profileSchema";

const root = apiPath("/nodia-cv");
const scopeHeaders = (version: number, signal?: AbortSignal) => ({
  expectedAuthSessionVersion: version,
  signal,
});

function verifiedReceipt(data: unknown, intent: CvGenerationInput, id?: string) {
  const result = cvGenerationSchema.parse(data);
  if ((id && id !== result.id) || !receivedCvIntent(result, intent))
    throw new Error("Unexpected Nodia CV generation identity");
  return result;
}

export async function startCvGeneration(intent: CvGenerationInput, version: number) {
  const response = await mainInstance.post<unknown>(`${root}/generations`, intent, scopeHeaders(version));
  return verifiedReceipt(response.data, intent);
}

const recoverySchema = z.object({
  recovery: z.object({ offer_text: z.string(), profile: profileRecordSchema }),
});

export async function restoreCvGeneration(requestKey: string, version: number, signal: AbortSignal) {
  const { data } = await mainInstance.get<unknown>(
    `${root}/generations/requests/${requestKey}`,
    scopeHeaders(version, signal),
  );
  const receipt = cvGenerationSchema.parse(data);
  const { recovery } = recoverySchema.parse(data);
  const { profile } = recovery;
  if (profile.id !== receipt.profile_id || profile.revision !== receipt.profile_revision)
    throw new Error("Unexpected recovered CV profile revision");
  const offer = cvOfferSchema.parse({
    offer_text: recovery.offer_text,
    language: receipt.language,
    vacancy_title: receipt.vacancy_title ?? "",
    vacancy_company: receipt.vacancy_company ?? "",
  });
  const input = {
    ...offer,
    request_key: requestKey,
    profile_id: profile.id,
    profile_revision: profile.revision,
    selection: receipt.selection,
  };
  return { input, profile, receipt };
}

async function fetchCvReceipt(id: string, version: number, signal?: AbortSignal) {
  const response = await mainInstance.get<unknown>(
    `${root}/generations/${id}`,
    scopeHeaders(version, signal),
  );
  const result = cvGenerationSchema.parse(response.data);
  if (id !== result.id) throw new Error("Unexpected Nodia CV generation ID");
  return result;
}

export async function readCvGeneration(id: string, intent: CvGenerationInput, version: number, signal?: AbortSignal) {
  const result = await fetchCvReceipt(id, version, signal);
  if (!receivedCvIntent(result, intent)) throw new Error("Unexpected Nodia CV generation identity");
  return result;
}

export async function saveCvReview(
  id: string,
  intent: CvGenerationInput,
  input: CvReviewSave,
  version: number,
) {
  const response = await mainInstance.put<unknown>(`${root}/drafts/${id}`, input, scopeHeaders(version));
  const result = verifiedReceipt(response.data, intent, id);
  if (result.state !== "ready" || result.review?.revision !== input.revision + 1)
    throw new Error("Unexpected Nodia CV review revision");
  return result;
}

export function useCvProfilesForGeneration(active: boolean) {
  const { scope, active: session } = useProfileScope();
  return useInfiniteQuery({
    queryKey: [...scope, "generation-profiles"] as const,
    queryFn: ({ pageParam, signal, queryKey }) => fetchCvProfilesPage(pageParam, signal, queryKey[2]),
    initialPageParam: 1,
    getNextPageParam: (page) => (page.page * profilesPageSize < page.total ? page.page + 1 : undefined),
    enabled: active && session,
    gcTime: 0,
    retry: false,
  });
}

export function useCvCatalog(active: boolean) {
  const { scope, active: session } = useProfileScope();
  return useInfiniteQuery({
    queryKey: [...scope, "generation-catalog"] as const,
    queryFn: async ({ pageParam, signal, queryKey }) => {
      const response = await mainInstance.get<unknown>(`${root}/ai-selection/catalog`, {
        ...scopeHeaders(queryKey[2], signal),
        params: { after: pageParam ?? undefined },
      });
      const page = cvCatalogSchema.parse(response.data);
      if (page.next_cursor && pageParam && BigInt(page.next_cursor) <= BigInt(pageParam))
        throw new Error("Invalid Nodia CV catalog cursor");
      return page;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: active && session,
    gcTime: 0,
    retry: false,
  });
}

export const cvEligibilityQueryKey = (
  scope: ReturnType<typeof useProfileScope>["scope"],
  selection: NodiaAiSelection | null,
) => [...scope, "generation-eligibility", selection] as const;

export function useCvEligibility(selection: NodiaAiSelection | null, active: boolean) {
  const { scope, active: session } = useProfileScope();
  return useQuery({
    queryKey: cvEligibilityQueryKey(scope, selection),
    queryFn: async ({ signal, queryKey }) => {
      const requested = queryKey[4];
      if (!requested) throw new Error("Missing Nodia CV model selection");
      const response = await mainInstance.get<unknown>(`${root}/ai-selection/eligibility`, {
        ...scopeHeaders(queryKey[2], signal),
        params: { ...requested, effort_id: requested.effort_id ?? undefined },
      });
      const result = cvEligibilitySchema.parse(response.data);
      if (!sameCvSelection(result.selection, requested))
        throw new Error("Unexpected Nodia CV model selection");
      return result;
    },
    enabled: active && session && Boolean(selection),
    gcTime: 0,
    retry: false,
  });
}

export type TrackedCvGeneration = { intent: CvGenerationInput; receipt: CvGeneration };
export const cvGenerationQueryKey = (scope: ReturnType<typeof useProfileScope>["scope"], id?: string) =>
  [...scope, "generation-status", id] as const;

export function useCvGenerationStatus(tracked: TrackedCvGeneration | null, active: boolean) {
  const { scope, active: session } = useProfileScope();
  return useQuery({
    queryKey: cvGenerationQueryKey(scope, tracked?.receipt.id),
    queryFn: ({ signal, queryKey }) => {
      const id = queryKey[4];
      if (!id) throw new Error("Missing Nodia CV generation");
      return fetchCvReceipt(id, queryKey[2], signal);
    },
    select: (result) => {
      if (!tracked || !receivedCvIntent(result, tracked.intent))
        throw new Error("Unexpected Nodia CV generation identity");
      return result;
    },
    enabled: active && session && Boolean(tracked),
    initialData: tracked?.receipt,
    refetchInterval: (query) =>
      cvPollInterval(query.state.data?.state, query.state.dataUpdateCount, Boolean(query.state.error)),
    retry: false,
    gcTime: 0,
  });
}

export function useCvHttpNotice(error: unknown, onDenial: () => void) {
  useEffect(() => {
    if (!error) return;
    if (profileAccessDenied(error)) onDenial();
    notifyHttpError(error);
  }, [error, onDenial]);
}
