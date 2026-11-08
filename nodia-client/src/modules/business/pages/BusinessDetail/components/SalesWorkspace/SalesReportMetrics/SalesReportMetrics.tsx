import { Box, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { averageClp, formatClp } from "../../../../../infrastructure/salesPolicies";
import { formatQuantity } from "../../../../../infrastructure/saleQuantities";
import type { SalesSummary } from "../../../../../infrastructure/salesTypes";
import { MetricCard, MetricContent, MetricsGrid, MetricValue } from "./styles";
export default function SalesReportMetrics({ summary, loading }: { summary: SalesSummary | undefined; loading: boolean }) {
  const { t, i18n } = useTranslation(["business", "product"]);
  const average = averageClp(summary?.average_ticket ?? null);
  const count = (value: string | undefined) => value === undefined ? "—" : new Intl.NumberFormat(i18n.language).format(BigInt(value));
  const metrics = [
    { key: "registered_sales", value: summary ? formatClp(summary.total_amount, i18n.language) : "—" },
    { key: "sales_count", value: count(summary?.sales_count) },
    { key: "units_sold", value: !summary ? "—" : summary.quantity_by_unit?.length
      ? summary.quantity_by_unit.map((entry) => `${formatQuantity(entry.quantity, i18n.language)} ${t(`product:units.${entry.measurement_unit}`)}`).join(" · ")
      : formatQuantity(summary.units_sold, i18n.language) },
    { key: "average_per_sale", value: average === null ? "—" : `≈ ${formatClp(average, i18n.language)}` },
  ];
  return <Skeleton loading={loading}><MetricsGrid>
    {metrics.map(metric => <MetricCard key={metric.key} component="article"><MetricContent>
      <Box><Typography component="h2" variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t(`business:pos.${metric.key}`)}</Typography>
        <MetricValue component="p">{metric.value}</MetricValue></Box>
      {metric.key === "average_per_sale" && <Typography variant="body2" color="text.secondary">{t("business:pos.average_per_sale_help")}</Typography>}
    </MetricContent></MetricCard>)}
  </MetricsGrid></Skeleton>;
}
