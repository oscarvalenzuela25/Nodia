import { Alert, Button, Chip, LinearProgress, Typography } from "@mui/material";
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
  MetricPanel,
  MetricValue,
  OverviewStack,
} from "./styles";

interface Props {
  query: FinanceQuery;
  onQueryChange: (query: FinanceQuery) => void;
  onViewMovements?: (query: FinanceQuery) => void;
}

const FinanceOverview = ({ query, onQueryChange, onViewMovements }: Props) => {
  const { t, i18n } = useTranslation("finance");
  const overview = useFinanceOverview(query);
  const financeBusy = useFinanceBusy();
  const disabled = financeBusy || overview.isLoading || overview.isFetching;
  const data = overview.data;
  const money = (value?: string) =>
    value === undefined ? "—" : formatFinanceAmount(value, i18n.language);
  const totals = [
    {
      key: "income",
      value: money(data?.totals.income_amount),
      color: "success.main",
    },
    {
      key: "expense",
      value: money(data?.totals.expense_amount),
      color: "error.main",
    },
    {
      key: "net",
      value: money(data?.totals.net_amount),
      color: "text.primary",
    },
    {
      key: "loan_remaining",
      value: money(data?.obligations.loan_remaining_amount),
      color: "text.primary",
    },
    {
      key: "debt_remaining",
      value: money(data?.obligations.debt_remaining_amount),
      color: "text.primary",
    },
  ];

  return (
    <OverviewStack>
      <FinanceFilters
        resource="overview"
        query={query}
        onChange={onQueryChange}
        disabled={disabled}
      />
      <Typography variant="body2" color="text.secondary">
        {t("finance:overview.subtitle")}
      </Typography>
      <Alert severity="info">{t("finance:overview.scope")}</Alert>
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
      {overview.isFetching && !overview.isLoading && (
        <LinearProgress sx={{ height: 2 }} />
      )}
      {(data || overview.isLoading) && (
        <Skeleton loading={overview.isLoading && !data}>
          <MetricGrid>
            {totals.map(({ key, value, color }) => (
              <MetricPanel key={key}>
                <Typography variant="body2" color="text.secondary">
                  {t(`finance:overview.${key}`)}
                </Typography>
                <MetricValue
                  sx={{ color }}
                  data-testid={`finance-metric-${key}`}
                >
                  {value}
                </MetricValue>
              </MetricPanel>
            ))}
            <MetricPanel>
              <Typography variant="body2" color="text.secondary">
                {t("finance:overview.movement_count")}
              </Typography>
              <MetricValue>{data?.totals.movement_count ?? "—"}</MetricValue>
              <CountsRow>
                <Chip
                  size="small"
                  label={`${t("finance:overview.pending_count")}: ${data?.totals.pending_count ?? "—"}`}
                />
                <Chip
                  size="small"
                  label={`${t("finance:overview.cancelled_count")}: ${data?.totals.cancelled_count ?? "—"}`}
                />
              </CountsRow>
            </MetricPanel>
          </MetricGrid>
        </Skeleton>
      )}
      {data && (
        <CountsRow>
          <Chip
            label={`${t("finance:overview.categories_count")}: ${data.counts.categories}`}
          />
          <Chip
            label={`${t("finance:overview.groups_count")}: ${data.counts.category_groups}`}
          />
          <Chip
            label={`${t("finance:overview.loans_count")}: ${data.counts.loans}`}
          />
          <Chip
            label={`${t("finance:overview.debts_count")}: ${data.counts.debts}`}
          />
        </CountsRow>
      )}
      <Alert severity="info">{t("finance:overview.balance_scope")}</Alert>
      {data?.totals.movement_count === 0 && !overview.isError && (
        <Alert severity="info">{t("finance:overview.empty")}</Alert>
      )}
      <FinanceResourceTab
        key={`movements-${JSON.stringify(query)}`}
        resource="movements"
        query={query}
        showFilters={false}
        titleKey="finance:overview.latest"
        limit={5}
      />
      {onViewMovements && (
        <Button
          variant="outlined"
          disabled={disabled}
          onClick={() => onViewMovements(query)}
          sx={{ alignSelf: { xs: "stretch", sm: "flex-end" } }}
        >
          {t("finance:view_all_movements")}
        </Button>
      )}
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
    </OverviewStack>
  );
};

export default FinanceOverview;
