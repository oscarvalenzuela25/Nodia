import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import useAuth from "../../../../../../../../../../hooks/useAuth";
import useAuthStore from "../../../../../../../../../../store/authStore";
import { notifyHttpError } from "../../../../../../../../../../config/httpFeedback";
import { findMatchProducts, readMatchProduct } from "./services";

export function useInvoiceMatchProducts(businessId: string, productId: string | null) {
  const { user, isSessionActive } = useAuth();
  const sessionVersion = useAuthStore(state => state.sessionVersion);
  const canInteract = isSessionActive && !!user?.id && !!businessId;
  const scopeKey = JSON.stringify([user?.id, sessionVersion, businessId]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const products = useInfiniteQuery({
    queryKey: ["products", "invoice-match-options", user?.id, sessionVersion, businessId, debounced], initialPageParam: 1,
    queryFn: ({ pageParam }) => findMatchProducts(businessId, debounced, pageParam),
    getNextPageParam: page => page.meta.page < page.meta.total_pages ? page.meta.page + 1 : undefined,
    enabled: canInteract, retry: false,
  });
  const selected = useQuery({
    queryKey: ["products", "invoice-match-snapshot", user?.id, sessionVersion, businessId, productId],
    queryFn: () => readMatchProduct(businessId, productId!), enabled: canInteract && !!productId,
    staleTime: 0, refetchOnWindowFocus: false, retry: false,
  });
  useEffect(() => { if (products.error) notifyHttpError(products.error); }, [products.error]);
  useEffect(() => { if (selected.error) notifyHttpError(selected.error); }, [selected.error]);
  const options = [...new Map(products.data?.pages.flatMap(page => page.data).filter(item => item.business_id === businessId).map(item => [item.id, item]) ?? []).values()];
  return { products, selected, options, setSearch, canInteract, scopeKey };
}
