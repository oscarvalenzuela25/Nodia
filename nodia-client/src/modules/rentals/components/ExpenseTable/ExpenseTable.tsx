import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { RentalExpense, RentalProperty, RentalQuery } from "../../types";
import { useRentalBusy, useRentalList } from "../../infrastructure/useServices";
import { formatRentalAmount } from "../../utils/money";

import RentalTable from "../RentalTable";
import RentalFilters from "../RentalFilters";

import ExpenseModal from "../ExpenseModal";
import ExpenseActions from "../ExpenseActions";
import { FilterRow } from "./styles";
export type ExpenseTableProps = {
  property: RentalProperty;
  reservationId?: string;
  onOpenReservation?: (id: string) => void;
};
function ExpenseHistory({
  property,
  reservationId,
  onOpenReservation,
}: ExpenseTableProps) {
  const { t, i18n } = useTranslation();
  const globalBusy = useRentalBusy(property.id);
  const [params, setParams] = useState<RentalQuery>({
    page: 1,
    limit: 10,
    ...(reservationId ? { reservation_id: reservationId } : {}),
  });
  const page = params.page ?? 1,
    limit = params.limit ?? 10,
    search = params.q?.name_cont ?? "";
  const update = (changes: Partial<RentalQuery>) =>
    setParams((previous) => ({ ...previous, ...changes }));
  const [editing, setEditing] = useState<RentalExpense | "new" | null>(null);
  const [command, setCommand] = useState<{
    expense: RentalExpense;
    action: "pay" | "void";
  }>();
  const list = useRentalList("expenses", property.id, params);
  const busy = globalBusy || list.isFetching;
  return (
    <>
      <FilterRow>
        <RentalFilters
          resource="expenses"
          property={property}
          query={params}
          onApply={setParams}
          disabled={busy}
        />
      </FilterRow>
      <RentalTable
        title={t("rental:tabs.expenses")}
        rows={list.data?.data ?? []}
        columns={[
          { key: "name", label: t("rental:name"), render: (row) => row.name },
          {
            key: "amount",
            label: t("rental:amount"),
            render: (row) => formatRentalAmount(row.amount, i18n.language),
          },
          {
            key: "incurred",
            label: t("rental:incurred_on"),
            render: (row) => row.incurred_on,
          },
          {
            key: "paid",
            label: t("rental:paid_on"),
            render: (row) => row.paid_on ?? "—",
          },
          {
            key: "category",
            label: t("rental:category"),
            render: (row) => row.category ?? "—",
          },
          {
            key: "status",
            label: t("rental:status"),
            render: (row) => t(`rental:${row.status}`),
          },
        ]}
        meta={list.data?.meta}
        page={page}
        limit={limit}
        onPageChange={(value) => update({ page: value })}
        onLimitChange={(value) => update({ page: 1, limit: value })}
        query={list}
        busy={globalBusy}
        search={search}
        onSearchChange={(value) =>
          update({ page: 1, q: value ? { name_cont: value } : undefined })
        }
        onCreate={() => setEditing("new")}
        actions={(row) => [
          ...(row.reservation_id && onOpenReservation
            ? [
                {
                  key: "reservation",
                  label: t("rental:open_reservation"),
                  onClick: () => onOpenReservation(row.reservation_id!),
                },
              ]
            : []),
          ...(row.status !== "voided"
            ? [
                {
                  key: "edit",
                  label: t("rental:edit_expense"),
                  onClick: () => setEditing(row),
                },
                {
                  key: "void",
                  label: t("rental:void"),
                  onClick: () => setCommand({ expense: row, action: "void" }),
                },
              ]
            : []),
          ...(row.status === "pending"
            ? [
                {
                  key: "pay",
                  label: t("rental:pay_expense"),
                  onClick: () => setCommand({ expense: row, action: "pay" }),
                },
              ]
            : []),
        ]}
      />
      {editing && (
        <ExpenseModal
          open
          property={property}
          initialData={editing === "new" ? undefined : editing}
          reservationId={reservationId}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {command && (
        <ExpenseActions
          open
          property={property}
          {...command}
          onClose={() => setCommand(undefined)}
        />
      )}
    </>
  );
}
export default function ExpenseTable(props: ExpenseTableProps) {
  return (
    <ExpenseHistory
      key={`${props.property.id}:${props.reservationId ?? "all"}`}
      {...props}
    />
  );
}
