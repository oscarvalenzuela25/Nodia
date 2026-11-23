import { useEffect, useState } from "react";
import { skipToken, useInfiniteQuery } from "@tanstack/react-query";
import useAuth from "../../../hooks/useAuth";
import { getProviders, getInvoices, getProducts } from "./services";

const useSearch = () => {
  const [input, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const trimmedInput = input.trim();
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(trimmedInput), 300);
    return () => clearTimeout(timer);
  }, [trimmedInput]);
  return { search: debouncedSearch, trimmedInput, setSearch };
};

export const usePagedProviderOptions = (businessId: string, enabled = true, options: { useOcrOnly?: boolean; actorScope?: readonly [string, number] } = {}) => {
  const { isSessionActive } = useAuth();
  const { search, setSearch } = useSearch();
  const useOcrOnly = options.useOcrOnly === true;
  const query = useInfiniteQuery({
    queryKey: ["providers", "options", businessId, search, useOcrOnly, ...(options.actorScope ?? [])],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getProviders({ page: pageParam, limit: 50, q: { business_id_eq: businessId, name_cont: search || undefined, ...(useOcrOnly ? { use_ocr_eq: true } : {}), s: "name asc" } }),
    getNextPageParam: (page) => page.meta.page < page.meta.total_pages ? page.meta.page + 1 : undefined,
    enabled: isSessionActive && enabled && !!businessId,
  });
  const providers = (query.data?.pages.flatMap((page) => page.data) ?? []).filter(provider => !useOcrOnly || provider.use_ocr === true);
  return { isFetching: query.isFetching, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch, fetchNextPage: query.fetchNextPage, hasNextPage: query.hasNextPage, providers, setSearch, options: providers.map((provider) => ({ value: provider.id, label: provider.name })) };
};

export const usePagedInvoiceCodeOptions = (businessId: string, enabled = true) => {
  const { isSessionActive } = useAuth();
  const { search, setSearch } = useSearch();
  const query = useInfiniteQuery({
    queryKey: ["invoices", "options", businessId, search],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getInvoices({ page: pageParam, limit: 50, q: { business_id_eq: businessId, code_cont: search || undefined, s: "code asc" } }),
    getNextPageParam: (page) => page.meta.page < page.meta.total_pages ? page.meta.page + 1 : undefined,
    enabled: isSessionActive && enabled && !!businessId,
  });
  return { isFetching: query.isFetching, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch, fetchNextPage: query.fetchNextPage, hasNextPage: query.hasNextPage, setSearch, options: Array.from(new Set(query.data?.pages.flatMap((page) => page.data.map((invoice) => invoice.code).filter((code): code is string => typeof code === "string" && code.trim().length > 0)) ?? [])) };
};

export const usePagedProductCodeOptions = (
  businessId: string,
  field: "code" | "barcode",
) => {
  const { isSessionActive } = useAuth();
  const { search, trimmedInput, setSearch } = useSearch();
  const hasSearch = trimmedInput.length > 0;
  const isDebouncing = trimmedInput !== search;
  const requestSearch = !isDebouncing && isSessionActive && businessId ? search : "";
  const query = useInfiniteQuery({
    queryKey: ["products", "options", businessId, field, requestSearch],
    initialPageParam: 1,
    queryFn: requestSearch
      ? ({ pageParam, signal }) =>
          getProducts(
            {
              page: pageParam,
              limit: 50,
              includes: false,
              q: {
                business_id_eq: businessId,
                ...(field === "code"
                  ? { code_cont: requestSearch, code_presence: "present" }
                  : { barcode_cont: requestSearch, barcode_presence: "present" }),
                s: `${field} asc`,
              },
            },
            signal,
          )
      : skipToken,
    getNextPageParam: ({ meta }) =>
      meta.page < meta.total_pages ? meta.page + 1 : undefined,
  });

  const identifiers = query.data?.pages.flatMap((page) =>
    page.data
      .map((product) => product[field])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  );

  return {
    hasSearch,
    isSearching: hasSearch && (isDebouncing || query.isFetching),
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    setSearch,
    options: Array.from(new Set(identifiers)),
  };
};
