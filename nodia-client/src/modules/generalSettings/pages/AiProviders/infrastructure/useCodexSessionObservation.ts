import { useQuery } from "@tanstack/react-query";
import { getCodexSession } from "./codexSession";
import useAuthStore, { hasValidatedSession } from "../../../../../store/authStore";

/** One bounded read per visible detail intent, shared by its header and panel. */
export function useCodexSessionObservation(providerId: string, enabled = true) {
  const authenticated = useAuthStore(hasValidatedSession);
  return useQuery({
    queryKey: ["codex-session", providerId],
    queryFn: ({ signal }) => getCodexSession(providerId, signal),
    enabled: enabled && authenticated,
    retry: false,
    // Server's live session observation has the same30-second cache boundary.
    staleTime: 30_000,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    meta: { errorNotification: "handled-locally" },
  });
}
