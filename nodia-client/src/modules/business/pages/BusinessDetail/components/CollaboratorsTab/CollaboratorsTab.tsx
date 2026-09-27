import type { FC, MouseEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Avatar,
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
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Skeleton } from "boneyard-js/react";

import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import { TableSkeleton } from "../../../../../../components/skeletons";
import { useAssignCollaborators } from "../../../../infrastructure/useServices";
import type { BusinessCollaborator } from "../../../../infrastructure/types";
import EditCollaboratorModal from "./components/EditCollaboratorModal";
import { SectionCard, SectionHeader, SectionTitle, StatusDot } from "../../styles";

interface Props {
  businessId?: string;
  businessName?: string;
  collaborators?: BusinessCollaborator[];
  onOpenAddCollaborator: () => void;
  isBusy?: boolean;
  isLoading?: boolean;
}

export const CollaboratorsTab: FC<Props> = ({
  businessId = "",
  collaborators = [],
  onOpenAddCollaborator,
  isBusy = false,
  isLoading = false,
}) => {
  const { t } = useTranslation(["business", "core"]);

  // 3-Dots Action Menu state
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuCollab, setMenuCollab] = useState<BusinessCollaborator | null>(null);

  // Dedicated Edit Collaborator Modal state
  const [editingCollab, setEditingCollab] = useState<BusinessCollaborator | null>(null);

  // Confirm Remove Collaborator Dialog state
  const [confirmRemoveCollab, setConfirmRemoveCollab] = useState<BusinessCollaborator | null>(null);

  const assignMutation = useAssignCollaborators();
  const isMutating = assignMutation.isPending;
  const isActionDisabled = isBusy || isMutating;

  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    collab: BusinessCollaborator
  ) => {
    setActionMenuAnchorEl(e.currentTarget);
    setMenuCollab(collab);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchorEl(null);
  };

  const handleOpenEdit = () => {
    if (menuCollab) {
      setEditingCollab(menuCollab);
    }
    handleCloseActionMenu();
  };

  const handleOpenConfirmRemove = () => {
    if (menuCollab) {
      setConfirmRemoveCollab(menuCollab);
    }
    handleCloseActionMenu();
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemoveCollab || !businessId) return;
    try {
      await assignMutation.mutateAsync({
        businessId,
        payload: {
          users: [
            {
              user_id: confirmRemoveCollab.user_id,
              action_ids: [],
            },
          ],
        },
        successTitle: t("business:collaborator_removed_success"),
      });
      setConfirmRemoveCollab(null);
    } catch {
      // Keep confirm dialog open on error
    }
  };

  return (
    <SectionCard>
      <SectionHeader>
        <SectionTitle>{t("business:collaborators_title")}</SectionTitle>
        <Button
          variant="contained"
          startIcon={<GroupAddOutlinedIcon />}
          onClick={onOpenAddCollaborator}
          disabled={isActionDisabled}
          sx={{ borderRadius: 2 }}
          data-testid="add-collab-tab-btn"
        >
          {t("business:action_add_collaborator")}
        </Button>
      </SectionHeader>

      <Skeleton
        loading={Boolean(isLoading)}
        fallback={
          <TableSkeleton
            columns={[
              { header: t("business:collab_col_user") },
              { header: t("business:collab_col_position") },
              { header: t("business:collab_col_actions") },
              { align: "center", header: t("business:collab_col_status") },
              { align: "right", header: t("core:actions") },
            ]}
            rows={4}
            paperSx={{ borderRadius: 2 }}
          />
        }
      >
        {collaborators.length > 0 ? (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ borderRadius: 2, overflow: "hidden" }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t("business:collab_col_user")}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t("business:collab_col_position")}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t("business:collab_col_actions")}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>
                    {t("business:collab_col_status")}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {t("core:actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {collaborators.map((collab) => (
                  <TableRow key={collab.id} hover>
                    {/* Colaborador / Usuario */}
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar
                          src={collab.user?.image_url ?? undefined}
                          sx={{
                            bgcolor: "primary.main",
                            width: 38,
                            height: 38,
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          {collab.user?.name ? (
                            collab.user.name.charAt(0).toUpperCase()
                          ) : (
                            <PersonOutlinedIcon fontSize="small" />
                          )}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {collab.user?.name ?? `User #${collab.user_id}`}
                          </Typography>
                          {collab.user?.email && (
                            <Typography variant="caption" color="text.secondary">
                              {collab.user.email}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Cargo / Posición */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={collab.position ? "text.primary" : "text.secondary"}
                      >
                        {collab.position || t("business:collab_no_position")}
                      </Typography>
                    </TableCell>

                    {/* Acciones Asignadas */}
                    <TableCell>
                      <Chip
                        label={t("business:collab_actions_assigned_count", {
                          count: collab.action_ids?.length ?? 0,
                          defaultValue: `${collab.action_ids?.length ?? 0} asignadas`,
                        })}
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>

                    {/* Estado */}
                    <TableCell align="center">
                      <Box
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <StatusDot active={collab.is_active} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {collab.is_active
                            ? t("business:status_active")
                            : t("business:status_inactive")}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Acciones: Menú de 3 puntos */}
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenActionMenu(e, collab)}
                        disabled={isActionDisabled}
                        aria-label={t("core:actions")}
                        data-testid={`collab-actions-btn-${collab.id}`}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box
            sx={{
              py: 6,
              textAlign: "center",
              borderRadius: 2,
              border: (theme) => `1px dashed ${theme.palette.divider}`,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t("business:collaborators_empty")}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<GroupAddOutlinedIcon />}
              onClick={onOpenAddCollaborator}
              disabled={isActionDisabled}
              sx={{ mt: 2, borderRadius: 2 }}
            >
              {t("business:add_new_collaborator")}
            </Button>
          </Box>
        )}
      </Skeleton>

      {/* 3-Dots Action Menu */}
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
              minWidth: 180,
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
          onClick={handleOpenEdit}
          sx={{ borderRadius: 1 }}
          data-testid="menu-item-edit-collab"
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("business:action_update")} />
        </MenuItem>

        <MenuItem
          onClick={handleOpenConfirmRemove}
          sx={{ borderRadius: 1 }}
          data-testid="menu-item-remove-collab"
        >
          <ListItemIcon>
            <DeleteOutlinedIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary={t("business:remove_collaborator")} />
        </MenuItem>
      </Menu>

      {/* Confirm Remove Collaborator Dialog */}
      <ConfirmDialog
        open={Boolean(confirmRemoveCollab)}
        onClose={() => setConfirmRemoveCollab(null)}
        onCancel={() => setConfirmRemoveCollab(null)}
        onConfirm={handleConfirmRemove}
        title={t("business:confirm_remove_collaborator_title")}
        message={t("business:confirm_remove_collaborator_message", {
          name:
            confirmRemoveCollab?.user?.name ??
            `User #${confirmRemoveCollab?.user_id}`,
        })}
        confirmText={t("business:confirm_remove_collaborator_btn")}
        isLoading={isMutating}
      />

      {/* Dedicated Single Collaborator Edit Modal */}
      {Boolean(editingCollab) && Boolean(businessId) && (
        <EditCollaboratorModal
          open={Boolean(editingCollab)}
          onClose={() => setEditingCollab(null)}
          businessId={businessId}
          collaborator={editingCollab}
        />
      )}
    </SectionCard>
  );
};

export default CollaboratorsTab;
