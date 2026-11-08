import InvoiceProductMatch from "./InvoiceProductMatch";
import PriceSuggestion from "../PriceSuggestion";
import InvoiceRowActions from "./InvoiceRowActions";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import BusinessWorkflow from "../../../../../../components/BusinessWorkflow";
import { getHttpErrorMessage, notifyHttpError } from "../../../../../../../../config/httpFeedback";
import { invoiceAiAnalysisMessageKey, invoiceAiRuntimeMessageKey } from "../../../../../../infrastructure/invoiceAiFailure";
import AnalysisConsole, { useAnalysisObservation } from "../../../../../../components/AnalysisConsole";
import { Workspace, WorkspaceGrid } from "../../../../../../components/AnalysisConsole/styles";
import { getInvoiceAiModes, isInvoiceAiMode, isProviderVisibleInInvoiceImport, resolveInvoiceAiConfiguration, resolveInvoiceAiProvider, type InvoiceAiMode } from "./aiSelection";
import type { FC, ChangeEvent, DragEvent } from "react";
import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
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
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { sileo } from "sileo";

import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../../../components/inputs/SelectSingleInput";
import QueryErrorAlert from "../../../../../../../../components/QueryErrorAlert";
import { usePagedProviderOptions } from "../../../../../../infrastructure/usePagedOptions";
import { getProductLogs } from "../../../../../../infrastructure/services";
import {
  useProducts,
  useAnalyzeInvoice,
  useVerifyIaProviders,
  useCreateInvoiceWithFile,
  useBulkCreateProducts,
  useBulkUpdateProducts,
} from "../../../../../../infrastructure/useServices";
import type {
  CreateProductPayload,
  BulkUpdateProductItemPayload,
  ProductLogEntity,
  ProductEntity,
  VerifyIaProviderItem,
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
  type InvoiceUpdateField,
  INVOICE_UPDATE_FIELDS,
  bindInvoiceRow,
  invoiceProductPayload,
  validateInvoiceRow,
  validateInvoiceRows,
  mapExtractedItemsToRows,
  calculatePriceDiff,
  normalizeVerifyProviders,
} from "./helpers";

const parseNumericInput = (value: string): number => value.trim() ? Number(value) : Number.NaN;
const numericInputValue = (value: number | undefined): string => typeof value === "number" && Number.isFinite(value) ? String(value) : "";

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
  const { t } = useTranslation(["business", "core", "ai_providers"]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToResults = useRef<boolean>(false);
  const analysisIntent = useRef<symbol | null>(null);
  const availabilityCheckPending = useRef(false);
  const [isCheckingAiAvailability, setIsCheckingAiAvailability] = useState(false);

  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedProviderTax, setSelectedProviderTax] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<InvoiceProvisionalRow[]>([]);
  const [invoiceCode, setInvoiceCode] = useState<string>("");
  const [invoiceTotalAmount, setInvoiceTotalAmount] = useState<number>(0);
  const [invoiceIssueDate, setInvoiceIssueDate] = useState<string>("");
  const [matchingRow, setMatchingRow] = useState<{ businessId: string; row: InvoiceProvisionalRow } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InvoiceProvisionalRow>>({});
  const [editTaxRate, setEditTaxRate] = useState<number>(19);
  const [isSaving, setIsSaving] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);

  const [modeSelection, setModeSelection] = useState<{ providerId: string; mode: InvoiceAiMode } | null>(null);
  const { data: iaProvidersData, isLoading: isVerifyingProviders, isFetching: isFetchingAiProviders, isError: aiProvidersError, refetch: refetchAiProviders } = useVerifyIaProviders({ mode: modeSelection?.mode });
  const providersList = useMemo(() => {
    return normalizeVerifyProviders(iaProvidersData);
  }, [iaProvidersData]);

  const [selectedAiProviderId, setSelectedAiProviderId] = useState<string | null>(null);
  const usableProviders = useMemo(() => {
    return providersList.filter(isProviderVisibleInInvoiceImport);
  }, [providersList]);

  const currentAiProvider = resolveInvoiceAiProvider(usableProviders, selectedAiProviderId);
  const enabledModes = getInvoiceAiModes(currentAiProvider);
  const requestedMode = modeSelection?.providerId === currentAiProvider?.id ? modeSelection?.mode : null;
  const defaultMode = isInvoiceAiMode(currentAiProvider?.default_mode) ? currentAiProvider.default_mode : null;
  const selectedAiMode = requestedMode
    ? (enabledModes.includes(requestedMode) ? requestedMode : null)
    : (defaultMode && enabledModes.includes(defaultMode) ? defaultMode : enabledModes[0] ?? null);
  const aiConfiguration = resolveInvoiceAiConfiguration(currentAiProvider, selectedAiMode);
  const availabilityMessage = selectedAiMode === "agentic"
    ? invoiceAiRuntimeMessageKey(currentAiProvider?.availability_reason) : null;
  const unavailableMessage = !currentAiProvider
    ? t("business:no_ai_providers_available")
    : availabilityMessage ? t(availabilityMessage)
    : !aiConfiguration.model ? t("business:ai_model_unassigned")
    : currentAiProvider.error || t("business:provider_unavailable");

  const activeModes = enabledModes.map((value) => ({
    value,
    label: `${t(`business:mode_${value}`)}${currentAiProvider?.default_mode === value ? ` (${t("business:default_badge")})` : ""}`,
  }));
  const aiProviderOptions = usableProviders.map((p) => ({
    value: p.id,
    label: `${p.name}${p.is_default ? ` (${t("business:default_badge")})` : ""}`,
  }));

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
  const providerQuery = usePagedProviderOptions(businessId);
  const providerOptions = providerQuery.options;

  const { data: productsData, isFetching: isFetchingProducts, isError: productsError, refetch: refetchProducts } = useProducts({
    q: { business_id_eq: businessId },
    all: true,
  });
  const existingProducts = productsData?.data ?? [];

  // Mutations
  const analyzeMutation = useAnalyzeInvoice();
  const analysisRuntimeMessage = invoiceAiAnalysisMessageKey(analyzeMutation.error);
  const observation = useAnalysisObservation(businessId);
  const createInvoiceMutation = useCreateInvoiceWithFile();
  const bulkCreateMutation = useBulkCreateProducts();
  const bulkUpdateMutation = useBulkUpdateProducts();

  const isAnalyzing = observation.isBusy;
  const isBusy =
    isAnalyzing || isCheckingAiAvailability || isFetchingAiProviders || isFetchingProducts || providerQuery.isFetching ||
    isSaving ||
    createInvoiceMutation.isPending ||
    bulkCreateMutation.isPending ||
    bulkUpdateMutation.isPending;

  const isUploadDisabled = !selectedProviderId || selectedProviderTax === null || productsError || isBusy;
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
  const needsAvailability = rows.some(row => !row.id && typeof row.has_stock !== "boolean");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isUploadDisabled || analysisIntent.current) return;
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
    if (isUploadDisabled || analysisIntent.current) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
    }
  };

  const handleAnalyze = async (
    provider: VerifyIaProviderItem,
    modeToUse?: InvoiceAiMode | null
  ) => {
    const effectiveMode = modeToUse ?? selectedAiMode;
    const configuration = resolveInvoiceAiConfiguration(provider, effectiveMode);
    if (analysisIntent.current || availabilityCheckPending.current || !file || !selectedProviderId || selectedProviderTax === null || productsError || aiProvidersError || isBusy || !configuration.canAnalyze || !effectiveMode) return;
    const intent = Symbol("invoice-analysis");
    analysisIntent.current = intent;
    const targetModel = configuration.model;
    const modelType = "default" as const;
    const effectiveThinkingLevel = configuration.thinkingLevel;

    let transport: Awaited<ReturnType<typeof observation.start>> | undefined;
    try {
      const params = {
        business_id: businessId,
        provider_id: selectedProviderId || undefined,
        ai_provider: provider.key,
        ai_provider_id: provider.id,
        model: targetModel,
        model_type: modelType,
        mode: effectiveMode,
        extended_thinking: undefined,
        thinking_level: effectiveThinkingLevel,
      };
      transport = await observation.start(params);
      if (analysisIntent.current !== intent || !transport.isCurrent()) return;
      const response = await analyzeMutation.mutateAsync({ file, ...params, ...transport });
      if (analysisIntent.current !== intent || !transport.isCurrent()) return;
      transport.preparing();

      const items = response.data?.items || [];
      const matchedProductIds = existingProducts
        .filter((p) =>
          items.some(
            (item) => item.code && item.code.trim().toLowerCase() === p.code?.trim().toLowerCase()
          )
        )
        .map((p) => p.id);

      let historicalLogs: ProductLogEntity[] = [];
      if (matchedProductIds.length > 0) {
        transport.emit('history_loading');
        try {
          const logsResponse = await getProductLogs({
            all: true,
            q: {
              product_id_in: matchedProductIds,
              s: "created_at desc",
            },
          }, transport.signal);
          if (analysisIntent.current !== intent || !transport.isCurrent()) return;
          historicalLogs = logsResponse.data || [];
        } catch (error) {
          if (analysisIntent.current !== intent || !transport.isCurrent()) return;
          notifyHttpError(error);
          transport.emit('history_unavailable');
          // Graceful fallback: existingProducts already provides catalog snapshot
        }
      }

      if (analysisIntent.current !== intent || !transport.isCurrent()) return;
      transport.emit('rows_preparing');
      const mappedRows = mapExtractedItemsToRows(
        items,
        existingProducts,
        historicalLogs,
        selectedProviderTax
      );
      if (analysisIntent.current !== intent || !transport.isCurrent()) return;
      setInvoiceCode(response.code || "");
      setInvoiceTotalAmount(response.total_amount ?? Number.NaN);
      setInvoiceIssueDate(response.data?.issue_date || "");
      shouldScrollToResults.current = true;
      setRows(mappedRows);
      if (mappedRows.some(row => !row.id && typeof row.has_stock !== "boolean")) setShowInvoiceDetails(true);
      transport.emit('draft_ready');
      transport.finish();
    } catch (error) {
      if (analysisIntent.current === intent && transport?.isCurrent()) transport.finish(error);
      // Error handled by mutation onError
    } finally {
      if (analysisIntent.current === intent) analysisIntent.current = null;
    }
  };

  const handleCheckAiAvailability = async () => {
    if (availabilityCheckPending.current) return;
    availabilityCheckPending.current = true;
    setIsCheckingAiAvailability(true);
    try { await refetchAiProviders(); }
    catch (error) { notifyHttpError(error); }
    finally { availabilityCheckPending.current = false; setIsCheckingAiAvailability(false); }
  };

  const handleCancelAnalysis = () => {
    if (!observation.cancel()) return;
    analysisIntent.current = null;
    analyzeMutation.reset();
    void handleCheckAiAvailability();
    sileo.success({ title: t("business:invoice_analysis_cancelled_title"), description: t("business:invoice_analysis_cancelled_description") });
  };

  const handleRemoveRow = (index: number) => {
    if (isBusy || analysisIntent.current) return;
    setRows((prev) => validateInvoiceRows(prev.filter((_, idx) => idx !== index)));
  };

  const handleOpenEdit = (index: number) => {
    if (isBusy || analysisIntent.current) return;
    const row = rows[index];
    setEditingIndex(index);
    setEditFormData({ ...row });
    if (row.cost_price > 0 && row.cost_price_tax >= row.cost_price) {
      const derivedTax = Math.round(
        ((row.cost_price_tax - row.cost_price) / row.cost_price) * 100
      );
      setEditTaxRate(derivedTax);
    } else {
      setEditTaxRate(selectedProviderTax ?? 19);
    }
  };

  const handleCostPriceChange = (cost: number) => {
    if (isBusy || analysisIntent.current) return;
    setEditFormData(prev => ({ ...prev, cost_price: cost, cost_price_tax: Math.round(cost * (1 + editTaxRate / 100)) }));
  };
  const handleTaxRateChange = (rate: number) => {
    if (isBusy || analysisIntent.current) return;
    setEditTaxRate(rate);
    setEditFormData(prev => ({ ...prev, cost_price_tax: Math.round((prev.cost_price ?? Number.NaN) * (1 + rate / 100)) }));
  };
  const handleCostPriceTaxChange = (taxCost: number) => {
    if (isBusy || analysisIntent.current) return;
    setEditFormData(prev => ({ ...prev, cost_price_tax: taxCost, cost_price: Math.round(taxCost / (1 + editTaxRate / 100)) }));
  };
  const handleSalePriceChange = (sale: number) => {
    if (isBusy || analysisIntent.current) return;
    setEditFormData(prev => ({ ...prev, sale_price: sale }));
  };

  const handleBindProduct = (product: ProductEntity, fields: InvoiceUpdateField[]) => {
    if (isBusy || analysisIntent.current || !matchingRow || matchingRow.businessId !== businessId || !rows.includes(matchingRow.row)) return false;
    try {
      if (rows.some(row => row !== matchingRow.row && row.id === product.id)) throw new Error(t("business:invoice_match_duplicate_target"));
      const bound = bindInvoiceRow(matchingRow.row, product, fields, businessId);
      setRows(previous => validateInvoiceRows(previous.map(row => row === matchingRow.row ? bound : row)));
      sileo.success({ title: t("business:invoice_match_prepared") });
      return true;
    } catch (error) {
      sileo.error({ title: t("business:invoice_match_failed"), description: error instanceof Error ? error.message : t("core:server_error_toast") });
      return false;
    }
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || isBusy || analysisIntent.current) return;

    const { errors, isValid } = validateInvoiceRow(editFormData);

    const newCode = (editFormData.code ?? "").trim();
    const currentRow = rows[editingIndex];
    const newSalePrice = Number(editFormData.sale_price ?? 0);
    const priceDiff = calculatePriceDiff(
      newSalePrice,
      currentRow.historicalProduct?.sale_price
    );

    const updatedRow: InvoiceProvisionalRow = {
      ...currentRow,
      ...editFormData,
      id: currentRow.id,
      code: newCode,
      name: (editFormData.name ?? "").trim(),
      cost_price: Number(editFormData.cost_price ?? 0),
      cost_price_tax: Number(editFormData.cost_price_tax ?? 0),
      sale_price: newSalePrice,
      quantity: editFormData.quantity ?? Number.NaN,
      has_stock: currentRow.id ? currentRow.has_stock : editFormData.has_stock,
      version: currentRow.version,
      manual_match: currentRow.manual_match ? { ...currentRow.manual_match, fields: [...new Set([...currentRow.manual_match.fields, ...INVOICE_UPDATE_FIELDS.filter(field => editFormData[field] !== currentRow[field])])] } : undefined,
      is_active: editFormData.is_active ?? true,
      isUpdate: Boolean(currentRow.id),
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
      return validateInvoiceRows(copy).sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
    });

    setEditingIndex(null);
  };

  const handleSubmitAll = async () => {
    if (analysisIntent.current || rows.length === 0 || hasErrors || rows.some(row => !row.id && typeof row.has_stock !== "boolean") || isBusy || !invoiceCode.trim() || !file || !Number.isFinite(invoiceTotalAmount) || invoiceTotalAmount < 0) {
      return;
    }

    setIsSaving(true);

    try {
      // =========================================================================
      // The current API persists the invoice and products in separate requests.
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
            code: r.invoice_code ?? r.code,
            matched_product_id: r.id,
            selected_update_fields: r.manual_match?.fields,
            name: r.name,
            cost_price: r.cost_price,
            quantity: Number.isFinite(r.quantity) ? r.quantity : null,
            is_update: r.isUpdate,
          })),
        },
        is_active: true,
      });

      // =========================================================================
      // A transactional confirmation endpoint is still required in Server.
      // Only runs if invoice was successfully saved in step 1.
      // =========================================================================
      const newItems: CreateProductPayload[] = [];
      const updateItems: BulkUpdateProductItemPayload[] = [];

      rows.forEach(row => {
        const payload = invoiceProductPayload(row, businessId, selectedProviderId || null);
        if ("id" in payload) updateItems.push(payload);
        else newItems.push(payload);
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
    <BusinessWorkflow>
      {/* Header with back button */}
      <Box data-business-toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => { if (!isBusy && !analysisIntent.current) onCancel(); }} sx={{ borderRadius: 2 }} disabled={isBusy}>
          {t("business:back_to_catalog")}
        </Button>
      </Box>

      {/* Instructions & Upload Area */}
      <QueryErrorAlert isError={aiProvidersError || productsError || providerQuery.isError} isFetching={isBusy} onRetry={() => { if (!isBusy && !analysisIntent.current) return Promise.all([handleCheckAiAvailability(), refetchProducts(), providerQuery.refetch()]); }} />
      <InvoiceSectionPaper>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <ReceiptLongOutlinedIcon color="primary" />
          {t("business:invoice_import_title")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("business:invoice_import_subtitle")}
        </Typography>

        <InvoiceDropzoneContainer>
          {/* Linked Provider Selector & Thinking Mode Toggle */}
          <Box data-business-toolbar
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box sx={{ flex: 1, minWidth: { xs: 0, sm: 280 }, width: { xs: '100%', sm: 'auto' }, maxWidth: 400 }}>
              <SelectSingleInput
                id="invoice-provider-select"
                label={t("business:select_provider_required")}
                required
                options={providerOptions}
                onSearchChange={value => { if (!isBusy && !analysisIntent.current) providerQuery.setSearch(value); }} hasMore={providerQuery.hasNextPage}
                onLoadMore={() => { if (!isBusy && !analysisIntent.current) void providerQuery.fetchNextPage(); }} loadingOptions={providerQuery.isFetching}
                value={selectedProviderId || null}
                onChange={(val) => { if (isBusy || analysisIntent.current) return; setSelectedProviderId(val ?? ""); setSelectedProviderTax(providerQuery.providers.find((provider) => provider.id === val)?.tax ?? null); }}
                placeholder={t("business:select_provider_placeholder", "Seleccionar proveedor...")}
                searchPlaceholder={t("business:search_provider_placeholder", "Buscar proveedor...")}
                disabled={isBusy}
                dataTestId="invoice-provider-select"
                helperText={t("business:select_provider_helper")}
                clearable
              />
            </Box>


          </Box>

          {/* Hidden File Input */}
          {/* Analyze Controls */}
          {file && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                mt: 2,
                p: 2.5,
                borderRadius: 2,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.02)"
                    : "rgba(0, 0, 0, 0.01)",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 2,
                    flex: 1,
                    minWidth: 0,
                    flexBasis: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {/* AI Provider Selector */}
                  <Box sx={{ minWidth: { xs: 0, sm: 200 }, flex: 1, flexBasis: { xs: '100%', sm: 'auto' }, maxWidth: 300 }}>
                    <SelectSingleInput
                      id="ai-provider-select"
                      label={t("business:select_ai_provider_label", "Proveedor de IA")}
                      options={aiProviderOptions}
                      value={currentAiProvider?.id || null}
                      onChange={(val) => {
                        if (isBusy || analysisIntent.current) return;
                        if (val) {
                          setSelectedAiProviderId(val);
                          setModeSelection(null);
                        }
                      }}
                      placeholder={t(
                        "business:select_ai_provider_placeholder",
                        "Seleccionar proveedor de IA..."
                      )}
                      disabled={isBusy}
                      dataTestId="ai-provider-select"
                      clearable={false}
                    />
                  </Box>

                  {/* Mode Selector (shown whenever selected provider has active modes) */}
                  {activeModes.length > 0 && (
                    <Box sx={{ minWidth: { xs: 0, sm: 200 }, flex: 1, flexBasis: { xs: '100%', sm: 'auto' }, maxWidth: 300 }}>
                      <SelectSingleInput
                        id="ai-mode-select"
                        label={t("business:select_ai_mode_label", "Método de Conexión")}
                        options={activeModes}
                        value={selectedAiMode}
                        onChange={(val) => {
                          if (isBusy || analysisIntent.current) return;
                          if (currentAiProvider && isInvoiceAiMode(val)) {
                            setSelectedAiProviderId(currentAiProvider.id);
                            setModeSelection({ providerId: currentAiProvider.id, mode: val });
                          }
                        }}
                        placeholder={t(
                          "business:select_ai_mode_placeholder",
                          "Seleccionar modo..."
                        )}
                        disabled={isBusy}
                        dataTestId="ai-mode-select"
                        clearable={false}
                      />
                    </Box>
                  )}
                </Box>

                {/* Analyze Action Button */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: { xs: "stretch", sm: "center" },
                    flexDirection: { xs: "column", sm: "row" },
                    alignSelf: "flex-end",
                    gap: 1,
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  <Tooltip
                    title={
                      !aiConfiguration.canAnalyze ? unavailableMessage : ""
                    }
                    arrow
                    placement="top"
                  >
                    <Box component="span" sx={{ width: { xs: '100%', sm: 'auto' }, maxWidth: '100%' }}>
                      <Button
                        variant="contained"
                        color={currentAiProvider?.key === "mistral" ? "secondary" : "primary"}
                        startIcon={
                          isAnalyzing ? (
                            <CircularProgress size={18} color="inherit" />
                          ) : (
                            <AutoAwesomeOutlinedIcon />
                          )
                        }
                        disabled={
                          isUploadDisabled ||
                          !file ||
                          !aiConfiguration.canAnalyze ||
                          aiProvidersError ||
                          isVerifyingProviders
                        }
                        onClick={() =>
                          currentAiProvider && handleAnalyze(currentAiProvider, selectedAiMode)
                        }
                        data-testid="analyze-invoice-btn"
                        sx={{
                          width: { xs: '100%', sm: 'auto' },
                          borderRadius: 2,
                          px: 3,
                          py: 1,
                          minHeight: "44px",
                          fontWeight: 600,
                          textTransform: "none",
                        }}
                      >
                        {isAnalyzing
                          ? t("business:analyzing_with_provider", {
                              provider: currentAiProvider?.name || "IA",
                              defaultValue: `Analizando con ${currentAiProvider?.name || "IA"}...`,
                            })
                          : t("business:analyze_with_provider", {
                              provider: currentAiProvider?.name || "IA",
                              defaultValue: `Analizar con ${currentAiProvider?.name || "IA"}`,
                            })}
                      </Button>
                    </Box>
                  </Tooltip>

                  {observation.isBusy && <Button variant="outlined" color="error" startIcon={<StopCircleOutlinedIcon />} onClick={handleCancelAnalysis}
                    data-testid="cancel-invoice-analysis-btn" sx={{ width: { xs: "100%", sm: "auto" }, minHeight: 44 }}>{t("business:invoice_analysis_cancel")}</Button>}

                  {currentAiProvider && !aiConfiguration.canAnalyze && !analyzeMutation.isError && (
                    <Button variant="outlined" onClick={() => { void handleCheckAiAvailability(); }} disabled={isBusy || isVerifyingProviders}
                      data-testid="check-invoice-ai-availability-btn" sx={{ width: { xs: "100%", sm: "auto" }, minHeight: 44 }}>
                      {t("business:invoice_ai_check_availability")}
                    </Button>
                  )}

                  {!aiConfiguration.canAnalyze && !isVerifyingProviders && (
                    <Tooltip
                      title={
                        unavailableMessage
                      }
                      arrow
                      placement="top"
                    >
                      <Box
                        component="span"
                        data-testid={`${currentAiProvider?.key || "ai"}-disabled-info-icon`}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          cursor: "help",
                          color: "text.secondary",
                          "&:hover": { color: "warning.main" },
                          transition: "color 0.15s ease",
                        }}
                      >
                        <InfoOutlinedIcon sx={{ fontSize: 20 }} />
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Box>
          )}

          {analyzeMutation.isError && (
            <Alert
              severity="warning"
              sx={{ mt: 2, borderRadius: 2, flexWrap: "wrap",
                "& .MuiAlert-message": { minWidth: 0, flex: "1 1 160px" },
                "& .MuiAlert-action": { width: { xs: "100%", sm: "auto" }, ml: { xs: 0, sm: 2 }, mr: { xs: 0, sm: -1 }, pl: { xs: 0, sm: 2 }, pt: { xs: 1, sm: 0.5 } } }}
              action={
                <Button
                  variant="outlined"
                  color="inherit"
                  size="small"
                  onClick={() => {
                    if (analysisRuntimeMessage) { void handleCheckAiAvailability(); return; }
                    if (currentAiProvider) handleAnalyze(currentAiProvider, selectedAiMode);
                  }}
                  disabled={analysisRuntimeMessage ? isBusy : isUploadDisabled || !file || !aiConfiguration.canAnalyze || aiProvidersError || isVerifyingProviders}
                  data-testid="retry-analyze-btn"
                  sx={{ fontWeight: 600, minHeight: 44, width: { xs: "100%", sm: "auto" } }}
                >
                  {t(analysisRuntimeMessage ? "business:invoice_ai_check_availability" : "business:retry_analysis_btn")}
                </Button>
              }
            >
              {analysisRuntimeMessage ? t(analysisRuntimeMessage) : getHttpErrorMessage(analyzeMutation.error)}
            </Alert>
          )}
          <Workspace>
            <WorkspaceGrid>
              <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
            onClick={() => !isUploadDisabled && !analysisIntent.current && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="invoice-dropzone"
            role="button"
            tabIndex={isUploadDisabled ? -1 : 0}
            aria-label={t("business:invoice_file_prompt")}
            onKeyDown={(event) => { if (!isUploadDisabled && !analysisIntent.current && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileInputRef.current?.click(); } }}
            aria-disabled={isUploadDisabled}
            sx={{
              flex: 1,
              minHeight: 320,
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
              </Box>
              <AnalysisConsole key={observation.view.startedAt ?? 'idle'} view={observation.view} />
            </WorkspaceGrid>
          </Workspace>

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
          <Box data-business-toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 2 }}>
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
              onChange={(e) => { if (!isBusy && !analysisIntent.current) setInvoiceCode(e.target.value); }}
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
              value={numericInputValue(invoiceTotalAmount)}
              onChange={(e) => { if (!isBusy && !analysisIntent.current) setInvoiceTotalAmount(parseNumericInput(e.target.value)); }}
              type="number"
              disabled={isBusy}
              error={!Number.isFinite(invoiceTotalAmount) || invoiceTotalAmount < 0}
              helperText={!Number.isFinite(invoiceTotalAmount) || invoiceTotalAmount < 0 ? t("business:invoice_validation_total") : undefined}
              data-testid="invoice-total-field"
            />
            <TextInput
              id="invoice-date-field"
              name="invoice_date"
              label={t("business:invoice_date_label")}
              value={invoiceIssueDate}
              onChange={(e) => { if (!isBusy && !analysisIntent.current) setInvoiceIssueDate(e.target.value); }}
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
          <Box data-business-toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 2 }}>
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
                disabled={hasErrors || needsAvailability || rows.length === 0 || isBusy || !invoiceCode.trim() || !Number.isFinite(invoiceTotalAmount) || invoiceTotalAmount < 0}
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
            role="region"
            aria-label={t("business:provisional_table_title", { count: rows.length })}
            tabIndex={0}
            sx={{
              borderRadius: 2,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              boxShadow: "none",
            }}
          >
            <Table size="small" sx={{ minWidth: showInvoiceDetails ? 1200 : 1000 }}>
              <TableHead>
                <TableRow>
                  <TableCell width={36}></TableCell>
                  <TableCell width={110}>{t("business:product_status")}</TableCell>
                  <TableCell>{t("business:product_code")}</TableCell>
                  <TableCell>{t("business:product_name")}</TableCell>
                  <TableCell align="right">{t("business:product_cost_price")}</TableCell>
                  <TableCell align="right">{t("business:product_cost_tax")}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                      {t("business:product_sale_price")}
                      <Tooltip title={t(showInvoiceDetails ? "business:invoice_hide_detail_columns" : "business:invoice_show_detail_columns")}>
                        <span><IconButton
                          aria-label={t(showInvoiceDetails ? "business:invoice_hide_detail_columns" : "business:invoice_show_detail_columns")}
                          aria-expanded={showInvoiceDetails}
                          disabled={isBusy}
                          onClick={() => { if (!isBusy && !analysisIntent.current) setShowInvoiceDetails(previous => !previous); }}
                          sx={{ minWidth: 44, minHeight: 44, color: "inherit" }}
                        >{showInvoiceDetails ? <RemoveRounded fontSize="small" /> : <AddRounded fontSize="small" />}</IconButton></span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  {showInvoiceDetails && <>
                    <TableCell align="right">{t("business:pos.invoice_quantity")}</TableCell>
                    <TableCell>{t("business:pos.availability")}</TableCell>
                  </>}
                  <TableCell align="right" width={96} sx={{ whiteSpace: "nowrap" }}>{t("core:actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <Fragment key={`${row.code}-${idx}`}>
                    <TableRow
                      sx={{
                        backgroundColor: !row.isValid
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

                      {/* Action Type (Nuevo / Actualizar) */}
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
                        </Box>
                      </TableCell>

                      <TableCell sx={{ fontWeight: 600, maxWidth: 240, overflowWrap: "anywhere" }}>{row.code || "-"}</TableCell>
                      <TableCell sx={{ minWidth: 160, maxWidth: 280, overflowWrap: "anywhere" }}>{row.name}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {Number.isFinite(row.cost_price) ? `$${row.cost_price.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {Number.isFinite(row.cost_price_tax) ? `$${row.cost_price_tax.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <span>{Number.isFinite(row.sale_price) ? `$${row.sale_price.toLocaleString()}` : "-"}</span>
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
                      {showInvoiceDetails && <>
                      <TableCell align="right">{Number.isFinite(row.quantity) ? row.quantity : "—"}</TableCell>
                      <TableCell><SelectSingleInput label={t("business:pos.availability")}
                        value={typeof row.has_stock === "boolean" ? String(row.has_stock) : null}
                        options={[{ value: "true", label: t("business:pos.available") }, { value: "false", label: t("business:pos.unavailable") }]}
                        onChange={value => { if (!isBusy && !analysisIntent.current) setRows(previous => previous.map((item,index) => index === idx ? { ...item, has_stock: value === null ? undefined : value === "true" } : item)); }}
                        disabled={isBusy || Boolean(row.id)} placeholder={t(row.id ? "business:pos.preserve_existing" : "business:pos.choose_availability")}
                      /></TableCell>

                      </>}

                      <TableCell align="right">
                        <InvoiceRowActions index={idx} disabled={isBusy}
                          onMatch={() => { if (!isBusy && !analysisIntent.current) setMatchingRow({ businessId, row }); }}
                          onEdit={() => handleOpenEdit(idx)} onRemove={() => handleRemoveRow(idx)} />
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
                        <TableCell sx={{ color: "text.secondary", maxWidth: 240, overflowWrap: "anywhere" }}>{row.historicalProduct.code}</TableCell>
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
                        <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 500 }}>
                          ${row.historicalProduct.sale_price.toLocaleString()}
                        </TableCell>
                        {showInvoiceDetails && <>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>—</TableCell>
                          <TableCell align="center">—</TableCell>
                        </>}
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

      {matchingRow && <InvoiceProductMatch key={rows.indexOf(matchingRow.row)} businessId={businessId} row={matchingRow.row} disabled={isBusy || matchingRow.businessId !== businessId} onClose={() => setMatchingRow(null)} onApply={handleBindProduct} />}

      {/* Row Edit Modal */}
      <BaseModal
        open={editingIndex !== null}
        onClose={() => { if (!isBusy && !analysisIntent.current) setEditingIndex(null); }}
        title={t("business:edit_invoice_item_title")}
        size="md"
        actions={
          <ModalActionsContainer>
            <Button
              variant="contained"
              color="error"
              disabled={isBusy} onClick={() => { if (!isBusy && !analysisIntent.current) setEditingIndex(null); }}
              data-testid="cancel-row-edit"
              sx={{ borderRadius: 2, px: 2.5 }}
            >
              {t("core:cancel")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              disabled={isBusy}
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
          <SelectSingleInput
            label={t("business:pos.availability")}
            value={typeof editFormData.has_stock === "boolean" ? String(editFormData.has_stock) : null}
            options={[{ value: "true", label: t("business:pos.available") }, { value: "false", label: t("business:pos.unavailable") }]}
            onChange={(value) => { if (!isBusy && !analysisIntent.current) setEditFormData(previous => ({ ...previous, has_stock: value === null ? undefined : value === "true" })); }}
            disabled={isBusy || Boolean(editFormData.id)}
            placeholder={t(editFormData.id ? "business:pos.preserve_existing" : "business:pos.choose_availability")}
          />
          {/* is_active Switch at top, matching Core pattern */}
          <SwitchWrapper>
            <StyledFormControlLabel
              control={
                  <StyledSwitch
                    disabled={isBusy || Boolean(editFormData.manual_match)}
                  checked={editFormData.is_active ?? true}
                  onChange={(e) => { if (!isBusy && !analysisIntent.current) setEditFormData((prev) => ({ ...prev, is_active: e.target.checked })); }}
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
                id="edit-field-code" disabled={isBusy}
                name="code"
                label={t("business:product_code")}
                value={editFormData.code ?? ""}
                onChange={(e) => { if (!isBusy && !analysisIntent.current) setEditFormData((prev) => ({ ...prev, code: e.target.value })); }}
                required
                data-testid="edit-field-code"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="edit-field-name" disabled={isBusy}
                name="name"
                label={t("business:product_name")}
                value={editFormData.name ?? ""}
                onChange={(e) => { if (!isBusy && !analysisIntent.current) setEditFormData((prev) => ({ ...prev, name: e.target.value })); }}
                required
                data-testid="edit-field-name"
              />
            </Grid>

            {/* Row 2: Costo Base sin Impuesto, Impuesto % auxiliar, Costo Base con Impuestos */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="edit-field-cost" disabled={isBusy}
                name="cost_price"
                type="number"
                label={t("business:product_cost_price")}
                value={numericInputValue(editFormData.cost_price)}
                onChange={(e) => handleCostPriceChange(parseNumericInput(e.target.value))}
                required
                data-testid="edit-field-cost"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="edit-field-tax-rate" disabled={isBusy}
                name="tax_rate"
                type="number"
                label={t("business:product_tax_rate")}
                value={numericInputValue(editTaxRate)}
                onChange={(e) => handleTaxRateChange(parseNumericInput(e.target.value))}
                data-testid="edit-field-tax-rate"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="edit-field-cost-tax" disabled={isBusy}
                name="cost_price_tax"
                type="number"
                label={t("business:product_cost_tax")}
                value={numericInputValue(editFormData.cost_price_tax)}
                onChange={(e) => handleCostPriceTaxChange(parseNumericInput(e.target.value))}
                data-testid="edit-field-cost-tax"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="edit-field-sale" disabled={isBusy}
                name="sale_price"
                type="number"
                label={t("business:product_sale_price")}
                value={numericInputValue(editFormData.sale_price)}
                onChange={(e) => handleSalePriceChange(parseNumericInput(e.target.value))}
                required
                data-testid="edit-field-sale"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <PriceSuggestion key={editingIndex} costPriceTax={editFormData.cost_price_tax ?? null} disabled={isBusy} onApply={handleSalePriceChange} />
            </Grid>

            {/* Invoice quantity remains separate from catalog stock. */}
            <Grid size={{ xs: 12 }}>
              <TextInput
                id="edit-field-stock" disabled={isBusy}
                name="quantity"
                type="number"
                label={t("business:pos.invoice_quantity")}
                value={numericInputValue(editFormData.quantity)}
                onChange={(e) => { if (!isBusy && !analysisIntent.current) setEditFormData((prev) => ({ ...prev, quantity: parseNumericInput(e.target.value) })); }}
                required
                data-testid="edit-field-stock"
              />
            </Grid>
          </Grid>
        </FormContainer>
      </BaseModal>
    </BusinessWorkflow>
  );
};

export default ProductInvoiceImport;
