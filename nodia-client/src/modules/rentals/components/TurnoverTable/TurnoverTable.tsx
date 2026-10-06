import { useState } from "react";
import { useTranslation } from "react-i18next";
import RentalFilters from "../RentalFilters";
import type { RentalProperty, RentalQuery } from "../../types";
import { useRentalList, useRentalBusy } from "../../infrastructure/useServices";
import { formatRentalInstant } from "../../utils/dates";
import RentalTable from "../RentalTable";
import { Wrapper } from "./styles";
export type TurnoverTableProps = {
  property: RentalProperty;
  onOpenTurnover: (id: string) => void;
  onOpenReservation: (id: string) => void;
};
export default function TurnoverTable({
  property,
  onOpenTurnover,
  onOpenReservation,
}: TurnoverTableProps) {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useState<RentalQuery>({ page: 1, limit: 10 });
  const page = params.page ?? 1,
    limit = params.limit ?? 10;
  const update = (changes: Partial<RentalQuery>) =>
    setParams((previous) => ({ ...previous, ...changes }));
  const query = useRentalList("turnovers", property.id, params);
  const busy = useRentalBusy(property.id);
  return (
    <Wrapper>
      <RentalFilters
        resource="turnovers"
        property={property}
        query={params}
        onApply={setParams}
        disabled={busy}
      />
      <RentalTable
        title={t("rental:preparation")}
        busy={busy}
        rows={query.data?.data ?? []}
        query={query}
        meta={query.data?.meta}
        page={page}
        limit={limit}
        onPageChange={(value) => update({ page: value })}
        onLimitChange={(value) => update({ page: 1, limit: value })}
        columns={[
          {
            key: "reservation",
            label: t("rental:incoming_reservation_id"),
            render: (r) => r.incoming_reservation_id,
          },
          {
            key: "linen",
            label: t("rental:linen_ready"),
            render: (r) =>
              t(
                r.linen_ready === null
                  ? "rental:unknown"
                  : r.linen_ready
                    ? "rental:yes"
                    : "rental:no",
              ),
          },
          {
            key: "cleaning",
            label: t("rental:cleaning_status"),
            render: (r) => t(`rental:cleaning_${r.cleaning_status}`),
          },
          {
            key: "planned",
            label: t("rental:planned_ready_at"),
            render: (r) =>
              r.planned_ready_at
                ? formatRentalInstant(
                    r.planned_ready_at,
                    property.timezone,
                    i18n.language,
                  )
                : t("rental:not_recorded"),
          },
          {
            key: "actual",
            label: t("rental:ready_at"),
            render: (r) =>
              r.ready_at
                ? formatRentalInstant(
                    r.ready_at,
                    property.timezone,
                    i18n.language,
                  )
                : t("rental:not_recorded"),
          },
        ]}
        actions={(r) => [
          {
            key: "edit",
            label: t("rental:review_preparation"),
            onClick: () => onOpenTurnover(r.id),
          },
          {
            key: "reservation",
            label: t("rental:open_reservation"),
            onClick: () => onOpenReservation(r.incoming_reservation_id),
          },
        ]}
      />
    </Wrapper>
  );
}
