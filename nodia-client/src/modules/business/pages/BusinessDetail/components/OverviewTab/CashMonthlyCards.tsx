import { Box, Grid, LinearProgress, Typography } from "@mui/material";
import CallReceivedOutlined from "@mui/icons-material/CallReceivedOutlined";
import CallMadeOutlined from "@mui/icons-material/CallMadeOutlined";
import { isAxiosError } from "axios";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../../../hooks/useAuth";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import { KpiCardSkeleton } from "../../../../../../components/skeletons";
import { useCashMonthlySummary } from "../../../../infrastructure/useCashServices";
import { formatCashAmount } from "../../../../infrastructure/cashValues";
import { KpiCard, KpiTop, KpiTitle, KpiValue } from "../../styles";

const cards = [
  { type: "income", title: "business:cash.monthly_income", icon: CallReceivedOutlined, color: "success" },
  { type: "expense", title: "business:cash.monthly_expense", icon: CallMadeOutlined, color: "error" },
] as const;

export default function CashMonthlyCards({ businessId }: { businessId: string }) {
  const { t, i18n } = useTranslation("business");
  const { user, sessionVersion } = useAuth();
  const query = useCashMonthlySummary({ businessId, actorId: user?.id ?? "", sessionVersion });
  const status = isAxiosError(query.error) ? query.error.response?.status : undefined;
  const report = status === 401 || status === 403 || status === 404 ? undefined : query.data;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const locale = language.startsWith("en") ? "en-US" : "es-CL";
  const month = report && new Intl.DateTimeFormat(locale, {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${report.period.from}T00:00:00Z`));

  return (
    <Box component="section" aria-label={t("business:cash.monthly_summary")} aria-busy={query.isFetching}>
      <QueryErrorAlert isError={query.isError} isFetching={query.isFetching} onRetry={query.refetch} />
      {query.isFetching && !query.isLoading && <LinearProgress sx={{ height: 2 }} />}
      <Grid container rowSpacing={3} columnSpacing={2}>
        {cards.map(({ type, title, icon: Icon, color }) => {
          const total = report?.summary[type];
          return (
            <Grid key={type} size={{ xs: 12, md: 6 }}>
              <Skeleton loading={query.isLoading} fallback={<KpiCardSkeleton />}>
                <KpiCard>
                  <Box>
                    <KpiTop>
                      <KpiTitle as="h3" sx={{ m: 0 }}>{t(title)}</KpiTitle>
                      <Icon aria-hidden color={color} fontSize="small" />
                    </KpiTop>
                    {month && <Typography variant="caption" color="text.secondary">{month}</Typography>}
                    {total && (
                      <>
                        <KpiValue sx={{ display: "block", overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>
                          {formatCashAmount(total.total_amount, locale)}
                        </KpiValue>
                        <Typography variant="body2" color="text.secondary">
                          {t("business:cash.movement_count", {
                            count: total.count,
                            formattedCount: new Intl.NumberFormat(locale).format(total.count),
                          })}
                        </Typography>
                      </>
                    )}
                  </Box>
                </KpiCard>
              </Skeleton>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
