import type { FC, MouseEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  IconButton,
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
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ReceiptIcon from "@mui/icons-material/Receipt";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { Skeleton } from "boneyard-js/react";

import InputSearch from "../../../../../../components/inputs/InputSearch";
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
import { StatusDot } from "../../styles";

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
  const { t } = useTranslation(["business", "core"]);

  const [search, setSearch] = useState("");
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isInvoiceMode, setIsInvoiceMode] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductEntity | null>(null);

  const { data: providersData } = useProviders({
    q: { business_id_eq: businessId },
    limit: 100,
  });
  const providers = providersData?.data ?? [];

  const {
    data: productsData,
    isLoading,
    refetch,
  } = useProducts({
    q: {
      business_id_eq: businessId,
      name_cont: search || undefined,
    },
    limit: 100,
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

  const handleToggleStatus = async (product: ProductEntity) => {
    try {
      await updateMutation.mutateAsync({
        id: product.id,
        payload: { is_active: !product.is_active },
      });
    } catch {
      // Do not throw unhandled error
    }
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Action Toolbar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ width: { xs: "100%", sm: 320 } }}>
          <InputSearch
            value={search}
            onChange={(val: string) => setSearch(val)}
            placeholder={t("business:search_products_placeholder")}
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
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 3,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            boxShadow: "none",
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("business:product_code")}</TableCell>
                <TableCell>{t("business:product_name")}</TableCell>
                <TableCell>{t("business:product_provider")}</TableCell>
                <TableCell align="right">{t("business:product_cost_price")}</TableCell>
                <TableCell align="right">{t("business:product_profit_margin")}</TableCell>
                <TableCell align="right">{t("business:product_sale_price")}</TableCell>
                <TableCell align="right">{t("business:product_stock")}</TableCell>
                <TableCell align="center">{t("business:product_status")}</TableCell>
                <TableCell align="right">{t("core:actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
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
                    <TableCell align="right">${(prod.cost_price || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">{prod.profit_percentage}%</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      ${(prod.sale_price || 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                        <span>{prod.stock}</span>
                        {prod.stock < 10 && (
                          <Chip
                            label="Bajo"
                            size="small"
                            color="warning"
                            sx={{ height: 20, fontSize: "0.68rem", fontWeight: 600 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                        <StatusDot active={prod.is_active} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {prod.is_active ? t("business:status_active") : t("business:status_inactive")}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("core:edit")}>
                        <IconButton size="small" onClick={() => handleOpenEdit(prod)} data-testid={`edit-product-${prod.id}`}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={prod.is_active ? t("business:action_deactivate") : t("business:action_activate")}>
                        <IconButton
                          size="small"
                          color={prod.is_active ? "error" : "success"}
                          onClick={() => handleToggleStatus(prod)}
                          data-testid={`toggle-product-${prod.id}`}
                        >
                          {prod.is_active ? (
                            <BlockOutlinedIcon fontSize="small" />
                          ) : (
                            <CheckCircleOutlineOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Skeleton>

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
