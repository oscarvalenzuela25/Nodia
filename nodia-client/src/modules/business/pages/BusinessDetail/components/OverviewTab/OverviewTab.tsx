import type { FC } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  Grid,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import {
  useProducts,
  useProviders,
  useInvoices,
} from "../../../../infrastructure/useServices";
import {
  KpiCard,
  KpiTop,
  KpiLabel,
  KpiTitle,
  KpiValue,
  KpiFooter,
  SectionCard,
  SectionHeader,
  SectionTitle,
  ScrollablePanelContent,
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

  const { data: productsData } = useProducts({
    q: { business_id_eq: businessId },
    limit: 50,
  });
  const { data: providersData } = useProviders({
    q: { business_id_eq: businessId },
    limit: 50,
  });
  const { data: invoicesData } = useInvoices({
    q: { business_id_eq: businessId },
    limit: 50,
  });

  const products = productsData?.data ?? [];
  const providers = providersData?.data ?? [];
  const invoices = invoicesData?.data ?? [];

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

  const totalInventoryVal = products.reduce(
    (acc, p) => acc + Number(p.stock || 0) * Number(p.sale_price || 0),
    0
  );

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
      {/* 3 Top KPI Cards */}
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
                {totalProducts}
                <Typography component="span" variant="subtitle2" color="text.secondary">
                  SKUs
                </Typography>
              </KpiValue>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
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
              </Box>
            </Box>
            <KpiFooter>
              <span>
                {t("business:kpi_products_inventory_val")}: $
                {Math.round(totalInventoryVal).toLocaleString()}
              </span>
            </KpiFooter>
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
              <Box
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
              </Box>
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
                ${Math.round(selectedMonthInvoiced).toLocaleString()}
              </KpiValue>
            </Box>
          </KpiCard>
        </Grid>
      </Grid>

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

            {invoices.length > 0 ? (
              <ScrollablePanelContent data-testid="recent-invoices-scroll-panel">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("business:invoice_code")}</TableCell>
                      <TableCell>{t("business:invoice_provider")}</TableCell>
                      <TableCell align="right">{t("business:invoice_total")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{inv.code}</TableCell>
                        <TableCell>{inv.provider?.name ?? "Proveedor Central"}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          ${(inv.total_amount || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollablePanelContent>
            ) : (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  {t("business:invoices_empty_desc")}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onOpenNewInvoice?.()}
                  sx={{ mt: 1.5, borderRadius: 2 }}
                >
                  {t("business:new_invoice_btn")}
                </Button>
              </Box>
            )}
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
                label={`${activeProviders} activos`}
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
    </Box>
  );
};

export default OverviewTab;
