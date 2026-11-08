import useAuth from "../../../../../hooks/useAuth";
import { CanceledError, isAxiosError, isCancel, type AxiosError } from "axios";
import { useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type MutateOptions,
} from "@tanstack/react-query";
import { sileo } from "sileo";
import i18n from "../../../../../translate";
import { authorizationKeys } from "../../../../../services/authorizationService";
import useAuthStore from "../../../../../store/authStore";
import { claimHttpErrorNotification } from "../../../../../config/httpFeedback";
import { InvalidOrderResponseError } from "./orderSchemas";
import {
  createModule,
  getModules,
  updateModule,
  createModuleGroup,
  getModuleGroups,
  updateModuleGroup,
  deleteModule,
  deleteModuleGroup,
  moveModuleOrder,
  moveModuleGroupOrder,
} from "./services";
import type {
  CreateModulePayload,
  GetModulesParams,
  UpdateModulePayload,
  CreateModuleGroupPayload,
  GetModuleGroupsParams,
  UpdateModuleGroupPayload,
  MoveOrderCommand,
  MoveModuleOrderCommand,
  OrderMoveResult,
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
  options?: { enabled?: boolean },
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
  options?: { enabled?: boolean },
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

export const deleteErrorMessage = (
  error: AxiosError<{ message?: string | string[] }> | Error,
): string => {
  const message =
    "response" in error ? error.response?.data?.message : undefined;
  const messages = (Array.isArray(message) ? message : [message]).filter(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
  return messages.length
    ? messages
        .map((value) => (i18n.exists(value) ? i18n.t(value) : value))
        .join(". ")
    : i18n.t("core:server_error_toast");
};

export const useDeleteModule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteModule(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: moduleKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: authorizationKeys.all }),
      ]);
      sileo.success({
        title: i18n.t("modules:notifications.success_title"),
        description: i18n.t("modules:notifications.deleted_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      sileo.error({
        title: i18n.t("modules:notifications.error_title"),
        description: deleteErrorMessage(error),
      });
    },
  });
};

export const useDeleteModuleGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteModuleGroup(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: moduleGroupKeys.all }),
        queryClient.invalidateQueries({ queryKey: moduleKeys.all }),
        queryClient.invalidateQueries({ queryKey: authorizationKeys.all }),
      ]);
      sileo.success({
        title: i18n.t("modules:notifications.success_title"),
        description: i18n.t("modules:groups.notifications.deleted_success"),
      });
    },
    onError: (error: AxiosError<{ message?: string }> | Error) => {
      sileo.error({
        title: i18n.t("modules:notifications.error_title"),
        description: deleteErrorMessage(error),
      });
    },
  });
};

type OrderActor = { userId: string | null; sessionVersion: number };
const orderActor = (): OrderActor => {
  const state = useAuthStore.getState();
  return { userId: state.user?.id ?? null, sessionVersion: state.sessionVersion };
};
const matchesOrderActor = (actor: OrderActor) => {
  const state = useAuthStore.getState();
  return Boolean(state.token) && state.sessionStatus === "authenticated" &&
    state.sessionVersion === actor.sessionVersion && (state.user?.id ?? null) === actor.userId;
};
const sameOrderActor = (left: OrderActor | null, right: OrderActor) =>
  left?.userId === right.userId && left?.sessionVersion === right.sessionVersion;

function moveErrorMessage(error: unknown): string {
  if (error instanceof InvalidOrderResponseError) return i18n.t("modules:ordering.invalid_response");
  if (isAxiosError(error)) {
    const message: unknown = error.response?.data?.message;
    const messages = (Array.isArray(message) ? message : [message]).filter(
      (value): value is string => typeof value === "string" && Boolean(value.trim()),
    );
    if (messages.length) return messages.map((value) => i18n.exists(value) ? i18n.t(value) : value).join(". ");
    if (!error.response || error.response.status >= 500) return i18n.t("modules:ordering.uncertain");
  }
  return i18n.t("modules:ordering.error");
}

function useOrderMutation<TCommand extends MoveOrderCommand>(
  send: (id: string, command: TCommand) => Promise<OrderMoveResult>,
) {
  const client = useQueryClient();
  const { user, sessionVersion } = useAuth();
  const actor = { userId: user?.id ?? null, sessionVersion };
  const [recovery, setRecovery] = useState<OrderActor | null>(null);
  const [recovering, setRecovering] = useState<OrderActor | null>(null);
  const recoveryPromise = useRef<Promise<boolean> | null>(null);

  const refresh = async (owner: OrderActor): Promise<boolean> => {
    if (!matchesOrderActor(owner)) return false;
    const results = await Promise.allSettled([
      client.invalidateQueries({ queryKey: moduleKeys.all }, { throwOnError: true }),
      client.invalidateQueries({ queryKey: moduleGroupKeys.all }, { throwOnError: true }),
      client.invalidateQueries({ queryKey: authorizationKeys.all }, { throwOnError: true }),
    ]);
    if (!matchesOrderActor(owner)) return false;
    const successful = results.every((result) => result.status === "fulfilled");
    setRecovery(successful ? null : owner);
    return successful;
  };

  type Variables = { id: string; command: TCommand };
  type ScopedVariables = Variables & { owner: OrderActor };
  type Options = MutateOptions<OrderMoveResult, unknown, Variables, OrderActor>;
  const mutation = useMutation<OrderMoveResult, unknown, ScopedVariables, OrderActor>({
    mutationFn: ({ id, command, owner }) => {
      if (!matchesOrderActor(owner)) throw new CanceledError("Session changed");
      return send(id, command);
    },
    retry: false,
    onMutate: ({ owner }) => {
      if (!matchesOrderActor(owner)) throw new CanceledError("Session changed");
      if (sameOrderActor(recovery, owner)) throw new Error("modules:ordering.recovery_failed");
      return owner;
    },
    onSuccess: async (result, _variables, owner) => {
      if (!owner || !matchesOrderActor(owner)) return;
      await refresh(owner);
      if (!matchesOrderActor(owner)) return;
      sileo.success({
        title: i18n.t("modules:notifications.success_title"),
        description: i18n.t(result.status === "moved" ? "modules:ordering.save_success" : "modules:ordering.unchanged"),
      });
    },
    onError: async (error, _variables, owner) => {
      if (!owner || !matchesOrderActor(owner) || isCancel(error)) return;
      if (claimHttpErrorNotification(error)) sileo.error({
        title: i18n.t("modules:notifications.error_title"),
        description: moveErrorMessage(error),
      });
      await refresh(owner);
    },
  });

  const recover = (): Promise<boolean> => {
    if (recoveryPromise.current) return recoveryPromise.current;
    const owner = orderActor();
    setRecovering(owner);
    const operation = refresh(owner).finally(() => {
      if (recoveryPromise.current === operation) recoveryPromise.current = null;
      setRecovering(null);
    });
    recoveryPromise.current = operation;
    return operation;
  };

  return {
    ...mutation,
    mutate: (variables: Variables, options?: Options) => mutation.mutate({ ...variables, owner: orderActor() }, options),
    mutateAsync: (variables: Variables, options?: Options) => mutation.mutateAsync({ ...variables, owner: orderActor() }, options),
    recoveryRequired: sameOrderActor(recovery, actor),
    isRecovering: sameOrderActor(recovering, actor),
    recover,
  };
}

export const useMoveModuleOrder = () => useOrderMutation<MoveModuleOrderCommand>(moveModuleOrder);
export const useMoveModuleGroupOrder = () => useOrderMutation<MoveOrderCommand>(moveModuleGroupOrder);
