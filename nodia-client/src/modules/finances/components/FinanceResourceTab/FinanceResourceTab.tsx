import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Chip, Typography } from "@mui/material";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import FinanceTable from "../FinanceTable";
import type { FinanceColumn } from "../FinanceTable";
import FinanceFilters from "../FinanceFilters";
import FinanceCatalogModal from "../FinanceCatalogModal";
import FinanceGroupModal from "../FinanceGroupModal";
import FinanceMovementModal from "../FinanceMovementModal";
import FinanceObligationModal from "../FinanceObligationModal";
import {
  useFinanceBusy,
  useFinanceList,
  useFinanceMutation,
  useFinanceRecord,
} from "../../infrastructure/useServices";
import type {
  FinanceCategoryGroup,
  FinanceMovement,
  FinanceObligation,
  FinanceQuery,
  FinanceRecordMap,
  FinanceResource,
} from "../../types";
import { formatFinanceAmount } from "../../utils/money";
import { formatFinanceDate } from "../../utils/dates";
import { ResourceContent } from "./styles";

export interface FinanceResourceTabProps {
  resource: FinanceResource;
  query?: FinanceQuery;
  onQueryChange?: (query: FinanceQuery) => void;
  showFilters?: boolean;
  titleKey?: string;
  limit?: number;
}

type ModalProps<T> = {
  open: boolean;
  onClose: () => void;
  initialData?: T;
  onSaved?: () => void;
};
type ResourceViewProps<R extends FinanceResource> = Omit<
  FinanceResourceTabProps,
  "resource"
> & {
  resource: R;
  columns: FinanceColumn<FinanceRecordMap[R]>[];
  renderModal: (props: ModalProps<FinanceRecordMap[R]>) => ReactNode;
  canPay?: (record: FinanceRecordMap[R]) => boolean;
};

function ResourceView<R extends FinanceResource>({
  resource,
  query,
  onQueryChange,
  showFilters = true,
  titleKey,
  limit = 10,
  columns,
  renderModal,
  canPay,
}: ResourceViewProps<R>) {
  const { t } = useTranslation();
  const [localQuery, setLocalQuery] = useState<FinanceQuery>({ limit });
  const currentQuery: FinanceQuery = useMemo(
    () =>
      onQueryChange
        ? { active: "active", limit, ...query }
        : {
            active: "active",
            limit,
            ...query,
            ...localQuery,
            q: { ...query?.q, ...localQuery.q },
          },
    [onQueryChange, limit, query, localQuery],
  );
  const change = (next: FinanceQuery) =>
    onQueryChange ? onQueryChange(next) : setLocalQuery(next);
  const listing = useFinanceList(resource, currentQuery);
  const mutation = useFinanceMutation(resource);
  const globalBusy = useFinanceBusy();
  const [modal, setModal] = useState<{ id?: string } | null>(null);
  const [toToggle, setToToggle] = useState<FinanceRecordMap[R] | null>(null);
  const [payment, setPayment] = useState<FinanceObligation | null>(null);
  const selected = useFinanceRecord(resource, modal?.id, Boolean(modal?.id));
  const submittingToggle = useRef(false);
  const busy =
    listing.isLoading ||
    listing.isFetching ||
    globalBusy ||
    Boolean(modal?.id && (selected.isLoading || selected.isFetching));
  const validPage = Math.max(
    1,
    listing.data?.meta.total_pages ?? currentQuery.page ?? 1,
  );
  const requestedPage = currentQuery.page ?? 1;

  useEffect(() => {
    let cancelled = false;
    if (
      listing.data &&
      !listing.isPlaceholderData &&
      requestedPage > validPage
    ) {
      const next = { ...currentQuery, page: validPage };
      queueMicrotask(() => {
        if (cancelled) return;
        if (onQueryChange) onQueryChange(next);
        else setLocalQuery(next);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    listing.data,
    listing.isPlaceholderData,
    requestedPage,
    validPage,
    currentQuery,
    onQueryChange,
  ]);

  const toggle = async () => {
    if (
      !toToggle ||
      busy ||
      mutation.isUncertain ||
      mutation.isReviewing ||
      submittingToggle.current
    )
      return;
    submittingToggle.current = true;
    try {
      await mutation.mutateAsync({
        id: toToggle.id,
        data: { is_active: !toToggle.is_active },
      });
      setToToggle(null);
    } catch {
      // Mutation owns feedback; keep confirmation and its selected record for retry.
    } finally {
      submittingToggle.current = false;
    }
  };
  const reviewToggle = async () => {
    if (busy || mutation.isReviewing || submittingToggle.current) return;
    submittingToggle.current = true;
    try {
      await mutation.reviewResult();
    } catch {
      // Keep the uncertain write blocked when its follow-up read fails.
    } finally {
      submittingToggle.current = false;
    }
  };
  const search =
    typeof currentQuery.q?.name_cont === "string"
      ? currentQuery.q.name_cont
      : "";
  return (
    <ResourceContent>
      {showFilters && (
        <FinanceFilters
          resource={resource}
          query={currentQuery}
          onChange={change}
          disabled={busy}
        />
      )}
      {modal?.id && selected.isError && (
        <Alert
          severity="error"
          action={
            <Button
              disabled={selected.isFetching}
              onClick={() => void selected.refetch()}
            >
              {t("finance:retry")}
            </Button>
          }
        >
          {t("finance:load_error")}
        </Alert>
      )}
      <FinanceTable
        rows={listing.data?.data ?? []}
        columns={columns}
        search={search}
        onSearchChange={(value) => {
          const q = { ...currentQuery.q };
          if (value.trim()) q.name_cont = value.trim();
          else delete q.name_cont;
          change({ ...currentQuery, q, page: 1 });
        }}
        onCreate={() => setModal({})}
        onEdit={(record) => setModal({ id: record.id })}
        onToggle={setToToggle}
        onPayment={
          resource === "obligations"
            ? (record) => setPayment(record as FinanceObligation)
            : undefined
        }
        canPay={canPay}
        meta={listing.data?.meta}
        page={requestedPage}
        limit={currentQuery.limit ?? limit}
        onPageChange={(page) => change({ ...currentQuery, page })}
        onLimitChange={(nextLimit) =>
          change({ ...currentQuery, limit: nextLimit, page: 1 })
        }
        isLoading={listing.isLoading && !listing.data}
        isFetching={listing.isFetching}
        isError={listing.isError}
        onRetry={() => void listing.refetch()}
        disabled={busy}
        titleKey={titleKey}
      />
      {modal &&
        (!modal.id || selected.data) &&
        renderModal({
          open: true,
          onClose: () => setModal(null),
          initialData: modal.id ? selected.data : undefined,
        })}
      {payment && (
        <FinanceMovementModal
          open
          onClose={() => setPayment(null)}
          obligation={payment}
        />
      )}
      <ConfirmDialog
        open={Boolean(toToggle)}
        onClose={() => {
          if (!busy && !mutation.isPending && !mutation.isReviewing)
            setToToggle(null);
        }}
        onConfirm={() =>
          void (mutation.isUncertain ? reviewToggle() : toggle())
        }
        confirmText={
          mutation.isUncertain ? t("finance:review_result") : undefined
        }
        title={t(
          toToggle?.is_active ? "finance:deactivate" : "finance:activate",
        )}
        message={t("finance:confirm_toggle", { name: toToggle?.name ?? "" })}
        isLoading={busy || mutation.isPending || mutation.isReviewing}
      >
        {mutation.isUncertain && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t("finance:uncertain_description")}
          </Alert>
        )}
      </ConfirmDialog>
    </ResourceContent>
  );
}

const FinanceResourceTab = (props: FinanceResourceTabProps) => {
  const { t, i18n } = useTranslation();
  const activeColumn = {
    key: "active",
    labelKey: "finance:visibility",
    render: (record: { is_active: boolean }) => (
      <Chip
        size="small"
        color={record.is_active ? "success" : "default"}
        label={t(record.is_active ? "finance:active" : "finance:inactive")}
      />
    ),
  };
  const nameColumn = {
    key: "name",
    labelKey: "finance:name",
    render: (record: { name: string }) => (
      <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
        {record.name}
      </Typography>
    ),
  };
  const keyColumn = {
    key: "key",
    labelKey: "finance:key",
    render: (record: { key: string }) => record.key,
  };
  const createdColumn = {
    key: "created",
    labelKey: "finance:created_at",
    render: (record: { created_at: string }) =>
      formatFinanceDate(record.created_at, i18n.language),
  };
  switch (props.resource) {
    case "categories":
      return (
        <ResourceView
          {...props}
          resource="categories"
          columns={[nameColumn, keyColumn, activeColumn, createdColumn]}
          renderModal={(modalProps) => <FinanceCatalogModal {...modalProps} />}
        />
      );
    case "category-groups":
      return (
        <ResourceView
          {...props}
          resource="category-groups"
          columns={[
            nameColumn,
            keyColumn,
            {
              key: "count",
              labelKey: "finance:category_count",
              align: "right",
              render: (record: FinanceCategoryGroup) => record.category_count,
            },
            activeColumn,
            createdColumn,
          ]}
          renderModal={(modalProps) => <FinanceGroupModal {...modalProps} />}
        />
      );
    case "movements":
      return (
        <ResourceView
          {...props}
          resource="movements"
          columns={[
            nameColumn,
            {
              key: "amount",
              labelKey: "finance:amount",
              align: "right",
              render: (record: FinanceMovement) =>
                formatFinanceAmount(record.amount, i18n.language),
            },
            {
              key: "type",
              labelKey: "finance:type",
              render: (record: FinanceMovement) => t(`finance:${record.type}`),
            },
            {
              key: "status",
              labelKey: "finance:status",
              render: (record: FinanceMovement) => (
                <Chip
                  size="small"
                  label={t(`finance:${record.status}`)}
                  variant="outlined"
                />
              ),
            },
            {
              key: "category",
              labelKey: "finance:category",
              render: (record: FinanceMovement) => record.category.name,
            },
            {
              key: "obligation",
              labelKey: "finance:obligation",
              render: (record: FinanceMovement) =>
                record.obligation?.name ?? t("finance:unlinked"),
            },
            activeColumn,
            createdColumn,
          ]}
          renderModal={(modalProps) => <FinanceMovementModal {...modalProps} />}
        />
      );
    case "obligations":
      return (
        <ResourceView
          {...props}
          resource="obligations"
          columns={[
            nameColumn,
            {
              key: "type",
              labelKey: "finance:type",
              render: (record: FinanceObligation) =>
                t(`finance:${record.type}`),
            },
            {
              key: "amount",
              labelKey: "finance:principal",
              align: "right",
              render: (record: FinanceObligation) =>
                formatFinanceAmount(record.amount, i18n.language),
            },
            {
              key: "paid",
              labelKey: "finance:paid_amount",
              align: "right",
              render: (record: FinanceObligation) =>
                formatFinanceAmount(record.paid_amount, i18n.language),
            },
            {
              key: "remaining",
              labelKey: "finance:remaining_amount",
              align: "right",
              render: (record: FinanceObligation) =>
                record.remaining_amount === null
                  ? t("finance:void_obligation")
                  : formatFinanceAmount(record.remaining_amount, i18n.language),
            },
            activeColumn,
            createdColumn,
          ]}
          renderModal={(modalProps) => (
            <FinanceObligationModal {...modalProps} />
          )}
          canPay={(record) =>
            record.is_active &&
            record.remaining_amount !== null &&
            BigInt(record.remaining_amount) > 0n
          }
        />
      );
  }
};

export default FinanceResourceTab;
