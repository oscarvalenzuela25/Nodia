import {
  useInfiniteQuery,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ZodError } from "zod";
import { sileo } from "sileo";
import useAuthStore from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import type {
  FinanceActive,
  FinanceMutationInput,
  FinanceQuery,
  FinanceResource,
} from "../types";
import {
  getFinanceList,
  getFinanceOverview,
  getFinanceRecord,
  getFinanceSummary,
  saveFinanceRecord,
} from "./services";

export const financeKeys = {
  scope: (userId: string | undefined) => ["finance", userId] as const,
  list: (
    userId: string | undefined,
    resource: FinanceResource,
    query: FinanceQuery,
  ) => ["finance", userId, "list", resource, query] as const,
  detail: (
    userId: string | undefined,
    resource: FinanceResource,
    id: string | undefined,
  ) => ["finance", userId, "detail", resource, id] as const,
};

function useFinanceActor() {
  const userId = useAuthStore((state) => state.user?.id);
  const authenticated = useAuthStore(
    (state) => state.sessionStatus === "authenticated",
  );
  return { userId, enabled: Boolean(userId && authenticated) };
}

export function useFinanceList<R extends FinanceResource>(
  resource: R,
  query: FinanceQuery,
  options: { enabled?: boolean } = {},
) {
  const actor = useFinanceActor();
  return useQuery({
    queryKey: financeKeys.list(actor.userId, resource, query),
    queryFn: ({ signal }) => getFinanceList(resource, query, signal),
    enabled: actor.enabled && options.enabled !== false,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === actor.userId ? previous : undefined,
  });
}

export function useFinanceRecord<R extends FinanceResource>(
  resource: R,
  id?: string,
  enabled = true,
) {
  const actor = useFinanceActor();
  return useQuery({
    queryKey: financeKeys.detail(actor.userId, resource, id),
    queryFn: ({ signal }) => getFinanceRecord(resource, id!, signal),
    enabled: actor.enabled && Boolean(id) && enabled,
  });
}

export function useFinanceOptions(
  resource: "categories" | "category-groups" | "obligations",
  search: string,
  enabled = true,
  active: FinanceActive = "active",
) {
  const actor = useFinanceActor();
  return useInfiniteQuery({
    queryKey: ["finance", actor.userId, "options", resource, search, active],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      getFinanceList(
        resource,
        {
          page: pageParam,
          limit: 20,
          active,
          ...(search.trim() ? { q: { name_cont: search.trim() } } : {}),
        },
        signal,
      ),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined,
    enabled: actor.enabled && enabled,
  });
}

export function useFinanceOverview(query: FinanceQuery) {
  const actor = useFinanceActor();
  return useQuery({
    queryKey: ["finance", actor.userId, "overview", query],
    queryFn: ({ signal }) => getFinanceOverview(query, signal),
    enabled: actor.enabled,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === actor.userId ? previous : undefined,
  });
}

export function useFinanceSummary(
  kind: "categories" | "category-groups",
  query: FinanceQuery,
) {
  const actor = useFinanceActor();
  return useQuery({
    queryKey: ["finance", actor.userId, "summary", kind, query],
    queryFn: ({ signal }) => getFinanceSummary(kind, query, signal),
    enabled: actor.enabled,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === actor.userId ? previous : undefined,
  });
}

export function isFinanceWriteUncertain(error: unknown): boolean {
  return (
    error instanceof ZodError ||
    (isAxiosError(error) && !error.response && error.code !== "ERR_CANCELED")
  );
}

export function useFinanceMutation<R extends FinanceResource>(resource: R) {
  const actor = useFinanceActor();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: financeKeys.scope(actor.userId),
    retry: false,
    mutationFn: (input: FinanceMutationInput<R>) => {
      if (!actor.enabled || useAuthStore.getState().user?.id !== actor.userId)
        throw new Error("finance:session_changed");
      return saveFinanceRecord(resource, input);
    },
    onSuccess: async (_record, input) => {
      if (useAuthStore.getState().user?.id !== actor.userId) return;
      sileo.success({
        title: i18n.t(
          input.id === undefined
            ? "finance:created_success"
            : "finance:updated_success",
        ),
      });
      await client.invalidateQueries({
        queryKey: financeKeys.scope(actor.userId),
      });
    },
    onError: (error) => {
      if (useAuthStore.getState().user?.id !== actor.userId) return;
      if (isFinanceWriteUncertain(error))
        sileo.error({
          title: i18n.t("finance:uncertain_title"),
          description: i18n.t("finance:uncertain_description"),
        });
      else notifyHttpError(error);
    },
  });
  const review = useMutation({
    mutationKey: financeKeys.scope(actor.userId),
    retry: false,
    mutationFn: async () => {
      if (useAuthStore.getState().user?.id !== actor.userId)
        throw new Error("finance:session_changed");
      await client.invalidateQueries(
        { queryKey: financeKeys.scope(actor.userId) },
        { throwOnError: true },
      );
    },
    onSuccess: () => mutation.reset(),
    onError: notifyHttpError,
  });
  return {
    ...mutation,
    isUncertain: isFinanceWriteUncertain(mutation.error),
    isReviewing: review.isPending,
    reviewResult: review.mutateAsync,
  };
}

export function useFinanceBusy(): boolean {
  const actor = useFinanceActor();
  return useIsMutating({ mutationKey: financeKeys.scope(actor.userId) }) > 0;
}
