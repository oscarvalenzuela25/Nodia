import useAuth from "../../../../../hooks/useAuth";
import type { AxiosError } from "axios";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { sileo } from "sileo";
import i18n from "../../../../../translate";
import {
  createAction,
  getActions,
  updateAction,
  createBusinessAction,
  getBusinessActions,
  updateBusinessAction,
  deleteBusinessAction,
} from "./services";
import type {
  CreateActionPayload,
  GetActionsParams,
  UpdateActionPayload,
  CreateBusinessActionPayload,
  UpdateBusinessActionPayload,
} from "../types";

export const actionKeys = {
  all: ["actions"] as const,
  lists: () => [...actionKeys.all, "list"] as const,
  list: (params?: GetActionsParams) => [...actionKeys.lists(), params] as const,
};

export const businessActionKeys = {
  all: ["business-actions"] as const,
  lists: () => [...businessActionKeys.all, "list"] as const,
  list: (params?: GetActionsParams) =>
    [...businessActionKeys.lists(), params] as const,
};

export const useActions = (
  params?: GetActionsParams,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: actionKeys.list(params),
    queryFn: () => getActions(params),
    placeholderData: keepPreviousData,
    enabled: isSessionActive && (options?.enabled ?? true),
  });
};

const extractErrorMessage = (
  error: AxiosError<{ message?: string }> | Error
): string => {
  if ("response" in error && typeof error.response?.data?.message === "string") {
    return error.response.data.message;
  }
  return error.message;
};

export const useCreateAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateActionPayload) => createAction(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: actionKeys.all });
      sileo.success({
        title: i18n.t("actions:notifications.success_title"),
        description: i18n.t("actions:notifications.created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("actions:notifications.error_title"),
        description:
          backendMessage || i18n.t("actions:notifications.created_error"),
      });
    },
  });
};

export const useUpdateAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      payload,
    }: {
      actionId: string;
      payload: UpdateActionPayload;
    }) => updateAction(actionId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: actionKeys.all });
      sileo.success({
        title: i18n.t("actions:notifications.success_title"),
        description: i18n.t("actions:notifications.updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("actions:notifications.error_title"),
        description:
          backendMessage || i18n.t("actions:notifications.updated_error"),
      });
    },
  });
};

export const useBusinessActions = (
  params?: GetActionsParams,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: businessActionKeys.list(params),
    queryFn: () => getBusinessActions(params),
    placeholderData: keepPreviousData,
    enabled: isSessionActive && (options?.enabled ?? true),
  });
};

export const useCreateBusinessAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBusinessActionPayload) =>
      createBusinessAction(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: businessActionKeys.all });
      sileo.success({
        title: i18n.t("actions:notifications.success_title"),
        description: i18n.t("actions:notifications.created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("actions:notifications.error_title"),
        description:
          backendMessage || i18n.t("actions:notifications.created_error"),
      });
    },
  });
};

export const useUpdateBusinessAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      payload,
    }: {
      actionId: string;
      payload: UpdateBusinessActionPayload;
    }) => updateBusinessAction(actionId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: businessActionKeys.all });
      sileo.success({
        title: i18n.t("actions:notifications.success_title"),
        description: i18n.t("actions:notifications.updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("actions:notifications.error_title"),
        description:
          backendMessage || i18n.t("actions:notifications.updated_error"),
      });
    },
  });
};

export const useDeleteBusinessAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (actionId: string) => deleteBusinessAction(actionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: businessActionKeys.all });
      sileo.success({
        title: i18n.t("actions:notifications.success_title"),
        description: i18n.t("actions:notifications.updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("actions:notifications.error_title"),
        description:
          backendMessage || i18n.t("actions:notifications.updated_error"),
      });
    },
  });
};
