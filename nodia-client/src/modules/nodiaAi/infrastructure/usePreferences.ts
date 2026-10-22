import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import useAuth from "../../../hooks/useAuth";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import i18n from "../../../translate";
import { nodiaAiKeys } from "./useServices";
import { getPreferenceCatalog, getPreferenceOptions, getPreferences, preparePreference } from "./preferenceServices";
import type { NodiaAiPreferenceOptionsQuery, NodiaAiPreferencePrepare } from "./preferenceSchemas";

export const preferenceKeys = (scope: readonly [string | null, number]) => [...nodiaAiKeys.all(scope), "preferences"] as const;
function useScope(active: boolean) {
  const { user, sessionVersion, isSessionActive } = useAuth();
  return { scope: [user?.id ?? null, sessionVersion] as const, enabled: active && isSessionActive && Boolean(user?.id) };
}
export function usePreferences(active: boolean) {
  const { scope, enabled } = useScope(active);
  return useInfiniteQuery({ queryKey: [...preferenceKeys(scope), "list"], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getPreferences(pageParam, signal), enabled, retry: false, staleTime: 0, gcTime: 0,
    getNextPageParam: page => page.next_cursor ?? undefined });
}
export function usePreferenceCatalog(active: boolean) {
  const { scope, enabled } = useScope(active);
  return useQuery({ queryKey: [...preferenceKeys(scope), "catalog"], queryFn: ({ signal }) => getPreferenceCatalog(signal), enabled, retry: false, staleTime: 0, gcTime: 0 });
}
export function usePreferenceOptions(query: NodiaAiPreferenceOptionsQuery | null, active: boolean) {
  const { scope, enabled } = useScope(active);
  return useInfiniteQuery({ queryKey: [...preferenceKeys(scope), "options", query], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getPreferenceOptions(query!, pageParam, signal), enabled: enabled && query !== null, retry: false, staleTime: 0, gcTime: 0,
    getNextPageParam: page => page.next_cursor ?? undefined });
}
export function usePreparePreference() {
  const { scope } = useScope(true);
  const client = useQueryClient();
  const current = (expected: typeof scope) => {
    const auth = useAuthStore.getState();
    return hasActiveSession(auth) && auth.user?.id === expected[0] && auth.sessionVersion === expected[1];
  };
  const mutation = useMutation({ mutationFn: (request: { input: NodiaAiPreferencePrepare; scope: typeof scope }) => {
    if (!current(request.scope)) throw new Error("nodia_ai:session_changed");
    return preparePreference(request.input);
  }, retry: false,
    onSuccess: (_data, request) => { if (current(request.scope)) { sileo.success({ title: i18n.t("nodiaAi:preferences.prepared") }); void client.invalidateQueries({ queryKey: [...preferenceKeys(request.scope), "list"] }); } },
    onError: (error, request) => { if (current(request.scope)) notifyHttpError(error); },
  });
  return { ...mutation, mutateAsync: (input: NodiaAiPreferencePrepare) => mutation.mutateAsync({ input, scope }) };
}
