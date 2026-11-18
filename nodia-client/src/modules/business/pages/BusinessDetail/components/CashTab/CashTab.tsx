import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, LinearProgress, useMediaQuery, useTheme } from "@mui/material";
import CallReceivedOutlined from "@mui/icons-material/CallReceivedOutlined";
import CallMadeOutlined from "@mui/icons-material/CallMadeOutlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import useAuth from "../../../../../../hooks/useAuth";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import InputSearch from "../../../../../../components/inputs/InputSearch";
import BusinessPagination from "../../../../components/BusinessPagination";
import type { CashScope, CashMovement, CashMovementType } from "../../../../infrastructure/cashTypes";
import { useCashCategory, useCashMovements } from "../../../../infrastructure/useCashServices";
import { trimCashText } from "../../../../infrastructure/cashValues";
import { CashMovementDialog, CashCategoryDrawer } from "./CashEditors";
import { CashActivityDialog } from "./CashActivityDialog";
import { CashAppliedFilters, CashFiltersButton } from "./CashFiltersBar";
import { CashRecords, CashTotals } from "./CashRecords";
import { cashFilterCriteria, defaultCashFilters, validCashSearch } from "./cashFilters";
import { cashPeriodLabel } from "./cashLabels";
import type { CashFilters } from "./cashFilters";
import { CashLayout, CashRecordsPanel, CashToolbar, CashToolbarActions, SearchArea } from "./styles";

interface CashTabProps {
  businessId: string;
  onEditInvoice: (invoiceId: string) => void;
}
type Editor =
  | { mode: "create"; type: CashMovementType }
  | { mode: "edit"; movement: Extract<CashMovement, { source: "manual" }> };

const MAX_PAGE = 100_000;

export default function CashTab(props: CashTabProps) {
  const auth = useAuth();
  const scope = { businessId: props.businessId, actorId: auth.user?.id ?? "", sessionVersion: auth.sessionVersion };
  return <ScopedCashTab key={JSON.stringify(scope)} scope={scope} active={auth.isSessionActive} onEditInvoice={props.onEditInvoice} />;
}

function ScopedCashTab({
  scope,
  active,
  onEditInvoice,
}: Pick<CashTabProps, "onEditInvoice"> & { scope: CashScope; active: boolean }) {
  const { t, i18n } = useTranslation(["business", "core"]);
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const dateLocale = locale.startsWith("es") ? "es-CL" : locale;
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeZone: "UTC" }), [dateLocale]);
  const formatDate = (value: string) => dateFormatter.format(new Date(`${value}T00:00:00Z`));
  const [filters, setFilters] = useState(defaultCashFilters);
  const [search, setSearch] = useState({ draft: "", applied: "" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [activityMovement, setActivityMovement] = useState<CashMovement | null>(null);
  const toolbarOpener = useRef<HTMLButtonElement | null>(null);
  const restoreToolbarFocus = useRef(false);

  const query = useCashMovements(scope, {
    page,
    limit,
    search: search.applied || undefined,
    ...cashFilterCriteria(filters),
  });
  const code = isAxiosError(query.error) ? query.error.response?.status : undefined;
  const accessUndetermined = code === 401 || code === 403 || code === 404;
  const snapshot = accessUndetermined ? undefined : query.data;
  const lastPage = Math.max(1, Math.min(snapshot?.meta.total_pages ?? 1, MAX_PAGE));
  if (snapshot && !query.isFetching && !query.isPlaceholderData && !query.isError && page > lastPage) setPage(lastPage);

  // Keep the selected category named across catalog paging. Refresh it when
  // its name changes independently of the movement response.
  const selected = useCashCategory(scope, filters.category?.id, !accessUndetermined);
  const applied = selected.data
    ? { ...filters, category: { id: selected.data.id, name: selected.data.name } }
    : filters;
  const period = cashPeriodLabel(applied, formatDate, t);
  const anotherEditor = Boolean(editor || categoriesOpen || activityMovement);
  const disabled = !active || accessUndetermined;
  const busy = disabled || query.isFetching || query.isPlaceholderData || anotherEditor;

  useEffect(() => {
    if (busy || !restoreToolbarFocus.current) return;
    const frame = requestAnimationFrame(() => {
      restoreToolbarFocus.current = false;
      const opener = toolbarOpener.current;
      toolbarOpener.current = null;
      if (opener?.isConnected && !opener.disabled) opener.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [busy]);

  const applyFilters = (next: CashFilters) => {
    if (busy) return;
    setFilters(next);
    setPage(1);
  };
  const editMovement = (movement: CashMovement) => {
    if (busy || query.isError) return;
    if (movement.source === "invoice") onEditInvoice(movement.invoice.id);
    else {
      toolbarOpener.current = null;
      setEditor({ mode: "edit", movement });
    }
  };
  const startMovement = (type: CashMovementType, opener: HTMLButtonElement) => {
    toolbarOpener.current = opener;
    setEditor({ mode: "create", type });
  };
  const closeMovement = () => {
    restoreToolbarFocus.current = Boolean(toolbarOpener.current);
    setEditor(null);
  };

  return (
    <CashLayout role="region" aria-label={t("business:tab_cash")}>
      <CashToolbar>
        <CashFiltersButton scope={scope} applied={applied} onApply={applyFilters} disabled={busy} />
        <CashToolbarActions>
          <Button variant="contained" color="success" startIcon={<CallReceivedOutlined />} onClick={(event) => startMovement("income", event.currentTarget)} disabled={busy}>
            {t("business:cash.add_income")}
          </Button>
          <Button variant="contained" color="error" startIcon={<CallMadeOutlined />} onClick={(event) => startMovement("expense", event.currentTarget)} disabled={busy}>
            {t("business:cash.add_expense")}
          </Button>
          <Button variant="outlined" startIcon={<CategoryOutlined />} onClick={(event) => {
            toolbarOpener.current = event.currentTarget;
            setCategoriesOpen(true);
          }} disabled={busy}>
            {t("business:cash.categories")}
          </Button>
        </CashToolbarActions>
      </CashToolbar>
      <CashAppliedFilters applied={applied} period={period} onApply={applyFilters} disabled={busy} />
      <QueryErrorAlert isError={query.isError} isFetching={!active || query.isFetching} onRetry={() => query.refetch()} />
      <CashTotals summary={snapshot?.summary} loading={query.isLoading} period={period} />
      <SearchArea>
        <InputSearch
          value={search.draft}
          onChange={(value) => {
            const valid = validCashSearch(value);
            setSearch((previous) => ({ draft: value, applied: valid ? trimCashText(value) : previous.applied }));
            if (valid) setPage(1);
          }}
          ariaLabel={t("business:cash.search")}
          placeholder={t("business:cash.search")}
          disabled={busy}
          fullWidth
        />
        {!validCashSearch(search.draft) && <Alert severity="warning">{t("business:cash.search_invalid")}</Alert>}
      </SearchArea>
      <CashRecordsPanel aria-busy={query.isFetching}>
        {query.isFetching && !query.isLoading && <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }} />}
        <CashRecords
          rows={snapshot?.data ?? []}
          loading={query.isLoading}
          hasSnapshot={Boolean(snapshot)}
          mobile={mobile}
          disabled={busy || query.isError}
          formatDate={formatDate}
          onEdit={editMovement}
          onToggle={setActivityMovement}
        />
        {snapshot && (
          <BusinessPagination
            component="div"
            page={Math.min(snapshot.meta.page, lastPage) - 1}
            rowsPerPage={limit}
            rowsPerPageOptions={[10, 25, 50, 100]}
            count={snapshot.meta.total_items}
            disabled={busy}
            labelRowsPerPage={t("core:rows_per_page")}
            labelDisplayedRows={({ from, to, count }) => t("core:displayed_rows", { from, to, count })}
            onPageChange={(_, value) => { if (!busy && value < MAX_PAGE) setPage(value + 1); }}
            onRowsPerPageChange={(event) => {
              if (busy) return;
              setLimit(Number(event.target.value));
              setPage(1);
            }}
          />
        )}
      </CashRecordsPanel>

      {editor && <CashMovementDialog scope={scope} editor={editor} disabled={disabled} onClose={closeMovement} />}
      <CashCategoryDrawer scope={scope} open={categoriesOpen} disabled={disabled} onClose={() => {
        restoreToolbarFocus.current = true;
        setCategoriesOpen(false);
      }} />
      {activityMovement && (
        <CashActivityDialog
          scope={scope}
          movement={activityMovement}
          disabled={disabled}
          onClose={() => setActivityMovement(null)}
        />
      )}
    </CashLayout>
  );
}
