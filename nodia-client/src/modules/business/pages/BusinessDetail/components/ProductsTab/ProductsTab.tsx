import type { FC, MouseEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
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
  TablePagination,
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
import { Skeleton } from "boneyard-js/react";

import InputSearch from "../../../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../../../components/inputs/SelectMultipleInput";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import TextInput from "../../../../../../components/inputs/TextInput";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import Filter from "../../../../../../components/Filter";
import FilterChips from "../../../../../../components/Filter/components/FilterChips";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useProviders,
} from "../../../../infrastructure/useServices";
import type {
  ProductEntity,
  CreateProductPayload,
  UpdateProductPayload,
} from "../../../../infrastructure/types";
import ProductModal, { type ProductFormData } from "./components/ProductModal";
import ProductBulkImport from "./components/ProductBulkImport";
import ProductInvoiceImport from "./components/ProductInvoiceImport";
import { StatusDot, StockDot } from "../../styles";

const ActiveFilters = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  alignItems: "center",
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
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isInvoiceMode, setIsInvoiceMode] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductEntity | null>(null);

  // 3-Dots Action Menu state
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuProduct, setMenuProduct] = useState<ProductEntity | null>(null);

  // Confirm Dialog state
  const [confirmToggleProduct, setConfirmToggleProduct] = useState<ProductEntity | null>(null);

  // Filter modal draft state
  const [draftFilterCodes, setDraftFilterCodes] = useState<string[]>([]);
  const [draftFilterName, setDraftFilterName] = useState<string>("");
  const [draftFilterProviders, setDraftFilterProviders] = useState<string[]>([]);
  const [draftFilterStock, setDraftFilterStock] = useState<("out" | "low" | "normal")[]>([]);
  const [draftFilterActive, setDraftFilterActive] = useState<"active" | "inactive" | null>(null);

  // Applied filter state
  const [appliedFilterCodes, setAppliedFilterCodes] = useState<string[]>([]);
  const [appliedFilterName, setAppliedFilterName] = useState<string>("");
  const [appliedFilterProviders, setAppliedFilterProviders] = useState<string[]>([]);
  const [appliedFilterStock, setAppliedFilterStock] = useState<("out" | "low" | "normal")[]>([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<"active" | "inactive" | null>(null);

  const { data: providersData } = useProviders({
    q: { business_id_eq: businessId },
    all: true,
  });
  const providers = providersData?.data ?? [];

  // All products to populate distinct product codes in filter
  const { data: allProductsData } = useProducts({
    q: { business_id_eq: businessId },
    all: true,
  });

  const codeOptions = useMemo(() => {
    return Array.from(
      new Set(
        (allProductsData?.data ?? [])
          .map((p) => p.code)
          .filter(Boolean) as string[]
      )
    );
  }, [allProductsData]);

  const providerOptions = useMemo(() => {
    return providers.map((p) => ({
      value: p.id,
      label: p.name,
    }));
  }, [providers]);

  const stockOptions = useMemo(
    () => [
      { value: "out", label: t("business:stock_variant_out") },
      { value: "low", label: t("business:stock_variant_low") },
      { value: "normal", label: t("business:stock_variant_normal") },
    ],
    [t]
  );

  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("business:status_active") },
      { value: "inactive", label: t("business:status_inactive") },
    ],
    [t]
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterCodes.length > 0) count += appliedFilterCodes.length;
    if (appliedFilterName.trim()) count += 1;
    if (appliedFilterProviders.length > 0) count += appliedFilterProviders.length;
    if (appliedFilterStock.length > 0) count += appliedFilterStock.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [
    appliedFilterCodes,
    appliedFilterName,
    appliedFilterProviders,
    appliedFilterStock,
    appliedFilterActive,
  ]);

  const {
    data: productsData,
    isLoading,
    isFetching,
    refetch,
  } = useProducts({
    page: page + 1,
    limit: rowsPerPage,
    q: {
      business_id_eq: businessId,
      name_cont:
        [appliedFilterName.trim(), search.trim()].filter(Boolean).join(" ") ||
        undefined,
      code_in: appliedFilterCodes.length > 0 ? appliedFilterCodes : undefined,
      provider_id_in:
        appliedFilterProviders.length > 0 ? appliedFilterProviders : undefined,
      stock_status_in:
        appliedFilterStock.length > 0 ? appliedFilterStock : undefined,
      is_active_eq:
        appliedFilterActive === "active"
          ? true
          : appliedFilterActive === "inactive"
          ? false
          : undefined,
    },
  });
  const products = productsData?.data ?? [];

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const isBusy = createMutation.isPending || updateMutation.isPending;

  const handleOpenMenu = (e: MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(e.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
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
    product: ProductEntity
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
    setPage(0);
  };

  const handleClearFilters = () => {
    setDraftFilterCodes([]);
    setDraftFilterName("");
    setDraftFilterProviders([]);
    setDraftFilterStock([]);
    setDraftFilterActive(null);
    setAppliedFilterCodes([]);
    setAppliedFilterName("");
    setAppliedFilterProviders([]);
    setAppliedFilterStock([]);
    setAppliedFilterActive(null);
    setPage(0);
  };

  const handleFormSubmit = async (data: ProductFormData) => {
    try {
      if (selectedProduct) {
        const payload: UpdateProductPayload = {
          code: data.code,
          name: data.name,
          cost_price: data.cost_price,
          cost_price_tax: data.cost_price_tax,
          profit_percentage: data.profit_percentage,
          sale_price: data.sale_price,
          stock: data.stock,
          provider_id: data.provider_id || null,
          is_active: data.is_active,
        };
        await updateMutation.mutateAsync({ id: selectedProduct.id, payload });
      } else {
        const payload: CreateProductPayload = {
          business_id: businessId,
          code: data.code,
          name: data.name,
          cost_price: data.cost_price,
          cost_price_tax: data.cost_price_tax,
          profit_percentage: data.profit_percentage,
          sale_price: data.sale_price,
          stock: data.stock,
          provider_id: data.provider_id || null,
          is_active: data.is_active,
        };
        await createMutation.mutateAsync(payload);
      }
      setIsSingleModalOpen(false);
      setSelectedProduct(null);
      if (onCloseDirectCreateModal) onCloseDirectCreateModal();
    } catch {
      // Do not close modal on error, allowing user to correct fields
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
      {/* Filter Row */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Filter
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
            value={draftFilterProviders}
            onChange={setDraftFilterProviders}
            disabled={isLoading || isFetching}
          />

          <SelectMultipleInput
            label={t("business:filter_stock_label")}
            placeholder={t("business:filter_stock_placeholder")}
            options={stockOptions}
            value={draftFilterStock}
            onChange={(vals) => setDraftFilterStock(vals as ("out" | "low" | "normal")[])}
            disabled={isLoading || isFetching}
          />

          <SelectSingleInput
            label={t("business:filter_status_label")}
            placeholder={t("business:filter_status_placeholder")}
            options={statusOptions}
            value={draftFilterActive}
            onChange={(val) => setDraftFilterActive(val as "active" | "inactive" | null)}
            disabled={isLoading || isFetching}
            clearable
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
              label={t("business:filter_chips_name", { value: appliedFilterName })}
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
                  setAppliedFilterProviders((prev) => prev.filter((p) => p !== provId));
                  setDraftFilterProviders((prev) => prev.filter((p) => p !== provId));
                  setPage(0);
                }}
              />
            );
          })}
          {appliedFilterStock.map((stockVariant) => {
            const stockLabel =
              stockVariant === "out"
                ? t("business:stock_variant_out")
                : stockVariant === "low"
                ? t("business:stock_variant_low")
                : t("business:stock_variant_normal");
            return (
              <FilterChips
                key={`stock-${stockVariant}`}
                label={t("business:filter_chips_stock", { value: stockLabel })}
                onAction={() => {
                  setAppliedFilterStock((prev) => prev.filter((s) => s !== stockVariant));
                  setDraftFilterStock((prev) => prev.filter((s) => s !== stockVariant));
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
        </ActiveFilters>
      )}

      {/* Action Toolbar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Box sx={{ width: { xs: "100%", sm: 320 } }}>
          <InputSearch
            value={search}
            onChange={(val: string) => {
              setSearch(val);
              setPage(0);
            }}
            placeholder={t("business:search_products_placeholder")}
            fullWidth
          />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button
            variant="contained"
            endIcon={<KeyboardArrowDownIcon />}
            onClick={handleOpenMenu}
            sx={{ borderRadius: 2 }}
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
            <MenuItem onClick={handleOpenAddSingle} data-testid="menu-add-single-product">
              <AddCircleOutlinedIcon sx={{ mr: 1.5, fontSize: 20 }} />
              {t("business:add_single_product")}
            </MenuItem>
            <MenuItem onClick={handleOpenBulk} data-testid="menu-add-bulk-products">
              <UploadFileIcon sx={{ mr: 1.5, fontSize: 20 }} />
              {t("business:add_bulk_products")}
            </MenuItem>
            <MenuItem onClick={handleOpenInvoice} data-testid="menu-add-invoice-products">
              <ReceiptIcon sx={{ mr: 1.5, fontSize: 20 }} />
              {t("business:add_invoice_products")}
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Products Table */}
      <Skeleton loading={isLoading}>
        <Paper
          sx={{
            borderRadius: 3,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            boxShadow: "none",
            overflow: "hidden",
          }}
        >
          <TableContainer>
            <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("business:product_code")}</TableCell>
                <TableCell>{t("business:product_name")}</TableCell>
                <TableCell>{t("business:product_provider")}</TableCell>
                <TableCell align="right">{t("business:product_cost_tax")}</TableCell>
                <TableCell align="right">{t("business:product_profit_margin")}</TableCell>
                <TableCell align="right">{t("business:product_sale_price")}</TableCell>
                <TableCell align="right">{t("business:product_stock")}</TableCell>
                <TableCell align="center">{t("business:product_status")}</TableCell>
                <TableCell align="center">{t("business:product_updated_at")}</TableCell>
                <TableCell align="right">{t("core:actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {t("business:products_empty_title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("business:products_empty_desc")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((prod) => (
                  <TableRow key={prod.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{prod.code}</TableCell>
                    <TableCell>{prod.name}</TableCell>
                    <TableCell>{prod.provider?.name ?? "-"}</TableCell>
                    <TableCell align="right">${(prod.cost_price_tax || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">{prod.profit_percentage}%</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      ${(prod.sale_price || 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, justifyContent: "flex-end" }}>
                        <span>{prod.stock}</span>
                        {(() => {
                          const stock = prod.stock;
                          const status = stock <= 0 ? "out" : stock < 10 ? "low" : "normal";
                          const label =
                            status === "out"
                              ? t("business:stock_out_of_stock")
                              : status === "low"
                              ? t("business:stock_low")
                              : t("business:stock_normal");
                          return (
                            <Tooltip title={label} arrow>
                              <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                                <StockDot status={status} data-testid={`stock-dot-${prod.id}`} />
                              </Box>
                            </Tooltip>
                          );
                        })()}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, justifyContent: "center" }}>
                        <StatusDot active={prod.is_active} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {prod.is_active ? t("business:status_active") : t("business:status_inactive")}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ color: "text.secondary", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                      {formatDateTime(prod.updated_at || prod.created_at)}
                    </TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={productsData?.meta?.total_items ?? products.length}
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
    </Skeleton>

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
      {(isSingleModalOpen || isCreateModalOpenDirectly) && (
        <ProductModal
          open={isSingleModalOpen || isCreateModalOpenDirectly}
          onClose={() => {
            setIsSingleModalOpen(false);
            setSelectedProduct(null);
            if (onCloseDirectCreateModal) onCloseDirectCreateModal();
          }}
          onSubmit={handleFormSubmit}
          initialData={selectedProduct}
          providers={providers}
          isSubmitting={isBusy}
        />
      )}
    </Box>
  );
};

export default ProductsTab;
