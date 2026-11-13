import { useQuery, type QueryFunctionContext } from "@tanstack/react-query";
import { getCodexSession } from "./codexSession";
import useAuthStore from "../../../../../store/authStore";

/** One bounded account read shared by visible session consumers of this instance. */
export const codexSessionObservationOptions = (providerId: string, sessionVersion: number) => ({
    queryKey: ["codex-session", providerId, sessionVersion],
    queryFn: ({ signal }: QueryFunctionContext) => getCodexSession(providerId, signal),
    retry: false,
    // Server's live session observation has the same 30-second cache boundary.
    staleTime: 30_000,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    meta: { errorNotification: "handled-locally" },
});

export function useCodexSessionObservation(providerId: string, enabled = true) {
  const sessionVersion = useAuthStore(state => state.sessionVersion);
  return useQuery({ ...codexSessionObservationOptions(providerId, sessionVersion), enabled });
}
