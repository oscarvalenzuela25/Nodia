import { useId } from "react";
import { Alert, Button, Chip, LinearProgress, Typography } from "@mui/material";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import FinanceFilters from "../FinanceFilters";
import FinanceResourceTab from "../FinanceResourceTab";
import {
  useFinanceBusy,
  useFinanceOverview,
} from "../../infrastructure/useServices";
import { formatFinanceAmount } from "../../utils/money";
import type { FinanceQuery } from "../../types";
import FinanceSummaryTable from "./FinanceSummaryTable";
import {
  CountsRow,
  MetricGrid,
  MetricHighlight,
  MetricLabel,
  MetricList,
  MetricPair,
  MetricPanel,
  MetricValue,
  OverviewContent,
  PanelHeading,
} from "./styles";

interface Props {
  query: FinanceQuery;
  onQueryChange: (query: FinanceQuery) => void;
  onViewMovements?: (query: FinanceQuery) => void;
}

const FinanceOverview = ({ query, onQueryChange, onViewMovements }: Props) => {
  const { t, i18n } = useTranslation("finance");
  const movementsHeadingId = useId();
  const balancesHeadingId = useId();
  const overview = useFinanceOverview(query);
  const financeBusy = useFinanceBusy();
  const disabled = financeBusy || overview.isLoading || overview.isFetching;
  const data = overview.data;
  const money = (value?: string) =>
    value === undefined ? "—" : formatFinanceAmount(value, i18n.language);
  const renderCounts = (counts: Record<string, number | undefined>) => (
    <CountsRow>
      {Object.entries(counts).map(([key, value]) => (
        <Chip
          key={key}
          size="small"
          label={t("finance:overview.count_item", {
            label: t(`finance:overview.${key}`),
            value: value ?? "—",
          })}
        />
      ))}
    </CountsRow>
  );

  return (
    <OverviewContent>
      <FinanceFilters
        resource="overview"
        query={query}
        onChange={onQueryChange}
        disabled={disabled}
      />
      {overview.isError && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={() => void overview.refetch()}
              disabled={disabled}
            >
              {t("finance:retry")}
            </Button>
          }
        >
          {t("finance:overview.summary_error")}
        </Alert>
      )}
      {(data || overview.isLoading) && (
        <Skeleton loading={overview.isLoading && !data}>
          <MetricGrid>
            {overview.isFetching && !overview.isLoading && (
              <LinearProgress
                aria-label={t("finance:overview.refreshing")}
                sx={{ position: "absolute", insetInline: 0, top: -5, height: 2 }}
              />
            )}
            <MetricPanel aria-labelledby={movementsHeadingId}>
              <PanelHeading id={movementsHeadingId} variant="h2">
                {t("finance:overview.filtered_movements")}
              </PanelHeading>
              <Typography variant="body2" color="text.secondary">
                {t("finance:overview.scope")}
              </Typography>
              <MetricList>
                <MetricHighlight>
                  <MetricLabel>{t("finance:overview.net")}</MetricLabel>
                  <MetricValue data-testid="finance-metric-net">
                    {money(data?.totals.net_amount)}
                  </MetricValue>
                </MetricHighlight>
                <MetricPair>
                  <MetricLabel>{t("finance:overview.income")}</MetricLabel>
                  <MetricValue data-testid="finance-metric-income">
                    {money(data?.totals.income_amount)}
                  </MetricValue>
                </MetricPair>
                <MetricPair>
                  <MetricLabel>{t("finance:overview.expense")}</MetricLabel>
                  <MetricValue data-testid="finance-metric-expense">
                    {money(data?.totals.expense_amount)}
                  </MetricValue>
                </MetricPair>
              </MetricList>
              {renderCounts({
                movement_count: data?.totals.movement_count,
                pending_count: data?.totals.pending_count,
                cancelled_count: data?.totals.cancelled_count,
              })}
            </MetricPanel>
            <MetricPanel aria-labelledby={balancesHeadingId}>
              <PanelHeading id={balancesHeadingId} variant="h2">
                {t("finance:overview.obligation_balances")}
              </PanelHeading>
              <Typography variant="body2" color="text.secondary">
                {t("finance:overview.balance_scope")}
              </Typography>
              <MetricList>
                <MetricPair>
                  <MetricLabel>{t("finance:overview.loan_remaining")}</MetricLabel>
                  <MetricValue data-testid="finance-metric-loan_remaining">
                    {money(data?.obligations.loan_remaining_amount)}
                  </MetricValue>
                </MetricPair>
                <MetricPair>
                  <MetricLabel>{t("finance:overview.debt_remaining")}</MetricLabel>
                  <MetricValue data-testid="finance-metric-debt_remaining">
                    {money(data?.obligations.debt_remaining_amount)}
                  </MetricValue>
                </MetricPair>
              </MetricList>
              {renderCounts({
                loans_count: data?.counts.loans,
                debts_count: data?.counts.debts,
              })}
            </MetricPanel>
          </MetricGrid>
        </Skeleton>
      )}
      <FinanceResourceTab
        key={`movements-${JSON.stringify(query)}`}
        resource="movements"
        query={query}
        showFilters={false}
        titleKey="finance:overview.latest"
        headingAction={
          onViewMovements && (
            <Button
              variant="outlined"
              endIcon={<ArrowForwardOutlinedIcon />}
              disabled={disabled}
              onClick={() => onViewMovements(query)}
            >
              {t("finance:view_all_movements")}
            </Button>
          )
        }
        limit={5}
      />
      {data &&
        renderCounts({
          categories_count: data.counts.categories,
          groups_count: data.counts.category_groups,
        })}
      <FinanceSummaryTable
        key={`categories-${JSON.stringify(query)}`}
        kind="categories"
        query={query}
      />
      <FinanceSummaryTable
        key={`groups-${JSON.stringify(query)}`}
        kind="category-groups"
        query={query}
      />
    </OverviewContent>
  );
};

export default FinanceOverview;
