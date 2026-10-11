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
import { createRole, getRoles, updateRole, deleteRole } from "./services";
import type {
  CreateRolePayload,
  GetRolesParams,
  UpdateRolePayload,
} from "../types";

import { authorizationKeys } from "../../../../../services/authorizationService";
import { userKeys } from "../../Users/infrastructure/useServices";

export const roleKeys = {
  all: ["roles"] as const,
  lists: () => [...roleKeys.all, "list"] as const,
  list: (params?: GetRolesParams) => [...roleKeys.lists(), params] as const,
};

export const useRoles = (
  params?: GetRolesParams,
  options?: { enabled?: boolean },
) => {
  const { isSessionActive } = useAuth();
  return useQuery({
    queryKey: roleKeys.list(params),
    queryFn: () => getRoles(params),
    placeholderData: keepPreviousData,
    enabled: isSessionActive && (options?.enabled ?? true),
  });
};

const extractErrorMessage = (
  error: AxiosError<{ message?: string }> | Error,
): string => {
  if (
    "response" in error &&
    typeof error.response?.data?.message === "string"
  ) {
    return error.response.data.message;
  }
  return error.message;
};

export const useCreateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRolePayload) => createRole(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: roleKeys.all });
      sileo.success({
        title: i18n.t("roles:notifications.success_title"),
        description: i18n.t("roles:notifications.created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("roles:notifications.error_title"),
        description: backendMessage
          ? i18n.t(backendMessage, { defaultValue: backendMessage })
          : i18n.t("roles:notifications.created_error"),
      });
    },
  });
};

export const useUpdateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      payload,
    }: {
      roleId: string;
      payload: UpdateRolePayload;
    }) => updateRole(roleId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: roleKeys.all });
      sileo.success({
        title: i18n.t("roles:notifications.success_title"),
        description: i18n.t("roles:notifications.updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("roles:notifications.error_title"),
        description: backendMessage
          ? i18n.t(backendMessage, { defaultValue: backendMessage })
          : i18n.t("roles:notifications.updated_error"),
      });
    },
  });
};

export const useDeleteRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: roleKeys.all }),
        queryClient.invalidateQueries({ queryKey: userKeys.all }),
        queryClient.invalidateQueries({ queryKey: authorizationKeys.all }),
      ]);
      sileo.success({
        title: i18n.t("roles:notifications.success_title"),
        description: i18n.t("roles:notifications.deleted_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const message = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("roles:notifications.error_title"),
        description: message
          ? i18n.t(message, { defaultValue: message })
          : i18n.t("roles:notifications.deleted_error"),
      });
    },
  });
};
