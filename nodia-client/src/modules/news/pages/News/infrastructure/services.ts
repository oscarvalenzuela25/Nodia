import { mainInstance } from "../../../../../config/api";
import { apiPath } from "../../../../../config/apiPath";
import i18n from "../../../../../translate";
import { newsResponseSchema, refreshResponseSchema, type NewsFilters, type NewsSourceKey } from "../../../types";

export async function getNews(filters: NewsFilters, signal?: AbortSignal) {
  const { data } = await mainInstance.get<unknown>(apiPath("/news"), {
    skipAuth: true, withCredentials: false, signal,
    params: { topic: filters.topic === "all" ? undefined : filters.topic, source_key: filters.source === "all" ? undefined : filters.source, order: filters.order, page: filters.page, limit: 20 },
  });
  const result = newsResponseSchema.safeParse(data);
  if (!result.success) throw new Error(i18n.t("news:invalid_response"));
  return result.data;
}

export async function refreshNews(sourceKey: NewsSourceKey) {
  const { data } = await mainInstance.post<unknown>(apiPath("/news/refresh"), { source_key: sourceKey });
  const result = refreshResponseSchema.safeParse(data);
  if (!result.success || result.data.source_key !== sourceKey) throw new Error(i18n.t("news:invalid_response"));
  return result.data;
}
