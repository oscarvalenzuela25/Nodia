import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Chip, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import useAuth from "../../../../../../hooks/useAuth";
import InputSearch from "../../../../../../components/inputs/InputSearch";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import MobileRecordCard from "../../../../../../components/MobileRecordCard";
import DateInput from "../../../../../../components/inputs/DateInput";
import Filter from "../../../../../../components/Filter";
import FilterChips from "../../../../../../components/Filter/components/FilterChips";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import { TableSkeleton } from "../../../../../../components/skeletons";
import BusinessPagination from "../../../../components/BusinessPagination";
import { getSales } from "../../../../infrastructure/salesServices";
import { formatClp } from "../../../../infrastructure/salesPolicies";
import type { Sale } from "../../../../infrastructure/salesTypes";
import { emptySalesRecordFilters, isSalesRecordStatus, SALES_RECORD_STATUSES, salesRecordFilterParams } from "./salesRecordFilters";
import { AppliedFilterRow, FilterRow, RecordsLayout, RecordsPanel, RecordsScroll, SearchArea, TableTopBar } from "./salesRecordsStyles";

interface Props { businessId: string; onOpen: (sale: Sale) => void }

export default function SalesRecords(props: Props) {
  const { isSessionActive, user, sessionVersion } = useAuth();
  const actorId = user?.id ?? "";
  // Changing actor/business remounts local filters; old observer data cannot become another scope's placeholder.
  return <ScopedSalesRecords key={JSON.stringify([actorId, sessionVersion, props.businessId])} {...props} actorId={actorId} sessionVersion={sessionVersion} enabled={isSessionActive && Boolean(actorId && props.businessId)} />;
}

function ScopedSalesRecords({ businessId, onOpen, actorId, sessionVersion, enabled }: Props & { actorId: string; sessionVersion: number; enabled: boolean }) {
  const { t, i18n } = useTranslation(["business", "core"]);
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState(emptySalesRecordFilters);
  const [draft, setDraft] = useState(emptySalesRecordFilters);
  const params = { page: page + 1, limit: 25, search: search.trim() || undefined, ...salesRecordFilterParams(applied) };
  const query = useQuery({ queryKey: ["business-sales", businessId, "list", actorId, sessionVersion, params], queryFn: () => getSales(businessId, params), enabled, placeholderData: keepPreviousData });
  const busy = query.isFetching || query.isPlaceholderData || !enabled;
  const rows = query.data?.data ?? [];
  const lastPage = Math.max(0, Math.ceil((query.data?.meta.total ?? 0) / 25) - 1);
  if (query.data && !query.isPlaceholderData && !query.isFetching && page > lastPage) setPage(lastPage);
  let invalidDraftPeriod = false;
  try { salesRecordFilterParams(draft); } catch { invalidDraftPeriod = true; }
  const hasPeriod = Boolean(applied.from || applied.through);
  const count = Number(applied.status !== null) + Number(hasPeriod);
  const date = (sale: Sale) => new Date(sale.completed_at ?? sale.created_at).toLocaleString(i18n.language, { timeZone: "America/Santiago" });
  const columns = [
    { header: t("business:pos.sale"), width: 180 }, { header: t("business:pos.date") },
    { header: t("business:pos.sale_status"), align: "center" as const }, { header: t("business:pos.payment_method") },
    { header: t("business:pos.total"), align: "right" as const }, { header: t("core:actions"), align: "right" as const },
  ];
  return <RecordsLayout>
    <FilterRow>
      <Filter title={t("business:pos.sales_filter_title")} disabled={busy} activeCount={count} applyDisabled={invalidDraftPeriod}
        onOpen={() => setDraft({ ...applied })}
        onFilter={() => { if (!invalidDraftPeriod) { setApplied({ ...draft }); setPage(0); } }}
        onClear={() => { const empty = emptySalesRecordFilters(); setDraft(empty); setApplied(empty); setPage(0); }}>
        <SelectSingleInput label={t("business:pos.sale_status")} placeholder={t("business:pos.sales_status_default")} value={draft.status} disabled={busy}
          options={SALES_RECORD_STATUSES.map((value) => ({ value, label: t(`business:pos.status_${value}`) }))}
          onChange={(value) => { if (value === null || isSalesRecordStatus(value)) setDraft((current) => ({ ...current, status: value })); }} />
        <DateInput label={t("business:pos.from")} value={draft.from} onChange={(from) => setDraft((current) => ({ ...current, from }))} disabled={busy} error={invalidDraftPeriod} />
        <DateInput label={t("business:pos.through")} value={draft.through} onChange={(through) => setDraft((current) => ({ ...current, through }))} disabled={busy} error={invalidDraftPeriod} />
        <Typography variant="caption" color="text.secondary">{t("business:pos.sales_period_help")}</Typography>
        {invalidDraftPeriod && <Alert severity="error">{t("business:pos.invalid_period")}</Alert>}
      </Filter>
      {count > 0 && <AppliedFilterRow>
      {applied.status !== null && <FilterChips label={t("business:filter_chips_status", { value: t(`business:pos.status_${applied.status}`) })} disabled={busy}
        onAction={() => { setApplied((current) => ({ ...current, status: null })); setPage(0); }} />}
      {hasPeriod && <FilterChips label={t("business:pos.sales_period_filter", { from: applied.from, through: applied.through })} disabled={busy}
        onAction={() => { setApplied((current) => ({ ...current, from: "", through: "" })); setPage(0); }} />}
      </AppliedFilterRow>}
    </FilterRow>
    <TableTopBar><SearchArea><InputSearch value={search} onChange={(value) => { setSearch(value); setPage(0); }} disabled={busy} fullWidth
      ariaLabel={t("business:pos.sales_search_label")} placeholder={t("business:pos.sales_search_placeholder")} /></SearchArea></TableTopBar>
    <QueryErrorAlert isError={query.isError} isFetching={busy} onRetry={() => { if (enabled) return query.refetch(); }} />
    <RecordsPanel>
      {query.isFetching && !query.isLoading && <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }} />}
      <Skeleton loading={query.isLoading} fallback={mobile ? undefined : <TableSkeleton columns={columns} rows={6} paperSx={{ border: 0, borderRadius: 0, boxShadow: "none" }} />}>
        {mobile ? <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
          {rows.map((sale) => <MobileRecordCard key={sale.id} title={sale.id} status={<Chip size="small" label={t(`business:pos.status_${sale.status}`)} />} disabled={busy}
            fields={[{ key: "date", label: t("business:pos.date"), value: date(sale) }, { key: "total", label: t("business:pos.total"), value: formatClp(sale.total_amount, i18n.language), fullWidth: true }, { key: "payment", label: t("business:pos.payment_method"), value: t(`business:pos.payment_${sale.payment_method}`) }]}
            primaryAction={{ key: "open", label: t("business:pos.open_sale"), onClick: () => onOpen(sale) }} />)}
          {!query.isLoading && !query.isError && rows.length === 0 && <Alert severity="info">{t("business:pos.sales_empty")}</Alert>}
          {query.isLoading && rows.length === 0 && Array.from({ length: 3 }, (_, index) => <Box key={index} sx={{ minHeight: 180 }} />)}
        </Box> : <RecordsScroll><Table sx={{ minWidth: 650 }} aria-label={t("business:pos.sales")}><TableHead><TableRow>
          {columns.map((column) => <TableCell key={column.header} align={column.align} width={column.width}>{column.header}</TableCell>)}
        </TableRow></TableHead><TableBody>
          {!query.isLoading && !query.isError && rows.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><Typography color="text.secondary">{t("business:pos.sales_empty")}</Typography></TableCell></TableRow>}
          {rows.map((sale) => <TableRow key={sale.id} hover>
            <TableCell sx={{ overflowWrap: "anywhere", maxWidth: 180 }}>{sale.id}</TableCell><TableCell>{date(sale)}</TableCell><TableCell align="center"><Chip size="small" label={t(`business:pos.status_${sale.status}`)} /></TableCell>
            <TableCell>{t(`business:pos.payment_${sale.payment_method}`)}</TableCell><TableCell align="right">{formatClp(sale.total_amount, i18n.language)}</TableCell>
            <TableCell align="right"><Button disabled={busy} onClick={() => onOpen(sale)}>{t("business:pos.open_sale")}</Button></TableCell>
          </TableRow>)}
        </TableBody></Table></RecordsScroll>}
      </Skeleton>
      {query.data && <BusinessPagination component="div" page={page} rowsPerPage={25} rowsPerPageOptions={[]} count={query.data.meta.total} onPageChange={(_, value) => { if (!busy) setPage(value); }} disabled={busy}
        labelDisplayedRows={({ from, to, count: total }) => t("business:pos.pagination", { from, to, count: total })} />}
    </RecordsPanel>
  </RecordsLayout>;
}
