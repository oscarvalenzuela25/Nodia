import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import useAuthStore from "../../../store/authStore";
import { getScopeUsers } from "./services";

export function useScopeUsers(
  search: string,
  selectedId: string,
  enabled: boolean,
  activeOnly = false,
) {
  const actorId = useAuthStore((state) => state.user?.id);
  const authenticated = useAuthStore(
    (state) => state.sessionStatus === "authenticated",
  );
  const active = enabled && authenticated && Boolean(actorId);
  const list = useInfiniteQuery({
    queryKey: ["scope-users", actorId, search, activeOnly],
    enabled: active,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      getScopeUsers(search, pageParam, undefined, signal, activeOnly),
    getNextPageParam: (last) =>
      last.meta.page < last.meta.total_pages ? last.meta.page + 1 : undefined,
  });
  const selected = useQuery({
    queryKey: ["scope-user", actorId, selectedId],
    enabled: active && Boolean(selectedId),
    queryFn: ({ signal }) => getScopeUsers("", 1, selectedId, signal),
  });
  return { list, selected };
}
