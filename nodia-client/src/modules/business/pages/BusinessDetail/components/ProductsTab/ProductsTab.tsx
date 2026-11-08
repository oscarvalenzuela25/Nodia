import BusinessPagination from "../../../../components/BusinessPagination";
import { TABLE_PANEL_RADIUS } from "../../../../../../theme/tablePanel";
import { ProductMobileCard } from "../../../../components/BusinessMobileCards/BusinessMobileCards";
import { useMediaQuery, useTheme } from "@mui/material";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import {
  usePagedProviderOptions,
  usePagedProductCodeOptions,
} from "../../../../infrastructure/usePagedOptions";
import type { FC, MouseEvent } from "react";
import { useState, useMemo, Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
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
import { styled } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ReceiptIcon from "@mui/icons-material/Receipt";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";

import { TableSkeleton } from "../../../../../../components/skeletons";
import InputSearch from "../../../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../../../components/inputs/SelectMultipleInput";
import ActiveStatusSelect from "../../../../../../components/Filter/components/ActiveStatusSelect";
import TextInput from "../../../../../../components/inputs/TextInput";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import Filter from "../../../../../../components/Filter";
import FilterChips from "../../../../../../components/Filter/components/FilterChips";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useExportProductsCsv,
} from "../../../../infrastructure/useServices";
import type {
  ProductEntity,
  ProductLogEntity,
  CreateProductPayload,
  UpdateProductPayload,
} from "../../../../infrastructure/types";
import ProductModal, { type ProductFormData } from "./components/ProductModal";
import ProductImageModal from "./components/ProductImageModal";
import ProductImageThumbnail from "./components/ProductImageThumbnail";
import ProductSalePrice from "./components/ProductSalePrice";
import type { ProductSaveTarget } from "./components/ProductModal/hooks/useDeferredProductSave";
import ProductBulkImport from "./components/ProductBulkImport";
import ProductInvoiceImport from "./components/ProductInvoiceImport";
import {
  exportProductsToCSV,
  downloadCSVFile,
} from "./components/ProductBulkImport/helpers";
import {
  calculatePriceDiff,
  resolveHistoricalLog,
  getPriceChangeStatus,
  priceMeasurementsComparable,
  type PriceChangeStatus,
} from "./helpers";
import { StatusDot } from "../../styles";

const ActiveFilters = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  alignItems: "center",
}));

const AdditionalColumnHeader = styled(TableCell)(({ theme }) => ({
  "&&": {
    backgroundColor: theme.palette.primary.dark,
    color: theme.palette.getContrastText(theme.palette.primary.dark),
  },
}));

interface Props {
  businessId: string;
  isCreateModalOpenDirectly?: boolean;
  onCloseDirectCreateModal?: () => void;
}

export const ProductsTab: FC<Props> = ({
  businessId,
  isCreateModalOpenDirectly = false,
  onCloseDirectCreateModal,
}) => {
  const { t, i18n } = useTranslation(["business", "core"]);
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "-";
      const locale = i18n.language.startsWith("en") ? "en-US" : "es-ES";
      return d.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  const [search, setSearch] = useState("");
  const [showAdditionalColumns, setShowAdditionalColumns] = useState(false);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isInvoiceMode, setIsInvoiceMode] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [downloadMenuAnchorEl, setDownloadMenuAnchorEl] =
    useState<null | HTMLElement>(null);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [imageProduct, setImageProduct] = useState<ProductEntity | null>(null);
  const [imageBusinessId, setImageBusinessId] = useState(businessId);
  if (imageBusinessId !== businessId) { setImageBusinessId(businessId); setImageProduct(null); }
  const [selectedProduct, setSelectedProduct] = useState<ProductEntity | null>(
    null,
  );

  // 3-Dots Action Menu state
  const [actionMenuAnchorEl, setActionMenuAnchorEl] =
    useState<null | HTMLElement>(null);
  const [menuProduct, setMenuProduct] = useState<ProductEntity | null>(null);

  // Confirm Dialog state
  const [confirmToggleProduct, setConfirmToggleProduct] =
    useState<ProductEntity | null>(null);

  // Filter modal draft state
  const [draftFilterCodes, setDraftFilterCodes] = useState<string[]>([]);
  const [draftFilterName, setDraftFilterName] = useState<string>("");
  const [draftFilterProviders, setDraftFilterProviders] = useState<string[]>(
    [],
  );
  const [draftFilterStock, setDraftFilterStock] = useState<
    ("available" | "unavailable" | "unknown")[]
  >([]);
  const [draftFilterActive, setDraftFilterActive] = useState<
    "active" | "inactive" | null
  >("active");
  const [draftFilterPriceChange, setDraftFilterPriceChange] = useState<
    PriceChangeStatus[]
  >([]);

  // Applied filter state
  const [appliedFilterCodes, setAppliedFilterCodes] = useState<string[]>([]);
  const [appliedFilterName, setAppliedFilterName] = useState<string>("");
  const [appliedFilterProviders, setAppliedFilterProviders] = useState<
    string[]
  >([]);
  const [appliedFilterStock, setAppliedFilterStock] = useState<
    ("available" | "unavailable" | "unknown")[]
  >([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<
    "active" | "inactive" | null
  >("active");
  const [appliedFilterPriceChange, setAppliedFilterPriceChange] = useState<
    PriceChangeStatus[]
  >([]);

  // Expanded rows state for historical log
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const handleToggleExpand = (productId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const providerQuery = usePagedProviderOptions(businessId);
  const codeQuery = usePagedProductCodeOptions(businessId);
  const providers = providerQuery.providers;
  const providerOptions = providerQuery.options;
  const codeOptions = codeQuery.options;

  const stockOptions = useMemo(
    () => [
      { value: "unavailable", label: t("business:pos.unavailable") },
      { value: "unknown", label: t("business:pos.availability_unknown") },
      { value: "available", label: t("business:pos.available") },
    ],
    [t],
  );


  const priceChangeOptions = useMemo(
    () => [
      { value: "increased", label: t("business:price_change_increased") },
      { value: "decreased", label: t("business:price_change_decreased") },
      { value: "unchanged", label: t("business:price_change_unchanged") },
    ],
    [t],
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterCodes.length > 0) count += appliedFilterCodes.length;
    if (appliedFilterName.trim()) count += 1;
    if (appliedFilterProviders.length > 0)
      count += appliedFilterProviders.length;
    if (appliedFilterStock.length > 0) count += appliedFilterStock.length;
    if (appliedFilterActive !== null) count += 1;
    if (appliedFilterPriceChange.length > 0)
      count += appliedFilterPriceChange.length;
    return count;
  }, [
    appliedFilterCodes,
    appliedFilterName,
    appliedFilterProviders,
    appliedFilterStock,
    appliedFilterActive,
    appliedFilterPriceChange,
  ]);

  const {
    data: productsData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useProducts({
    page: page + 1,
    limit: rowsPerPage,
    includes: true,
    q: {
      business_id_eq: businessId,
      name_cont:
        [appliedFilterName.trim(), search.trim()].filter(Boolean).join(" ") ||
        undefined,
      code_in: appliedFilterCodes.length > 0 ? appliedFilterCodes : undefined,
      provider_id_in:
        appliedFilterProviders.length > 0 ? appliedFilterProviders : undefined,
      availability_in:
        appliedFilterStock.length > 0 ? appliedFilterStock : undefined,
      price_change_in:
        appliedFilterPriceChange.length > 0
          ? appliedFilterPriceChange
          : undefined,
      is_active_eq:
        appliedFilterActive === "active"
          ? true
          : appliedFilterActive === "inactive"
            ? false
            : undefined,
      s: "created_at desc",
    },
  });
  const products = useMemo(
    () => productsData?.data ?? [],
    [productsData?.data],
  );

  // Server supplies one bounded, authoritative previous normal-price snapshot per product.
  const productLogs = useMemo(() => products.flatMap((product) => product.previous_price_snapshot ? [product.previous_price_snapshot] : []), [products]);

  const logsByProductId = useMemo(() => {
    const map = new Map<string, ProductLogEntity[]>();
    for (const log of productLogs) {
      if (!log.product_id) continue;
      const arr = map.get(log.product_id) || [];
      arr.push(log);
      map.set(log.product_id, arr);
    }
    return map;
  }, [productLogs]);

  const logsByCode = useMemo(() => {
    const map = new Map<string, ProductLogEntity[]>();
    for (const log of productLogs) {
      if (!log.code) continue;
      const key = log.code.trim().toLowerCase();
      const arr = map.get(key) || [];
      arr.push(log);
      map.set(key, arr);
    }
    return map;
  }, [productLogs]);

  const displayedProducts = useMemo(() => {
    if (appliedFilterPriceChange.length === 0) return products;
    return products.filter((prod) => {
      const pLogs = (logsByProductId.get(prod.id) || []).concat(
        (prod.code ? logsByCode.get(prod.code.trim().toLowerCase()) : undefined) || [],
      );
      const histLog = resolveHistoricalLog(prod, pLogs);
      if (histLog && !priceMeasurementsComparable(prod, histLog)) return false;
      const status = getPriceChangeStatus(prod, histLog);
      return appliedFilterPriceChange.includes(status);
    });
  }, [products, appliedFilterPriceChange, logsByProductId, logsByCode]);

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const exportMutation = useExportProductsCsv();
  const isBusy =
    isLoading ||
    isFetching ||
    createMutation.isPending ||
    updateMutation.isPending;
  const isExporting = exportMutation.isPending;

  const handleOpenMenu = (e: MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(e.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
  };

  const handleOpenDownloadMenu = (e: MouseEvent<HTMLButtonElement>) => {
    setDownloadMenuAnchorEl(e.currentTarget);
  };

  const handleCloseDownloadMenu = () => {
    setDownloadMenuAnchorEl(null);
  };

  const handleDownloadCurrentView = () => {
    handleCloseDownloadMenu();
    if (products.length === 0) {
      sileo.warning({
        title: t("business:download_empty_warning"),
      });
      return;
    }
    const csvContent = exportProductsToCSV(products, i18n.language);
    const filename = i18n.language?.startsWith("en")
      ? "products_view.csv"
      : "productos_vista.csv";
    downloadCSVFile(csvContent, filename);
    sileo.success({
      title: t("business:download_success_title"),
    });
  };

  const handleDownloadAll = async () => {
    handleCloseDownloadMenu();
    try {
      const csvData = await exportMutation.mutateAsync({
        business_id: businessId,
        lang: i18n.language,
      });
      const filename = i18n.language?.startsWith("en")
        ? "products_all.csv"
        : "productos_todos.csv";
      downloadCSVFile(csvData, filename);
      sileo.success({
        title: t("business:download_success_title"),
      });
    } catch {
      // Handled by onError in useExportProductsCsv hook
    }
  };

  const handleOpenAddSingle = () => {
    handleCloseMenu();
    setSelectedProduct(null);
    setIsSingleModalOpen(true);
  };

  const handleOpenBulk = () => {
    handleCloseMenu();
    setIsBulkMode(true);
  };

  const handleOpenInvoice = () => {
    handleCloseMenu();
    setIsInvoiceMode(true);
  };

  const handleOpenEdit = (product: ProductEntity) => {
    setSelectedProduct(product);
    setIsSingleModalOpen(true);
  };

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    product: ProductEntity,
  ) => {
    setActionMenuAnchorEl(e.currentTarget);
    setMenuProduct(product);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchorEl(null);
  };

  const handleConfirmToggle = async () => {
    if (!confirmToggleProduct) return;
    try {
      await updateMutation.mutateAsync({
        id: confirmToggleProduct.id,
        payload: { is_active: !confirmToggleProduct.is_active },
      });
      setConfirmToggleProduct(null);
    } catch {
      // Keep confirm dialog open on error
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilterCodes(draftFilterCodes);
    setAppliedFilterName(draftFilterName);
    setAppliedFilterProviders(draftFilterProviders);
    setAppliedFilterStock(draftFilterStock);
    setAppliedFilterActive(draftFilterActive);
    setAppliedFilterPriceChange(draftFilterPriceChange);
    setPage(0);
  };

  const handleClearFilters = () => {
    setDraftFilterCodes([]);
    setDraftFilterName("");
    setDraftFilterProviders([]);
    setDraftFilterStock([]);
    setDraftFilterActive("active");
    setDraftFilterPriceChange([]);
    setAppliedFilterCodes([]);
    setAppliedFilterName("");
    setAppliedFilterProviders([]);
    setAppliedFilterStock([]);
    setAppliedFilterActive("active");
    setAppliedFilterPriceChange([]);
    setPage(0);
  };

  const handleFormSubmit = async (data: ProductFormData, target?: ProductSaveTarget): Promise<ProductEntity> => {
      if (data.has_stock === null) throw new Error(t("business:pos.choose_availability"));
      const productId = target?.id ?? selectedProduct?.id;
      if (productId) {
        const payload: UpdateProductPayload = {
          expected_version: target?.version ?? data.expected_version ?? selectedProduct?.version,
          code: data.code,
          measurement_unit: data.measurement_unit,
          name: data.name,
          cost_price: data.cost_price,
          cost_price_tax: data.cost_price_tax,
          sale_price: data.sale_price,
          barcode: data.barcode,
          offer_price: data.offer_price,
          is_offer_enabled: data.is_offer_enabled,
          has_stock: data.has_stock ?? undefined,
          provider_id: data.provider_id || null,
          is_active: data.is_active,
        };
        return updateMutation.mutateAsync({ id: productId, payload });
      } else {
        const payload: CreateProductPayload = {
          business_id: businessId,
          code: data.code,
          measurement_unit: data.measurement_unit,
          name: data.name,
          cost_price: data.cost_price,
          cost_price_tax: data.cost_price_tax,
          sale_price: data.sale_price,
          barcode: data.barcode,
          offer_price: data.offer_price,
          is_offer_enabled: data.is_offer_enabled,
          has_stock: data.has_stock,
          provider_id: data.provider_id || null,
          is_active: data.is_active,
        };
        return createMutation.mutateAsync(payload);
      }
  };

  // If bulk import view is active
  if (isBulkMode) {
    return (
      <ProductBulkImport
        businessId={businessId}
        onCancel={() => setIsBulkMode(false)}
        onSuccess={() => {
          setIsBulkMode(false);
          void refetch();
        }}
      />
    );
  }

  // If invoice import view is active
  if (isInvoiceMode) {
    return (
      <ProductInvoiceImport
        businessId={businessId}
        onCancel={() => setIsInvoiceMode(false)}
        onSuccess={() => {
          setIsInvoiceMode(false);
          void refetch();
        }}
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <QueryErrorAlert
        isError={isError}
        isFetching={isFetching}
        onRetry={refetch}
      />
      {/* Filter Row */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Filter
          disabled={isBusy}
          onOpen={() => setDraftFilterActive(appliedFilterActive)}
          onFilter={handleApplyFilters}
          onClear={handleClearFilters}
          activeCount={activeFiltersCount}
          title={t("business:filter_products_title")}
          subtitle={t("business:filter_products_subtitle")}
        >
          <SelectMultipleInput
            label={t("business:filter_code_label")}
            placeholder={t("business:filter_code_placeholder")}
            options={codeOptions}
            onSearchChange={codeQuery.setSearch}
            hasMore={codeQuery.hasNextPage}
            onLoadMore={() => {
              void codeQuery.fetchNextPage();
            }}
            loadingOptions={codeQuery.isFetching}
            value={draftFilterCodes}
            onChange={setDraftFilterCodes}
            disabled={isLoading || isFetching}
          />

          <TextInput
            label={t("business:filter_name_label")}
            placeholder={t("business:filter_name_placeholder")}
            value={draftFilterName}
            onChange={(e) => setDraftFilterName(e.target.value)}
            disabled={isLoading || isFetching}
            dataTestId="filter-product-name-input"
          />

          <SelectMultipleInput
            label={t("business:filter_provider_label")}
            placeholder={t("business:filter_provider_placeholder")}
            options={providerOptions}
            onSearchChange={providerQuery.setSearch}
            hasMore={providerQuery.hasNextPage}
            onLoadMore={() => {
              void providerQuery.fetchNextPage();
            }}
            loadingOptions={providerQuery.isFetching}
            value={draftFilterProviders}
            onChange={setDraftFilterProviders}
            disabled={isLoading || isFetching}
          />

          <SelectMultipleInput
            label={t("business:pos.availability")}
            placeholder={t("business:filter_stock_placeholder")}
            options={stockOptions}
            value={draftFilterStock}
            onChange={(vals) =>
              setDraftFilterStock(vals as ("available" | "unavailable" | "unknown")[])
            }
            disabled={isLoading || isFetching}
          />

          <ActiveStatusSelect
            value={draftFilterActive ?? "all"}
            onChange={(value) => setDraftFilterActive(value === "all" ? null : value)}
            disabled={isBusy}
          />

          <SelectMultipleInput
            label={t("business:filter_price_change_label")}
            placeholder={t("business:filter_price_change_placeholder")}
            options={priceChangeOptions}
            value={draftFilterPriceChange}
            onChange={(vals) =>
              setDraftFilterPriceChange(vals as PriceChangeStatus[])
            }
            disabled={isLoading || isFetching}
          />
        </Filter>
      </Box>

      {/* Active Filters Chips */}
      {activeFiltersCount > 0 && (
        <ActiveFilters sx={{ mb: 2 }}>
          {appliedFilterCodes.map((code) => (
            <FilterChips
              key={`code-${code}`}
              label={t("business:filter_chips_code", { value: code })}
              onAction={() => {
                setAppliedFilterCodes((prev) => prev.filter((c) => c !== code));
                setDraftFilterCodes((prev) => prev.filter((c) => c !== code));
                setPage(0);
              }}
            />
          ))}
          {appliedFilterName.trim() && (
            <FilterChips
              label={t("business:filter_chips_name", {
                value: appliedFilterName,
              })}
              onAction={() => {
                setAppliedFilterName("");
                setDraftFilterName("");
                setPage(0);
              }}
            />
          )}
          {appliedFilterProviders.map((provId) => {
            const prov = providers.find((p) => p.id === provId);
            const provName = prov?.name || provId;
            return (
              <FilterChips
                key={`prov-${provId}`}
                label={t("business:filter_chips_provider", { value: provName })}
                onAction={() => {
                  setAppliedFilterProviders((prev) =>
                    prev.filter((p) => p !== provId),
                  );
                  setDraftFilterProviders((prev) =>
                    prev.filter((p) => p !== provId),
                  );
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterStock.map((stockVariant) => {
            const stockLabel = t(`business:pos.${stockVariant === "unknown" ? "availability_unknown" : stockVariant}`);
            return (
              <FilterChips
                key={`stock-${stockVariant}`}
                label={t("business:filter_chips_stock", { value: stockLabel })}
                onAction={() => {
                  setAppliedFilterStock((prev) =>
                    prev.filter((s) => s !== stockVariant),
                  );
                  setDraftFilterStock((prev) =>
                    prev.filter((s) => s !== stockVariant),
                  );
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterActive !== null && (
            <FilterChips
              label={t("business:filter_chips_status", {
                value:
                  appliedFilterActive === "active"
                    ? t("business:status_active")
                    : t("business:status_inactive"),
              })}
              onAction={() => {
                setAppliedFilterActive(null);
                setDraftFilterActive(null);
                setPage(0);
              }}
            />
          )}
          {appliedFilterPriceChange.map((variation) => {
            const label =
              variation === "increased"
                ? t("business:price_change_increased")
                : variation === "decreased"
                  ? t("business:price_change_decreased")
                  : t("business:price_change_unchanged");
            return (
              <FilterChips
                key={`price-change-${variation}`}
                label={t("business:filter_chips_price_change", {
                  value: label,
                })}
                onAction={() => {
                  setAppliedFilterPriceChange((prev) =>
                    prev.filter((v) => v !== variation),
                  );
                  setDraftFilterPriceChange((prev) =>
                    prev.filter((v) => v !== variation),
                  );
                  setPage(0);
                }}
              />
            );
          })}
        </ActiveFilters>
      )}

      {/* Action Toolbar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ width: { xs: "100%", sm: 320 } }}>
          <InputSearch
            value={search}
            onChange={(val: string) => {
              setSearch(val);
              setPage(0);
            }}
            placeholder={t("business:search_products_placeholder")}
            fullWidth
            disabled={isBusy}
          />
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexDirection: { xs: "column", sm: "row" },
            width: { xs: "100%", sm: "auto" },
            "& > button": {
              width: { xs: "100%", sm: "auto" },
              minHeight: { xs: 44, sm: "auto" },
            },
          }}
        >
          <Button
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            endIcon={<KeyboardArrowDownIcon />}
            onClick={handleOpenDownloadMenu}
            disabled={isExporting || isLoading}
            sx={{ borderRadius: 2 }}
            data-testid="download-products-csv-btn"
          >
            {t("business:download_csv")}
          </Button>

          <Menu
            anchorEl={downloadMenuAnchorEl}
            open={Boolean(downloadMenuAnchorEl)}
            onClose={handleCloseDownloadMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem
              onClick={handleDownloadCurrentView}
              data-testid="menu-download-current-view"
            >
              <ListItemIcon>
                <TableChartOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t("business:download_current_view")}</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={handleDownloadAll}
              data-testid="menu-download-all"
            >
              <ListItemIcon>
                <CloudDownloadOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t("business:download_all_data")}</ListItemText>
            </MenuItem>
          </Menu>

          <Button
            variant="contained"
            endIcon={<KeyboardArrowDownIcon />}
            onClick={handleOpenMenu}
            sx={{ borderRadius: 2 }}
            disabled={isBusy}
            data-testid="manage-products-btn"
          >
            {t("business:manage_products")}
          </Button>

          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleCloseMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem
              onClick={handleOpenAddSingle}
              data-testid="menu-add-single-product"
            >
              <AddCircleOutlinedIcon sx={{ mr: 1.5, fontSize: 20 }} />
              {t("business:add_single_product")}
            </MenuItem>
            <MenuItem
              onClick={handleOpenBulk}
              data-testid="menu-add-bulk-products"
            >
              <UploadFileIcon sx={{ mr: 1.5, fontSize: 20 }} />
              {t("business:add_bulk_products")}
            </MenuItem>
            <MenuItem
              onClick={handleOpenInvoice}
              data-testid="menu-add-invoice-products"
            >
              <ReceiptIcon sx={{ mr: 1.5, fontSize: 20 }} />
              {t("business:add_invoice_products")}
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Products Table */}
      <Paper
        sx={{
          borderRadius: TABLE_PANEL_RADIUS,
          p: { xs: 0, sm: 0 },
          border: (theme) =>
            mobile ? "none" : `1px solid ${theme.palette.divider}`,
          boxShadow: "none",
          bgcolor: mobile ? "transparent" : "background.paper",
          overflow: "hidden",
        }}
      >
        <Skeleton
          loading={isLoading}
          fallback={
            <TableSkeleton
              columns={[
                { width: 48, align: "center" },
                { header: t("business:product_code") },
                { header: t("business:product_name") },
                { align: "center", header: t("business:pos.image_column") },
                { header: t("business:product_provider") },
                { align: "right", header: t("business:product_cost_tax") },
                { align: "right", header: t("business:product_sale_price") },
                ...(showAdditionalColumns ? [
                  { align: "right" as const, header: t("business:pos.availability") },
                  { align: "center" as const, header: t("business:product_status") },
                  { align: "center" as const, header: t("business:product_updated_at") },
                ] : []),
                { align: "right", header: t("core:actions") },
              ]}
              rows={rowsPerPage > 10 ? 10 : rowsPerPage}
            />
          }
        >
          {mobile ? (
            <Box sx={{ display: "grid", gap: 2 }}>
              {displayedProducts.length === 0 && !isError ? (
                <Box sx={{ p: 2, textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {t("business:products_empty_title")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("business:products_empty_desc")}
                  </Typography>
                </Box>
              ) : (
                displayedProducts.map((prod) => (
                  <ProductMobileCard
                    key={prod.id}
                    product={prod}
                    disabled={isBusy}
                    formatDate={formatDateTime}
                    onEdit={handleOpenEdit}
                    onImage={setImageProduct}
                    onToggle={setConfirmToggleProduct}
                    expanded={Boolean(expandedRows[prod.id])}
                    onExpand={() => handleToggleExpand(prod.id)}
                    historical={resolveHistoricalLog(
                      prod,
                      (logsByProductId.get(prod.id) || []).concat(
                        (prod.code ? logsByCode.get(prod.code.trim().toLowerCase()) : undefined) || [],
                      ),
                    )}
                  />
                ))
              )}
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 48, p: 0.5 }} align="center" />
                    <TableCell>{t("business:product_code")}</TableCell>
                    <TableCell>{t("business:product_name")}</TableCell>
                    <TableCell align="center">{t("business:pos.image_column")}</TableCell>
                    <TableCell>{t("business:product_provider")}</TableCell>
                    <TableCell align="right">
                      {t("business:product_cost_tax")}
                    </TableCell>
                    <TableCell align="right">
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: .5 }}>
                        {t("business:product_sale_price")}
                        <Tooltip title={t(showAdditionalColumns ? "product:table_hide_additional_columns" : "product:table_show_additional_columns")}>
                          <Box component="span" sx={{ display: "inline-flex" }}>
                          <IconButton
                            color="inherit"
                            size="small"
                            aria-label={t(showAdditionalColumns ? "product:table_hide_additional_columns" : "product:table_show_additional_columns")}
                            aria-expanded={showAdditionalColumns}
                            disabled={isBusy}
                            onClick={() => setShowAdditionalColumns((shown) => !shown)}
                            sx={{ width: 44, height: 44, flexShrink: 0 }}
                          >
                            {showAdditionalColumns ? <RemoveRoundedIcon fontSize="small" /> : <AddRoundedIcon fontSize="small" />}
                          </IconButton>
                          </Box>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    {showAdditionalColumns && <>
                    <AdditionalColumnHeader align="right">
                      {t("business:pos.availability")}
                    </AdditionalColumnHeader>
                    <AdditionalColumnHeader align="center">
                      {t("business:product_status")}
                    </AdditionalColumnHeader>
                    <AdditionalColumnHeader align="center">
                      {t("business:product_updated_at")}
                    </AdditionalColumnHeader>
                    </>}
                    <TableCell align="right">{t("core:actions")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && displayedProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showAdditionalColumns ? 11 : 8} align="center" sx={{ py: 6 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600, mb: 0.5 }}
                        >
                          {t("business:products_empty_title")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("business:products_empty_desc")}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedProducts.map((prod) => {
                      const pLogs = (logsByProductId.get(prod.id) || []).concat(
                        (prod.code ? logsByCode.get(prod.code.trim().toLowerCase()) : undefined) || [],
                      );
                      const historicalLog = resolveHistoricalLog(prod, pLogs);
                      const comparable = !historicalLog || priceMeasurementsComparable(prod, historicalLog);
                      const priceDiff = comparable ? calculatePriceDiff(prod.sale_price, historicalLog?.sale_price) : null;
                      const isExpanded = Boolean(expandedRows[prod.id]);

                      return (
                        <Fragment key={prod.id}>
                          <TableRow hover>
                            <TableCell
                              sx={{ width: 48, p: 0.5 }}
                              align="center"
                            >
                              <Tooltip
                                title={
                                  isExpanded
                                    ? t("business:collapse_historical_tooltip")
                                    : t("business:expand_historical_tooltip")
                                }
                              >
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleToggleExpand(prod.id)}
                                    disabled={!historicalLog}
                                    aria-label={
                                      isExpanded
                                        ? t(
                                            "business:collapse_historical_tooltip",
                                          )
                                        : t(
                                            "business:expand_historical_tooltip",
                                          )
                                    }
                                    data-testid={`expand-product-btn-${prod.id}`}
                                    sx={{
                                      transition: "transform 0.2s ease-in-out",
                                      transform: isExpanded
                                        ? "rotate(180deg)"
                                        : "rotate(0deg)",
                                    }}
                                  >
                                    <KeyboardArrowDownIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, maxWidth: 200, overflowWrap: "anywhere" }}>
                              {prod.code ?? "—"}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 280, overflowWrap: "anywhere" }}><Typography variant="body2">{prod.name}</Typography></TableCell>
                            <TableCell align="center"><ProductImageThumbnail name={prod.name} image={prod.image} disabled={isBusy} onOpen={() => setImageProduct(prod)} /></TableCell>
                            <TableCell sx={{ maxWidth: 220, overflowWrap: "anywhere" }}>{prod.provider?.name ?? "-"}</TableCell>
                            <TableCell align="right">
                              ${(prod.cost_price_tax || 0).toLocaleString()}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-end",
                                  minWidth: "max-content",
                                }}
                              >
                                <ProductSalePrice measurementUnit={prod.measurement_unit} salePrice={prod.sale_price} offerPrice={prod.offer_price} offerEnabled={prod.is_offer_enabled} />
                                {priceDiff && (
                                  <Tooltip
                                    title={
                                      priceDiff.isIncrease
                                        ? t(
                                            "business:price_increased_tooltip",
                                            { percent: priceDiff.percent },
                                          )
                                        : t(
                                            "business:price_decreased_tooltip",
                                            { percent: priceDiff.percent },
                                          )
                                    }
                                  >
                                    <Box
                                      sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 0.25,
                                        color: priceDiff.isIncrease
                                          ? "error.main"
                                          : "success.main",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                      }}
                                      data-testid={`price-diff-${prod.id}`}
                                    >
                                      {priceDiff.isIncrease ? (
                                        <ArrowUpwardIcon
                                          sx={{ fontSize: 13 }}
                                        />
                                      ) : (
                                        <ArrowDownwardIcon
                                          sx={{ fontSize: 13 }}
                                        />
                                      )}
                                      <span>
                                        {priceDiff.isIncrease
                                          ? `+${priceDiff.percent}%`
                                          : `-${priceDiff.percent}%`}
                                      </span>
                                    </Box>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                            {showAdditionalColumns && <>
                            <TableCell align="right">
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 1,
                                  justifyContent: "flex-end",
                                }}
                              >
                                <Chip size="small" label={t(prod.has_stock === true ? "business:pos.available" : prod.has_stock === false ? "business:pos.unavailable" : "business:pos.availability_unknown")} color={prod.has_stock === true ? "success" : prod.has_stock === false ? "error" : "default"} />
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 1,
                                  justifyContent: "center",
                                }}
                              >
                                <StatusDot active={prod.is_active} />
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {prod.is_active
                                    ? t("business:status_active")
                                    : t("business:status_inactive")}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell
                              align="center"
                              sx={{
                                color: "text.secondary",
                                fontSize: "0.8125rem",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatDateTime(
                                prod.updated_at || prod.created_at,
                              )}
                            </TableCell>
                            </>}
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={(e) => handleOpenActionMenu(e, prod)}
                                disabled={isBusy}
                                data-testid={`product-actions-btn-${prod.id}`}
                                aria-label={t("core:actions")}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>

                          {/* Historical Comparison Sub-row */}
                          {isExpanded && historicalLog && (
                            <TableRow
                              key={`${prod.id}-historical`}
                              sx={{
                                backgroundColor: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? "rgba(255, 255, 255, 0.03)"
                                    : "rgba(0, 0, 0, 0.02)",
                                "& > td": {
                                  borderBottom: (theme) =>
                                    `1px dashed ${theme.palette.divider}`,
                                  color: "text.secondary",
                                  fontSize: "0.8125rem",
                                  py: 0.75,
                                },
                              }}
                              data-testid={`historical-row-${prod.id}`}
                            >
                              <TableCell align="center">
                                <HistoryOutlinedIcon
                                  sx={{ fontSize: 16, color: "text.secondary" }}
                                />
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontWeight: 600,
                                  color: "text.secondary",
                                }}
                              >
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <span>{historicalLog.code ?? "—"}</span>
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
                                </Box>
                              </TableCell>
                              <TableCell sx={{ color: "text.secondary" }}>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontStyle: "italic",
                                    color: "text.secondary",
                                  }}
                                >
                                  {historicalLog.name}
                                </Typography>
                              </TableCell>
                              <TableCell align="center" sx={{ color: "text.secondary" }}>—</TableCell>
                              <TableCell sx={{ color: "text.secondary" }}>
                                -
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ color: "text.secondary" }}
                              >
                                $
                                {(
                                  historicalLog.cost_price_tax || 0
                                ).toLocaleString()}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  color: "text.secondary",
                                  fontWeight: 500,
                                }}
                              >
                                <ProductSalePrice measurementUnit={historicalLog.measurement_unit} salePrice={historicalLog.sale_price} />
                              </TableCell>
                              {showAdditionalColumns && <>
                              <TableCell align="right" sx={{ color: "text.secondary" }}>
                                {t(historicalLog.has_stock === true ? "business:pos.available" : historicalLog.has_stock === false ? "business:pos.unavailable" : "business:pos.availability_unknown")}
                              </TableCell>
                              <TableCell
                                align="center"
                                sx={{ color: "text.secondary" }}
                              >
                                -
                              </TableCell>
                              <TableCell
                                align="center"
                                sx={{
                                  color: "text.secondary",
                                  fontSize: "0.8125rem",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {formatDateTime(
                                  historicalLog.created_at ||
                                    historicalLog.updated_at,
                                )}
                              </TableCell>
                              </>}
                              <TableCell align="right">
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                >
                                  -
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Skeleton>
        <BusinessPagination
          component="div"
          count={productsData?.meta?.total_items ?? displayedProducts.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100, 150, 200]}
          disabled={isLoading || isFetching || isBusy}
          labelRowsPerPage={t("core:pagination.rows_per_page")}
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} ${t("core:pagination.of")} ${
              count !== -1 ? count : `${t("core:pagination.more_than")} ${to}`
            }`
          }
        />
      </Paper>

      {/* 3-Dots Actions Menu */}
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
        <MenuItem
          onClick={() => {
            if (menuProduct) {
              handleOpenEdit(menuProduct);
            }
            handleCloseActionMenu();
          }}
          sx={{ borderRadius: 1 }}
          data-testid="menu-item-edit-product"
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("business:action_update")} />
        </MenuItem>

        {menuProduct && (
          <MenuItem
            onClick={() => {
              setConfirmToggleProduct(menuProduct);
              handleCloseActionMenu();
            }}
            sx={{ borderRadius: 1 }}
            data-testid="menu-item-toggle-product"
          >
            <ListItemIcon>
              {menuProduct.is_active ? (
                <BlockOutlinedIcon fontSize="small" color="error" />
              ) : (
                <CheckCircleOutlineOutlinedIcon
                  fontSize="small"
                  color="success"
                />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                menuProduct.is_active
                  ? t("business:action_deactivate")
                  : t("business:action_activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* Confirm Deactivate / Activate Dialog */}
      <ConfirmDialog
        open={Boolean(confirmToggleProduct)}
        onClose={() => setConfirmToggleProduct(null)}
        onCancel={() => setConfirmToggleProduct(null)}
        onConfirm={handleConfirmToggle}
        title={
          confirmToggleProduct?.is_active
            ? t("business:confirm_deactivate_product_title")
            : t("business:confirm_activate_product_title")
        }
        message={
          confirmToggleProduct?.is_active
            ? t("business:confirm_deactivate_product_message")
            : t("business:confirm_activate_product_message")
        }
        confirmText={
          confirmToggleProduct?.is_active
            ? t("business:action_deactivate")
            : t("business:action_activate")
        }
        isLoading={updateMutation.isPending}
      />

      {/* Single Product Modal */}
      {imageProduct && <ProductImageModal key={`${businessId}:${imageProduct.id}`} open businessId={businessId} product={imageProduct} onClose={() => setImageProduct(null)} />}
      {(isSingleModalOpen || isCreateModalOpenDirectly) && (
        <ProductModal
          businessId={businessId}
          open={isSingleModalOpen || isCreateModalOpenDirectly}
          onClose={() => {
            setIsSingleModalOpen(false);
            setSelectedProduct(null);
            if (onCloseDirectCreateModal) onCloseDirectCreateModal();
          }}
          onSubmit={handleFormSubmit}
          initialData={selectedProduct}
          providers={providers}
          providerSearch={{
            onSearchChange: providerQuery.setSearch,
            onLoadMore: () => {
              void providerQuery.fetchNextPage();
            },
            hasMore: providerQuery.hasNextPage,
            loadingOptions: providerQuery.isFetching,
          }}
          isSubmitting={isBusy}
        />
      )}
    </Box>
  );
};

export default ProductsTab;
