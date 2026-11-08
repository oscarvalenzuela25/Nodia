import useAuthStore, { hasActiveSession } from "../store/authStore";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { sileo } from "sileo";
import { mainInstance } from "../config/api";
import { claimHttpErrorNotification } from "../config/httpFeedback";
import i18n from "../translate";
import useGeneralSettingsStore from "../store/generalSettings/generalSettingsStore";
import type { AuthorizationContextResponse } from "../store/generalSettings/types";

const getEndpoint = (path: string) => {
  const hasV1 = mainInstance.defaults.baseURL?.includes("/api/v1");
  return hasV1 ? path : `/api/v1${path}`;
};

export const getAuthorizationContext = async (): Promise<AuthorizationContextResponse> => {
  const { data } = await mainInstance.get<AuthorizationContextResponse>(
    getEndpoint("/authorization/context")
  );
  return data;
};

export const authorizationKeys = {
  all: ["authorization"] as const,
  context: () => [...authorizationKeys.all, "context"] as const,
};

export const useAuthorizationContext = (options?: { enabled?: boolean }) => {
  const userId = useAuthStore((state) => state.user?.id);
  const isSessionActive = useAuthStore(hasActiveSession);
  const setContext = useGeneralSettingsStore((state) => state.setContext);

  const query = useQuery({
    queryKey: [...authorizationKeys.context(), userId],
    queryFn: getAuthorizationContext,
    meta: { errorNotification: "handled-locally" },
    enabled: isSessionActive && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (query.data && isSessionActive) {
      setContext(query.data);
    }
  }, [query.data, isSessionActive, setContext]);

  useEffect(() => {
    if (query.isError && claimHttpErrorNotification(query.error)) {
      const error = query.error as AxiosError<{ message?: string; error?: string }> | Error;
      let backendMessage: string | undefined;

      if ("response" in error && error.response?.data) {
        backendMessage =
          error.response.data.message || error.response.data.error;
      }

      sileo.error({
        title: i18n.t("core:auth_context_error_title"),
        description: backendMessage || i18n.t("core:auth_context_error_message"),
      });
    }
  }, [query.isError, query.errorUpdatedAt, query.error]);

  return query;
};

export default useAuthorizationContext;
