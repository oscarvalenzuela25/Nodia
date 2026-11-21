import { useEffect, useSyncExternalStore } from "react";
import { isAxiosError } from "axios";
import { restoreSession } from "../config/api";
import { queryClient } from "../config/reactQuery";
import useAuthStore from "../store/authStore";
import { connectionMonitor, getConnectionIssue, isBrowserOffline } from "./connectionMonitor";

export function retryConnection(): Promise<void> {
  return connectionMonitor.retry(async () => {
    const auth = useAuthStore.getState();
    if (auth.token && auth.sessionStatus === "unavailable") await restoreSession().catch(() => undefined);
    if (isBrowserOffline()) return;
    await queryClient.refetchQueries({
      type: "active",
      predicate: ({ state }) => state.status === "error" && isAxiosError(state.error) &&
        state.error.config?.method?.toLowerCase() === "get" && Boolean(getConnectionIssue(state.error)),
    }, { cancelRefetch: false });
  });
}

export function useConnectionMonitor(): void {
  useEffect(() => {
    if (isBrowserOffline()) connectionMonitor.offline();
    const onOnline = () => {
      if (connectionMonitor.getSnapshot().status !== "available") void retryConnection();
    };
    window.addEventListener("offline", connectionMonitor.offline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", connectionMonitor.offline);
      window.removeEventListener("online", onOnline);
    };
  }, []);
}

export function useConnectionStatus() {
  return useSyncExternalStore(connectionMonitor.subscribe, connectionMonitor.getSnapshot);
}
