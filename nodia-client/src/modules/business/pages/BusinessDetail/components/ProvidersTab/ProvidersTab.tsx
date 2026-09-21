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
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderEntity | null>(null);

  // 3-Dots Action Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuProvider, setMenuProvider] = useState<ProviderEntity | null>(null);

  // Confirm Dialog state
  const [confirmToggleProvider, setConfirmToggleProvider] = useState<ProviderEntity | null>(null);

  const {
    data: providersData,
    isLoading,
  } = useProviders({
    q: {
      business_id_eq: businessId,
      name_cont: search || undefined,
    },
    limit: 100,
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
            fields: data.fields,
            is_active: data.is_active,
          },
        });
      } else {
        await createMutation.mutateAsync({
          business_id: businessId,
          name: data.name,
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Toolbar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ width: { xs: "100%", sm: 320 } }}>
          <InputSearch
            value={search}
            onChange={(val: string) => setSearch(val)}
            placeholder={t("business:search_providers_placeholder")}
          />
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          sx={{ borderRadius: 2 }}
          data-testid="new-provider-btn"
        >
          {t("business:new_provider_btn")}
        </Button>
      </Box>

      {/* Table */}
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
                <TableCell width={100}>{t("business:provider_id")}</TableCell>
                <TableCell>{t("business:provider_name")}</TableCell>
                <TableCell>{t("business:provider_fields_label")}</TableCell>
                <TableCell align="center">{t("business:product_status")}</TableCell>
                <TableCell align="right" width={80}>{t("core:actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {providers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
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

                    {/* Fields (Dynamic JSON chips or empty message) */}
                    <TableCell>
                      {prov.fields && Object.keys(prov.fields).length > 0 ? (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                          {Object.entries(prov.fields).map(([k, v]) => (
                            <Chip
                              key={k}
                              size="small"
                              variant="outlined"
                              label={`${k}: ${String(v)}`}
                              sx={{ fontSize: "0.75rem", borderRadius: 1.5 }}
                              data-testid={`provider-field-chip-${prov.id}-${k}`}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontStyle: "italic" }}
                          data-testid={`no-fields-${prov.id}`}
                        >
                          {t("business:no_custom_fields")}
                        </Typography>
                      )}
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
