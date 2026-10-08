import type { FC, MouseEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { sileo } from "sileo";

import {
  useProducts,
  useProviders,
  useInvoices,
} from "../../../../infrastructure/useServices";
import type { InvoiceEntity } from "../../../../infrastructure/types";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import { Skeleton } from "boneyard-js/react";
import { KpiCardsGridSkeleton, TableSkeleton } from "../../../../../../components/skeletons";
import InvoicePreviewModal from "../InvoicesTab/components/InvoicePreviewModal/InvoicePreviewModal";
import {
  KpiCard,
  KpiTop,
  KpiLabel,
  KpiTitle,
  KpiValue,
  SectionCard,
  SectionHeader,
  SectionTitle,
  ScrollablePanelContent,
  StatusDot,
} from "../../styles";

interface Props {
  businessId: string;
  onSwitchTab?: (tabIndex: number) => void;
  onOpenNewProvider?: () => void;
  onOpenNewProduct?: () => void;
  onOpenNewInvoice?: () => void;
}

export const OverviewTab: FC<Props> = ({
  businessId,
  onSwitchTab,
  onOpenNewInvoice,
}) => {
  const { t, i18n } = useTranslation(["business", "core"]);

  const { data: productsData, isLoading: isLoadingProducts, isError: productsError, isFetching: productsFetching, refetch: refetchProducts } = useProducts({
    all: true,
    q: {
      business_id_eq: businessId,
      s: "created_at desc",
    },
  });
  const { data: providersData, isLoading: isLoadingProviders, isError: providersError, isFetching: providersFetching, refetch: refetchProviders } = useProviders({
    all: true,
    q: {
      business_id_eq: businessId,
      s: "created_at desc",
    },
  });
  const { data: invoicesData, isLoading: isLoadingInvoices, isError: invoicesError, isFetching: invoicesFetching, refetch: refetchInvoices } = useInvoices({
    all: true,
    q: {
      business_id_eq: businessId,
      s: "created_at desc",
    },
  });

  const isLoadingOverview = isLoadingProducts || isLoadingProviders || isLoadingInvoices;

  const products = useMemo(() => productsData?.data ?? [], [productsData?.data]);
  const providers = useMemo(() => providersData?.data ?? [], [providersData?.data]);
  const invoices = useMemo(() => invoicesData?.data ?? [], [invoicesData?.data]);
  const recentInvoices = useMemo(() => invoices.slice(0, 10), [invoices]);
  const productsComplete = !productsError && !!productsData && (productsData.meta?.total_items ?? 0) <= products.length;
  const providersComplete = !providersError && !!providersData && (providersData.meta?.total_items ?? 0) <= providers.length;
  const invoicesComplete = !invoicesError && !!invoicesData && (invoicesData.meta?.total_items ?? 0) <= invoices.length;
  const isFetchingOverview = productsFetching || providersFetching || invoicesFetching;

  // Actions and preview modal state for invoices
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceEntity | null>(null);
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuInvoice, setMenuInvoice] = useState<InvoiceEntity | null>(null);

  const handleOpenActionMenu = (e: MouseEvent<HTMLElement>, inv: InvoiceEntity) => {
    e.stopPropagation();
    setActionMenuAnchorEl(e.currentTarget);
    setMenuInvoice(inv);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchorEl(null);
    setMenuInvoice(null);
  };

  const handleCopyPath = async (path?: string) => {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      sileo.success({
        title: t("business:invoice_path_copied_toast"),
        description: path,
      });
    } catch {
      sileo.error({ title: t("core:server_error_toast") });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, y, m, d] = match;
        return i18n.language.startsWith("en") ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      const locale = i18n.language.startsWith("en") ? "en-US" : "es-CL";
      return d.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  // Metrics calculation
  const totalProducts = productsData?.meta?.total_items ?? products.length;
  const normalStockCount = products.filter(
    (p) => Number(p.stock || 0) >= 10
  ).length;
  const lowStockCount = products.filter(
    (p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) < 10
  ).length;
  const outOfStockCount = products.filter(
    (p) => Number(p.stock || 0) <= 0
  ).length;

  const activeProvidersList = providers.filter((p) => p.is_active);
  const activeProviders = activeProvidersList.length;
  const inactiveProviders = providers.filter((p) => !p.is_active).length;

  const totalStock = products.reduce(
    (acc, p) => acc + Number(p.stock || 0),
    0
  );

  const formatMonthLabel = (monthKey: string, lang: string): string => {
    const [yearStr, monthStr] = monthKey.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const d = new Date(year, month, 1);
    const locale = lang.startsWith("en") ? "en-US" : "es-CL";
    const formatted = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(d);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(currentMonthKey);
    invoices.forEach((inv) => {
      const dateStr = inv.data?.issue_date || inv.created_at;
      if (dateStr) {
        const match = String(dateStr).match(/^(\d{4})-(\d{2})/);
        if (match) {
          monthsSet.add(`${match[1]}-${match[2]}`);
        }
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [invoices, currentMonthKey]);

  const selectedMonthInvoiced = useMemo(() => {
    return invoices
      .filter((inv) => {
        const dateStr = inv.data?.issue_date || inv.created_at;
        if (!dateStr) return false;
        const match = String(dateStr).match(/^(\d{4})-(\d{2})/);
        if (match) {
          return `${match[1]}-${match[2]}` === selectedMonth;
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}` === selectedMonth;
      })
      .reduce((acc, inv) => acc + Number(inv.total_amount || 0), 0);
  }, [invoices, selectedMonth]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <QueryErrorAlert isError={productsError || providersError || invoicesError} isFetching={isFetchingOverview}
        onRetry={() => Promise.all([refetchProducts(), refetchProviders(), refetchInvoices()])} />
      {isFetchingOverview && !isLoadingOverview && <LinearProgress sx={{ height: 2 }} />}
      {!isLoadingOverview && (!productsComplete || !providersComplete || !invoicesComplete) && (
        <Typography color="text.secondary" role="status">{t("business:aggregates_unavailable")}</Typography>
      )}
      {/* 3 Top KPI Cards */}
      <Skeleton
        loading={isLoadingOverview}
        fallback={<KpiCardsGridSkeleton />}
      >
        <Grid container spacing={3}>
        {/* KPI 1: Catálogo de Productos */}
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard>
            <Box>
              <KpiTop>
                <KpiTitle sx={{ mb: 0 }}>{t("business:kpi_products_label")}</KpiTitle>
                <Inventory2OutlinedIcon color="primary" fontSize="small" />
              </KpiTop>
              <KpiValue>
                {productsError ? "—" : totalProducts}
                <Typography component="span" variant="subtitle2" color="text.secondary">
                  {t("business:kpi_products_unit", "productos")}
                </Typography>
              </KpiValue>
              {productsComplete && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                <Chip
                  label={t("business:kpi_products_stock_normal", {
                    count: normalStockCount,
                    defaultValue: `${normalStockCount} stock normal`,
                  })}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 22, fontSize: "0.75rem", fontWeight: 600 }}
                  data-testid="kpi-stock-normal-chip"
                />
                <Chip
                  label={t("business:kpi_products_stock_low_badge", {
                    count: lowStockCount,
                    defaultValue: `${lowStockCount} stock bajo`,
                  })}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ height: 22, fontSize: "0.75rem", fontWeight: 600 }}
                  data-testid="kpi-stock-low-chip"
                />
                <Chip
                  label={t("business:kpi_products_stock_out", {
                    count: outOfStockCount,
                    defaultValue: `${outOfStockCount} sin stock`,
                  })}
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ height: 22, fontSize: "0.75rem", fontWeight: 600 }}
                  data-testid="kpi-stock-out-chip"
                />
              </Box>}
            </Box>
          </KpiCard>
        </Grid>

        {/* KPI 2: Cadena de Abastecimiento */}
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard>
            <Box>
              <KpiTop>
                <KpiTitle sx={{ mb: 0 }}>{t("business:kpi_providers_label")}</KpiTitle>
                <StorefrontOutlinedIcon color="primary" fontSize="small" />
              </KpiTop>
              {providersComplete && <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  flexWrap: "wrap",
                  alignItems: "center",
                  mt: 1.5,
                  minHeight: 40,
                }}
              >
                <Chip
                  label={
                    activeProviders === 1
                      ? t("business:kpi_providers_active_single", {
                          count: activeProviders,
                          defaultValue: "1 Proveedor activo",
                        })
                      : t("business:kpi_providers_active_plural", {
                          count: activeProviders,
                          defaultValue: `${activeProviders} Proveedores activos`,
                        })
                  }
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 26, fontSize: "0.8rem", fontWeight: 600 }}
                  data-testid="kpi-providers-active-chip"
                />
                <Chip
                  label={
                    inactiveProviders === 1
                      ? t("business:kpi_providers_inactive_single", {
                          count: inactiveProviders,
                          defaultValue: "1 Proveedor inactivo",
                        })
                      : t("business:kpi_providers_inactive_plural", {
                          count: inactiveProviders,
                          defaultValue: `${inactiveProviders} Proveedores inactivos`,
                        })
                  }
                  size="small"
                  color="default"
                  variant="outlined"
                  sx={{ height: 26, fontSize: "0.8rem", fontWeight: 600 }}
                  data-testid="kpi-providers-inactive-chip"
                />
              </Box>}
            </Box>
          </KpiCard>
        </Grid>

        {/* KPI 3: Rendimiento Comercial */}
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard>
            <Box>
              <KpiTop>
                <KpiLabel>{t("business:kpi_invoices_title")}</KpiLabel>
                <ReceiptLongOutlinedIcon color="primary" fontSize="small" />
              </KpiTop>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 1,
                  mb: 0.5,
                }}
              >
                <KpiTitle sx={{ mb: 0 }}>{t("business:kpi_invoices_label")}</KpiTitle>
                <Select
                  size="small"
                  disabled={isFetchingOverview}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  data-testid="kpi-invoices-month-select"
                  sx={{
                    height: 28,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: 2,
                    "& .MuiSelect-select": { py: 0.25, px: 1 },
                  }}
                >
                  {availableMonths.map((m) => (
                    <MenuItem key={m} value={m} sx={{ fontSize: "0.8rem" }}>
                      {formatMonthLabel(m, i18n.language)}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block" }}
                data-testid="kpi-invoices-month-caption"
              >
                {t("business:kpi_invoices_month_caption", {
                  month: formatMonthLabel(selectedMonth, i18n.language),
                  defaultValue: `Facturas correspondientes a ${formatMonthLabel(selectedMonth, i18n.language)}`,
                })}
              </Typography>
              <KpiValue sx={{ mt: 1 }} data-testid="kpi-invoiced-current-month">
                {invoicesComplete ? `$${Math.round(selectedMonthInvoiced).toLocaleString()}` : "—"}
              </KpiValue>
            </Box>
          </KpiCard>
        </Grid>
      </Grid>
      </Skeleton>

      {/* Middle Section: Recent Invoices (8 cols) & Key Providers (4 cols) */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <SectionCard>
            <SectionHeader>
              <SectionTitle>
                <ReceiptLongOutlinedIcon color="primary" fontSize="small" />
                {t("business:recent_invoices_title")}
              </SectionTitle>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon fontSize="small" />}
                onClick={() => onSwitchTab?.(3)}
                sx={{ textTransform: "none" }}
              >
                {t("business:view_all_invoices")}
              </Button>
            </SectionHeader>

            <Skeleton
              loading={isLoadingInvoices}
              fallback={
                <TableSkeleton
                  columns={[
                    { header: t("business:invoice_code") },
                    { header: t("business:invoice_provider") },
                    { align: "right", header: t("business:invoice_total") },
                    { header: t("business:invoice_issue_date_col") },
                    { header: t("business:invoice_path") },
                    { align: "center", header: t("business:invoice_view_file_column") },
                    { align: "center", header: t("business:active_label") },
                    { align: "right", header: t("core:actions") },
                  ]}
                  rows={4}
                  paperSx={{ borderRadius: 2 }}
                />
              }
            >
              {recentInvoices.length > 0 ? (
                <TableContainer
                  component={Paper}
                  sx={{
                    borderRadius: 3,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    boxShadow: "none",
                    overflowX: "auto",
                    scrollbarWidth: "thin",
                    "&::-webkit-scrollbar": {
                      height: 6,
                      background: "transparent",
                    },
                    "&::-webkit-scrollbar-track": {
                      background: "transparent",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      borderRadius: 9999,
                      backgroundColor: (theme) =>
                        alpha(theme.palette.text.primary, 0.2),
                      "&:hover": {
                        backgroundColor: (theme) =>
                          alpha(theme.palette.text.primary, 0.35),
                      },
                    },
                  }}
                  data-testid="recent-invoices-scroll-panel"
                >
                  <Table size="small" stickyHeader sx={{ minWidth: 650 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("business:invoice_code")}</TableCell>
                        <TableCell>{t("business:invoice_provider")}</TableCell>
                        <TableCell align="right">{t("business:invoice_total")}</TableCell>
                        <TableCell>{t("business:invoice_issue_date_col")}</TableCell>
                        <TableCell>{t("business:invoice_path")}</TableCell>
                        <TableCell align="center">{t("business:invoice_view_file_column")}</TableCell>
                        <TableCell align="center">{t("business:active_label")}</TableCell>
                        <TableCell align="right">{t("core:actions")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentInvoices.map((inv) => (
                        <TableRow key={inv.id} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {inv.code}
                            </Typography>
                          </TableCell>
                          <TableCell>{inv.provider?.name ?? "-"}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            ${(inv.total_amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDate(inv.data?.issue_date || inv.created_at)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {inv.path_storage ? (
                              <Tooltip title={t("business:invoice_copy_path_tooltip")}>
                                <Box
                                  component="button"
                                  type="button"
                                  onClick={() => handleCopyPath(inv.path_storage)}
                                  sx={{
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    maxWidth: 180,
                                    background: "none",
                                    border: (theme) => `1px dashed ${theme.palette.divider}`,
                                    borderRadius: 1.5,
                                    px: 1,
                                    py: 0.5,
                                    textAlign: "left",
                                    transition: "all 0.15s ease",
                                    "&:hover": {
                                      borderColor: "primary.main",
                                      backgroundColor: (theme) =>
                                        alpha(theme.palette.primary.main, 0.08),
                                    },
                                  }}
                                  data-testid={`invoice-path-btn-${inv.id}`}
                                >
                                  <ContentCopyIcon
                                    sx={{ fontSize: 13, color: "text.secondary", flexShrink: 0 }}
                                  />
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      color: "text.primary",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {inv.path_storage.split("/").pop() || inv.path_storage}
                                  </Typography>
                                </Box>
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                -
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {inv.path_storage ? (
                              <Tooltip title={t("business:invoice_view_file_tooltip")}>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => setPreviewInvoice(inv)}
                                  data-testid={`invoice-view-file-btn-${inv.id}`}
                                  aria-label={t("business:invoice_view_file_tooltip")}
                                >
                                  <VisibilityOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                -
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                              <StatusDot active={inv.is_active} />
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {inv.is_active ? t("business:status_active") : t("business:status_inactive")}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenActionMenu(e, inv)}
                              disabled={isFetchingOverview}
                              data-testid={`invoice-actions-btn-${inv.id}`}
                              aria-label={t("core:actions")}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : invoicesError ? null : (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("business:invoices_empty_desc")}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isFetchingOverview}
                    onClick={() => onOpenNewInvoice?.()}
                    sx={{ mt: 1.5, borderRadius: 2 }}
                  >
                    {t("business:new_invoice_btn")}
                  </Button>
                </Box>
              )}
            </Skeleton>
          </SectionCard>
        </Grid>

        {/* Key Providers Widget */}
        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <SectionCard sx={{ height: "100%" }}>
            <SectionHeader>
              <SectionTitle>
                <StorefrontOutlinedIcon color="primary" fontSize="small" />
                {t("business:key_providers_title")}
              </SectionTitle>
              <Chip
                label={providersComplete ? t("business:kpi_providers_active_plural", { count: activeProviders }) : "—"}
                size="small"
                color="success"
                variant="outlined"
              />
            </SectionHeader>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 2, mt: -1 }}
              data-testid="key-providers-explanation"
            >
              {t(
                "business:key_providers_progress_explanation",
                "Las barras de progreso indican el porcentaje del stock total de inventario asociado a cada proveedor."
              )}
            </Typography>

            <ScrollablePanelContent data-testid="key-providers-scroll-panel">
              <Stack spacing={2.5} sx={{ pr: 0.5 }}>
                {activeProvidersList.length > 0 ? (
                  activeProvidersList.map((prov) => {
                    const provStock = products
                      .filter((p) => String(p.provider_id) === String(prov.id))
                      .reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
                    const pct =
                      totalStock > 0 ? Math.round((provStock / totalStock) * 100) : 0;
                    return (
                      <Box key={prov.id} data-testid={`key-provider-progress-${prov.id}`}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            mb: 0.5,
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {prov.name}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {pct}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    );
                  })
                ) : (
                  <Box sx={{ py: 3, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("business:no_active_providers")}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </ScrollablePanelContent>
          </SectionCard>
        </Grid>
      </Grid>

      {/* 3-Dots Action Menu for Invoices */}
      <Menu
        anchorEl={actionMenuAnchorEl}
        open={Boolean(actionMenuAnchorEl)}
        onClose={handleCloseActionMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              borderRadius: 2,
              minWidth: 160,
              boxShadow: theme.shadows[3],
              border: `1px solid ${theme.palette.divider}`,
            }),
          },
          list: {
            sx: {
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              p: 1,
            },
          },
        }}
      >
        {menuInvoice?.path_storage && (
          <MenuItem
            onClick={() => {
              if (menuInvoice) setPreviewInvoice(menuInvoice);
              handleCloseActionMenu();
            }}
            sx={{ borderRadius: 1 }}
            data-testid="menu-item-preview-invoice"
          >
            <ListItemIcon>
              <VisibilityOutlinedIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText primary={t("business:invoice_view_file_tooltip")} />
          </MenuItem>
        )}

        {menuInvoice?.path_storage && (
          <MenuItem
            onClick={() => {
              if (menuInvoice?.path_storage) handleCopyPath(menuInvoice.path_storage);
              handleCloseActionMenu();
            }}
            sx={{ borderRadius: 1 }}
            data-testid="menu-item-copy-path"
          >
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t("business:invoice_copy_path_tooltip")} />
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            onSwitchTab?.(3);
            handleCloseActionMenu();
          }}
          sx={{ borderRadius: 1 }}
          data-testid="menu-item-view-all-invoices"
        >
          <ListItemIcon>
            <ArrowForwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("business:view_all_invoices")} />
        </MenuItem>
      </Menu>

      {/* Preview Invoice File Modal */}
      {previewInvoice && (
        <InvoicePreviewModal
          open={Boolean(previewInvoice)}
          onClose={() => setPreviewInvoice(null)}
          invoice={previewInvoice}
        />
      )}
    </Box>
  );
};

export default OverviewTab;
