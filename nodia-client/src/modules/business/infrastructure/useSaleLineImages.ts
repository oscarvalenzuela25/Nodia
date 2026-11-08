import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useAuth from "../../../hooks/useAuth";
import useAuthStore from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import { getProducts } from "./services";
import type { CartLine } from "./salesTypes";
import type { ProductEntity } from "./types";

type Image = ProductEntity["image"] | null;
type Images = Record<string, Image>;
const FRESH_MS = 30_000;

/** Images are presentation metadata; prices and quantities remain frozen in each cart. */
export function useSaleLineImages(businessId: string, lines: CartLine[]) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  const actorId = user?.id ?? "";
  const client = useQueryClient();
  const ids = [...new Set(lines.map((line) => line.product_id))].sort();
  const prefix = ["products", "pos-line-images", actorId, sessionVersion, businessId] as const;
  const key = (id: string) => [...prefix, "product", id] as const;
  const current = () => useAuthStore.getState().user?.id === actorId && useAuthStore.getState().sessionVersion === sessionVersion;
  const known = (id: string) => {
    const state = client.getQueryState<{ image: Image }>(key(id));
    return state?.data && !state.isInvalidated && Date.now() - state.dataUpdatedAt < FRESH_MS ? state.data : undefined;
  };
  const remember = (product: ProductEntity) => {
    if (current() && product.business_id === businessId) client.setQueryData(key(product.id), { image: product.image ?? null });
  };
  const query = useQuery({
    queryKey: ["products", "pos-line-images", actorId, sessionVersion, businessId, "selection", ids],
    enabled: isSessionActive && Boolean(actorId && businessId) && ids.length > 0,
    staleTime: FRESH_MS, retry: false, refetchOnWindowFocus: false,
    initialData: () => ids.length && ids.every((id) => known(id)) ? Object.fromEntries(ids.map((id) => [id, known(id)!.image])) as Images : undefined,
    queryFn: async (): Promise<Images> => {
      const images: Images = {};
      const missing = ids.filter((id) => { const found = known(id); if (found) images[id] = found.image; return !found; });
      for (let start = 0; start < missing.length; start += 100) {
        const batch = missing.slice(start, start + 100);
        const response = await getProducts({ page: 1, limit: 100, includes: true, q: { business_id_eq: businessId, id_in: batch.join(",") } });
        if (!response || !Array.isArray(response.data) || response.data.some((product) => product.business_id !== businessId || !batch.includes(product.id))) throw new Error("invalid_sale_line_images");
        for (const product of response.data) { images[product.id] = product.image ?? null; remember(product); }
        for (const id of batch) if (!(id in images)) { images[id] = null; if (current()) client.setQueryData(key(id), { image: null }); }
      }
      return images;
    },
  });
  useEffect(() => { if (query.error) notifyHttpError(query.error); }, [query.error]);
  return { images: isSessionActive ? query.data ?? {} : {}, remember, isLoading: query.isLoading, isError: query.isError, isFetching: query.isFetching, retry: () => query.refetch() };
}
