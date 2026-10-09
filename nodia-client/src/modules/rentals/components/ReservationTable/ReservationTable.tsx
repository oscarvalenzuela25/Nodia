import { useState } from "react";
import { Chip, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import RentalFilters from "../RentalFilters";
import type {
  RentalProperty,
  RentalReservation,
  RentalQuery,
} from "../../types";
import { useRentalList, useRentalBusy } from "../../infrastructure/useServices";
import { formatRentalAmount } from "../../utils/money";
import RentalTable from "../RentalTable";
import { Filters } from "./styles";
import MobileRecordCard from "../../../../components/MobileRecordCard";
export type ReservationTableProps = {
  property: RentalProperty;
  onOpenReservation: (id: string) => void;
  onEditReservation: (reservation: RentalReservation) => void;
  onCreateReservation: () => void;
};
export default function ReservationTable({
  property,
  onOpenReservation,
  onEditReservation,
  onCreateReservation,
}: ReservationTableProps) {
  const { t, i18n } = useTranslation();
  const [queryParams, setQueryParams] = useState<RentalQuery>({
    page: 1,
    limit: 10,
    active: "active",
  });
  const [searchBy, setSearchBy] = useState("guest_name_cont");
  const page = queryParams.page ?? 1,
    limit = queryParams.limit ?? 10,
    search = queryParams.q?.[searchBy] ?? "";
  const query = useRentalList("reservations", property.id, queryParams);
  const busy = useRentalBusy(property.id);
  const update = (changes: Partial<RentalQuery>) =>
    setQueryParams((previous) => ({ ...previous, ...changes }));
  return (
    <Stack spacing={3}>
      <Filters>
        <SelectSingleInput
          label={t("rental:search_by")}
          value={searchBy}
          clearable={false}
          disabled={busy}
          options={[
            { value: "guest_name_cont", label: t("rental:guest_name") },
            {
              value: "external_reference_cont",
              label: t("rental:external_reference"),
            },
          ]}
          onChange={(value) => {
            if (value) {
              setSearchBy(value);
              update({ page: 1, q: search ? { [value]: search } : undefined });
            }
          }}
        />
      </Filters>
      <RentalFilters
        resource="reservations"
        property={property}
        query={queryParams}
        onApply={setQueryParams}
        disabled={busy}
      />
      <RentalTable
        title={t("rental:tabs.reservations")}
        busy={busy}
        rows={query.data?.data ?? []}
        meta={query.data?.meta}
        page={page}
        limit={limit}
        onPageChange={(value) => update({ page: value })}
        onLimitChange={(value) => update({ page: 1, limit: value })}
        query={query}
        renderMobileRow={(reservation, disabled) => <MobileRecordCard title={reservation.guest_name} disabled={disabled}
          status={<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            <Chip size="small" label={t(`rental:status_${reservation.status}`)} color={reservation.status === "confirmed" ? "success" : "default"} />
            {!reservation.is_active && <Chip size="small" label={t("rental:inactive")} />}
          </Stack>}
          fields={[
            { key: "in", label: t("rental:check_in_on"), value: `${reservation.check_in_on} · ${reservation.check_in_time}` },
            { key: "out", label: t("rental:check_out_on"), value: `${reservation.check_out_on} · ${reservation.check_out_time}` },
            { key: "nights", label: t("rental:nights"), value: reservation.nights },
            { key: "balance", label: t("rental:balance_due_amount"), value: formatRentalAmount(reservation.balance_due_amount, i18n.language) },
          ]}
          primaryAction={{ key: "detail", label: t("rental:open_detail"), onClick: () => onOpenReservation(reservation.id) }}
          actions={[{ key: "edit", label: t("rental:edit"), onClick: () => onEditReservation(reservation) }]} />}
        search={search}
        onSearchChange={(value) =>
          update({ page: 1, q: value ? { [searchBy]: value } : undefined })
        }
        onCreate={property.is_active ? onCreateReservation : undefined}
        columns={[
          {
            key: "guest",
            label: t("rental:guest_name"),
            render: (r) => r.guest_name,
          },
          {
            key: "stay",
            label: t("rental:stay"),
            render: (r) =>
              `${r.check_in_on} ${r.check_in_time} → ${r.check_out_on} ${r.check_out_time}`,
          },
          { key: "nights", label: t("rental:nights"), render: (r) => r.nights },
          {
            key: "status",
            label: t("rental:status"),
            render: (r) => t(`rental:status_${r.status}`),
          },
          {
            key: "archive",
            label: t("rental:active"),
            render: (r) => t(r.is_active ? "rental:active" : "rental:inactive"),
          },
          {
            key: "money",
            label: t("rental:balance_due_amount"),
            render: (r) =>
              formatRentalAmount(r.balance_due_amount, i18n.language),
          },
        ]}
        actions={(r) => [
          {
            key: "detail",
            label: t("rental:open_detail"),
            onClick: () => onOpenReservation(r.id),
          },
          {
            key: "edit",
            label: t("rental:edit"),
            onClick: () => onEditReservation(r),
          },
        ]}
      />
    </Stack>
  );
}
