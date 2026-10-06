import { Alert, Button, LinearProgress, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import type { RentalProperty, RentalReservation } from "../../types";
import {
  useRentalBusy,
  useRentalRecord,
} from "../../infrastructure/useServices";
import { formatRentalAmount } from "../../utils/money";
import { formatRentalInstant } from "../../utils/dates";
import { DetailList, ModalActions } from "./styles";
export type ReservationDetailProps = {
  property: RentalProperty;
  id: string;
  onClose: () => void;
  onEdit: (r: RentalReservation) => void;
  onConfirm: (r: RentalReservation) => void;
  onCancel: (r: RentalReservation) => void;
  onStay: (r: RentalReservation, command: "start" | "complete") => void;
  onOpenPayments: (reservationId: string) => void;
  onOpenTurnover: (id: string) => void;
};
export default function ReservationDetail({
  property,
  id,
  onClose,
  onEdit,
  onConfirm,
  onCancel,
  onStay,
  onOpenPayments,
  onOpenTurnover,
}: ReservationDetailProps) {
  const { t, i18n } = useTranslation();
  const query = useRentalRecord("reservations", property.id, id);
  const busy = useRentalBusy(property.id);
  const row = query.data;
  return (
    <BaseModal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t("rental:reservation_detail")}
      size="lg"
      disableEscapeKeyDown={busy}
    >
      {query.isFetching && !query.isLoading && <LinearProgress />}
      {query.isError && (
        <Alert
          severity="error"
          action={
            <Button disabled={busy} onClick={() => query.refetch()}>
              {t("rental:retry")}
            </Button>
          }
        >
          {t("rental:load_error")}
        </Alert>
      )}
      <Skeleton loading={query.isLoading}>
        <DetailList>
          <Typography variant="h6">
            {row?.guest_name ?? t("rental:reservation_detail")}
          </Typography>
          {row && (
            <>
              <Typography>{row.guest_contact}</Typography>
              <Typography>
                {t(`rental:status_${row.status}`)} ·{" "}
                {t(`rental:channel_${row.channel}`)} ·{" "}
                {t(row.is_active ? "rental:active" : "rental:inactive")}
              </Typography>
              <Typography>
                {row.check_in_on} {row.check_in_time} → {row.check_out_on}{" "}
                {row.check_out_time} ·{" "}
                {t("rental:nights_count", { count: row.nights })} ·{" "}
                {property.timezone}
              </Typography>
              {(
                [
                  "total_amount",
                  "commission_amount",
                  "expected_amount",
                  "deposit_amount",
                  "received_amount",
                  "refunded_amount",
                  "balance_due_amount",
                  "refund_due_amount",
                ] as const
              ).map((name) => (
                <Typography key={name}>
                  {t(`rental:${name}`)}:{" "}
                  {formatRentalAmount(row[name], i18n.language)}
                </Typography>
              ))}
              <Typography>
                {t("rental:external_reference")}:{" "}
                {row.external_reference ?? t("rental:not_recorded")}
              </Typography>
              <Typography>
                {t("rental:notes")}: {row.notes ?? t("rental:not_recorded")}
              </Typography>
              {(
                ["deposit_due_at", "balance_due_at", "cancelled_at"] as const
              ).map(
                (name) =>
                  row[name] && (
                    <Typography key={name}>
                      {t(`rental:${name}`)}:{" "}
                      {formatRentalInstant(
                        row[name]!,
                        property.timezone,
                        i18n.language,
                      )}
                    </Typography>
                  ),
              )}
              {row.policy_snapshot && (
                <>
                  <Typography variant="subtitle1">
                    {t("rental:frozen_policy")}
                  </Typography>
                  {row.policy_snapshot.kind === "direct" ? (
                    <>
                      <Typography>{row.policy_snapshot.policy_name}</Typography>
                      {row.policy_snapshot.rules.map((rule) => (
                        <Typography key={rule.min_days_before}>
                          {t("rental:policy_rule_summary", {
                            days: rule.min_days_before,
                            percent: rule.refund_percent,
                          })}
                        </Typography>
                      ))}
                    </>
                  ) : (
                    <>
                      <Typography>
                        {row.policy_snapshot.platform_reference}
                      </Typography>
                      <Typography>
                        {row.policy_snapshot.platform_description}
                      </Typography>
                    </>
                  )}
                </>
              )}
              {row.cancellation_snapshot && (
                <Alert severity="info">
                  {t("rental:cancellation_record_summary", {
                    days: row.cancellation_snapshot.days_before,
                    refund:
                      row.cancellation_snapshot.refund_amount === null
                        ? t("rental:not_recorded")
                        : formatRentalAmount(
                            row.cancellation_snapshot.refund_amount,
                            i18n.language,
                          ),
                  })}
                </Alert>
              )}
              <Alert severity="info">
                {t("rental:archive_occupancy_explanation")}
              </Alert>
              <ModalActions>
                <Button disabled={busy} onClick={() => onEdit(row)}>
                  {t("rental:edit")}
                </Button>
                <Button disabled={busy} onClick={() => onOpenPayments(row.id)}>
                  {t("rental:payments_and_refunds")}
                </Button>
                {row.turnover_id && (
                  <Button
                    disabled={busy}
                    onClick={() => onOpenTurnover(row.turnover_id!)}
                  >
                    {t("rental:review_preparation")}
                  </Button>
                )}
                {row.status === "draft" && (
                  <Button
                    disabled={busy || !row.is_active || !property.is_active}
                    onClick={() => onConfirm(row)}
                  >
                    {t("rental:confirm_reservation")}
                  </Button>
                )}
                {["draft", "confirmed"].includes(row.status) && (
                  <Button disabled={busy} onClick={() => onCancel(row)}>
                    {t("rental:cancel_reservation")}
                  </Button>
                )}
                {row.status === "confirmed" && (
                  <Button disabled={busy} onClick={() => onStay(row, "start")}>
                    {t("rental:start_stay")}
                  </Button>
                )}
                {row.status === "in_progress" && (
                  <Button
                    disabled={busy}
                    onClick={() => onStay(row, "complete")}
                  >
                    {t("rental:complete_stay")}
                  </Button>
                )}
              </ModalActions>
            </>
          )}
        </DetailList>
      </Skeleton>
    </BaseModal>
  );
}
