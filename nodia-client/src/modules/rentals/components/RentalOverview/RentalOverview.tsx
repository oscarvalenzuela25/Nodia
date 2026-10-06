import { useState } from "react";
import { Alert, Button, LinearProgress, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import {
  useRentalBusy,
  useRentalOverview,
} from "../../infrastructure/useServices";
import {
  addCivilDays,
  formatRentalInstant,
  todayInZone,
} from "../../utils/dates";
import { validRentalPeriod } from "../PaymentModal/schema";
import { formatRentalAmount } from "../../utils/money";
import type { RentalProperty } from "../../types";
import { FilterRow, MetricCard, MetricGrid, OverviewStack } from "./styles";
export type RentalOverviewProps = {
  property: RentalProperty;
  onOpenReservation?: (id: string) => void;
  onOpenTurnover?: (id: string) => void;
  onViewPayments?: () => void;
  onViewExpenses?: () => void;
  onViewReservations?: () => void;
  onViewTurnovers?: () => void;
};
function Overview({
  property,
  onOpenReservation,
  onOpenTurnover,
  onViewPayments,
  onViewExpenses,
  onViewReservations,
  onViewTurnovers,
}: RentalOverviewProps) {
  const { t, i18n } = useTranslation();
  const today = todayInZone(property.timezone);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(addCivilDays(today, 1));
  const valid = validRentalPeriod(from, to);
  const overview = useRentalOverview(
    property.id,
    { from_on: from, to_on: to },
    valid,
  );
  const globalBusy = useRentalBusy(property.id);
  const busy = globalBusy || overview.isFetching;
  const data = overview.data;
  const cash = data
    ? [
        { label: "cash_received", amount: data.cash.received_amount },
        { label: "cash_refunded", amount: data.cash.refunded_amount },
        { label: "cash_paid_expenses", amount: data.cash.paid_expenses_amount },
        { label: "cash_net", amount: data.cash.net_amount },
      ]
    : [];
  const pending = data
    ? [
        {
          label: "pending_reservation_balance",
          amount: data.pending.reservation_balance_amount,
        },
        { label: "pending_refunds", amount: data.pending.refund_amount },
        { label: "pending_expenses", amount: data.pending.expense_amount },
        { label: "draft_received", amount: data.pending.draft_received_amount },
      ]
    : [];
  return (
    <OverviewStack>
      <FilterRow>
        <TextInput
          label={t("rental:from_on")}
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          disabled={busy}
        />
        <TextInput
          label={t("rental:to_on")}
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          disabled={busy}
        />
      </FilterRow>
      {!valid && (
        <Alert severity="warning">{t("rental:cash_period_invalid")}</Alert>
      )}
      <Alert severity="info">{t("rental:overview_scope")}</Alert>
      {overview.isError && (
        <Alert
          severity="error"
          action={
            <Button disabled={busy} onClick={() => void overview.refetch()}>
              {t("rental:retry")}
            </Button>
          }
        >
          {t("rental:load_error")}
        </Alert>
      )}
      {overview.isFetching && data && <LinearProgress sx={{ height: 2 }} />}
      <Skeleton loading={overview.isLoading && !data && valid}>
        <OverviewStack>
          <Typography variant="h6">{t("rental:overview_cash")}</Typography>
          <MetricGrid>
            {cash.map((metric) => (
              <MetricCard key={metric.label}>
                <Typography variant="body2" color="text.secondary">
                  {t(`rental:${metric.label}`)}
                </Typography>
                <Typography variant="h5">
                  {formatRentalAmount(metric.amount, i18n.language)}
                </Typography>
              </MetricCard>
            ))}
          </MetricGrid>
          <Typography variant="body2" color="text.secondary">
            {t("rental:overview_cash_hint")}
          </Typography>
          <Typography variant="h6">{t("rental:overview_pending")}</Typography>
          <MetricGrid>
            {pending.map((metric) => (
              <MetricCard key={metric.label}>
                <Typography variant="body2" color="text.secondary">
                  {t(`rental:${metric.label}`)}
                </Typography>
                <Typography variant="h5">
                  {metric.amount === null
                    ? t("rental:unknown")
                    : formatRentalAmount(metric.amount, i18n.language)}
                </Typography>
              </MetricCard>
            ))}
          </MetricGrid>
          {data && (
            <>
              <Typography variant="body2" color="text.secondary">
                {t("rental:as_of", {
                  date: formatRentalInstant(
                    data.as_of,
                    property.timezone,
                    i18n.language,
                  ),
                })}
              </Typography>
              <FilterRow>
                {[
                  { callback: onViewPayments, key: "view_payments" },
                  { callback: onViewExpenses, key: "view_expenses" },
                  { callback: onViewReservations, key: "view_reservations" },
                  { callback: onViewTurnovers, key: "view_turnovers" },
                ].map(
                  ({ callback, key }) =>
                    callback && (
                      <Button key={key} disabled={busy} onClick={callback}>
                        {t(`rental:${key}`)}
                      </Button>
                    ),
                )}
              </FilterRow>
              {[
                {
                  title: "upcoming_check_ins",
                  rows: data.upcoming_check_ins,
                  date: "check_in_at" as const,
                },
                {
                  title: "upcoming_check_outs",
                  rows: data.upcoming_check_outs,
                  date: "check_out_at" as const,
                },
              ].map((section) => (
                <OverviewStack key={section.title}>
                  <Typography variant="h6">
                    {t(`rental:${section.title}`)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("rental:sample_limit")}
                  </Typography>
                  {section.rows.length === 0 ? (
                    <Typography>{t("rental:empty")}</Typography>
                  ) : (
                    section.rows.map((row) => (
                      <MetricCard key={row.id}>
                        <Typography>
                          {row.guest_name} ·{" "}
                          {formatRentalInstant(
                            row[section.date],
                            property.timezone,
                            i18n.language,
                          )}{" "}
                          · {t(`rental:${row.status}`)}
                        </Typography>
                        {onOpenReservation && (
                          <Button
                            disabled={busy}
                            onClick={() => onOpenReservation(row.id)}
                          >
                            {t("rental:open_reservation")}
                          </Button>
                        )}
                      </MetricCard>
                    ))
                  )}
                </OverviewStack>
              ))}
              <OverviewStack>
                <Typography variant="h6">
                  {t("rental:pending_turnovers")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("rental:sample_limit")}
                </Typography>
                {data.pending_turnovers.length === 0 ? (
                  <Typography>{t("rental:empty")}</Typography>
                ) : (
                  data.pending_turnovers.map((row) => (
                    <MetricCard key={row.id}>
                      <Typography>
                        {t("rental:reservation")}: {row.incoming_reservation_id}{" "}
                        · {t(`rental:${row.cleaning_status}`)}
                      </Typography>
                      {onOpenTurnover && (
                        <Button
                          disabled={busy}
                          onClick={() => onOpenTurnover(row.id)}
                        >
                          {t("rental:view_turnovers")}
                        </Button>
                      )}
                    </MetricCard>
                  ))
                )}
              </OverviewStack>
            </>
          )}
        </OverviewStack>
      </Skeleton>
    </OverviewStack>
  );
}
export default function RentalOverview(props: RentalOverviewProps) {
  return <Overview key={props.property.id} {...props} />;
}
