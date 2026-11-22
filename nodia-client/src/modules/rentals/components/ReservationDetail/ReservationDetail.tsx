import { Alert, Button, Chip, LinearProgress, Typography } from "@mui/material";
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
import {
  DetailActions,
  DetailGrid,
  DetailList,
  DetailPanel,
  DetailPanels,
  DetailSkeleton,
  SummaryTags,
} from "./styles";

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
  const actionsDisabled = busy || query.isFetching || query.isError;
  const formatInstant = (instant: string) =>
    formatRentalInstant(instant, property.timezone, i18n.language);
  const formatAmount = (amount: string) =>
    formatRentalAmount(amount, i18n.language);

  return (
    <BaseModal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t("rental:reservation_detail")}
      subtitle={row?.guest_name}
      size="lg"
      disableEscapeKeyDown={busy}
    >
      <DetailList>
        {query.isFetching && !query.isLoading && (
          <LinearProgress aria-label={t("rental:reservation_detail")} />
        )}
        {query.isError && (
          <Alert
            severity="error"
            action={
              <Button disabled={busy || query.isFetching} onClick={() => void query.refetch()}>
                {t("rental:retry")}
              </Button>
            }
          >
            {t("rental:load_error")}
          </Alert>
        )}
        <Skeleton loading={query.isLoading && !row}>
          {query.isLoading && !row && <DetailSkeleton aria-hidden />}
          {!row && !query.isLoading && !query.isError && (
            <Typography color="text.secondary">{t("rental:empty")}</Typography>
          )}
          {row && (
            <DetailPanel>
              <SummaryTags>
                <Chip label={t(`rental:status_${row.status}`)} />
                <Chip variant="outlined" label={t(`rental:channel_${row.channel}`)} />
                {!row.is_active && <Chip variant="outlined" label={t("rental:inactive")} />}
              </SummaryTags>
              <DetailGrid>
                <div>
                  <dt>{t("rental:check_in_on")}</dt>
                  <dd>{formatInstant(row.check_in_at)}</dd>
                </div>
                <div>
                  <dt>{t("rental:check_out_on")}</dt>
                  <dd>{formatInstant(row.check_out_at)}</dd>
                </div>
              </DetailGrid>
              <Typography variant="body2" color="text.secondary">
                {t("rental:nights_count", { count: row.nights })} · {property.timezone}
              </Typography>
            </DetailPanel>
          )}
        </Skeleton>
        {row && (
          <>
            <DetailActions>
              {row.status === "draft" && (
                <Button
                  variant="contained"
                  disabled={actionsDisabled || !row.is_active || !property.is_active}
                  onClick={() => onConfirm(row)}
                >
                  {t("rental:confirm_reservation")}
                </Button>
              )}
              {row.status === "confirmed" && (
                <Button
                  variant="contained"
                  disabled={actionsDisabled}
                  onClick={() => onStay(row, "start")}
                >
                  {t("rental:start_stay")}
                </Button>
              )}
              {row.status === "in_progress" && (
                <Button
                  variant="contained"
                  disabled={actionsDisabled}
                  onClick={() => onStay(row, "complete")}
                >
                  {t("rental:complete_stay")}
                </Button>
              )}
              <Button variant="outlined" disabled={actionsDisabled} onClick={() => onEdit(row)}>
                {t("rental:edit")}
              </Button>
              <Button
                variant="outlined"
                disabled={actionsDisabled}
                onClick={() => onOpenPayments(row.id)}
              >
                {t("rental:payments_and_refunds")}
              </Button>
              {row.turnover_id && (
                <Button
                  variant="outlined"
                  disabled={actionsDisabled}
                  onClick={() => onOpenTurnover(row.turnover_id!)}
                >
                  {t("rental:review_preparation")}
                </Button>
              )}
              {(row.status === "draft" || row.status === "confirmed") && (
                <Button
                  variant="outlined"
                  color="error"
                  disabled={actionsDisabled}
                  onClick={() => onCancel(row)}
                >
                  {t("rental:cancel_reservation")}
                </Button>
              )}
            </DetailActions>
            <DetailPanels>
              <DetailPanel>
                <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t("rental:payments_and_refunds")}
                </Typography>
                <DetailGrid>
                  {(["balance_due_amount", "refund_due_amount", "received_amount", "refunded_amount"] as const)
                    .map((name) => (
                      <div key={name}>
                        <dt>{t(`rental:${name}`)}</dt>
                        <dd>{formatAmount(row[name])}</dd>
                      </div>
                    ))}
                </DetailGrid>
              </DetailPanel>
              <DetailPanel>
                <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t("rental:wizard_agreement")}
                </Typography>
                <DetailGrid>
                  {(["total_amount", "expected_amount", "deposit_amount", "commission_amount"] as const)
                    .map((name) => (
                      <div key={name}>
                        <dt>{t(`rental:${name}`)}</dt>
                        <dd>{formatAmount(row[name])}</dd>
                      </div>
                    ))}
                  {(["deposit_due_at", "balance_due_at", "cancelled_at"] as const)
                    .map((name) => {
                      const instant = row[name];
                      return instant && (
                        <div key={name}>
                          <dt>{t(`rental:${name}`)}</dt>
                          <dd>{formatInstant(instant)}</dd>
                        </div>
                      );
                    })}
                </DetailGrid>
              </DetailPanel>
              <DetailPanel>
                <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t("rental:wizard_guest")}
                </Typography>
                <DetailGrid>
                  <div>
                    <dt>{t("rental:guest_contact")}</dt>
                    <dd>{row.guest_contact || t("rental:not_recorded")}</dd>
                  </div>
                  <div>
                    <dt>{t("rental:guests_count")}</dt>
                    <dd>{row.guests_count}</dd>
                  </div>
                  <div>
                    <dt>{t("rental:external_reference")}</dt>
                    <dd>{row.external_reference ?? t("rental:not_recorded")}</dd>
                  </div>
                  <div>
                    <dt>{t("rental:notes")}</dt>
                    <dd>{row.notes ?? t("rental:not_recorded")}</dd>
                  </div>
                </DetailGrid>
              </DetailPanel>
              {row.policy_snapshot && (
                <DetailPanel>
                  <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
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
                      <Typography>{row.policy_snapshot.platform_reference}</Typography>
                      <Typography>{row.policy_snapshot.platform_description}</Typography>
                    </>
                  )}
                </DetailPanel>
              )}
            </DetailPanels>
            {row.cancellation_snapshot && (
              <Alert severity="info">
                {t("rental:cancellation_record_summary", {
                  days: row.cancellation_snapshot.days_before,
                  refund: row.cancellation_snapshot.refund_amount === null
                    ? t("rental:not_recorded")
                    : formatAmount(row.cancellation_snapshot.refund_amount),
                })}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              {t("rental:archive_occupancy_explanation")}
            </Typography>
          </>
        )}
      </DetailList>
    </BaseModal>
  );
}
