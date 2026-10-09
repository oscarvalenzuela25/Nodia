import { notifyHttpError } from "../../../../../../../../config/httpFeedback";
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
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
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
  const { t } = useTranslation(["business", "core"]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToResults = useRef<boolean>(false);
  const analysisIntent = useRef(false);

  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedProviderTax, setSelectedProviderTax] = useState<number | null>(null);
  const [isPreparingDraft, setIsPreparingDraft] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<InvoiceProvisionalRow[]>([]);
  const [invoiceCode, setInvoiceCode] = useState<string>("");
  const [invoiceTotalAmount, setInvoiceTotalAmount] = useState<number>(0);
  const [invoiceIssueDate, setInvoiceIssueDate] = useState<string>("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InvoiceProvisionalRow>>({});
  const [editTaxRate, setEditTaxRate] = useState<number>(19);
  const [isSaving, setIsSaving] = useState(false);

  const { data: iaProvidersData, isLoading: isVerifyingProviders, isFetching: isFetchingAiProviders, isError: aiProvidersError, refetch: refetchAiProviders } = useVerifyIaProviders();
  const providersList = useMemo(() => {
    return normalizeVerifyProviders(iaProvidersData);
  }, [iaProvidersData]);

  const [lastUsedProvider, setLastUsedProvider] = useState<VerifyIaProviderItem | null>(null);
  const [useThinkingMode, setUseThinkingMode] = useState<boolean>(false);
  const [selectedAiProviderId, setSelectedAiProviderId] = useState<string | null>(null);
  const [modeSelection, setModeSelection] = useState<{ providerId: string; mode: InvoiceAiMode } | null>(null);
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
  const currentSupportsThinking = aiConfiguration.supportsThinking;
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
  const observation = useAnalysisObservation(businessId);
  const createInvoiceMutation = useCreateInvoiceWithFile();
  const bulkCreateMutation = useBulkCreateProducts();
  const bulkUpdateMutation = useBulkUpdateProducts();

  const isAnalyzing = analyzeMutation.isPending;
  const isBusy =
    isAnalyzing || isPreparingDraft || isFetchingAiProviders || isFetchingProducts || providerQuery.isFetching ||
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

  const handleAnalyze = async (
    provider: VerifyIaProviderItem,
    modeToUse?: InvoiceAiMode | null
  ) => {
    const effectiveMode = modeToUse ?? selectedAiMode;
    const configuration = resolveInvoiceAiConfiguration(provider, effectiveMode);
    if (analysisIntent.current || !file || !selectedProviderId || selectedProviderTax === null || productsError || isBusy || !configuration.canAnalyze || !effectiveMode) return;
    analysisIntent.current = true;
    setLastUsedProvider(provider);
    const targetModel = configuration.model;
    const modelType = "default" as const;
    const shouldSendThinking = effectiveMode === "token_plan_web" && useThinkingMode && configuration.supportsThinking;
    const effectiveThinkingLevel = effectiveMode === "token_plan_agentic" || effectiveMode === "api_key"
      ? configuration.thinkingLevel : undefined;

    setIsPreparingDraft(true);
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
        extended_thinking: effectiveMode === "api_key" ? undefined : shouldSendThinking,
        thinking_level: effectiveThinkingLevel,
      };
      transport = await observation.start(params);
      const response = await analyzeMutation.mutateAsync({ file, ...params, ...transport });
      if (!transport.isCurrent()) return;
      observation.preparing();

      setInvoiceCode(response.code || "");
      setInvoiceTotalAmount(response.total_amount ?? Number.NaN);
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
        observation.emit('history_loading');
        try {
          const logsResponse = await getProductLogs({
            all: true,
            q: {
              product_id_in: matchedProductIds,
              s: "created_at desc",
            },
          });
          historicalLogs = logsResponse.data || [];
        } catch (error) {
          if (!transport.isCurrent()) return;
          notifyHttpError(error);
          observation.emit('history_unavailable');
          // Graceful fallback: existingProducts already provides catalog snapshot
        }
      }

      if (!transport.isCurrent()) return;
      observation.emit('rows_preparing');
      const mappedRows = mapExtractedItemsToRows(
        items,
        existingProducts,
        historicalLogs,
        selectedProviderTax
      );
      shouldScrollToResults.current = true;
      setRows(mappedRows);
      observation.emit('draft_ready');
      observation.finish();
    } catch (error) {
      if (!transport || transport.isCurrent()) observation.finish(error);
      // Error handled by mutation onError
    } finally {
      analysisIntent.current = false;
      setIsPreparingDraft(false);
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
    setRows((prev) => validateInvoiceRows(prev.filter((_, idx) => idx !== index)));
  };

  const handleOpenEdit = (index: number) => {
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
      return validateInvoiceRows(copy).sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
    });

    setEditingIndex(null);
  };

  const handleSubmitAll = async () => {
    if (rows.length === 0 || hasErrors || isBusy || !invoiceCode.trim() || !file || !Number.isFinite(invoiceTotalAmount) || invoiceTotalAmount < 0) {
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
      // A transactional confirmation endpoint is still required in Server.
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
      <QueryErrorAlert isError={aiProvidersError || productsError || providerQuery.isError} isFetching={isBusy} onRetry={() => Promise.all([refetchAiProviders(), refetchProducts(), providerQuery.refetch()])} />
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
          <Box
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
                onSearchChange={providerQuery.setSearch} hasMore={providerQuery.hasNextPage}
                onLoadMore={() => { void providerQuery.fetchNextPage(); }} loadingOptions={providerQuery.isFetching}
                value={selectedProviderId || null}
                onChange={(val) => { setSelectedProviderId(val ?? ""); setSelectedProviderTax(providerQuery.providers.find((provider) => provider.id === val)?.tax ?? null); }}
                placeholder={t("business:select_provider_placeholder", "Seleccionar proveedor...")}
                searchPlaceholder={t("business:search_provider_placeholder", "Buscar proveedor...")}
                disabled={isBusy}
                dataTestId="invoice-provider-select"
                helperText={t("business:select_provider_helper")}
                clearable
              />
            </Box>

            {/* Thinking Mode Checkbox (ONLY for token_plan_web) */}
            {Boolean(file && currentSupportsThinking && selectedAiMode === "token_plan_web") && (
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Tooltip
                  title={t("business:use_thinking_mode_tooltip")}
                  arrow
                  placement="top"
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={useThinkingMode}
                        onChange={(e) => setUseThinkingMode(e.target.checked)}
                        disabled={isBusy}
                        size="small"
                        color="primary"
                        data-testid="use-thinking-mode-checkbox"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t("business:use_thinking_mode")}
                      </Typography>
                    }
                    sx={{ m: 0, userSelect: "none" }}
                  />
                </Tooltip>
              </Box>
            )}
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
                        if (val) {
                          setSelectedAiProviderId(val);
                          setModeSelection(null);
                          setUseThinkingMode(false);
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
                          if (currentAiProvider && isInvoiceAiMode(val)) {
                            setModeSelection({ providerId: currentAiProvider.id, mode: val });
                            setUseThinkingMode(false);
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
                    alignItems: "center",
                    alignSelf: "flex-end",
                    gap: 1,
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  <Tooltip
                    title={
                      !currentAiProvider
                        ? t("business:no_ai_providers_available", "No hay proveedores de IA disponibles o autorizados.")
                        : !aiConfiguration.canAnalyze
                        ? (!aiConfiguration.model ? t("business:ai_model_unassigned") : currentAiProvider?.error) ||
                          (currentAiProvider?.key === "gemini"
                            ? t("business:gemini_session_expired_tooltip")
                            : t("business:provider_unavailable"))
                        : ""
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

                  {!aiConfiguration.canAnalyze && !isVerifyingProviders && (
                    <Tooltip
                      title={
                        currentAiProvider?.error ||
                        (currentAiProvider?.key === "gemini"
                          ? t("business:gemini_session_expired_tooltip")
                          : t("business:provider_unavailable"))
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
              sx={{ mt: 2, borderRadius: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    const target =
                      lastUsedProvider ||
                      providersList.find((p) => p.can_use_model) ||
                      providersList[0];
                    if (target) {
                      handleAnalyze(target);
                    }
                  }}
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
            onClick={() => !isUploadDisabled && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="invoice-dropzone"
            role="button"
            tabIndex={isUploadDisabled ? -1 : 0}
            aria-label={t("business:invoice_file_prompt")}
            onKeyDown={(event) => { if (!isUploadDisabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fileInputRef.current?.click(); } }}
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
              value={numericInputValue(invoiceTotalAmount)}
              onChange={(e) => setInvoiceTotalAmount(parseNumericInput(e.target.value))}
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
                disabled={hasErrors || rows.length === 0 || isBusy || !invoiceCode.trim() || !Number.isFinite(invoiceTotalAmount) || invoiceTotalAmount < 0}
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
                  <TableCell width={110}>{t("business:product_status")}</TableCell>
                  <TableCell>{t("business:product_code")}</TableCell>
                  <TableCell>{t("business:product_name")}</TableCell>
                  <TableCell align="right">{t("business:product_cost_price")}</TableCell>
                  <TableCell align="right">{t("business:product_cost_tax")}</TableCell>
                  <TableCell align="right">{t("business:product_profit_margin")}</TableCell>
                  <TableCell align="right">{t("business:product_sale_price")}</TableCell>
                  <TableCell align="right">{t("business:product_stock")}</TableCell>
                  <TableCell width={48} align="center">
                    <LockOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </TableCell>
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
                        {Number.isFinite(row.cost_price) ? `$${row.cost_price.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell align="right">
                        {Number.isFinite(row.cost_price_tax) ? `$${row.cost_price_tax.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell align="right">{Number.isFinite(row.profit_percentage) ? `${row.profit_percentage}%` : "—"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
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
                      <TableCell align="right">{Number.isFinite(row.stock) ? row.stock : "—"}</TableCell>

                      {/* Lock Checkbox (Moved to the right) */}
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
                        <TableCell align="center">
                          <Typography variant="caption" color="text.disabled">-</Typography>
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
                value={numericInputValue(editFormData.cost_price)}
                onChange={(e) => handleCostPriceChange(parseNumericInput(e.target.value))}
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
                value={numericInputValue(editTaxRate)}
                onChange={(e) => handleTaxRateChange(parseNumericInput(e.target.value))}
                data-testid="edit-field-tax-rate"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextInput
                id="edit-field-cost-tax"
                name="cost_price_tax"
                type="number"
                label={t("business:product_cost_tax")}
                value={numericInputValue(editFormData.cost_price_tax)}
                onChange={(e) => handleCostPriceTaxChange(parseNumericInput(e.target.value))}
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
                value={numericInputValue(editFormData.profit_percentage)}
                onChange={(e) => handleProfitMarginChange(parseNumericInput(e.target.value))}
                data-testid="edit-field-margin"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInput
                id="edit-field-sale"
                name="sale_price"
                type="number"
                label={t("business:product_sale_price")}
                value={numericInputValue(editFormData.sale_price)}
                onChange={(e) => handleSalePriceChange(parseNumericInput(e.target.value))}
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
                value={numericInputValue(editFormData.stock)}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    stock: parseNumericInput(e.target.value),
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
