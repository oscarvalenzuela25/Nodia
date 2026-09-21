import type { FC, ChangeEvent, DragEvent } from "react";
import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "../ProductModal/styles";
import {
  useBulkCreateProducts,
  useBulkUpdateProducts,
} from "../../../../../../infrastructure/useServices";
import type {
  CreateProductPayload,
  BulkUpdateProductItemPayload,
} from "../../../../../../infrastructure/types";
import { DropzoneBox, ValidBadge, ErrorBadge } from "../../../../styles";
import {
  type ProvisionalRow,
  validateRow,
  parseCSV,
  generateTemplateCSV,
} from "./helpers";

interface Props {
  businessId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export const ProductBulkImport: FC<Props> = ({
  businessId,
  onCancel,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation(["business", "core"]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<ProvisionalRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ProvisionalRow>>({});
  const [editTaxRate, setEditTaxRate] = useState<number>(19);

  // Prevent browser default behavior of opening dropped files in tab
  useEffect(() => {
    const preventBrowserFileDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventBrowserFileDrop);
    window.addEventListener("drop", preventBrowserFileDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserFileDrop);
      window.removeEventListener("drop", preventBrowserFileDrop);
    };
  }, []);

  const bulkCreateMutation = useBulkCreateProducts();
  const bulkUpdateMutation = useBulkUpdateProducts();
  const isBusy = bulkCreateMutation.isPending || bulkUpdateMutation.isPending;

  const hasErrors = useMemo(() => rows.some((r) => !r.isValid), [rows]);

  const handleDownloadTemplate = () => {
    const csvContent = generateTemplateCSV(i18n.language);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = i18n.language?.startsWith("en")
      ? "product_template_nodia.csv"
      : "plantilla_productos_nodia.csv";
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsedRows = parseCSV(text);
      setRows(parsedRows);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isBusy) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isBusy) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isBusy) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenEdit = (index: number) => {
    const row = rows[index];
    setEditingIndex(index);
    setEditFormData({ ...row });
    if (row.cost_price > 0 && row.cost_price_tax > row.cost_price) {
      const derivedTax = Math.round(
        ((row.cost_price_tax - row.cost_price) / row.cost_price) * 100
      );
      setEditTaxRate(derivedTax > 0 ? derivedTax : 19);
    } else {
      setEditTaxRate(19);
    }
  };

  const handleCostPriceChange = (cost: number) => {
    const computedTaxCost = Math.round(cost * (1 + editTaxRate / 100));
    const margin = editFormData.profit_percentage ?? 30;
    const computedSale = Math.round(computedTaxCost * (1 + margin / 100));
    setEditFormData((prev) => ({
      ...prev,
      cost_price: cost,
      cost_price_tax: computedTaxCost,
      sale_price: computedSale,
    }));
  };

  const handleTaxRateChange = (rate: number) => {
    setEditTaxRate(rate);
    const cost = editFormData.cost_price ?? 0;
    const computedTaxCost = Math.round(cost * (1 + rate / 100));
    const margin = editFormData.profit_percentage ?? 30;
    const computedSale = Math.round(computedTaxCost * (1 + margin / 100));
    setEditFormData((prev) => ({
      ...prev,
      cost_price_tax: computedTaxCost,
      sale_price: computedSale,
    }));
  };

  const handleCostPriceTaxChange = (taxCost: number) => {
    const computedCost = Math.round(taxCost / (1 + editTaxRate / 100));
    const margin = editFormData.profit_percentage ?? 30;
    const computedSale = Math.round(taxCost * (1 + margin / 100));
    setEditFormData((prev) => ({
      ...prev,
      cost_price_tax: taxCost,
      cost_price: computedCost,
      sale_price: computedSale,
    }));
  };

  const handleProfitMarginChange = (margin: number) => {
    const taxCost = editFormData.cost_price_tax ?? 0;
    const computedSale = Math.round(taxCost * (1 + margin / 100));
    setEditFormData((prev) => ({
      ...prev,
      profit_percentage: margin,
      sale_price: computedSale,
    }));
  };

  const handleSalePriceChange = (sale: number) => {
    const taxCost = editFormData.cost_price_tax ?? 0;
    let computedMargin = editFormData.profit_percentage ?? 30;
    if (taxCost > 0) {
      computedMargin = Math.max(0, Math.round(((sale - taxCost) / taxCost) * 100));
    }
    setEditFormData((prev) => ({
      ...prev,
      sale_price: sale,
      profit_percentage: computedMargin,
    }));
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const { errors, isValid } = validateRow(editFormData);
    const updatedRow: ProvisionalRow = {
      ...rows[editingIndex],
      ...editFormData,
      code: (editFormData.code ?? "").trim(),
      name: (editFormData.name ?? "").trim(),
      cost_price: Number(editFormData.cost_price ?? 0),
      cost_price_tax: Number(editFormData.cost_price_tax ?? 0),
      profit_percentage: Number(editFormData.profit_percentage ?? 0),
      sale_price: Number(editFormData.sale_price ?? 0),
      stock: Number(editFormData.stock ?? 0),
      is_active: editFormData.is_active ?? true,
      errors,
      isValid,
    };

    setRows((prev) => {
      const copy = [...prev];
      copy[editingIndex] = updatedRow;
      // Re-sort: Invalid (red) rows always first!
      return copy.sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
    });

    setEditingIndex(null);
  };

  const handleSubmitAll = async () => {
    if (rows.length === 0 || hasErrors || isBusy) return;

    const newItems: CreateProductPayload[] = [];
    const updateItems: BulkUpdateProductItemPayload[] = [];

    rows.forEach((r) => {
      if (r.id) {
        updateItems.push({
          id: r.id,
          code: r.code,
          name: r.name,
          cost_price: r.cost_price,
          cost_price_tax: r.cost_price_tax,
          profit_percentage: r.profit_percentage,
          sale_price: r.sale_price,
          stock: r.stock,
          is_active: r.is_active,
        });
      } else {
        newItems.push({
          business_id: businessId,
          code: r.code,
          name: r.name,
          cost_price: r.cost_price,
          cost_price_tax: r.cost_price_tax,
          profit_percentage: r.profit_percentage,
          sale_price: r.sale_price,
          stock: r.stock,
          is_active: r.is_active,
        });
      }
    });

    if (newItems.length > 0) {
      await bulkCreateMutation.mutateAsync(newItems);
    }
    if (updateItems.length > 0) {
      await bulkUpdateMutation.mutateAsync(updateItems);
    }

    onSuccess();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header with back button & Download template */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onCancel} sx={{ borderRadius: 2 }}>
          {t("business:back_to_catalog")}
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownloadOutlinedIcon />}
          onClick={handleDownloadTemplate}
          sx={{ borderRadius: 2 }}
        >
          {t("business:download_template_btn")}
        </Button>
      </Box>

      {/* Instructions Alert Box */}
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          {t("business:bulk_instructions_title")}
        </Typography>
        <Typography variant="body2" component="div">
          1. {t("business:bulk_instruction_1")}
          <br />
          2. {t("business:bulk_instruction_2")}
          <br />
          3. <strong>{t("business:bulk_instruction_3")}</strong>
        </Typography>
      </Alert>

      {/* Dropzone */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,text/csv"
        style={{ display: "none" }}
      />
      <DropzoneBox
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          ...(isDragging && {
            borderColor: "primary.main",
            borderStyle: "solid",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "rgba(33, 150, 243, 0.08)" : "rgba(25, 118, 210, 0.06)",
          }),
        }}
        data-testid="csv-dropzone"
      >
        <CloudUploadOutlinedIcon sx={{ fontSize: 44, color: "primary.main", mb: 1 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {fileName ? t("business:dropzone_selected", { filename: fileName }) : t("business:dropzone_prompt")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("business:bulk_csv_format_hint")}
        </Typography>
      </DropzoneBox>

      {/* Provisional Table */}
      {rows.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t("business:provisional_table_title", { count: rows.length })}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {hasErrors && (
                <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                  {t("business:must_fix_errors_warning")}
                </Typography>
              )}
              <Button
                variant="contained"
                disabled={hasErrors || rows.length === 0 || isBusy}
                onClick={handleSubmitAll}
                sx={{ borderRadius: 2 }}
                data-testid="submit-bulk-products"
              >
                {t("business:save_bulk_btn")}
              </Button>
            </Box>
          </Box>

          <TableContainer component={Paper} sx={{ borderRadius: 2, border: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={50} align="center">{t("business:product_status")}</TableCell>
                  <TableCell>{t("business:product_code")}</TableCell>
                  <TableCell>{t("business:product_name")}</TableCell>
                  <TableCell align="right">{t("business:product_cost_price")}</TableCell>
                  <TableCell align="right">{t("business:product_profit_margin")}</TableCell>
                  <TableCell align="right">{t("business:product_sale_price")}</TableCell>
                  <TableCell align="right">{t("business:product_stock")}</TableCell>
                  <TableCell align="center">{t("business:provisional_table_type")}</TableCell>
                  <TableCell align="right">{t("core:actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow
                    key={`${row.code}-${idx}`}
                    sx={{
                      backgroundColor: !row.isValid
                        ? (theme) => (theme.palette.mode === "dark" ? "rgba(244, 67, 54, 0.08)" : "rgba(244, 67, 54, 0.04)")
                        : undefined,
                    }}
                  >
                    <TableCell align="center">
                      {row.isValid ? (
                        <Tooltip title={t("business:row_valid_tooltip")}>
                          <ValidBadge data-testid="row-status-valid" />
                        </Tooltip>
                      ) : (
                        <Tooltip title={t("business:row_error_tooltip", { errors: row.errors.join(", ") })}>
                          <ErrorBadge data-testid="row-status-error" />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.code || "-"}</TableCell>
                    <TableCell>{row.name || "-"}</TableCell>
                    <TableCell align="right">${row.cost_price.toLocaleString()}</TableCell>
                    <TableCell align="right">{row.profit_percentage}%</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>${row.sale_price.toLocaleString()}</TableCell>
                    <TableCell align="right">{row.stock}</TableCell>
                    <TableCell align="center">
                      <Typography variant="caption" sx={{ fontWeight: 600, color: row.id ? "info.main" : "success.main" }}>
                        {row.id ? t("business:provisional_table_type_update") : t("business:provisional_table_type_new")}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("business:edit_row_tooltip")}>
                        <IconButton size="small" onClick={() => handleOpenEdit(idx)} data-testid={`edit-row-${idx}`}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("business:remove_row_tooltip")}>
                        <IconButton size="small" color="error" onClick={() => handleRemoveRow(idx)} data-testid={`delete-row-${idx}`}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Edit Provisional Row Dialog */}
      <BaseModal
        open={editingIndex !== null}
        onClose={() => setEditingIndex(null)}
        title={t("business:edit_provisional_product")}
        size="md"
        actions={
          <ModalActionsContainer>
            <Button
              variant="contained"
              color="error"
              onClick={() => setEditingIndex(null)}
              sx={{ borderRadius: 2, px: 2.5 }}
            >
              {t("core:cancel")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveEdit}
              sx={{ borderRadius: 2, px: 2.5 }}
            >
              {t("business:save_changes")}
            </Button>
          </ModalActionsContainer>
        }
      >
        <FormContainer
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveEdit();
          }}
        >
          {/* is_active Switch at top, matching Core pattern */}
          <SwitchWrapper>
            <StyledFormControlLabel
              control={
                <StyledSwitch
                  checked={editFormData.is_active ?? true}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                  name="is_active"
                />
              }
              label={t("business:active_label")}
              labelPlacement="start"
            />
          </SwitchWrapper>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="bulk-edit-code"
                name="code"
                label={t("business:product_code")}
                value={editFormData.code ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, code: e.target.value }))
                }
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="bulk-edit-name"
                name="name"
                label={t("business:product_name")}
                value={editFormData.name ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </Grid>

            {/* Row 2: Costo Base sin Impuesto, Impuesto % auxiliar, Costo Base con Impuestos */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="bulk-edit-cost"
                name="cost_price"
                type="number"
                label={t("business:product_cost_price")}
                value={String(editFormData.cost_price ?? 0)}
                onChange={(e) => handleCostPriceChange(Number(e.target.value))}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="bulk-edit-tax-rate"
                name="tax_rate"
                type="number"
                label={t("business:product_tax_rate")}
                value={String(editTaxRate)}
                onChange={(e) => handleTaxRateChange(Number(e.target.value))}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="bulk-edit-cost-tax"
                name="cost_price_tax"
                type="number"
                label={t("business:product_cost_tax")}
                value={String(editFormData.cost_price_tax ?? 0)}
                onChange={(e) => handleCostPriceTaxChange(Number(e.target.value))}
              />
            </Grid>

            {/* Row 3: Margen % y Precio Venta */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="bulk-edit-margin"
                name="profit_percentage"
                type="number"
                label={t("business:product_profit_margin")}
                value={String(editFormData.profit_percentage ?? 0)}
                onChange={(e) => handleProfitMarginChange(Number(e.target.value))}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="bulk-edit-sale"
                name="sale_price"
                type="number"
                label={t("business:product_sale_price")}
                value={String(editFormData.sale_price ?? 0)}
                onChange={(e) => handleSalePriceChange(Number(e.target.value))}
                required
              />
            </Grid>

            {/* Row 4: Stock */}
            <Grid size={{ xs: 12 }}>
              <TextInput
                id="bulk-edit-stock"
                name="stock"
                type="number"
                label={t("business:product_stock")}
                value={String(editFormData.stock ?? 0)}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    stock: Number(e.target.value) || 0,
                  }))
                }
                required
              />
            </Grid>
          </Grid>
        </FormContainer>
      </BaseModal>
    </Box>
  );
};

export default ProductBulkImport;
