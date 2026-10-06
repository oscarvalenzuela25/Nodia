import { useState } from "react";
import { Stack } from "@mui/material";
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
