import type { FC, MouseEvent } from "react";
import { useState } from "react";
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
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { Skeleton } from "boneyard-js/react";

import InputSearch from "../../../../../../components/inputs/InputSearch";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import {
  useProviders,
  useCreateProvider,
  useUpdateProvider,
} from "../../../../infrastructure/useServices";
import type { ProviderEntity } from "../../../../infrastructure/types";
import ProviderModal, { type ProviderFormData } from "./components/ProviderModal";
import { ProviderBulkImport } from "./components/ProviderBulkImport";
import { StatusDot } from "../../styles";

interface Props {
  businessId: string;
  isCreateModalOpenDirectly?: boolean;
  onCloseDirectCreateModal?: () => void;
}

export const ProvidersTab: FC<Props> = ({
  businessId,
  isCreateModalOpenDirectly = false,
  onCloseDirectCreateModal,
}) => {
  const { t } = useTranslation(["business", "core"]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderEntity | null>(null);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [manageMenuAnchorEl, setManageMenuAnchorEl] = useState<null | HTMLElement>(null);

  // 3-Dots Action Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuProvider, setMenuProvider] = useState<ProviderEntity | null>(null);

  // Confirm Dialog state
  const [confirmToggleProvider, setConfirmToggleProvider] = useState<ProviderEntity | null>(null);

  const {
    data: providersData,
    isLoading,
    isFetching,
    refetch,
  } = useProviders({
    page: page + 1,
    limit: rowsPerPage,
    q: {
      business_id_eq: businessId,
      name_cont: search.trim() || undefined,
      s: "created_at desc",
    },
  });
  const providers = providersData?.data ?? [];

  const createMutation = useCreateProvider();
  const updateMutation = useUpdateProvider();
  const isBusy = createMutation.isPending || updateMutation.isPending;

  const handleOpenCreate = () => {
    setSelectedProvider(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (provider: ProviderEntity) => {
    setSelectedProvider(provider);
    setIsModalOpen(true);
  };

  const handleOpenActionMenu = (
    event: MouseEvent<HTMLButtonElement>,
    provider: ProviderEntity
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuProvider(provider);
  };

  const handleCloseActionMenu = () => {
    setMenuAnchorEl(null);
  };

  const handleConfirmToggle = async () => {
    if (!confirmToggleProvider) return;
    try {
      await updateMutation.mutateAsync({
        id: confirmToggleProvider.id,
        payload: { is_active: !confirmToggleProvider.is_active },
      });
      setConfirmToggleProvider(null);
    } catch {
      // Do not close confirm dialog on error
    }
  };

  const handleFormSubmit = async (data: ProviderFormData) => {
    try {
      if (selectedProvider) {
        await updateMutation.mutateAsync({
          id: selectedProvider.id,
          payload: {
            name: data.name,
            tax: data.tax,
            fields: data.fields,
            is_active: data.is_active,
          },
        });
      } else {
        await createMutation.mutateAsync({
          business_id: businessId,
          name: data.name,
          tax: data.tax,
          fields: data.fields,
          is_active: data.is_active,
        });
      }

      setIsModalOpen(false);
      setSelectedProvider(null);
      if (onCloseDirectCreateModal) onCloseDirectCreateModal();
    } catch {
      // Do not close modal on error, allowing user to retry
    }
  };

  // If bulk import view is active
  if (isBulkMode) {
    return (
      <ProviderBulkImport
        businessId={businessId}
        onCancel={() => setIsBulkMode(false)}
        onSuccess={() => {
          setIsBulkMode(false);
          void refetch();
        }}
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Toolbar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ width: { xs: "100%", sm: 320 } }}>
          <InputSearch
            value={search}
            onChange={(val: string) => {
              setSearch(val);
              setPage(0);
            }}
            placeholder={t("business:search_providers_placeholder")}
            fullWidth
          />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button
            variant="contained"
            endIcon={<KeyboardArrowDownIcon />}
            onClick={(e) => setManageMenuAnchorEl(e.currentTarget)}
            sx={{ borderRadius: 2 }}
            data-testid="manage-providers-btn"
          >
            {t("business:manage_providers")}
          </Button>
          <Menu
            anchorEl={manageMenuAnchorEl}
            open={Boolean(manageMenuAnchorEl)}
            onClose={() => setManageMenuAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem
              onClick={() => {
                setManageMenuAnchorEl(null);
                handleOpenCreate();
              }}
              data-testid="add-single-provider-menu-item"
            >
              <ListItemIcon>
                <AddIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t("business:add_single_provider")}</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setManageMenuAnchorEl(null);
                setIsBulkMode(true);
              }}
              data-testid="add-bulk-providers-menu-item"
            >
              <ListItemIcon>
                <CloudUploadOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t("business:add_bulk_providers")}</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Table */}
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
                <TableCell width={100}>{t("business:provider_id")}</TableCell>
                <TableCell>{t("business:provider_name")}</TableCell>
                <TableCell align="center" width={110}>{t("business:provider_tax")}</TableCell>
                <TableCell>{t("business:provider_fields_label")}</TableCell>
                <TableCell align="center">{t("business:product_status")}</TableCell>
                <TableCell align="right" width={80}>{t("core:actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {providers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {t("business:providers_empty_title")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("business:providers_empty_desc")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                providers.map((prov) => (
                  <TableRow key={prov.id} hover data-testid={`provider-row-${prov.id}`}>
                    {/* ID */}
                    <TableCell sx={{ fontFamily: "monospace", color: "text.secondary", fontSize: "0.8rem" }}>
                      {prov.id}
                    </TableCell>

                    {/* Name */}
                    <TableCell sx={{ fontWeight: 600 }}>{prov.name}</TableCell>

                    {/* Tax */}
                    <TableCell align="center">
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${prov.tax ?? 19}%`}
                        sx={{ fontWeight: 600, borderRadius: 1.5 }}
                        data-testid={`provider-tax-chip-${prov.id}`}
                      />
                    </TableCell>

                    {/* Fields: Structured format with support for { value, instructions } */}
                    <TableCell data-testid={`provider-fields-cell-${prov.id}`}>
                      {(() => {
                        const getFieldConfig = (
                          field: unknown,
                        ): { value: string; instructions: string } => {
                          if (!field) return { value: "", instructions: "" };
                          if (typeof field === "string")
                            return { value: field, instructions: "" };
                          if (
                            typeof field === "object" &&
                            field !== null &&
                            "value" in field
                          ) {
                            const val = (field as Record<string, unknown>).value;
                            const inst = (field as Record<string, unknown>).instructions;
                            return {
                              value: typeof val === "string" ? val : "",
                              instructions: typeof inst === "string" ? inst : "",
                            };
                          }
                          return { value: "", instructions: "" };
                        };

                        const codeConfig = getFieldConfig(prov.fields?.code);
                        const costPriceConfig = getFieldConfig(prov.fields?.cost_price);
                        const costPriceTaxConfig = getFieldConfig(prov.fields?.cost_price_tax);
                        const packagesConfig = getFieldConfig(prov.fields?.packages);
                        const unitsPerPackageConfig = getFieldConfig(prov.fields?.units_per_package);

                        const renderFieldRow = (
                          label: string,
                          config: { value: string; instructions: string },
                          testId: string,
                        ) => (
                          <Typography
                            variant="caption"
                            component="div"
                            sx={{
                              lineHeight: 1.5,
                              display: "inline-flex",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                            data-testid={testId}
                          >
                            <Box component="span" sx={{ fontWeight: 600 }}>
                              {label}:
                            </Box>{" "}
                            <Box
                              component="span"
                              sx={{
                                ml: 0.5,
                                color: config.value ? "text.primary" : "text.secondary",
                                fontStyle: config.value ? "normal" : "italic",
                              }}
                            >
                              {config.value || t("business:no_info")}
                            </Box>
                            {config.instructions ? (
                              <Tooltip
                                title={`${t("business:mapping_field_instructions_label")}: ${config.instructions}`}
                                arrow
                                placement="top"
                              >
                                <Box
                                  component="span"
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    cursor: "help",
                                    ml: 0.5,
                                  }}
                                  data-testid={`${testId}-instructions`}
                                >
                                  <InfoOutlinedIcon
                                    sx={{ fontSize: 13, color: "info.main" }}
                                  />
                                </Box>
                              </Tooltip>
                            ) : null}
                          </Typography>
                        );

                        return (
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                            {renderFieldRow(
                              t("business:provider_col_code"),
                              codeConfig,
                              `provider-field-code-${prov.id}`,
                            )}
                            {renderFieldRow(
                              t("business:provider_col_cost_price"),
                              costPriceConfig,
                              `provider-field-cost-price-${prov.id}`,
                            )}
                            {renderFieldRow(
                              t("business:provider_col_cost_price_tax"),
                              costPriceTaxConfig,
                              `provider-field-cost-price-tax-${prov.id}`,
                            )}
                            {renderFieldRow(
                              t("business:provider_col_packages"),
                              packagesConfig,
                              `provider-field-packages-${prov.id}`,
                            )}
                            {renderFieldRow(
                              t("business:provider_col_units_per_package"),
                              unitsPerPackageConfig,
                              `provider-field-units-per-package-${prov.id}`,
                            )}
                          </Box>
                        );
                      })()}
                    </TableCell>

                    {/* Status */}
                    <TableCell align="center">
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                        <StatusDot active={prov.is_active} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {prov.is_active ? t("business:status_active") : t("business:status_inactive")}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Actions Menu Trigger */}
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenActionMenu(e, prov)}
                        disabled={isBusy}
                        data-testid={`provider-actions-btn-${prov.id}`}
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
          count={providersData?.meta?.total_items ?? providers.length}
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
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
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
            if (menuProvider) {
              handleOpenEdit(menuProvider);
            }
            handleCloseActionMenu();
          }}
          sx={{ borderRadius: 1 }}
          data-testid="menu-item-edit-provider"
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("business:action_update")} />
        </MenuItem>

        {menuProvider && (
          <MenuItem
            onClick={() => {
              setConfirmToggleProvider(menuProvider);
              handleCloseActionMenu();
            }}
            sx={{ borderRadius: 1 }}
            data-testid="menu-item-toggle-provider"
          >
            <ListItemIcon>
              {menuProvider.is_active ? (
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
                menuProvider.is_active
                  ? t("business:action_deactivate")
                  : t("business:action_activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* Confirm Deactivate / Activate Dialog */}
      <ConfirmDialog
        open={Boolean(confirmToggleProvider)}
        onClose={() => setConfirmToggleProvider(null)}
        onCancel={() => setConfirmToggleProvider(null)}
        onConfirm={handleConfirmToggle}
        title={
          confirmToggleProvider?.is_active
            ? t("business:confirm_deactivate_provider_title")
            : t("business:confirm_activate_provider_title")
        }
        message={
          confirmToggleProvider?.is_active
            ? t("business:confirm_deactivate_provider_message", {
                name: confirmToggleProvider.name,
              })
            : t("business:confirm_activate_provider_message", {
                name: confirmToggleProvider?.name,
              })
        }
        confirmText={
          confirmToggleProvider?.is_active
            ? t("business:action_deactivate")
            : t("business:action_activate")
        }
        cancelText={t("core:cancel")}
        isLoading={updateMutation.isPending}
      />

      {/* Create / Edit Modal */}
      {(isModalOpen || isCreateModalOpenDirectly) && (
        <ProviderModal
          open={isModalOpen || isCreateModalOpenDirectly}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProvider(null);
            if (onCloseDirectCreateModal) onCloseDirectCreateModal();
          }}
          onSubmit={handleFormSubmit}
          initialData={selectedProvider}
          isSubmitting={isBusy}
        />
      )}
    </Box>
  );
};

export default ProvidersTab;
