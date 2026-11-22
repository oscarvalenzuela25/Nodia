import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Chip } from "@mui/material";
import RentalFilters from "../RentalFilters";
import type { RentalProperty, RentalQuery, RentalTurnover } from "../../types";
import { useRentalList, useRentalBusy } from "../../infrastructure/useServices";
import { formatRentalInstant } from "../../utils/dates";
import RentalTable from "../RentalTable";
import MobileRecordCard from "../../../../components/MobileRecordCard";
import { Wrapper } from "./styles";
export type TurnoverTableProps = {
  property: RentalProperty;
  onOpenTurnover: (id: string) => void;
  onOpenReservation: (id: string) => void;
};

const cleaningColor = {
  pending: "warning",
  in_progress: "info",
  completed: "success",
} as const;

export default function TurnoverTable({
  property,
  onOpenTurnover,
  onOpenReservation,
}: TurnoverTableProps) {
  const { t, i18n } = useTranslation();
  const reservationLabel = useId();
  const [params, setParams] = useState<RentalQuery>({ page: 1, limit: 10 });
  const page = params.page ?? 1,
    limit = params.limit ?? 10;
  const update = (changes: Partial<RentalQuery>) =>
    setParams((previous) => ({ ...previous, ...changes }));
  const query = useRentalList("turnovers", property.id, params);
  const busy = useRentalBusy(property.id);
  const controlsDisabled = busy || query.isFetching || query.isLoading;
  const linenStatus = (row: RentalTurnover) =>
    t(
      row.linen_ready === null
        ? "rental:unknown"
        : row.linen_ready
          ? "rental:yes"
          : "rental:no",
    );
  const cleaningStatus = (row: RentalTurnover) => (
    <Chip
      component="span"
      size="small"
      variant="outlined"
      color={cleaningColor[row.cleaning_status]}
      label={t(`rental:cleaning_${row.cleaning_status}`)}
    />
  );
  const timeOrNotRecorded = (value: string | null) =>
    value
      ? formatRentalInstant(value, property.timezone, i18n.language)
      : t("rental:not_recorded");
  const reviewAction = (row: RentalTurnover) => ({
    key: "edit",
    label: t("rental:review_preparation"),
    onClick: () => onOpenTurnover(row.id),
    disabled: controlsDisabled,
  });

  return (
    <Wrapper>
      <RentalFilters
        resource="turnovers"
        property={property}
        query={params}
        onApply={setParams}
        disabled={controlsDisabled}
      />
      <RentalTable
        renderMobileRow={(r, cardBusy, actions) => (
          <MobileRecordCard
            title={t("rental:configuration_view.preparation_for", {
              id: r.incoming_reservation_id,
            })}
            disabled={cardBusy}
            actions={actions}
            primaryAction={reviewAction(r)}
            fields={[
              {
                key: "linen",
                label: t("rental:linen_ready"),
                value: linenStatus(r),
              },
              {
                key: "cleaning",
                label: t("rental:cleaning_status"),
                value: cleaningStatus(r),
              },
              {
                key: "planned",
                label: t("rental:planned_ready_at"),
                value: timeOrNotRecorded(r.planned_ready_at),
                fullWidth: true,
              },
              {
                key: "actual",
                label: t("rental:ready_at"),
                value: timeOrNotRecorded(r.ready_at),
                fullWidth: true,
              },
            ]}
          />
        )}
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
            render: (row) => (
              <span id={`${reservationLabel}-${row.id}`}>
                {t("rental:incoming_transition", {
                  id: row.incoming_reservation_id,
                })}
              </span>
            ),
          },
          {
            key: "linen",
            label: t("rental:linen_ready"),
            render: linenStatus,
          },
          {
            key: "cleaning",
            label: t("rental:cleaning_status"),
            render: cleaningStatus,
          },
          {
            key: "planned",
            label: t("rental:planned_ready_at"),
            render: (r) => timeOrNotRecorded(r.planned_ready_at),
          },
          {
            key: "actual",
            label: t("rental:ready_at"),
            render: (r) => timeOrNotRecorded(r.ready_at),
          },
          {
            key: "review",
            label: t("rental:preparation"),
            render: (row) => {
              const action = reviewAction(row);
              return (
                <Button
                  variant="outlined"
                  size="small"
                  aria-describedby={`${reservationLabel}-${row.id}`}
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              );
            },
          },
        ]}
        actions={(r) => [
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
