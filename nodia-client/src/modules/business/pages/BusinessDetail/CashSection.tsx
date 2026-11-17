import { useRef, useState } from "react";
import { LinearProgress } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import QueryErrorAlert from "../../../../components/QueryErrorAlert";
import useAuthStore from "../../../../store/authStore";
import { getInvoiceEditSource } from "../../infrastructure/services";
import { invoiceKeys } from "../../infrastructure/queryKeys";
import { usePagedProviderOptions } from "../../infrastructure/usePagedOptions";
import { useUpdateInvoice } from "../../infrastructure/useServices";
import { cashKeys } from "../../infrastructure/useCashServices";
import type { CashScope } from "../../infrastructure/cashTypes";
import CashTab from "./components/CashTab";
import InvoiceModal, { type InvoiceFormSubmitData } from "./components/InvoicesTab/components/InvoiceModal";

type SourceInvoice = Awaited<ReturnType<typeof getInvoiceEditSource>>;

function LinkedInvoiceEditor({ scope, invoiceId, onClose }: {
  scope: CashScope;
  invoiceId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(["business", "core"]);
  const queryClient = useQueryClient();
  const [invoice, setInvoice] = useState<SourceInvoice>();
  const sending = useRef(false);
  const update = useUpdateInvoice();
  const source = useQuery({
    queryKey: [...invoiceKeys.all, "cash-source", scope, invoiceId],
    queryFn: ({ signal }) => getInvoiceEditSource(scope.businessId, invoiceId, signal),
    refetchOnMount: "always",
    enabled: !invoice,
  });
  if (!invoice && source.isFetchedAfterMount && !source.isFetching && !source.isError && source.data) {
    setInvoice(source.data);
  }
  const providers = usePagedProviderOptions(scope.businessId, Boolean(invoice), {
    actorScope: [scope.actorId, scope.sessionVersion],
  });

  if (!invoice) {
    return (
      <BaseModal open title={t("business:edit_invoice_modal_title")} onClose={onClose}>
        {source.isFetching && <LinearProgress aria-label={t("business:cash.loading_invoice")} />}
        <QueryErrorAlert isError={source.isError} isFetching={source.isFetching} onRetry={source.refetch} />
      </BaseModal>
    );
  }

  const submit = async (form: InvoiceFormSubmitData) => {
    const auth = useAuthStore.getState();
    if (sending.current || auth.user?.id !== scope.actorId || auth.sessionVersion !== scope.sessionVersion) return;
    sending.current = true;
    try {
      const code = form.code.trim() || null;
      const provider = form.provider_id || null;
      await update.mutateAsync({
        id: invoice.id,
        payload: {
          ...(code === invoice.code ? {} : { code }),
          ...(provider === (invoice.provider_id ?? null) ? {} : { provider_id: provider }),
          ...(form.is_active === invoice.is_active ? {} : { is_active: form.is_active }),
          ...(form.notes === (invoice.data?.notes ?? "") ? {} : {
            data: { ...invoice.data, notes: form.notes },
          }),
        },
      });
      void queryClient.invalidateQueries({ queryKey: cashKeys.movements(scope) });
      onClose();
    } catch {
      // The update hook notifies the error. Keep the invoice snapshot and form.
    } finally {
      sending.current = false;
    }
  };

  return (
    <InvoiceModal
      open
      linkedCashExpense
      initialData={invoice}
      providers={providers.providers}
      providerSearch={{
        onSearchChange: providers.setSearch,
        onLoadMore: () => { void providers.fetchNextPage(); },
        hasMore: providers.hasNextPage,
        loadingOptions: providers.isFetching,
      }}
      isSubmitting={update.isPending}
      onSubmit={submit}
      onClose={() => { if (!sending.current) onClose(); }}
    />
  );
}

export default function CashSection({ businessId, actorId, sessionVersion }: CashScope) {
  const [invoiceId, setInvoiceId] = useState<string>();
  return (
    <>
      <CashTab businessId={businessId} onEditInvoice={setInvoiceId} />
      {invoiceId && (
        <LinkedInvoiceEditor
          key={invoiceId}
          scope={{ businessId, actorId, sessionVersion }}
          invoiceId={invoiceId}
          onClose={() => setInvoiceId(undefined)}
        />
      )}
    </>
  );
}
