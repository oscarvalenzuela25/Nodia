import { queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CanceledError } from "axios";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import useAuthStore, { hasActiveSession } from "../../../../../../../store/authStore";
import type { CashScope } from "../../../../../infrastructure/cashTypes";
import { readList, readListCatalog, readLists } from "./services";
import { mergeListDetail } from "../listMarks";

export type ShoppingListScope = CashScope;

const scopeKey = ({ actorId, sessionVersion, businessId }: ShoppingListScope) =>
  ["business-shopping-lists", actorId, sessionVersion, businessId] as const;

export const shoppingListKeys = {
  list: (scope: ShoppingListScope) => [...scopeKey(scope), "list"] as const,
  detail: (scope: ShoppingListScope, id: string) => [...scopeKey(scope), "detail", id] as const,
};

const ownsCurrentScope = (scope: ShoppingListScope, auth = useAuthStore.getState()) =>
  auth.user?.id === scope.actorId && auth.sessionVersion === scope.sessionVersion &&
  auth.sessionStatus === "authenticated";

export const useOwnsListScope = (scope: ShoppingListScope) => useAuthStore(auth => ownsCurrentScope(scope, auth));

export const useHasListScope = (scope: ShoppingListScope) =>
  useAuthStore(auth => ownsCurrentScope(scope, auth) && hasActiveSession(auth));

export function useListScopeGuard(scope: ShoppingListScope) {
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return useCallback(() => mounted.current && ownsCurrentScope(scope), [scope]);
}

function assertCurrentSession(scope: ShoppingListScope) {
  if (!ownsCurrentScope(scope)) throw new CanceledError("Shopping list scope changed");
}

export function useShoppingLists(scope: ShoppingListScope, page: number, limit: number, search: string) {
  const enabled = useHasListScope(scope);
  return useQuery({
    queryKey: [...shoppingListKeys.list(scope), page, limit, search],
    queryFn: ({ signal }) => {
      assertCurrentSession(scope);
      return readLists(scope.businessId, { page, limit, search: search || undefined }, signal);
    },
    enabled,
    placeholderData: previous => previous,
  });
}

export function shoppingListDetailOptions(scope: ShoppingListScope, id: string) {
  return queryOptions({
    queryKey: shoppingListKeys.detail(scope, id),
    queryFn: ({ signal }) => {
      assertCurrentSession(scope);
      return readList(scope.businessId, id, signal);
    },
    staleTime: 0,
    retry: false,
    structuralSharing: mergeListDetail,
  });
}

export function useShoppingListDetail(scope: ShoppingListScope, id: string | undefined, revalidateOnFocus = false) {
  const active = useHasListScope(scope);
  return useQuery({
    ...shoppingListDetailOptions(scope, id ?? ""),
    enabled: active && Boolean(id),
    refetchOnWindowFocus: revalidateOnFocus,
  });
}

export function useShoppingListCatalog(scope: ShoppingListScope, enabled: boolean) {
  const active = useHasListScope(scope);
  const [search, setSearch] = useState("");
  const [criteria, setCriteria] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setCriteria(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useInfiniteQuery({
    queryKey: [...scopeKey(scope), "products", criteria],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      assertCurrentSession(scope);
      return readListCatalog(scope.businessId, pageParam, criteria, signal);
    },
    getNextPageParam: page => page.meta.page < page.meta.total_pages ? page.meta.page + 1 : undefined,
    enabled: enabled && active,
  });
  return {
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    setSearch,
    isSearching: search.trim() !== criteria,
    products: query.data?.pages.flatMap(page => page.data) ?? [],
  };
}
