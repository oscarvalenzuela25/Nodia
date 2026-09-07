import type { AxiosError } from "axios";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { sileo } from "sileo";
import i18n from "../../../../../translate";
import { createUser, getUsers, updateUser } from "./services";
import type {
  CreateUserPayload,
  GetUsersParams,
  UpdateUserPayload,
} from "../types";

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (params?: GetUsersParams) => [...userKeys.lists(), params] as const,
};

export const useUsers = (params?: GetUsersParams) =>
  useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => getUsers(params),
    placeholderData: keepPreviousData,
  });

const extractErrorMessage = (
  error: AxiosError<{ message?: string }> | Error
): string => {
  if ("response" in error && typeof error.response?.data?.message === "string") {
    return error.response.data.message;
  }
  return error.message;
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      sileo.success({
        title: i18n.t("users:notifications.success_title"),
        description: i18n.t("users:notifications.created_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("users:notifications.error_title"),
        description:
          backendMessage || i18n.t("users:notifications.created_error"),
      });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: UpdateUserPayload;
    }) => updateUser(userId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      sileo.success({
        title: i18n.t("users:notifications.success_title"),
        description: i18n.t("users:notifications.updated_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      const backendMessage = extractErrorMessage(error);
      sileo.error({
        title: i18n.t("users:notifications.error_title"),
        description:
          backendMessage || i18n.t("users:notifications.updated_error"),
      });
    },
  });
};

