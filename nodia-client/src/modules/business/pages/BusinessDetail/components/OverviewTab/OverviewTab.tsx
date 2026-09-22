import type { FC } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  Grid,
  LinearProgress,
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
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import NoteAddOutlinedIcon from "@mui/icons-material/NoteAddOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";

import {
  useProducts,
  useProviders,
  useInvoices,
} from "../../../../infrastructure/useServices";
import {
  KpiCard,
  KpiTop,
  KpiLabel,
  KpiValue,
  KpiFooter,
  SectionCard,
  SectionHeader,
  SectionTitle,
} from "../../styles";

interface Props {
  businessId: string;
  onSwitchTab: (tabIndex: number) => void;
  onOpenNewProvider: () => void;
  onOpenNewProduct: () => void;
  onOpenNewInvoice: () => void;
}

export const OverviewTab: FC<Props> = ({
  businessId,
  onSwitchTab,
  onOpenNewProvider,
  onOpenNewProduct,
  onOpenNewInvoice,
}) => {
  const { t } = useTranslation(["business", "core"]);

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
  const lowStockCount = products.filter((p) => p.stock < 10).length;
  const totalInventoryVal = products.reduce(
    (acc, p) => acc + (p.stock || 0) * (p.sale_price || 0),
    0
  );

  const totalProviders = providersData?.meta?.total_items ?? providers.length;
  const activeProviders = providers.filter((p) => p.is_active).length;

  const totalInvoiced = invoices.reduce(
    (acc, inv) => acc + (inv.total_amount || 0),
    0
  );
  const paidInvoices = invoices.filter(
    (inv) => inv.data?.status === "paid" || !inv.data?.status
  );
  const pendingInvoices = invoices.filter(
    (inv) => inv.data?.status === "pending" || inv.data?.status === "overdue"
  );
  const pendingAmount = pendingInvoices.reduce(
    (acc, inv) => acc + (inv.total_amount || 0),
    0
  );
  const collectedPct = invoices.length
    ? Math.round((paidInvoices.length / invoices.length) * 100)
    : 100;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* 3 Top KPI Cards */}
      <Grid container spacing={3}>
        {/* KPI 1: Proveedores */}
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard>
            <Box>
              <KpiTop>
                <KpiLabel>{t("business:kpi_providers_title")}</KpiLabel>
                <StorefrontOutlinedIcon color="primary" fontSize="small" />
              </KpiTop>
              <Typography variant="body2" color="text.secondary">
                {t("business:kpi_providers_label")}
              </Typography>
              <KpiValue>
                {totalProviders}
                <Chip
                  label={t("business:kpi_providers_active", { count: activeProviders })}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 22, fontSize: "0.75rem", fontWeight: 600 }}
                />
              </KpiValue>
            </Box>
            <KpiFooter>
              <span>{t("business:kpi_providers_avg")}: $4,850/prov</span>
              <span style={{ fontWeight: 600 }}>Top: Proveedor Central</span>
            </KpiFooter>
          </KpiCard>
        </Grid>

        {/* KPI 2: Catálogo de Productos */}
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard>
            <Box>
              <KpiTop>
                <KpiLabel>{t("business:kpi_products_title")}</KpiLabel>
                <Inventory2OutlinedIcon color="primary" fontSize="small" />
              </KpiTop>
              <Typography variant="body2" color="text.secondary">
                {t("business:kpi_products_label")}
              </Typography>
              <KpiValue>
                {totalProducts}
                <Typography component="span" variant="subtitle2" color="text.secondary">
                  SKUs
                </Typography>
                {lowStockCount > 0 && (
                  <Chip
                    label={t("business:kpi_products_low_stock", { count: lowStockCount })}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 22, fontSize: "0.75rem", fontWeight: 600 }}
                  />
                )}
              </KpiValue>
            </Box>
            <KpiFooter>
              <span>
                {t("business:kpi_products_inventory_val")}: $
                {totalInventoryVal.toLocaleString()}
              </span>
              <span style={{ fontWeight: 600 }}>
                {t("business:kpi_products_availability")}: 98.4%
              </span>
            </KpiFooter>
          </KpiCard>
        </Grid>

        {/* KPI 3: Facturación & Finanzas */}
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard>
            <Box>
              <KpiTop>
                <KpiLabel>{t("business:kpi_invoices_title")}</KpiLabel>
                <ReceiptLongOutlinedIcon color="primary" fontSize="small" />
              </KpiTop>
              <Typography variant="body2" color="text.secondary">
                {t("business:kpi_invoices_label")}
              </Typography>
              <KpiValue>
                ${totalInvoiced.toLocaleString()}
                <Chip
                  label={`${collectedPct}% ${t("business:kpi_invoices_collected")}`}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 22, fontSize: "0.75rem", fontWeight: 600 }}
                />
              </KpiValue>
            </Box>
            <KpiFooter>
              <span>
                {t("business:kpi_invoices_pending")}: ${pendingAmount.toLocaleString()}
              </span>
              <Button
                size="small"
                onClick={() => onSwitchTab(3)}
                sx={{ textTransform: "none", p: 0, minWidth: "auto", fontSize: "0.75rem" }}
              >
                {t("business:view_all_invoices")} &rarr;
              </Button>
            </KpiFooter>
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
                onClick={() => onSwitchTab(3)}
                sx={{ textTransform: "none" }}
              >
                {t("business:view_all_invoices")}
              </Button>
            </SectionHeader>

            {invoices.length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("business:invoice_code")}</TableCell>
                    <TableCell>{t("business:invoice_provider")}</TableCell>
                    <TableCell align="right">{t("business:invoice_total")}</TableCell>
                    <TableCell align="center">{t("business:invoice_status")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.slice(0, 5).map((inv) => (
                    <TableRow key={inv.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{inv.code}</TableCell>
                      <TableCell>{inv.provider?.name ?? "Proveedor Central"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        ${(inv.total_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={
                            inv.data?.status === "overdue"
                              ? t("business:invoice_status_overdue")
                              : inv.data?.status === "pending"
                              ? t("business:invoice_status_pending")
                              : t("business:invoice_status_paid")
                          }
                          size="small"
                          color={
                            inv.data?.status === "overdue"
                              ? "error"
                              : inv.data?.status === "pending"
                              ? "warning"
                              : "success"
                          }
                          sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  {t("business:invoices_empty_desc")}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onOpenNewInvoice}
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

            <Stack spacing={2.5}>
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2">Tecnología & Software</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    54%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={54} sx={{ height: 6, borderRadius: 3 }} />
              </Box>

              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2">Logística & Despacho</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    28%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={28}
                  color="secondary"
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>

              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2">Insumos & Consumibles</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    18%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={18}
                  color="warning"
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>

              <Box sx={{ pt: 1, borderTop: (theme) => `1px solid ${theme.palette.divider}` }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  PROVEEDORES REGISTRADOS ({providers.length})
                </Typography>
                {providers.slice(0, 3).map((prov) => (
                  <Box
                    key={prov.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 0.5,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {prov.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {typeof prov.fields?.phone === "string"
                        ? prov.fields.phone
                        : typeof prov.fields?.email === "string"
                        ? prov.fields.email
                        : "Proveedor activo"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      {/* Bottom Section: Top Products (7 cols) & Quick Actions / Financial Alerts (5 cols) */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SectionCard>
            <SectionHeader>
              <SectionTitle>
                <Inventory2OutlinedIcon color="primary" fontSize="small" />
                {t("business:top_products_title")}
              </SectionTitle>
              <Button
                size="small"
                onClick={() => onSwitchTab(2)}
                sx={{ textTransform: "none" }}
              >
                Ver todos &rarr;
              </Button>
            </SectionHeader>

            {products.length > 0 ? (
              <Stack spacing={2}>
                {products.slice(0, 4).map((prod) => (
                  <Box
                    key={prod.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {prod.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        SKU: {prod.code}
                      </Typography>
                    </Box>

                    <Box sx={{ width: 140, display: { xs: "none", sm: "block" } }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="caption">Stock</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {prod.stock} u.
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, prod.stock * 2)}
                        color={prod.stock < 10 ? "warning" : "success"}
                        sx={{ height: 5, borderRadius: 2 }}
                      />
                    </Box>

                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      ${(prod.sale_price || 0).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  {t("business:products_empty_desc")}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onOpenNewProduct}
                  sx={{ mt: 1.5, borderRadius: 2 }}
                >
                  {t("business:new_product_modal_title")}
                </Button>
              </Box>
            )}
          </SectionCard>
        </Grid>

        {/* Quick Actions & Financial Alerts */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            {/* Quick Actions Card */}
            <SectionCard>
              <SectionHeader>
                <SectionTitle>
                  <BoltOutlinedIcon color="primary" fontSize="small" />
                  {t("business:quick_actions_title")}
                </SectionTitle>
              </SectionHeader>

              <Stack spacing={1.5}>
                <Button
                  variant="outlined"
                  startIcon={<PersonAddOutlinedIcon />}
                  fullWidth
                  onClick={onOpenNewProvider}
                  sx={{ justifyContent: "flex-start", borderRadius: 2, textTransform: "none" }}
                >
                  {t("business:quick_action_new_provider")}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AddCircleOutlinedIcon />}
                  fullWidth
                  onClick={onOpenNewProduct}
                  sx={{ justifyContent: "flex-start", borderRadius: 2, textTransform: "none" }}
                >
                  {t("business:quick_action_new_product")}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<NoteAddOutlinedIcon />}
                  fullWidth
                  onClick={onOpenNewInvoice}
                  sx={{ justifyContent: "flex-start", borderRadius: 2, textTransform: "none" }}
                >
                  {t("business:quick_action_new_invoice")}
                </Button>
              </Stack>
            </SectionCard>

            {/* Financial Health & Alerts */}
            <SectionCard sx={{ borderLeft: (theme) => `4px solid ${theme.palette.warning.main}` }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                <WarningAmberOutlinedIcon color="warning" />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t("business:financial_alerts_title")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    {t("business:financial_alert_message")}
                  </Typography>
                </Box>
              </Box>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default OverviewTab;
