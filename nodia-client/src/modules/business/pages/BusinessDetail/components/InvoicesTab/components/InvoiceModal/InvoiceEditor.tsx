import { useState } from "react";
import { Alert, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../../../../../components/BaseModal";
import QueryErrorAlert from "../../../../../../../../components/QueryErrorAlert";
import { notifyHttpError } from "../../../../../../../../config/httpFeedback";
import useAuthStore, { hasActiveSession } from "../../../../../../../../store/authStore";
import type { CashMutationOutcome, CashScope } from "../../../../../../infrastructure/cashTypes";
import { formatCashAmount } from "../../../../../../infrastructure/cashValues";
import { invoiceKeys } from "../../../../../../infrastructure/queryKeys";
import { getInvoiceEditSource, type InvoiceEditSource } from "../../../../../../infrastructure/services";
import { useCashMutation } from "../../../../../../infrastructure/useCashServices";
import { usePagedProviderOptions } from "../../../../../../infrastructure/usePagedOptions";
import { CashMutationFeedback } from "../../../CashTab/CashEditors/CashMutationFeedback";
import { isCashVersionConflict } from "../../../CashTab/CashEditors/fields";
import InvoiceModal from "./InvoiceModal";
import { buildInvoiceCommand, toInvoiceFormData, type InvoiceFormSubmitData } from "./invoiceCommands";

function matchesScope(scope: CashScope, auth: ReturnType<typeof useAuthStore.getState>): boolean {
  return auth.user?.id === scope.actorId &&
    auth.sessionVersion === scope.sessionVersion &&
    hasActiveSession(auth);
}

export default function InvoiceEditor({ scope, invoiceId, onClose }: {
  scope: CashScope;
  invoiceId?: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(["business", "core"]);
  const active = useAuthStore((auth) => matchesScope(scope, auth));
  const [invoice, setInvoice] = useState<InvoiceEditSource>();
  const [latest, setLatest] = useState<InvoiceEditSource>();
  const mutation = useCashMutation(scope);
  const source = useQuery({
    queryKey: [...invoiceKeys.all, "edit-source", scope, invoiceId],
    queryFn: async ({ signal }) => {
      if (!invoiceId || !matchesScope(scope, useAuthStore.getState())) {
        throw new Error("Unexpected invoice scope");
      }
      try {
        return await getInvoiceEditSource(scope.businessId, invoiceId, signal);
      } catch (error) {
        if (!signal.aborted && matchesScope(scope, useAuthStore.getState())) notifyHttpError(error);
        throw error;
      }
    },
    refetchOnMount: "always",
    enabled: Boolean(invoiceId && !invoice && active),
  });

  // Freeze the exact source presented in the form. A background fetch must
  // never advance the revision associated with an existing draft.
  if (!invoice && source.isFetchedAfterMount && !source.isFetching && !source.isError && source.data) {
    setInvoice(source.data);
  }
  const providers = usePagedProviderOptions(scope.businessId, active && (!invoiceId || Boolean(invoice)), {
    actorScope: [scope.actorId, scope.sessionVersion],
  });

  if (invoiceId && !invoice) {
    return (
      <BaseModal open title={t("business:edit_invoice_modal_title")} onClose={onClose}>
        {source.isFetching && <LinearProgress aria-label={t("business:cash.loading_invoice")} />}
        <QueryErrorAlert isError={source.isError} isFetching={source.isFetching} onRetry={source.refetch} />
      </BaseModal>
    );
  }

  const conflict = isCashVersionConflict(mutation.outcome);
  const locked = mutation.pending || mutation.busy;
  const accept = (outcome: CashMutationOutcome | undefined) => {
    if (outcome?.status === "committed" &&
        (outcome.operation === "invoice_create" || outcome.operation === "invoice_update")) onClose();
  };
  const submit = async (form: InvoiceFormSubmitData) => {
    if (locked || conflict || !active) return;
    accept(await mutation.submit(buildInvoiceCommand(form, invoice)));
  };
  const reviewLatest = async () => {
    if (!active || source.isFetching) return;
    const { data, isSuccess } = await source.refetch();
    if (isSuccess && matchesScope(scope, useAuthStore.getState())) setLatest(data);
  };
  const applyLatest = () => {
    if (!latest || !active) return;
    setInvoice(latest);
    setLatest(undefined);
    mutation.reset();
  };
  const comparison = latest && {
    amount: formatCashAmount(String(latest.total_amount), i18n.language),
    date: toInvoiceFormData(latest).issue_date || "—",
    category: latest.cash_expense?.category.name ?? "—",
  };

  return (
    <InvoiceModal
      open
      initialData={invoice}
      providers={providers.providers}
      providerSearch={{
        onSearchChange: providers.setSearch,
        onLoadMore: () => { void providers.fetchNextPage(); },
        hasMore: providers.hasNextPage,
        loadingOptions: providers.isFetching,
      }}
      isSubmitting={locked}
      onSubmit={submit}
      onClose={() => { if (!locked) onClose(); }}
      cash={{
        scope,
        blocked: !active || conflict,
        feedback: (
          <>
            <CashMutationFeedback
              outcome={mutation.outcome}
              busy={mutation.busy || !active}
              onRecover={() => { void mutation.recover().then(accept); }}
              onRetry={() => { void mutation.retry().then(accept); }}
            />
            {conflict && (
              <Alert severity="warning">
                <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
                  <Typography variant="body2">{t("business:cash_version_conflict")}</Typography>
                  {latest && comparison ? (
                    <>
                      <Typography variant="body2">
                        {t("business:cash.current_version", { version: latest.version })}
                      </Typography>
                      <Typography variant="body2">
                        {t("business:cash.invoice_current_values", comparison)}
                      </Typography>
                      <Button type="button" disabled={!active} onClick={applyLatest}>
                        {t("business:cash.accept_current")}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" disabled={source.isFetching || !active} onClick={() => { void reviewLatest(); }}>
                      {t("business:cash.review_current")}
                    </Button>
                  )}
                </Stack>
              </Alert>
            )}
          </>
        ),
      }}
    />
  );
}
