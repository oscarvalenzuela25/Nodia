import {
  hashKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { CanceledError, isAxiosError } from "axios";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { sileo } from "sileo";
import { getServerErrorCode } from "../../../config/axiosInstance";
import { getHttpErrorMessage, notifyHttpError } from "../../../config/httpFeedback";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import i18n from "../../../translate";
import { cashUuidSchema } from "./cashSchemas";
import {
  cashCategoryParams,
  getCashCategories,
  getCashCategory,
  getCashMovement,
  getCashMovements,
  getCashReceipt,
  sendCashMutation,
} from "./cashServices";
import type {
  CashCategoryFilters,
  CashCategoryOptions,
  CashMovementFilters,
  CashMutationCommand,
  CashMutationOutcome,
  CashReceipt,
  CashScope,
} from "./cashTypes";
import { trimCashText } from "./cashValues";

const cashScopeKey = ({ actorId, sessionVersion, businessId }: CashScope) =>
  ["business-cash", actorId, sessionVersion, businessId] as const;

export const cashKeys = {
  categories: (scope: CashScope) => [...cashScopeKey(scope), "categories"] as const,
  movements: (scope: CashScope) => [...cashScopeKey(scope), "movements"] as const,
  monthly: (scope: CashScope) => [...cashScopeKey(scope), "monthly"] as const,
};

const hasCashScope = (scope: CashScope, auth = useAuthStore.getState()) =>
  Boolean(scope.actorId) &&
  cashUuidSchema.safeParse(scope.businessId).success &&
  auth.user?.id === scope.actorId &&
  auth.sessionVersion === scope.sessionVersion;

const canRequest = (scope: CashScope, auth = useAuthStore.getState()) =>
  hasCashScope(scope, auth) && hasActiveSession(auth);

function assertRequestScope(scope: CashScope): void {
  if (!canRequest(scope)) throw new CanceledError("Cash scope changed");
}

function previousPage<T>(
  data: T | undefined,
  previous: QueryKey | undefined,
  key: QueryKey,
): T | undefined {
  return previous && hashKey(previous.slice(0, -1)) === hashKey(key.slice(0, -1)) ? data : undefined;
}

export function useCashMovements(scope: CashScope, { page, search, ...fields }: CashMovementFilters) {
  const active = useAuthStore((auth) => canRequest(scope, auth));
  const criteria = { ...fields, search: trimCashText(search ?? "") || undefined };
  const queryKey = [...cashKeys.movements(scope), "list", criteria, page];
  return useQuery({
    queryKey,
    enabled: active,
    queryFn: ({ signal }) => {
      assertRequestScope(scope);
      return getCashMovements(scope.businessId, { ...criteria, page }, signal);
    },
    placeholderData: (data, previous) => previousPage(data, previous?.queryKey, queryKey),
  });
}

export function useCashCategories(
  scope: CashScope,
  { page, search, ...fields }: CashCategoryFilters,
  enabled = true,
) {
  const active = useAuthStore((auth) => canRequest(scope, auth));
  const criteria = { ...fields, search: trimCashText(search ?? "") || undefined };
  const queryKey = [...cashKeys.categories(scope), "list", criteria, page];
  return useQuery({
    queryKey,
    enabled: active && enabled,
    queryFn: ({ signal }) => {
      assertRequestScope(scope);
      return getCashCategories(scope.businessId, { ...criteria, page }, signal);
    },
    placeholderData: (data, previous) => previousPage(data, previous?.queryKey, queryKey),
  });
}

export function useCashCategoryOptions(scope: CashScope, filters: CashCategoryOptions, enabled = true) {
  const active = useAuthStore((auth) => canRequest(scope, auth));
  const options = { ...filters, page: 1, limit: 25 };
  return useInfiniteQuery({
    queryKey: [
      ...cashKeys.categories(scope),
      "options",
      cashCategoryParams(scope.businessId, options).toString(),
    ],
    initialPageParam: 1,
    enabled: active && enabled,
    queryFn: ({ pageParam, signal }) => {
      assertRequestScope(scope);
      return getCashCategories(scope.businessId, { ...options, page: pageParam }, signal);
    },
    getNextPageParam: ({ meta }) =>
      meta.page < Math.min(meta.total_pages, 100000) ? meta.page + 1 : undefined,
  });
}

export function useCashCategory(scope: CashScope, id?: string, enabled = true) {
  const active = useAuthStore((auth) => canRequest(scope, auth));
  return useQuery({
    queryKey: [...cashKeys.categories(scope), "detail", id],
    enabled: active && enabled && !!id,
    queryFn: ({ signal }) => {
      assertRequestScope(scope);
      return getCashCategory(scope.businessId, id ?? "", signal);
    },
  });
}

export function useCashMovement(scope: CashScope, id?: string, enabled = true) {
  const active = useAuthStore((auth) => canRequest(scope, auth));
  return useQuery({
    queryKey: [...cashKeys.movements(scope), "detail", id],
    enabled: active && enabled && !!id,
    queryFn: ({ signal }) => {
      assertRequestScope(scope);
      return getCashMovement(scope.businessId, id ?? "", signal);
    },
  });
}

type CashIntent = {
  owner: symbol;
  scope: CashScope;
  requestKey: string;
  command: CashMutationCommand;
};

type MutationState = {
  owner: symbol;
  busy: boolean;
  pending: boolean;
  outcome?: CashMutationOutcome;
};

function invalidateCash(
  client: QueryClient,
  scope: CashScope,
  operation: CashMutationCommand["operation"],
) {
  if (operation === "category_create" || operation === "category_update")
    void client.invalidateQueries({ queryKey: cashKeys.categories(scope) });
  else void client.invalidateQueries({ queryKey: cashKeys.monthly(scope) });
  void client.invalidateQueries({ queryKey: cashKeys.movements(scope) });
}

function notifyReceipt(receipt: CashReceipt) {
  switch (receipt.status) {
    case "committed":
      sileo.success({ title: i18n.t("business:cash_saved") });
      break;
    case "processing":
      sileo.info({ title: i18n.t("business:cash_request_processing") });
      break;
    case "unconfirmed":
      sileo.info({ title: i18n.t("business:cash_request_unconfirmed") });
      break;
    case "retryable":
      sileo.info({ title: i18n.t("business:cash_request_retryable") });
      break;
    case "rejected":
      sileo.error({
        title: i18n.t("core:server_error_toast"),
        description: i18n.exists(receipt.error.message)
          ? i18n.t(receipt.error.message)
          : receipt.error.message,
      });
      break;
  }
}

export function useCashMutation(scope: CashScope) {
  const scopeId = JSON.stringify(cashScopeKey(scope));
  const owner = useMemo(() => Symbol(scopeId), [scopeId]);
  const client = useQueryClient();
  const mounted = useRef<symbol | null>(null);
  const intent = useRef<CashIntent | null>(null);
  const lock = useRef<CashIntent | null>(null);
  const [state, setState] = useState<MutationState>();
  const currentState = state?.owner === owner ? state : undefined;
  const { mutateAsync } = useMutation({
    mutationKey: [...cashScopeKey(scope), "mutation"],
    mutationFn: ({ scope, requestKey, command }: CashIntent) => {
      assertRequestScope(scope);
      return sendCashMutation(scope.businessId, requestKey, command);
    },
    retry: false,
  });

  useLayoutEffect(() => {
    mounted.current = owner;
    return () => {
      mounted.current = null;
      if (intent.current?.owner === owner) intent.current = null;
      if (lock.current?.owner === owner) lock.current = null;
    };
  }, [owner]);

  const isCurrent = () => mounted.current === owner && hasCashScope(scope);
  const canStart = () => isCurrent() && canRequest(scope) && lock.current?.owner !== owner;
  const run = async (
    entry: CashIntent,
    action: "submit" | "recover" | "retry",
  ): Promise<CashMutationOutcome | undefined> => {
    const previous = currentState?.outcome;
    lock.current = entry;
    setState({ owner, busy: true, pending: true, outcome: previous });
    const finish = (outcome: CashMutationOutcome) => {
      const pending = outcome.status !== "committed" && outcome.status !== "rejected";
      if (!pending) intent.current = null;
      setState({ owner, busy: false, pending, outcome });
      return outcome;
    };
    try {
      const receipt =
        action === "recover"
          ? await getCashReceipt(entry.scope.businessId, entry.requestKey, entry.command)
          : await mutateAsync(entry);
      if (receipt.status === "committed") invalidateCash(client, entry.scope, entry.command.operation);
      if (!isCurrent()) return;
      notifyReceipt(receipt);
      return finish(receipt);
    } catch (error) {
      if (!isCurrent()) return;
      notifyHttpError(error);
      const response = isAxiosError<{ message?: unknown }>(error) ? error.response : undefined;
      const status = response?.status;
      // Only an initial, definitive client error can prove failure here. An
      // error on replay cannot override a previously uncertain commit.
      if (
        action === "submit" &&
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        status !== 408
      ) {
        const message = response?.data?.message;
        return finish({
          request_key: entry.requestKey,
          operation: entry.command.operation,
          status: "rejected",
          error: {
            status_code: status,
            message:
              getServerErrorCode(error) ??
              (typeof message === "string" ? message : getHttpErrorMessage(error)),
          },
        });
      }
      return finish({ request_key: entry.requestKey, status: "unavailable" });
    } finally {
      if (lock.current === entry) lock.current = null;
    }
  };

  const submit = async (command: CashMutationCommand) => {
    if (!canStart() || intent.current?.owner === owner) return;
    const entry: CashIntent = {
      owner,
      scope: { ...scope },
      requestKey: crypto.randomUUID(),
      command: structuredClone(command),
    };
    intent.current = entry;
    return run(entry, "submit");
  };

  const recover = async () => {
    if (!canStart() || intent.current?.owner !== owner) return;
    return run(intent.current, "recover");
  };

  const retry = async () => {
    if (!canStart() || intent.current?.owner !== owner) return;
    return run(intent.current, "retry");
  };

  const reset = () => {
    if (intent.current?.owner !== owner && lock.current?.owner !== owner) setState(undefined);
  };

  return {
    busy: currentState?.busy ?? false,
    pending: currentState?.pending ?? false,
    outcome: currentState?.outcome,
    submit,
    recover,
    retry,
    reset,
  };
}
