import { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import useAuth from "../../../../../../hooks/useAuth";
import { getTopbarAiStatus } from "./services";

const POLL_INTERVAL_MS = 120_000;

export function isTopbarAuthorizationError(error: unknown) {
  return isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);
}

export function useTopbarAiStatus() {
  const { isSessionValid, sessionVersion } = useAuth();
  const status = useQuery({
    queryKey: ["ai-topbar-status", sessionVersion],
    queryFn: ({ signal }) => getTopbarAiStatus(signal),
    enabled: isSessionValid,
    staleTime: POLL_INTERVAL_MS,
    refetchInterval: (query) => isSessionValid && !isTopbarAuthorizationError(query.state.error) ? POLL_INTERVAL_MS : false,
    retry: false,
    retryOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
  return { status, isSessionValid, sessionVersion };
}
