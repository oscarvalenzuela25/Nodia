import { useState } from "react";
import { Box, Button, LinearProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import SalesReportFilters, { defaultReportFilters, reportPeriod } from "./SalesReportFilters";
import SalesReportMetrics from "./SalesReportMetrics";
import SalesReportRanking from "./SalesReportRanking";
import { useSalesReports } from "./useSalesReports";
import { ReportReadError } from "./salesReportStyles";

export default function SalesReports({ businessId }: { businessId: string }) {
  const { t } = useTranslation(["business", "core"]);
  const [defaults] = useState(defaultReportFilters);
  const [filters, setFilters] = useState(defaults);
  const { summary, top, busy } = useSalesReports(businessId, reportPeriod(filters)!, filters.metric);
  return <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
    <SalesReportFilters value={filters} defaults={defaults} disabled={busy} onApply={setFilters} />
    <Box sx={{ display: "grid", gap: 2, minWidth: 0 }} aria-busy={summary.isFetching}>
      <Typography variant="body2" color="text.secondary">America/Santiago · CLP</Typography>
      {summary.isFetching && !summary.isLoading && <LinearProgress />}
      {summary.isError && <ReportReadError severity="error" action={<Button sx={{ minHeight: 44 }} disabled={busy} onClick={() => void summary.refetch()}>{t("business:pos.retry")}</Button>}>{t("core:server_error_alert")}</ReportReadError>}
      <SalesReportMetrics summary={summary.data} loading={summary.isLoading} />
      <Typography variant="body2" color="text.secondary">{t("business:pos.report_explanation")}</Typography>
    </Box>
    <SalesReportRanking data={top.data} metric={filters.metric} loading={top.isLoading} fetching={top.isFetching} error={top.isError}
      retryDisabled={busy} onRetry={() => void top.refetch()} />
  </Box>;
}
