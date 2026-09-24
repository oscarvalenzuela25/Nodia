import type { FC, ChangeEvent, DragEvent } from "react";
import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { sileo } from "sileo";

import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../../../components/inputs/SelectSingleInput";
import {
  useCanUseGemini,
  useCanUseMistral,
} from "../../../../../../../../store/generalSettings/useGeneralSettings";
import { getProductLogs } from "../../../../../../infrastructure/services";
import {
  useProviders,
  useProducts,
  useAnalyzeInvoice,
  useCreateInvoiceWithFile,
  useBulkCreateProducts,
  useBulkUpdateProducts,
} from "../../../../../../infrastructure/useServices";
import type {
  CreateProductPayload,
  BulkUpdateProductItemPayload,
  ProductLogEntity,
} from "../../../../../../infrastructure/types";
import { DropzoneBox, ValidBadge, ErrorBadge } from "../../../../styles";
import {
  InvoiceSectionPaper,
  InvoiceSummaryGrid,
  InvoiceDropzoneContainer,
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";
import {
  type InvoiceProvisionalRow,
  validateInvoiceRow,
  mapExtractedItemsToRows,
  calculatePriceDiff,
} from "./helpers";

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface Props {
  businessId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export const ProductInvoiceImport: FC<Props> = ({
  businessId,
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation(["business", "core"]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToResults = useRef<boolean>(false);

  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<InvoiceProvisionalRow[]>([]);
  const [invoiceCode, setInvoiceCode] = useState<string>("");
  const [invoiceTotalAmount, setInvoiceTotalAmount] = useState<number>(0);
  const [invoiceIssueDate, setInvoiceIssueDate] = useState<string>("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InvoiceProvisionalRow>>({});
  const [editTaxRate, setEditTaxRate] = useState<number>(19);
  const [isSaving, setIsSaving] = useState(false);

  const canUseGemini = useCanUseGemini();
  const canUseMistral = useCanUseMistral();
  const [analyzingProvider, setAnalyzingProvider] = useState<"gemini" | "mistral" | null>(null);
  const [lastUsedProvider, setLastUsedProvider] = useState<"gemini" | "mistral">("gemini");
  const previewUrl = useMemo(() => {
    if (!file) return null;
    const isImg =
      file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);
    if (isImg) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Smoothly scroll down and focus the table section when invoice analysis succeeds
  useEffect(() => {
    if (shouldScrollToResults.current && rows.length > 0 && resultsSectionRef.current) {
      shouldScrollToResults.current = false;
      requestAnimationFrame(() => {
        if (typeof resultsSectionRef.current?.scrollIntoView === "function") {
          resultsSectionRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
        if (typeof resultsSectionRef.current?.focus === "function") {
          resultsSectionRef.current.focus({ preventScroll: true });
        }
      });
    }
  }, [rows]);

  const isImage = Boolean(
    file &&
      (file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name))
  );
  const isPdf = Boolean(
    file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name))
  );

  // Queries
  const { data: providersData } = useProviders({
    q: { business_id_eq: businessId },
    limit: 100,
  });
  const providers = providersData?.data ?? [];

  const providerOptions = useMemo(() => {
    return providers.map((p) => ({
      value: p.id,
      label: p.name,
    }));
  }, [providers]);

  const { data: productsData } = useProducts({
    q: { business_id_eq: businessId },
    all: true,
  });
  const existingProducts = productsData?.data ?? [];

  // Mutations
  const analyzeMutation = useAnalyzeInvoice();
  const createInvoiceMutation = useCreateInvoiceWithFile();
  const bulkCreateMutation = useBulkCreateProducts();
  const bulkUpdateMutation = useBulkUpdateProducts();

  const isAnalyzing = analyzeMutation.isPending;
  const isBusy =
    isAnalyzing ||
    isSaving ||
    createInvoiceMutation.isPending ||
    bulkCreateMutation.isPending ||
    bulkUpdateMutation.isPending;

  const isUploadDisabled = !selectedProviderId || isBusy;
  const [isDragging, setIsDragging] = useState(false);

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

  const hasErrors = useMemo(() => rows.some((r) => !r.isValid), [rows]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isUploadDisabled) return;
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploadDisabled) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploadDisabled) {
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
    if (isUploadDisabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
    }
  };

  const handleAnalyze = async (provider: "gemini" | "mistral" = "gemini") => {
    if (!file || !selectedProviderId || isBusy) return;

    setAnalyzingProvider(provider);
    setLastUsedProvider(provider);

    try {
      const response = await analyzeMutation.mutateAsync({
        file,
        business_id: businessId,
        provider_id: selectedProviderId || undefined,
        ai_provider: provider,
      });

      setInvoiceCode(response.code || "");
      setInvoiceTotalAmount(response.total_amount || 0);
      setInvoiceIssueDate(response.data?.issue_date || "");

      const items = response.data?.items || [];
      const matchedProductIds = existingProducts
        .filter((p) =>
          items.some(
            (item) => item.code && item.code.trim().toLowerCase() === p.code.trim().toLowerCase()
          )
        )
        .map((p) => p.id);

      let historicalLogs: ProductLogEntity[] = [];
      if (matchedProductIds.length > 0) {
        try {
          const logsResponse = await getProductLogs({
            all: true,
            q: {
              product_id_in: matchedProductIds,
              s: "created_at desc",
            },
          });
          historicalLogs = logsResponse.data || [];
        } catch {
          // Graceful fallback: existingProducts already provides catalog snapshot
        }
      }

      const mappedRows = mapExtractedItemsToRows(
        items,
        existingProducts,
        historicalLogs
      );
      shouldScrollToResults.current = true;
      setRows(mappedRows);
    } catch {
      // Error handled by mutation onError
    } finally {
      setAnalyzingProvider(null);
    }
  };

  const handleToggleLock = (index: number) => {
    setRows((prev) => {
      const copy = [...prev];
      const current = copy[index];
      if (!current) return prev;
      copy[index] = {
        ...current,
        isLocked: !current.isLocked,
      };
      return copy;
    });
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

    const { errors, isValid } = validateInvoiceRow(editFormData);

    // Cross reference code if edited
    const newCode = (editFormData.code ?? "").trim();
    const matched = existingProducts.find(
      (p) => p.code.toLowerCase() === newCode.toLowerCase()
    );

    const currentRow = rows[editingIndex];
    const newSalePrice = Number(editFormData.sale_price ?? 0);
    const priceDiff = calculatePriceDiff(
      newSalePrice,
      currentRow.historicalProduct?.sale_price
    );

    const updatedRow: InvoiceProvisionalRow = {
      ...currentRow,
      ...editFormData,
      id: matched?.id,
      code: newCode,
      name: (editFormData.name ?? "").trim(),
      cost_price: Number(editFormData.cost_price ?? 0),
      cost_price_tax: Number(editFormData.cost_price_tax ?? 0),
      profit_percentage: Number(editFormData.profit_percentage ?? 0),
      sale_price: newSalePrice,
      stock: Number(editFormData.stock ?? 0),
      is_active: editFormData.is_active ?? true,
      isUpdate: Boolean(matched?.id),
      isLocked: currentRow.isLocked ?? false,
      historicalProduct: currentRow.historicalProduct,
      priceDiff,
      errors,
      isValid,
    };

    setRows((prev) => {
      const copy = [...prev];
      copy[editingIndex] = updatedRow;
      // Strict sorting: Red/invalid rows ALWAYS at the top!
      return copy.sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
    });

    setEditingIndex(null);
  };

  const handleSubmitAll = async () => {
    if (rows.length === 0 || hasErrors || isBusy || !invoiceCode.trim() || !file) {
      return;
    }

    setIsSaving(true);

    try {
      // =========================================================================
      // ATOMIC PERSISTENCE STEP 1: Create Invoice
      // If invoice creation fails, STOP immediately. Do NOT touch products.
      // =========================================================================
      await createInvoiceMutation.mutateAsync({
        file,
        business_id: businessId,
        provider_id: selectedProviderId || null,
        code: invoiceCode.trim(),
        total_amount: Math.round(invoiceTotalAmount || 0),
        data: {
          issue_date: invoiceIssueDate || undefined,
          items_count: rows.length,
          extracted_items: rows.map((r) => ({
            code: r.code,
            name: r.name,
            cost_price: r.cost_price,
            quantity: r.stock,
            is_update: r.isUpdate,
          })),
        },
        is_active: true,
      });

      // =========================================================================
      // ATOMIC PERSISTENCE STEP 2: Create & Update Products
      // Only runs if invoice was successfully saved in step 1.
      // =========================================================================
      const newItems: CreateProductPayload[] = [];
      const updateItems: BulkUpdateProductItemPayload[] = [];

      rows.forEach((r) => {
        if (r.id) {
          updateItems.push({
            id: r.id,
            provider_id: selectedProviderId || null,
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
            provider_id: selectedProviderId || null,
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

      sileo.success({
        title: t("business:invoice_and_products_success"),
      });

      onSuccess();
    } catch {
      sileo.error({
        title: t("core:server_error_toast"),
        description: t("business:invoice_save_failed_abort"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header with back button */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onCancel} sx={{ borderRadius: 2 }} disabled={isBusy}>
          {t("business:back_to_catalog")}
        </Button>
      </Box>

      {/* Instructions & Upload Area */}
      <InvoiceSectionPaper>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <ReceiptLongOutlinedIcon color="primary" />
          {t("business:invoice_import_title")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("business:invoice_import_subtitle")}
        </Typography>

        <InvoiceDropzoneContainer>
          {/* Linked Provider Selector */}
          <Box sx={{ maxWidth: 400 }}>
            <SelectSingleInput
              id="invoice-provider-select"
              label={t("business:select_provider_required")}
              required
              options={providerOptions}
              value={selectedProviderId || null}
              onChange={(val) => setSelectedProviderId(val ?? "")}
              placeholder={t("business:select_provider_placeholder", "Seleccionar proveedor...")}
              searchPlaceholder={t("business:search_provider_placeholder", "Buscar proveedor...")}
              disabled={isBusy}
              dataTestId="invoice-provider-select"
              helperText={t("business:select_provider_helper")}
              clearable
            />
          </Box>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isUploadDisabled}
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            style={{ display: "none" }}
            data-testid="invoice-file-input"
          />

          {/* Dropzone Box */}
          <DropzoneBox
            onClick={() => !isUploadDisabled && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="invoice-dropzone"
            aria-disabled={isUploadDisabled}
            sx={{
              ...(isUploadDisabled && {
                cursor: "not-allowed",
                opacity: 0.6,
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.01)" : "#f5f5f5",
                "&:hover": {
                  borderColor: "divider",
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.01)" : "#f5f5f5",
                },
              }),
              ...(isDragging && !isUploadDisabled && {
                borderColor: "primary.main",
                borderStyle: "solid",
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(33, 150, 243, 0.08)" : "rgba(25, 118, 210, 0.06)",
              }),
            }}
          >
            {file ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1.5,
                  width: "100%",
                }}
              >
                {isImage && previewUrl ? (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt={file.name}
                    sx={{
                      maxHeight: 180,
                      maxWidth: "100%",
                      objectFit: "contain",
                      borderRadius: 2,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                    }}
                  />
                ) : isPdf ? (
                  <PictureAsPdfOutlinedIcon
                    sx={{
                      fontSize: 56,
                      color: "error.main",
                      mb: 0.5,
                    }}
                  />
                ) : (
                  <ReceiptLongOutlinedIcon
                    sx={{
                      fontSize: 56,
                      color: "primary.main",
                      mb: 0.5,
                    }}
                  />
                )}

                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      color: isUploadDisabled ? "text.disabled" : "text.primary",
                    }}
                  >
                    {t("business:invoice_file_selected", { filename: file.name })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(file.size)} • {t("business:dropzone_replace_hint")}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <>
                <CloudUploadOutlinedIcon
                  sx={{
                    fontSize: 44,
                    color: isUploadDisabled ? "text.disabled" : "primary.main",
                    mb: 1,
                  }}
                />
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    color: isUploadDisabled ? "text.disabled" : "text.primary",
                  }}
                >
                  {!selectedProviderId
                    ? t("business:select_provider_first_to_upload")
                    : t("business:invoice_file_prompt")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  PDF, PNG, JPG, JPEG, WEBP
                </Typography>
              </>
            )}
          </DropzoneBox>

          {/* Analyze Buttons */}
          {file && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1.5,
                mt: 1,
              }}
            >
              {/* Gemini Button */}
              <Tooltip
                title={!canUseGemini ? t("business:provider_not_configured_tooltip") : ""}
                disableHoverListener={canUseGemini}
              >
                <span>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={
                      isAnalyzing && analyzingProvider === "gemini" ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <AutoAwesomeOutlinedIcon />
                      )
                    }
                    disabled={isUploadDisabled || !file || !canUseGemini}
                    onClick={() => handleAnalyze("gemini")}
                    data-testid="analyze-invoice-btn"
                    sx={{ borderRadius: 2 }}
                  >
                    {isAnalyzing && analyzingProvider === "gemini"
                      ? t("business:analyzing_with_gemini")
                      : t("business:analyze_with_gemini")}
                  </Button>
                </span>
              </Tooltip>

              {/* Mistral Button */}
              <Tooltip
                title={!canUseMistral ? t("business:provider_not_configured_tooltip") : ""}
                disableHoverListener={canUseMistral}
              >
                <span>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={
                      isAnalyzing && analyzingProvider === "mistral" ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <AutoAwesomeOutlinedIcon />
                      )
                    }
                    disabled={isUploadDisabled || !file || !canUseMistral}
                    onClick={() => handleAnalyze("mistral")}
                    data-testid="analyze-invoice-mistral-btn"
                    sx={{ borderRadius: 2 }}
                  >
                    {isAnalyzing && analyzingProvider === "mistral"
                      ? t("business:analyzing_with_mistral")
                      : t("business:analyze_with_mistral")}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}

          {analyzeMutation.isError && (
            <Alert
              severity="warning"
              sx={{ mt: 2, borderRadius: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => handleAnalyze(lastUsedProvider)}
                  disabled={isUploadDisabled}
                  data-testid="retry-analyze-btn"
                  sx={{ fontWeight: 600 }}
                >
                  {t("business:retry_analysis_btn")}
                </Button>
              }
            >
              {analyzeMutation.error?.response?.data?.message ||
                t("business:ai_analysis_failed_retry_hint")}
            </Alert>
          )}
        </InvoiceDropzoneContainer>
      </InvoiceSectionPaper>

      {/* Invoice Summary & Provisional Table */}
      {rows.length > 0 && (
        <InvoiceSectionPaper
          ref={resultsSectionRef}
          tabIndex={-1}
          data-testid="invoice-results-section"
          sx={{ scrollMarginTop: "90px", outline: "none" }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t("business:invoice_summary_title")}
            </Typography>
            <Chip
              label={t("business:invoice_items_count", { count: rows.length })}
              color="primary"
              variant="outlined"
              size="small"
            />
          </Box>

          <InvoiceSummaryGrid>
            <TextInput
              id="invoice-code-field"
              name="invoice_code"
              label={t("business:invoice_number_label")}
              value={invoiceCode}
              onChange={(e) => setInvoiceCode(e.target.value)}
              required
              error={!invoiceCode.trim()}
              helperText={!invoiceCode.trim() ? t("validations:required") : undefined}
              disabled={isBusy}
              data-testid="invoice-code-field"
            />
            <TextInput
              id="invoice-total-field"
              name="invoice_total"
              label={t("business:invoice_total_label")}
              value={String(invoiceTotalAmount)}
              onChange={(e) => setInvoiceTotalAmount(Number(e.target.value) || 0)}
              type="number"
              disabled={isBusy}
              data-testid="invoice-total-field"
            />
            <TextInput
              id="invoice-date-field"
              name="invoice_date"
              label={t("business:invoice_date_label")}
              value={invoiceIssueDate}
              onChange={(e) => setInvoiceIssueDate(e.target.value)}
              disabled={isBusy}
              data-testid="invoice-date-field"
            />
            {file && (
              <TextInput
                id="invoice-file-field"
                name="invoice_file"
                label={t("business:invoice_file_label")}
                value={file.name}
                onChange={() => {}}
                disabled
              />
            )}
          </InvoiceSummaryGrid>

          <Alert severity="info" sx={{ mt: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="body2">
              {t("business:invoice_sync_explainer")}
            </Typography>
          </Alert>

          {/* Table Header / Save Action */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
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
                color="success"
                disabled={hasErrors || rows.length === 0 || isBusy || !invoiceCode.trim()}
                onClick={handleSubmitAll}
                startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : <ReceiptLongOutlinedIcon />}
                sx={{ borderRadius: 2 }}
                data-testid="submit-invoice-products"
              >
                {t("business:save_invoice_and_products_btn")}
              </Button>
            </Box>
          </Box>

          {/* Table */}
          <TableContainer
            component={Paper}
            sx={{
              borderRadius: 2,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              boxShadow: "none",
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={36}></TableCell>
                  <TableCell width={48} align="center">
                    <LockOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </TableCell>
                  <TableCell width={110}>{t("business:product_status")}</TableCell>
                  <TableCell>{t("business:product_code")}</TableCell>
                  <TableCell>{t("business:product_name")}</TableCell>
                  <TableCell align="right">{t("business:product_cost_price")}</TableCell>
                  <TableCell align="right">{t("business:product_cost_tax")}</TableCell>
                  <TableCell align="right">{t("business:product_profit_margin")}</TableCell>
                  <TableCell align="right">{t("business:product_sale_price")}</TableCell>
                  <TableCell align="right">{t("business:product_stock")}</TableCell>
                  <TableCell align="right" width={110}>{t("core:actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <Fragment key={`${row.code}-${idx}`}>
                    <TableRow
                      sx={{
                        backgroundColor: row.isLocked
                          ? "rgba(46, 125, 50, 0.08)"
                          : !row.isValid
                          ? "rgba(211, 47, 47, 0.05)"
                          : "inherit",
                        transition: "background-color 0.2s ease",
                      }}
                      data-testid={`invoice-row-${idx}`}
                    >
                      {/* Status Dot */}
                      <TableCell align="center">
                        <Tooltip
                          title={
                            row.isValid
                              ? t("business:row_valid_tooltip")
                              : t("business:row_error_tooltip", {
                                  errors: row.errors.join(", "),
                                })
                          }
                        >
                          <Box sx={{ display: "inline-flex" }}>
                            {row.isValid ? (
                              <ValidBadge data-testid={`valid-dot-${idx}`} />
                            ) : (
                              <ErrorBadge data-testid={`error-dot-${idx}`} />
                            )}
                          </Box>
                        </Tooltip>
                      </TableCell>

                      {/* Lock Checkbox */}
                      <TableCell align="center" width={48}>
                        <Tooltip
                          title={
                            row.isLocked
                              ? t("business:unlock_row_tooltip")
                              : t("business:lock_row_tooltip")
                          }
                        >
                          <Checkbox
                            size="small"
                            icon={<LockOpenOutlinedIcon fontSize="small" color="action" />}
                            checkedIcon={<LockOutlinedIcon fontSize="small" color="success" />}
                            checked={Boolean(row.isLocked)}
                            onChange={() => handleToggleLock(idx)}
                            disabled={isBusy}
                            data-testid={`lock-checkbox-${idx}`}
                            sx={{ p: 0.5 }}
                          />
                        </Tooltip>
                      </TableCell>

                      {/* Action Type (Nuevo / Actualizar) & Ready Badge */}
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                          <Chip
                            label={
                              row.isUpdate
                                ? t("business:action_type_update")
                                : t("business:action_type_new")
                            }
                            color={row.isUpdate ? "info" : "primary"}
                            size="small"
                            variant={row.isUpdate ? "filled" : "outlined"}
                          />
                          {row.isLocked && (
                            <Chip
                              label={t("business:row_locked_ready")}
                              color="success"
                              size="small"
                              variant="filled"
                              data-testid={`ready-badge-${idx}`}
                              sx={{ fontWeight: 600, height: 22 }}
                            />
                          )}
                        </Box>
                      </TableCell>

                      <TableCell sx={{ fontWeight: 600 }}>{row.code || "-"}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right">
                        {row.cost_price > 0 ? `$${row.cost_price.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell align="right">
                        {row.cost_price_tax > 0 ? `$${row.cost_price_tax.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell align="right">{row.profit_percentage}%</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <span>{row.sale_price > 0 ? `$${row.sale_price.toLocaleString()}` : "-"}</span>
                          {row.priceDiff && (
                            <Tooltip
                              title={
                                row.priceDiff.isIncrease
                                  ? t("business:price_increased_tooltip", { percent: row.priceDiff.percent })
                                  : t("business:price_decreased_tooltip", { percent: row.priceDiff.percent })
                              }
                            >
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.25,
                                  color: row.priceDiff.isIncrease ? "error.main" : "success.main",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                }}
                                data-testid={`price-diff-${idx}`}
                              >
                                {row.priceDiff.isIncrease ? (
                                  <ArrowUpwardIcon sx={{ fontSize: 13 }} />
                                ) : (
                                  <ArrowDownwardIcon sx={{ fontSize: 13 }} />
                                )}
                                <span>
                                  {row.priceDiff.isIncrease
                                    ? `+${row.priceDiff.percent}%`
                                    : `-${row.priceDiff.percent}%`}
                                </span>
                              </Box>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{row.stock}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={t("business:edit_row_tooltip")}>
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenEdit(idx)}
                              disabled={isBusy || Boolean(row.isLocked)}
                              data-testid={`edit-row-${idx}`}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t("business:remove_row_tooltip")}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveRow(idx)}
                              disabled={isBusy || Boolean(row.isLocked)}
                              data-testid={`delete-row-${idx}`}
                            >
                              <DeleteOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>

                    {/* Extra row for historical comparison */}
                    {row.historicalProduct && (
                      <TableRow
                        key={`${row.code}-${idx}-historical`}
                        sx={{
                          backgroundColor: (theme) =>
                            theme.palette.mode === "dark"
                              ? "rgba(255, 255, 255, 0.03)"
                              : "rgba(0, 0, 0, 0.02)",
                          "& > td": {
                            borderBottom: (theme) => `1px dashed ${theme.palette.divider}`,
                            color: "text.secondary",
                            fontSize: "0.8125rem",
                            py: 0.75,
                          },
                        }}
                        data-testid={`historical-row-${idx}`}
                      >
                        <TableCell align="center" />
                        <TableCell align="center">
                          <HistoryOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={t("business:historical_badge")}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontSize: "0.7rem",
                              height: 20,
                              color: "text.secondary",
                              borderColor: "divider",
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>{row.historicalProduct.code}</TableCell>
                        <TableCell sx={{ color: "text.secondary" }}>
                          <Typography variant="caption" sx={{ fontStyle: "italic", color: "text.secondary" }}>
                            {row.historicalProduct.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>
                          ${row.historicalProduct.cost_price.toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>
                          ${row.historicalProduct.cost_price_tax.toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>
                          {row.historicalProduct.profit_percentage}%
                        </TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 500 }}>
                          ${row.historicalProduct.sale_price.toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>
                          {row.historicalProduct.stock}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="text.disabled">-</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </InvoiceSectionPaper>
      )}

      {/* Row Edit Modal */}
      <BaseModal
        open={editingIndex !== null}
        onClose={() => setEditingIndex(null)}
        title={t("business:edit_invoice_item_title")}
        size="md"
        actions={
          <ModalActionsContainer>
            <Button
              variant="contained"
              color="error"
              onClick={() => setEditingIndex(null)}
              data-testid="cancel-row-edit"
              sx={{ borderRadius: 2, px: 2.5 }}
            >
              {t("core:cancel")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveEdit}
              data-testid="save-row-edit"
              sx={{ borderRadius: 2, px: 2.5 }}
            >
              {t("core:save")}
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
                  data-testid="edit-field-active-switch"
                />
              }
              label={t("business:active_label")}
              labelPlacement="start"
            />
          </SwitchWrapper>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="edit-field-code"
                name="code"
                label={t("business:product_code")}
                value={editFormData.code ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, code: e.target.value }))
                }
                required
                data-testid="edit-field-code"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="edit-field-name"
                name="name"
                label={t("business:product_name")}
                value={editFormData.name ?? ""}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                data-testid="edit-field-name"
              />
            </Grid>

            {/* Row 2: Costo Base sin Impuesto, Impuesto % auxiliar, Costo Base con Impuestos */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="edit-field-cost"
                name="cost_price"
                type="number"
                label={t("business:product_cost_price")}
                value={String(editFormData.cost_price ?? 0)}
                onChange={(e) => handleCostPriceChange(Number(e.target.value))}
                required
                data-testid="edit-field-cost"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="edit-field-tax-rate"
                name="tax_rate"
                type="number"
                label={t("business:product_tax_rate")}
                value={String(editTaxRate)}
                onChange={(e) => handleTaxRateChange(Number(e.target.value))}
                data-testid="edit-field-tax-rate"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="edit-field-cost-tax"
                name="cost_price_tax"
                type="number"
                label={t("business:product_cost_tax")}
                value={String(editFormData.cost_price_tax ?? 0)}
                onChange={(e) => handleCostPriceTaxChange(Number(e.target.value))}
                data-testid="edit-field-cost-tax"
              />
            </Grid>

            {/* Row 3: Margen % y Precio Venta */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="edit-field-margin"
                name="profit_percentage"
                type="number"
                label={t("business:product_profit_margin")}
                value={String(editFormData.profit_percentage ?? 0)}
                onChange={(e) => handleProfitMarginChange(Number(e.target.value))}
                data-testid="edit-field-margin"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="edit-field-sale"
                name="sale_price"
                type="number"
                label={t("business:product_sale_price")}
                value={String(editFormData.sale_price ?? 0)}
                onChange={(e) => handleSalePriceChange(Number(e.target.value))}
                required
                data-testid="edit-field-sale"
              />
            </Grid>

            {/* Row 4: Stock */}
            <Grid size={{ xs: 12 }}>
              <TextInput
                id="edit-field-stock"
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
                data-testid="edit-field-stock"
              />
            </Grid>
          </Grid>
        </FormContainer>
      </BaseModal>
    </Box>
  );
};

export default ProductInvoiceImport;
