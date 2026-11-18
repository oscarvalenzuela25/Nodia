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
  CashCommandValidationError,
  cashCategoryParams,
  getCashCategories,
  getCashCategory,
  getCashMonthlySummary,
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
import { businessKeys, invoiceKeys, productKeys, productLogKeys } from "./queryKeys";

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

export function useCashMonthlySummary(scope: CashScope, enabled = true) {
  const active = useAuthStore((auth) => canRequest(scope, auth));
  return useQuery({
    queryKey: cashKeys.monthly(scope),
    enabled: active && enabled,
    queryFn: ({ signal }) => {
      assertRequestScope(scope);
      return getCashMonthlySummary(scope.businessId, signal);
    },
  });
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
  if (
    operation === "invoice_create" || operation === "invoice_update" || operation === "invoice_ocr_confirm"
  ) {
    void client.invalidateQueries({ queryKey: invoiceKeys.lists() });
  }
  if (operation === "invoice_ocr_confirm") {
    void client.invalidateQueries({ queryKey: productKeys.all });
    void client.invalidateQueries({ queryKey: productLogKeys.all });
    void client.invalidateQueries({ queryKey: businessKeys.detail(scope.businessId) });
  }
}

function snapshotCommand(command: CashMutationCommand): CashMutationCommand {
  if (command.operation === "invoice_create" || command.operation === "invoice_ocr_confirm") {
    // Files hold immutable bytes. Keep the native File so every replay retains
    // the original filename and MIME alongside the captured command fields.
    const snapshot = { ...command };
    snapshot.fields = structuredClone(command.fields);
    return snapshot;
  }
  return structuredClone(command);
}

function isCashCrud(operation: CashMutationCommand["operation"]) {
  return operation.startsWith("category_") || operation.startsWith("movement_");
}

function notifyReceipt(receipt: CashReceipt, cashCrud: boolean) {
  if (cashCrud && receipt.status !== "committed" && receipt.status !== "rejected") {
    sileo.info({ title: i18n.t("business:cash.save_unconfirmed") });
    return;
  }
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
    const cashCrud = isCashCrud(entry.command.operation);
    lock.current = entry;
    setState({ owner, busy: true, pending: true, outcome: previous });
    const finish = (outcome: CashMutationOutcome) => {
      const pending = outcome.status !== "committed" && outcome.status !== "rejected";
      if (!pending) intent.current = null;
      setState({ owner, busy: false, pending, outcome });
      return outcome;
    };
    const accept = (receipt: CashReceipt) => {
      if (receipt.status === "committed" && hasCashScope(entry.scope)) {
        invalidateCash(client, entry.scope, entry.command.operation);
      }
      if (!isCurrent()) return;
      notifyReceipt(receipt, cashCrud);
      return finish(receipt);
    };
    const readReceipt = () => getCashReceipt(entry.scope.businessId, entry.requestKey, entry.command);
    const verifyWrite = async (): Promise<CashReceipt | undefined> => {
      if (!isCurrent() || !canRequest(entry.scope)) return;
      try {
        return await readReceipt();
      } catch {
        // The original write's outcome remains unknown until a later confirmation.
      }
    };
    try {
      const receipt = action === "recover" ? await readReceipt() : await mutateAsync(entry);
      return accept(cashCrud && action !== "recover" && receipt.status === "processing"
        ? (await verifyWrite()) ?? receipt
        : receipt);
    } catch (error) {
      if (!isCurrent()) return;
      const invalidCommand = error instanceof CashCommandValidationError ? error : undefined;
      const response = isAxiosError<{ message?: unknown }>(error) ? error.response : undefined;
      const status = invalidCommand?.statusCode ?? response?.status;
      // An error on replay cannot override a previously uncertain commit.
      const definitive = action === "submit" && status !== undefined &&
        status >= 400 && status < 500 && status !== 408;
      const observed = cashCrud && action !== "recover" && !definitive
        ? await verifyWrite()
        : undefined;
      if (observed?.status === "committed" || observed?.status === "rejected") return accept(observed);
      if (!isCurrent()) return;
      if (invalidCommand) {
        sileo.error({
          title: i18n.t("core:server_error_toast"),
          description: i18n.t(invalidCommand.message),
        });
      } else notifyHttpError(error);
      if (definitive) {
        const message = response?.data?.message;
        return finish({
          request_key: entry.requestKey,
          operation: entry.command.operation,
          status: "rejected",
          error: {
            status_code: status,
            message:
              invalidCommand?.message ??
              getServerErrorCode(error) ??
              (typeof message === "string" ? message : getHttpErrorMessage(error)),
          },
        });
      }
      return finish(observed ?? { request_key: entry.requestKey, status: "unavailable" });
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
      command: snapshotCommand(command),
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
