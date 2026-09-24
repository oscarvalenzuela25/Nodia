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
import { authorizationKeys } from "../../../../../services/authorizationService";
import {
  createModule,
  getModules,
  updateModule,
  createModuleGroup,
  getModuleGroups,
  updateModuleGroup,
} from "./services";
import type {
  CreateModulePayload,
  GetModulesParams,
  UpdateModulePayload,
  CreateModuleGroupPayload,
  GetModuleGroupsParams,
  UpdateModuleGroupPayload,
} from "../types";

export const moduleKeys = {
  all: ["modules"] as const,
  lists: () => [...moduleKeys.all, "list"] as const,
  list: (params?: GetModulesParams) => [...moduleKeys.lists(), params] as const,
};

export const moduleGroupKeys = {
  all: ["module-groups"] as const,
  lists: () => [...moduleGroupKeys.all, "list"] as const,
  list: (params?: GetModuleGroupsParams) =>
    [...moduleGroupKeys.lists(), params] as const,
};

export const useModules = (
  params?: GetModulesParams,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: moduleKeys.list(params),
    queryFn: () => getModules(params),
    placeholderData: keepPreviousData,
    enabled: isSessionActive && (options?.enabled ?? true),
  });
};

export const useModuleGroups = (
  params?: GetModuleGroupsParams,
  options?: { enabled?: boolean }
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: moduleGroupKeys.list(params),
    queryFn: () => getModuleGroups(params),
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

export const useCreateModule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateModulePayload) => createModule(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      await queryClient.invalidateQueries({ queryKey: authorizationKeys.all });
      sileo.success({
        title: i18n.t("modules:notifications.success_title"),
        description: i18n.t("modules:notifications.created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("modules:notifications.error_title"),
        description:
          backendMessage || i18n.t("modules:notifications.created_error"),
      });
    },
  });
};

export const useUpdateModule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      moduleId,
      payload,
    }: {
      moduleId: string;
      payload: UpdateModulePayload;
    }) => updateModule(moduleId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      await queryClient.invalidateQueries({ queryKey: authorizationKeys.all });
      sileo.success({
        title: i18n.t("modules:notifications.success_title"),
        description: i18n.t("modules:notifications.updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("modules:notifications.error_title"),
        description:
          backendMessage || i18n.t("modules:notifications.updated_error"),
      });
    },
  });
};

export const useCreateModuleGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateModuleGroupPayload) =>
      createModuleGroup(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleGroupKeys.all });
      await queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      await queryClient.invalidateQueries({ queryKey: authorizationKeys.all });
      sileo.success({
        title: i18n.t("modules:notifications.success_title"),
        description: i18n.t("modules:groups.notifications.created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("modules:notifications.error_title"),
        description:
          backendMessage ||
          i18n.t("modules:groups.notifications.created_error"),
      });
    },
  });
};

export const useUpdateModuleGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string;
      payload: UpdateModuleGroupPayload;
    }) => updateModuleGroup(groupId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleGroupKeys.all });
      await queryClient.invalidateQueries({ queryKey: moduleKeys.all });
      await queryClient.invalidateQueries({ queryKey: authorizationKeys.all });
      sileo.success({
        title: i18n.t("modules:notifications.success_title"),
        description: i18n.t("modules:groups.notifications.updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("modules:notifications.error_title"),
        description:
          backendMessage ||
          i18n.t("modules:groups.notifications.updated_error"),
      });
    },
  });
};
