import axios from "axios";
import { sileo } from "sileo";
import BusinessWorkflow from "../../../../../../components/BusinessWorkflow";
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
import SelectSingleInput from "../../../../../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "../ProductModal/styles";
import PriceSuggestion from "../PriceSuggestion";
import { calculateProductPricing, validProductTaxRate, type ProductPricingField } from "../ProductModal/productPricing";
import { MEASUREMENT_UNITS, isMeasurementUnit } from "../../../../../../infrastructure/measurementUnits";
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
  productImportPayload,
  parseNumber,
} from "./helpers";

interface Props {
  businessId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

const ProductBulkImportEditor: FC<Props> = ({
  businessId,
  onCancel,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation(["business", "core", "product"]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileGeneration = useRef(0);
  const submitting = useRef(false);
  const unknownCreation = useRef(false);
  const [creationUnknown, setCreationUnknown] = useState(false);

  const [rows, setRows] = useState<ProvisionalRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ProvisionalRow>>({});
  const [editPricingError, setEditPricingError] = useState<ProductPricingField | null>(null);
  const [editTaxRate, setEditTaxRate] = useState<number>(19);

  // Prevent browser default behavior of opening dropped files in tab
  useEffect(() => {
    const reads = fileGeneration;
    const preventBrowserFileDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventBrowserFileDrop);
    window.addEventListener("drop", preventBrowserFileDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserFileDrop);
      window.removeEventListener("drop", preventBrowserFileDrop);
      reads.current++;
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
    URL.revokeObjectURL(url);
  };

  const processFile = (file: File) => {
    if (isBusy || submitting.current || unknownCreation.current) return;
    const generation = ++fileGeneration.current;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (generation !== fileGeneration.current) return;
      try {
        const parsedRows = parseCSV(String(event.target?.result ?? ""));
        setRows(parsedRows); setFileName(file.name);
      } catch {
        sileo.error({ title: t("business:pos.invalid_field") });
      }
    };
    reader.onerror = () => { if (generation === fileGeneration.current) sileo.error({ title: t("business:pos.invalid_field") }); };
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
    if (isBusy || submitting.current || unknownCreation.current) return;
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenEdit = (index: number) => {
    if (isBusy || submitting.current || unknownCreation.current) return;
    const row = rows[index];
    setEditingIndex(index);
    setEditPricingError(null);
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

  const updateCost = (source: ProductPricingField, value: number) => {
    const rate = source === "tax_rate" ? value : editTaxRate;
    if (source === "tax_rate") setEditTaxRate(value);
    const current = { cost_price: editFormData.cost_price ?? Number.NaN, cost_price_tax: editFormData.cost_price_tax ?? Number.NaN, sale_price: editFormData.sale_price ?? Number.NaN };
    const failedCost = editPricingError === "cost_price" || editPricingError === "cost_price_tax" ? editPricingError : null;
    const calculationSource = source === "tax_rate" && failedCost ? failedCost : source;
    const calculationValue = source === "tax_rate" && failedCost ? current[failedCost] : value;
    const result = calculateProductPricing(calculationSource, calculationValue, current, rate);
    setEditPricingError(result.valid ? null : calculationSource);
    setEditFormData(previous => ({ ...previous, ...(source === "tax_rate" ? {} : { [source]: value }), ...(result.valid ? result.values : {}) }));
  };
  const handleCostPriceChange = (cost: number) => updateCost("cost_price", cost);
  const handleTaxRateChange = (rate: number) => updateCost("tax_rate", rate);
  const handleCostPriceTaxChange = (cost: number) => updateCost("cost_price_tax", cost);
  const handleSalePriceChange = (sale: number) => setEditFormData(previous => ({ ...previous, sale_price: sale }));

  const handleSaveEdit = () => {
    if (editingIndex === null || isBusy || Boolean(editPricingError) || !validProductTaxRate(editTaxRate)) return;

    const { errors, isValid } = validateRow(editFormData);
    const updatedRow: ProvisionalRow = {
      ...rows[editingIndex],
      ...editFormData,
      code: editFormData.code === undefined ? undefined : editFormData.code?.trim() || null,
      name: (editFormData.name ?? "").trim(),
      cost_price: Number(editFormData.cost_price ?? Number.NaN),
      cost_price_tax: Number(editFormData.cost_price_tax ?? Number.NaN),
      sale_price: Number(editFormData.sale_price ?? Number.NaN),
      stock: rows[editingIndex].stock,
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
    if (rows.length === 0 || hasErrors || isBusy || submitting.current || unknownCreation.current) return;

    const newItems: CreateProductPayload[] = [];
    const updateItems: BulkUpdateProductItemPayload[] = [];

    fileGeneration.current++; // Discard a previously selected file that finishes reading after submission starts.
    const submittedRows = rows;
    submittedRows.forEach(row => {
      const payload = productImportPayload(row, businessId);
      if ("id" in payload) updateItems.push(payload);
      else newItems.push(payload);
    });

    submitting.current = true;
    let creating = false;
    let invalidCreationReceipt = false;
    try {
      if (newItems.length > 0) {
        creating = true;
        const created = await bulkCreateMutation.mutateAsync(newItems);
        const completeReceipt = Array.isArray(created)
          && created.length === newItems.length
          && created.every(product => product && typeof product.id === "string" && product.id && Number.isSafeInteger(product.version) && (product.version ?? 0) > 0)
          && new Set(created.map(product => product.id)).size === newItems.length;
        if (!completeReceipt) {
          invalidCreationReceipt = true;
          throw new Error("Invalid bulk creation receipt");
        }
        const createdByRow = new Map(submittedRows.filter(row => !row.id).map((row, index) => [row, created[index]]));
        setRows(previous => previous.map(row => {
          const product = createdByRow.get(row);
          return product ? { ...row, id: product.id, version: product.version } : row;
        }));
        creating = false;
      }
      if (updateItems.length > 0) await bulkUpdateMutation.mutateAsync(updateItems);
      onSuccess();
    } catch (error) {
      // A complete creation response is the only safe source of newly assigned IDs.
      // Code-less products cannot be rediscovered by an empty code or guessed name.
      if (creating && !(axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 408)) {
        unknownCreation.current = true;
        setCreationUnknown(true);
      }
      if (invalidCreationReceipt) sileo.error({ title: t("core:server_error_toast") });
      // Mutation hooks own HTTP feedback. Keep rows and successful record identities for correction.
    } finally { submitting.current = false; }
  };

  return (
    <BusinessWorkflow>
      {/* Header with back button & Download template */}
      <Box data-business-toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
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

      {creationUnknown && <Alert severity="warning">{t("product:bulk_create_unknown")}</Alert>}

      {/* Dropzone */}
      <input
        type="file"
        disabled={isBusy || creationUnknown}
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
          <Box data-business-toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
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
                disabled={hasErrors || rows.length === 0 || isBusy || creationUnknown}
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
                  <TableCell>{t("product:measurement_unit")}</TableCell>
                  <TableCell align="right">{t("business:product_cost_price")}</TableCell>
                  <TableCell align="right">{t("business:product_sale_price")}</TableCell>
                  <TableCell align="right">{t("business:pos.availability")}</TableCell>
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
                    <TableCell>{row.measurement_unit ? (isMeasurementUnit(row.measurement_unit) ? t(`product:units.${row.measurement_unit}`) : row.measurement_unit) : t(row.id ? "business:pos.preserve_existing" : "product:units.unit")}</TableCell>
                    <TableCell align="right">${row.cost_price.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>${row.sale_price.toLocaleString()}</TableCell>
                    <TableCell align="right">{typeof row.has_stock === "boolean" ? t(row.has_stock ? "business:pos.available" : "business:pos.unavailable") : t(row.id ? "business:pos.preserve_existing" : "business:pos.availability_unknown")}</TableCell>
                    <TableCell align="center">
                      <Typography variant="caption" sx={{ fontWeight: 600, color: row.id ? "info.main" : "success.main" }}>
                        {row.id ? t("business:provisional_table_type_update") : t("business:provisional_table_type_new")}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("business:edit_row_tooltip")}>
                        <IconButton size="small" disabled={isBusy || creationUnknown} onClick={() => handleOpenEdit(idx)} data-testid={`edit-row-${idx}`}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("business:remove_row_tooltip")}>
                        <IconButton size="small" color="error" disabled={isBusy || creationUnknown} onClick={() => handleRemoveRow(idx)} data-testid={`delete-row-${idx}`}>
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
              disabled={isBusy || Boolean(editPricingError) || !validProductTaxRate(editTaxRate)}
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
          {Boolean(editPricingError) && <Alert severity="error">{t("business:product_price_calculation_invalid")}</Alert>}
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
              <SelectSingleInput label={t("product:measurement_unit")} value={editFormData.measurement_unit ?? (editFormData.id ? null : "unit")}
                options={MEASUREMENT_UNITS.map(unit => ({ value: unit, label: t(`product:units.${unit}`) }))}
                onChange={value => setEditFormData(previous => ({ ...previous, measurement_unit: value ?? undefined }))} disabled={isBusy}
                helperText={editFormData.id && editFormData.measurement_unit === undefined ? t("business:pos.preserve_existing") : undefined} />
              <TextInput
                id="bulk-edit-code"
                name="code"
                label={t("business:product_code")}
                value={editFormData.code ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, code: e.target.value }))
                }
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
                disabled={isBusy}
                id="bulk-edit-cost"
                name="cost_price"
                type="number"
                label={t("business:product_cost_price")}
                value={Number.isFinite(editFormData.cost_price) ? String(editFormData.cost_price) : ""}
                onChange={(e) => handleCostPriceChange(parseNumber(e.target.value))}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                disabled={isBusy}
                id="bulk-edit-tax-rate"
                name="tax_rate"
                type="number"
                label={t("business:product_tax_rate")}
                value={Number.isFinite(editTaxRate) ? String(editTaxRate) : ""}
                onChange={(e) => handleTaxRateChange(parseNumber(e.target.value))}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                disabled={isBusy}
                id="bulk-edit-cost-tax"
                name="cost_price_tax"
                type="number"
                label={t("business:product_cost_tax")}
                value={Number.isFinite(editFormData.cost_price_tax) ? String(editFormData.cost_price_tax) : ""}
                onChange={(e) => handleCostPriceTaxChange(parseNumber(e.target.value))}
              />
            </Grid>

            <Grid size={12}><PriceSuggestion key={editingIndex} costPriceTax={editFormData.cost_price_tax ?? null} disabled={isBusy || Boolean(editPricingError) || !validProductTaxRate(editTaxRate)} onApply={handleSalePriceChange} /></Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                disabled={isBusy}
                id="bulk-edit-sale"
                name="sale_price"
                type="number"
                label={t("business:product_sale_price")}
                value={Number.isFinite(editFormData.sale_price) ? String(editFormData.sale_price) : ""}
                onChange={(e) => handleSalePriceChange(parseNumber(e.target.value))}
                required
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <SelectSingleInput label={t("business:pos.availability")}
                value={typeof editFormData.has_stock === "boolean" ? String(editFormData.has_stock) : null}
                options={[{ value: "true", label: t("business:pos.available") }, { value: "false", label: t("business:pos.unavailable") }]}
                onChange={value => setEditFormData(previous => ({ ...previous, has_stock: value === null ? undefined : value === "true" }))}
                placeholder={t(editFormData.id ? "business:pos.preserve_existing" : "business:pos.choose_availability")}
                disabled={isBusy} required={!editFormData.id} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextInput name="barcode" label={t("business:pos.barcode")} value={editFormData.barcode ?? ""}
                onChange={event => setEditFormData(previous => ({ ...previous, barcode: event.target.value || null }))} disabled={isBusy} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextInput name="offer_price" type="number" label={t("business:pos.alternate_price")} value={editFormData.offer_price == null ? "" : String(editFormData.offer_price)}
                onChange={event => setEditFormData(previous => ({ ...previous, offer_price: event.target.value === "" ? null : Number(event.target.value) }))} disabled={isBusy} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <SwitchWrapper><StyledFormControlLabel labelPlacement="start" label={t("business:pos.use_alternate")}
                control={<StyledSwitch checked={editFormData.is_offer_enabled ?? false} disabled={isBusy}
                  onChange={event => setEditFormData(previous => ({ ...previous, is_offer_enabled: event.target.checked }))} />} /></SwitchWrapper>
            </Grid>
          </Grid>
        </FormContainer>
      </BaseModal>
    </BusinessWorkflow>
  );
};


export const ProductBulkImport: FC<Props> = (props) => <ProductBulkImportEditor key={props.businessId} {...props} />;

export default ProductBulkImport;
