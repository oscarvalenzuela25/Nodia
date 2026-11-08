import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import useAuth from "../../../hooks/useAuth";
import useAuthStore from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import { getProducts } from "./services";
import type { GetProductsResponse, ProductEntity } from "./types";

const PAGE_SIZE = 24;
export function nextPosCatalogPage(page: GetProductsResponse): number | undefined {
  const { page: current, total_pages: total } = page.meta;
  return Number.isSafeInteger(current) && current >= 1 && Number.isSafeInteger(total) && current < total ? current + 1 : undefined;
}
export const mergePosCatalogPages = (pages: GetProductsResponse[]): ProductEntity[] => {
  const products = new Map<string, ProductEntity>();
  for (const page of pages) for (const product of page.data) products.set(product.id, product);
  return [...products.values()];
};

/** One bounded page reader shared by the selector and the scrollable catalogue. */
export function usePosCatalog(businessId: string, assignmentMode = false) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const actorId = user?.id ?? "";
  const scope = JSON.stringify([actorId, sessionVersion, businessId, assignmentMode]);
  const [input, setInput] = useState({ scope, value: "" });
  const [debounced, setDebounced] = useState({ scope, value: "" });
  const search = input.scope === scope ? input.value : "";
  const querySearch = debounced.scope === scope ? debounced.value : "";
  const queryScope = JSON.stringify([scope, querySearch]);
  const searchPending = search.trim() !== querySearch;
  useEffect(() => {
    const timer = setTimeout(() => setDebounced({ scope, value: search.trim() }), 300);
    return () => clearTimeout(timer);
  }, [scope, search]);
  const query = useInfiniteQuery({
    queryKey: ["products", "pos-catalog", actorId, sessionVersion, businessId, assignmentMode, querySearch],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = await getProducts({ page: pageParam, limit: PAGE_SIZE, includes: true,
        q: { business_id_eq: businessId, is_active_eq: true, ...(assignmentMode ? {} : { has_stock_eq: true }), name_cont: querySearch || undefined, s: "name asc" } });
      if (!page || !Array.isArray(page.data) || !page.meta || page.meta.page !== pageParam || !Number.isSafeInteger(page.meta.total_pages) || page.meta.total_pages < 0 ||
          page.data.some((product) => !product || typeof product.id !== "string" || product.business_id !== businessId)) throw new Error("invalid_pos_catalog_response");
      return page;
    },
    getNextPageParam: nextPosCatalogPage,
    enabled: isSessionActive && Boolean(actorId && businessId),
    retry: false, refetchOnWindowFocus: false,
  });
  useEffect(() => { if (query.error) notifyHttpError(query.error); }, [query.error]);
  const products = useMemo(() => isSessionActive ? mergePosCatalogPages(query.data?.pages ?? []) : [], [isSessionActive, query.data]);
  const fetching = query.isFetching || searchPending;
  const selection = useRef<{ scope: string; queryScope: string; search: string; fetching: boolean; blocked: boolean; products: ProductEntity[] } | null>(null);
  useEffect(() => {
    selection.current = { scope, queryScope, search, fetching, blocked: fetching || query.isError || !isSessionActive, products };
    return () => { selection.current = null; };
  }, [scope, queryScope, search, fetching, query.isError, isSessionActive, products]);
  const sameContext = () => selection.current?.scope === scope && selection.current.queryScope === queryScope && selection.current.search === search && useAuthStore.getState().user?.id === actorId && useAuthStore.getState().sessionVersion === sessionVersion;
  const resolveSelection = (id: string): ProductEntity | null => sameContext() && !selection.current?.blocked ? selection.current?.products.find((product) => product.id === id) ?? null : null;
  const pageLock = useRef<string | null>(null);
  const loadMore = async () => {
    if (!sameContext() || !isSessionActive || selection.current?.blocked || !query.hasNextPage || pageLock.current === queryScope) return;
    pageLock.current = queryScope;
    try { await query.fetchNextPage({ cancelRefetch: false }); }
    finally { if (pageLock.current === queryScope) pageLock.current = null; }
  };
  const retry = async () => {
    if (!sameContext() || !isSessionActive || selection.current?.fetching || pageLock.current === queryScope) return;
    pageLock.current = queryScope;
    try { if (query.isFetchNextPageError) await query.fetchNextPage({ cancelRefetch: false }); else await query.refetch({ cancelRefetch: false }); }
    finally { if (pageLock.current === queryScope) pageLock.current = null; }
  };
  return { context: scope, products, search, setSearch: (value: string) => setInput({ scope, value }), fetching, networkFetching: query.isFetching, isLoading: query.isLoading,
    isError: query.isError, hasNextPage: query.hasNextPage, loadMore, retry, resolveSelection };
}
