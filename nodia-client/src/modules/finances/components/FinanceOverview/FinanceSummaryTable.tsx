import { useEffect, useRef, useState } from "react";
import { Alert, Button, Chip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import FinanceTable from "../FinanceTable";
import FinanceRecordCard from "../FinanceRecordCard";
import FinanceDeleteDialog from "../FinanceDeleteDialog";
import type { FinanceColumn } from "../FinanceTable";
import FinanceCatalogModal from "../FinanceCatalogModal";
import FinanceGroupModal from "../FinanceGroupModal";
import {
  useFinanceBusy,
  useFinanceMutation,
  useFinanceRecord,
  useFinanceSummary,
} from "../../infrastructure/useServices";
import { formatFinanceAmount } from "../../utils/money";
import type { FinanceQuery, FinanceSummary } from "../../types";
import { OverviewStack } from "./styles";

interface Props {
  kind: "categories" | "category-groups";
  query: FinanceQuery;
}

const FinanceSummaryTable = ({ kind, query }: Props) => {
  const { t, i18n } = useTranslation("finance");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string>();
  const [toggleRow, setToggleRow] = useState<FinanceSummary | null>(null);
  const [deleteRow, setDeleteRow] = useState<FinanceSummary | null>(null);
  const toggleInFlight = useRef(false);
  const summaryQuery = { ...query.q };
  delete summaryQuery.name_cont;
  if (search.trim()) summaryQuery.name_cont = search.trim();
  const summary = useFinanceSummary(kind, {
    ...query,
    page,
    limit,
    q: summaryQuery,
  });
  const detail = useFinanceRecord(kind, editId, Boolean(editId));
  const mutation = useFinanceMutation(kind);
  const financeBusy = useFinanceBusy();
  const lastPage = Math.max(1, summary.data?.meta.total_pages ?? page);
  useEffect(() => {
    let cancelled = false;
    if (summary.data && !summary.isPlaceholderData && page > lastPage)
      queueMicrotask(() => {
        if (!cancelled) setPage(lastPage);
      });
    return () => {
      cancelled = true;
    };
  }, [summary.data, summary.isPlaceholderData, page, lastPage]);
  const busy =
    financeBusy || summary.isFetching || summary.isLoading || detail.isFetching;
  const columns: FinanceColumn<FinanceSummary>[] = [
    {
      key: "name",
      labelKey: "finance:name",
      render: (row) => (
        <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
          {row.name}
        </Typography>
      ),
    },
    { key: "key", labelKey: "finance:key", render: (row) => row.key },
    {
      key: "movement_count",
      labelKey: "finance:table.movement_count",
      align: "right",
      render: (row) => row.movement_count,
    },
    {
      key: "income",
      labelKey: "finance:table.income",
      align: "right",
      render: (row) => formatFinanceAmount(row.income_amount, i18n.language),
    },
    {
      key: "expense",
      labelKey: "finance:table.expense",
      align: "right",
      render: (row) => formatFinanceAmount(row.expense_amount, i18n.language),
    },
    {
      key: "net",
      labelKey: "finance:table.net",
      align: "right",
      render: (row) => formatFinanceAmount(row.net_amount, i18n.language),
    },
    {
      key: "active",
      labelKey: "finance:active",
      render: (row) => (
        <Chip
          size="small"
          color={row.is_active ? "success" : "default"}
          label={t(row.is_active ? "finance:active" : "finance:inactive")}
        />
      ),
    },
  ];
  const openCreate = () => {
    setEditId(undefined);
    setModalOpen(true);
  };
  const openEdit = (row: FinanceSummary) => {
    setEditId(row.id);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditId(undefined);
  };
  const confirmToggle = async () => {
    if (
      !toggleRow ||
      toggleInFlight.current ||
      busy ||
      mutation.isUncertain ||
      mutation.isReviewing
    )
      return;
    toggleInFlight.current = true;
    try {
      await mutation.mutateAsync({
        id: toggleRow.id,
        data: { is_active: !toggleRow.is_active },
      });
      setToggleRow(null);
      setPage(1);
    } catch {
      // Shared mutation hook owns feedback; keep the confirmation available.
    } finally {
      toggleInFlight.current = false;
    }
  };
  const reviewToggle = async () => {
    if (toggleInFlight.current || busy || mutation.isReviewing) return;
    toggleInFlight.current = true;
    try {
      await mutation.reviewResult();
    } catch {
      // Failed review retains uncertainty and never replays the write.
    } finally {
      toggleInFlight.current = false;
    }
  };
  const readyToEdit = !editId || Boolean(detail.data);

  return (
    <OverviewStack>
      {kind === "category-groups" && (
        <Alert severity="info">
          {t("finance:overview.overlapping_groups")}
        </Alert>
      )}
      {modalOpen && editId && detail.isError && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              disabled={busy}
              onClick={() => void detail.refetch()}
            >
              {t("finance:retry")}
            </Button>
          }
        >
          {t("finance:overview.summary_error")}
        </Alert>
      )}
      <FinanceTable
        rows={summary.data?.data ?? []}
        columns={columns}
        titleKey={
          kind === "categories"
            ? "finance:overview.category_summary"
            : "finance:overview.group_summary"
        }
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggle={setToggleRow}
        onDelete={setDeleteRow}
        renderMobileRow={(row, actions) => (
          <FinanceRecordCard
            record={row}
            actions={actions}
            fields={[
              { key: "id", label: t("finance:id"), value: row.id },
              { key: "key", label: t("finance:key"), value: row.key },
              {
                key: "movements",
                label: t("finance:table.movement_count"),
                value: row.movement_count,
              },
              {
                key: "income",
                fullWidth: true,
                label: t("finance:table.income"),
                value: formatFinanceAmount(row.income_amount, i18n.language),
              },
              {
                key: "expense",
                fullWidth: true,
                label: t("finance:table.expense"),
                value: formatFinanceAmount(row.expense_amount, i18n.language),
              },
              {
                key: "net",
                fullWidth: true,
                label: t("finance:table.net"),
                value: formatFinanceAmount(row.net_amount, i18n.language),
              },
            ]}
          />
        )}
        meta={summary.data?.meta}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        isLoading={summary.isLoading}
        isFetching={summary.isFetching}
        isError={summary.isError}
        onRetry={() => void summary.refetch()}
        disabled={busy}
      />
      {modalOpen &&
        readyToEdit &&
        kind === "categories" &&
        (!detail.data || !("category_count" in detail.data)) && (
          <FinanceCatalogModal
            open
            onClose={closeModal}
            initialData={editId ? detail.data : undefined}
            onSaved={() => setPage(1)}
          />
        )}
      {modalOpen &&
        readyToEdit &&
        kind === "category-groups" &&
        (!detail.data || "category_count" in detail.data) && (
          <FinanceGroupModal
            open
            onClose={closeModal}
            initialData={editId ? detail.data : undefined}
            onSaved={() => setPage(1)}
          />
        )}
      <ConfirmDialog
        open={Boolean(toggleRow)}
        onClose={() => {
          if (!busy && !mutation.isReviewing) setToggleRow(null);
        }}
        onConfirm={() =>
          void (mutation.isUncertain ? reviewToggle() : confirmToggle())
        }
        confirmText={
          mutation.isUncertain ? t("finance:review_result") : undefined
        }
        title={t(
          toggleRow?.is_active ? "finance:deactivate" : "finance:activate",
        )}
        message={t("finance:confirm_toggle", { name: toggleRow?.name ?? "" })}
        isLoading={busy || mutation.isPending || mutation.isReviewing}
      >
        {mutation.isUncertain && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t("finance:uncertain_description")}
          </Alert>
        )}
      </ConfirmDialog>
      {deleteRow && (
        <FinanceDeleteDialog
          resource={kind}
          record={deleteRow}
          onClose={() => setDeleteRow(null)}
          onDeleted={() => setDeleteRow(null)}
        />
      )}
    </OverviewStack>
  );
};

export default FinanceSummaryTable;
