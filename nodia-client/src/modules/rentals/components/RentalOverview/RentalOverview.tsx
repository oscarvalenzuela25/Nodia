import DateInput from "../../../../components/inputs/DateInput";
import { useId, useState } from "react";
import { Alert, Button, LinearProgress, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
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
import {
  DashboardGrid,
  DashboardPanel,
  MetricActions,
  MetricCard,
  MetricGrid,
  MetricItem,
  OverviewStack,
  PeriodFilters,
} from "./styles";

export type RentalCashPeriod = { from_on: string; to_on: string };

export type RentalOverviewProps = {
  cashOnly?: boolean;
  property: RentalProperty;
  period?: RentalCashPeriod;
  onPeriodChange?: (period: RentalCashPeriod) => void;
  onOpenReservation?: (id: string) => void;
  onOpenTurnover?: (id: string) => void;
  onViewPayments?: () => void;
  onViewExpenses?: () => void;
  onViewReservations?: () => void;
  onViewTurnovers?: () => void;
};

function MoneyMetrics({
  metrics,
}: {
  metrics: { label: string; amount?: string | null }[];
}) {
  const { t, i18n } = useTranslation();
  return (
    <MetricGrid>
      {metrics.map(({ label, amount }) => (
        <MetricItem
          key={label}
          data-emphasized={label === "cash_net" || undefined}
        >
          <Typography component="dt" variant="body2" color="text.secondary">
            {t(`rental:${label}`)}
          </Typography>
          <Typography component="dd" variant="h6">
            {amount === undefined
              ? "—"
              : amount === null
                ? t("rental:unknown")
                : formatRentalAmount(amount, i18n.language)}
          </Typography>
        </MetricItem>
      ))}
    </MetricGrid>
  );
}

function Overview({
  cashOnly = false,
  property,
  period: requestedPeriod,
  onPeriodChange,
  onOpenReservation,
  onOpenTurnover,
  onViewPayments,
  onViewExpenses,
  onViewReservations,
  onViewTurnovers,
}: RentalOverviewProps) {
  const { t, i18n } = useTranslation();
  const cashHeading = useId();
  const pendingHeading = useId();
  const [localPeriod, setLocalPeriod] = useState(() => {
    const today = todayInZone(property.timezone);
    return { from_on: `${today.slice(0, 7)}-01`, to_on: addCivilDays(today, 1) };
  });
  const period = requestedPeriod ?? localPeriod;
  const [periodDraft, setDraft] = useState<RentalCashPeriod | null>(null);
  const draft = periodDraft ?? period;
  const valid = validRentalPeriod(draft.from_on, draft.to_on);
  const changed =
    draft.from_on !== period.from_on || draft.to_on !== period.to_on;
  const overview = useRentalOverview(
    property.id,
    period,
    validRentalPeriod(period.from_on, period.to_on),
  );
  const globalBusy = useRentalBusy(property.id);
  const busy = globalBusy || overview.isLoading || overview.isFetching;
  const response = overview.data;
  const scopeValid =
    !response ||
    (response.scope.property_id === property.id &&
      validRentalPeriod(response.scope.from_on, response.scope.to_on));
  const data = scopeValid ? response : undefined;
  const showMetrics = Boolean(data) || overview.isLoading;
  const dateFormat = new Intl.DateTimeFormat(
    i18n.language.startsWith("es") ? "es-CL" : "en-US",
    { dateStyle: "medium", timeZone: "UTC" },
  );
  const displayDate = (date: string) =>
    dateFormat.format(new Date(`${date}T00:00:00Z`));

  return (
    <OverviewStack>
      {(overview.isError || !scopeValid) && (
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
      {overview.isFetching && data && (
        <LinearProgress
          aria-label={t("rental:overview_cash")}
          sx={{ height: 2 }}
        />
      )}
      <DashboardGrid>
        <DashboardPanel aria-labelledby={cashHeading}>
          <div>
            <Typography component="h2" variant="h6" id={cashHeading}>
              {t("rental:overview_cash")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("rental:overview_scope")}
            </Typography>
          </div>
          {data && (
            <Typography variant="body2" color="text.secondary" role="status">
              {t("rental:cash_displayed_period", {
                from: displayDate(data.scope.from_on),
                to: displayDate(addCivilDays(data.scope.to_on, -1)),
              })}
            </Typography>
          )}
          {showMetrics && (
            <Skeleton loading={overview.isLoading && !data}>
              <MoneyMetrics
                metrics={[
                  { label: "cash_net", amount: data?.cash.net_amount },
                  { label: "cash_received", amount: data?.cash.received_amount },
                  { label: "cash_refunded", amount: data?.cash.refunded_amount },
                  {
                    label: "cash_paid_expenses",
                    amount: data?.cash.paid_expenses_amount,
                  },
                ]}
              />
            </Skeleton>
          )}
          <Typography variant="body2" color="text.secondary">
            {t("rental:overview_cash_hint")}
          </Typography>
          <PeriodFilters
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || !valid || !changed) return;
              if (!requestedPeriod) setLocalPeriod(draft);
              onPeriodChange?.(draft);
              setDraft(null);
            }}
          >
            <DateInput
              label={t("rental:from_on")}
              value={draft.from_on}
              onChange={(from_on) =>
                setDraft((current) => ({ ...(current ?? period), from_on }))
              }
              disabled={busy}
            />
            <DateInput
              label={t("rental:to_on")}
              value={draft.to_on}
              onChange={(to_on) =>
                setDraft((current) => ({ ...(current ?? period), to_on }))
              }
              disabled={busy}
            />
            {!valid && (
              <Alert severity="warning">{t("rental:cash_period_invalid")}</Alert>
            )}
            <Button
              type="submit"
              variant="outlined"
              disabled={busy || !valid || !changed}
            >
              {t("rental:cash_apply_period")}
            </Button>
          </PeriodFilters>
          {(onViewPayments || onViewExpenses) && (
            <MetricActions>
              {onViewPayments && (
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={onViewPayments}
                >
                  {t("rental:view_payments")}
                </Button>
              )}
              {onViewExpenses && (
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={onViewExpenses}
                >
                  {t("rental:view_expenses")}
                </Button>
              )}
            </MetricActions>
          )}
        </DashboardPanel>
        <DashboardPanel aria-labelledby={pendingHeading}>
          <div>
            <Typography component="h2" variant="h6" id={pendingHeading}>
              {t("rental:overview_pending")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("rental:cash_pending_scope")}
            </Typography>
          </div>
          {showMetrics && (
            <Skeleton loading={overview.isLoading && !data}>
              <MoneyMetrics
                metrics={[
                  {
                    label: "pending_reservation_balance",
                    amount: data?.pending.reservation_balance_amount,
                  },
                  { label: "pending_refunds", amount: data?.pending.refund_amount },
                  { label: "pending_expenses", amount: data?.pending.expense_amount },
                  { label: "draft_received", amount: data?.pending.draft_received_amount },
                ]}
              />
            </Skeleton>
          )}
          {data && (
            <Typography variant="body2" color="text.secondary">
              {t("rental:as_of", {
                date: formatRentalInstant(
                  data.as_of,
                  property.timezone,
                  i18n.language,
                ),
              })}
            </Typography>
          )}
          {(onViewReservations || onViewTurnovers) && (
            <MetricActions>
              {onViewReservations && (
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={onViewReservations}
                >
                  {t("rental:view_reservations")}
                </Button>
              )}
              {onViewTurnovers && (
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={onViewTurnovers}
                >
                  {t("rental:view_turnovers")}
                </Button>
              )}
            </MetricActions>
          )}
        </DashboardPanel>
      </DashboardGrid>
      {data && !cashOnly && (
        <>
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
              <Typography component="h2" variant="h6">
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
                      · {t(`rental:status_${row.status}`)}
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
            <Typography component="h2" variant="h6">
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
                    {t("rental:incoming_transition", {
                      id: row.incoming_reservation_id,
                    })}{" "}
                    · {t(`rental:cleaning_${row.cleaning_status}`)}
                  </Typography>
                  {onOpenTurnover && (
                    <Button
                      disabled={busy}
                      onClick={() => onOpenTurnover(row.id)}
                    >
                      {t("rental:review_preparation")}
                    </Button>
                  )}
                </MetricCard>
              ))
            )}
          </OverviewStack>
        </>
      )}
    </OverviewStack>
  );
}
export default function RentalOverview(props: RentalOverviewProps) {
  return <Overview key={props.property.id} {...props} />;
}
