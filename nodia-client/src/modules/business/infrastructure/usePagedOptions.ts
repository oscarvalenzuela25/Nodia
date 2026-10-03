import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import useAuth from "../../../hooks/useAuth";
import { getProviders, getInvoices, getProducts } from "./services";

const useSearch = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  return { search: debouncedSearch, setSearch };
};

export const usePagedProviderOptions = (businessId: string, enabled = true) => {
  const { isSessionActive } = useAuth();
  const { search, setSearch } = useSearch();
  const query = useInfiniteQuery({
    queryKey: ["providers", "options", businessId, search],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getProviders({ page: pageParam, limit: 50, q: { business_id_eq: businessId, name_cont: search || undefined, s: "name asc" } }),
    getNextPageParam: (page) => page.meta.page < page.meta.total_pages ? page.meta.page + 1 : undefined,
    enabled: isSessionActive && enabled && !!businessId,
  });
  const providers = query.data?.pages.flatMap((page) => page.data) ?? [];
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
  return { isFetching: query.isFetching, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch, fetchNextPage: query.fetchNextPage, hasNextPage: query.hasNextPage, setSearch, options: Array.from(new Set(query.data?.pages.flatMap((page) => page.data.map((invoice) => invoice.code)) ?? [])) };
};

export const usePagedProductCodeOptions = (businessId: string, enabled = true) => {
  const { isSessionActive } = useAuth();
  const { search, setSearch } = useSearch();
  const query = useInfiniteQuery({
    queryKey: ["products", "options", businessId, search],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getProducts({ page: pageParam, limit: 50, q: { business_id_eq: businessId, code_cont: search || undefined, s: "code asc" } }),
    getNextPageParam: (page) => page.meta.page < page.meta.total_pages ? page.meta.page + 1 : undefined,
    enabled: isSessionActive && enabled && !!businessId,
  });
  return { isFetching: query.isFetching, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch, fetchNextPage: query.fetchNextPage, hasNextPage: query.hasNextPage, setSearch, options: Array.from(new Set(query.data?.pages.flatMap((page) => page.data.map((product) => product.code)) ?? [])) };
};
