import { useId, useState } from "react";
import { Alert, Button, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { useNodiaAiReport } from "../../infrastructure/useObservation";
import { formatReportDecimal, type NodiaAiReport, type NodiaAiReportSource } from "../../infrastructure/reportSchemas";
import type { NodiaAiToolResultRef } from "../../infrastructure/types";
import { ReportTableContainer, ReportWrapper, SourceBlock } from "./styles";

type Column = NodiaAiReportSource["columns"][number];
function ReportTable({ columns, rows, busy }: { columns: Column[]; rows: NodiaAiReport["rows"]; busy: boolean }) {
  const { t, i18n } = useTranslation("nodiaAi");
  const label = (column: Column) => i18n.exists(column.label_key) ? i18n.t(column.label_key) : column.key;
  const cell = (value: string | number | boolean | null, column: Column) => value === null ? t(column.unit === null ? "reports.no_value" : "reports.unknown")
    : typeof value === "boolean" ? t(value ? "reports.true" : "reports.false")
    : column.value_type === "decimal" && typeof value === "string" ? formatReportDecimal(value, i18n.language) : String(value);
  return <ReportTableContainer tabIndex={0} role="region" aria-label={t("reports.table")} aria-busy={busy}>
    <Table size="small" sx={{ minWidth: 650 }}>
      <caption>{t("reports.groups_caption")}</caption>
      <TableHead><TableRow>{columns.map(column => <TableCell key={column.key} scope="col">{label(column)}{column.unit ? ` (${column.unit})` : ""}</TableCell>)}</TableRow></TableHead>
      <TableBody>{rows.map((row, index) => <TableRow key={index}>{row.map((value, columnIndex) => <TableCell key={columns[columnIndex].key} sx={{ whiteSpace: "nowrap" }}>{cell(value, columns[columnIndex])}</TableCell>)}</TableRow>)}</TableBody>
    </Table>
  </ReportTableContainer>;
}

function SourceReport({ source, busy }: { source: NodiaAiReportSource; busy: boolean }) {
  const { t, i18n } = useTranslation("nodiaAi");
  const [details, setDetails] = useState(false);
  const detailsId = useId();
  const sourceKey = `nodiaAi:reports.sources.${source.source_key}`;
  const label = i18n.exists(sourceKey) ? i18n.t(sourceKey) : t("reports.source", { key: source.source_key });
  const date = new Intl.DateTimeFormat(i18n.language, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" }).format(new Date(source.observed_at));
  return <SourceBlock aria-label={label}>
    <Typography component="h5" variant="subtitle2">{label} · {source.source_alias}</Typography>
    {Object.entries(source.totals).map(([name, value]) => {
      const column = source.columns.find(entry => entry.key === name);
      return <Typography key={name} variant="body1" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{t("reports.total", { label: column && i18n.exists(column.label_key) ? i18n.t(column.label_key) : name, value: formatReportDecimal(value, i18n.language), unit: column?.unit ?? t("reports.no_unit") })}</Typography>;
    })}
    {source.status === "empty" && <Typography variant="body2">{t("reports.empty")}</Typography>}
    <Typography variant="caption" color="text.secondary">{t("reports.matched", { value: formatReportDecimal(source.matched_records, i18n.language) })}</Typography>
    <Typography variant="caption" color="text.secondary">{t("reports.basis", { basis: source.basis_key })}</Typography>
    {source.period ? <Typography variant="caption" color="text.secondary">{t("reports.period", { from: source.period.from, to: source.period.to_exclusive, timezone: source.period.timezone })}</Typography>
      : <Typography variant="caption" color="text.secondary">{t("reports.no_period")}</Typography>}
    {Object.entries(source.scope).map(([name, value]) => <Typography key={name} variant="caption" color="text.secondary">{t(`reports.scope.${name}`, { value })}</Typography>)}
    <Typography variant="caption" color="text.secondary"><time dateTime={source.observed_at}>{t("reports.observed", { date })}</time></Typography>
    <Button variant="contained" disabled={busy} aria-expanded={details} aria-controls={detailsId} onClick={() => setDetails(value => !value)}>{t(details ? "reports.hide_details" : "reports.details")}</Button>
    {details && <div id={detailsId}>
      <Typography variant="body2" color="text.secondary">{t("reports.totals_complete")}</Typography>
      {source.rows.length ? <ReportTable columns={source.columns} rows={source.rows} busy={busy} /> : <Typography variant="body2">{t("reports.no_groups")}</Typography>}
      {!source.group_page_complete && <Alert severity="info">{t("reports.more_groups")}</Alert>}
    </div>}
  </SourceBlock>;
}

export default function ReportObservation({ resultRef }: { resultRef: NodiaAiToolResultRef }) {
  const { t } = useTranslation("nodiaAi");
  const query = useNodiaAiReport(resultRef);
  const [compare, setCompare] = useState(false);
  const comparisonId = useId();
  const report = query.data;
  return <ReportWrapper aria-label={t("reports.title")}>
    {query.isFetching && !query.isLoading && <LinearProgress aria-label={t("refreshing")} />}
    {query.isError && <Alert severity="error" action={<Button variant="contained" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t(query.accessRejected ? "observation.result_restricted" : "observation.result_error")}</Alert>}
    <Skeleton loading={query.isLoading}>
      {!report && !query.isLoading && !query.isError && <Typography variant="body2">{t("reports.unavailable")}</Typography>}
      {report && <>
        <Typography component="h4" variant="subtitle1">{t("reports.title")}</Typography>
        <Typography variant="body2" color="text.secondary">{t("reports.independent")}</Typography>
        {report.status === "partial" && <Alert severity="warning">{t("reports.partial")}</Alert>}
        {report.status === "needs_clarification" && <Alert severity="info">{t("reports.clarification")}</Alert>}
        {report.source_results.map(source => <SourceReport key={source.source_alias} source={source} busy={query.isFetching} />)}
        {report.source_errors.map(item => <Alert severity="warning" key={item.source_alias}>{t("reports.failed_source", { alias: item.source_alias })}</Alert>)}
        {report.combine === "compare_compatible" && report.source_results.length > 0 && <>
          <Button variant="contained" disabled={query.isFetching} aria-expanded={compare} aria-controls={comparisonId} onClick={() => setCompare(value => !value)}>{t(compare ? "reports.hide_comparison" : "reports.comparison")}</Button>
          {compare && <div id={comparisonId}><Typography variant="body2">{t("reports.comparison_note")}</Typography><ReportTable columns={report.columns} rows={report.rows} busy={query.isFetching} /></div>}
        </>}
      </>}
    </Skeleton>
  </ReportWrapper>;
}
