import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import { isAxiosError } from "axios";
import useAuth from "../../../../../hooks/useAuth";
import useAuthStore, { hasValidatedSession } from "../../../../../store/authStore";
import { useAuthorizationContext } from "../../../../../services/authorizationService";
import { claimHttpErrorNotification, getHttpErrorMessage, notifyHttpError } from "../../../../../config/httpFeedback";
import i18n from "../../../../../translate";
import { NEWS_CATALOG_VERSION, type NewsFilters, type NewsSourceKey } from "../../../types";
import { getNews, refreshNews } from "./services";

const newsCatalogKey = ["news-public", NEWS_CATALOG_VERSION] as const;
export const newsKeys = {
  all: newsCatalogKey,
  list: (filters: NewsFilters) => [...newsCatalogKey, filters] as const,
};
const currentActor = () => {
  const state = useAuthStore.getState();
  return hasValidatedSession(state) && state.user?.id ? `${state.user.id}:${state.sessionVersion}` : null;
};

export function useNews(filters: NewsFilters) {
  const query = useQuery({ queryKey: newsKeys.list(filters), queryFn: ({ signal }) => getNews(filters, signal), placeholderData: keepPreviousData, retry: false, meta: { errorNotification: "handled-locally" } });
  useEffect(() => { if (query.isError) notifyHttpError(query.error); }, [query.isError, query.error, query.errorUpdatedAt]);
  return query;
}

export function useNewsRefresh(sourceKey: NewsSourceKey | null) {
  const auth = useAuth();
  const context = useAuthorizationContext({ enabled: auth.isSessionActive && Boolean(auth.user?.id) });
  const client = useQueryClient();
  const [failure, setFailure] = useState<{ actor: string; source: NewsSourceKey; message: string } | null>(null);
  const inFlight = useRef(false);
  const actor = auth.isSessionActive && auth.user?.id ? `${auth.user.id}:${auth.sessionVersion}` : null;
  const canRefresh = Boolean(actor && !auth.isRefreshing && !context.isFetching && !context.isError && context.data?.roles.includes("super_admin"));
  const activeIntent = useRef<{ actor: string | null; source: NewsSourceKey | null; authorized: boolean }>({ actor, source: sourceKey, authorized: canRefresh });
  useLayoutEffect(() => { activeIntent.current = { actor, source: sourceKey, authorized: canRefresh }; }, [actor, sourceKey, canRefresh]);
  const isCurrentIntent = (request: { actor: string; source: NewsSourceKey }) => currentActor() === request.actor && activeIntent.current.actor === request.actor && activeIntent.current.source === request.source && activeIntent.current.authorized;
  const mutation = useMutation({
    mutationFn: async (request: { actor: string; source: NewsSourceKey }) => {
      if (!isCurrentIntent(request)) throw new Error(i18n.t("auth:session_expired"));
      return refreshNews(request.source);
    },
    retry: false,
    onSuccess: async (data, request) => {
      if (!isCurrentIntent(request)) return;
      setFailure(null);
      sileo.success({ title: i18n.t(`news:refresh_${data.status}`), description: data.status === "updated" ? i18n.t("news:refresh_count", { count: data.received_count }) : undefined });
      await client.invalidateQueries({ queryKey: newsKeys.all });
    },
    onError: (error, request) => {
      if (!isCurrentIntent(request)) return;
      const message = getHttpErrorMessage(error);
      setFailure({ actor: request.actor, source: request.source, message });
      if (claimHttpErrorNotification(error)) sileo.error({ title: i18n.t("news:refresh_failed"), description: message });
      if (isAxiosError(error) && error.response?.status === 403) void client.invalidateQueries({ queryKey: ["authorization"] });
      // Reconcile local conserved state, never retry the external refresh.
      void client.invalidateQueries({ queryKey: newsKeys.all });
    },
    onSettled: () => { inFlight.current = false; },
  });
  return { canRefresh, isPending: mutation.isPending, failure: failure?.actor === actor && failure.source === sourceKey ? failure.message : null,
    refresh: () => {
      if (canRefresh && actor && sourceKey && isCurrentIntent({ actor, source: sourceKey }) && !mutation.isPending && !inFlight.current) {
        inFlight.current = true;
        mutation.mutate({ actor, source: sourceKey });
      }
    } };
}
