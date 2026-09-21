import type { FC, ChangeEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import BaseModal from "../../../../../../components/BaseModal";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import SelectMultipleInput from "../../../../../../components/inputs/SelectMultipleInput";
import TextInput from "../../../../../../components/inputs/TextInput";
import { useUsers } from "../../../../../generalSettings/pages/Users/infrastructure/useServices";
import { useBusinessActions } from "../../../../../generalSettings/pages/Actions/infrastructure/useServices";
import { useAssignCollaborators } from "../../../../infrastructure/useServices";
import { getTranslatedName } from "../../../../../../store/generalSettings/helpers";
import useAuthStore from "../../../../../../store/authStore";
import type { User } from "../../../../../generalSettings/pages/Users/types";
import type { BusinessAction } from "../../../../../generalSettings/pages/Actions/types";
import type {
  BusinessCollaboratorModalProps,
  CollaboratorRowState,
} from "./types";
import {
  ModalContainer,
  CollaboratorItemCard,
  CollaboratorCardHeader,
  ModalActionsContainer,
} from "./styles";

const createEmptyRow = (): CollaboratorRowState => ({
  tempId: Math.random().toString(36).substring(2, 9),
  user_id: "",
  position: "",
  action_ids: [],
});

const BusinessCollaboratorModalInner: FC<BusinessCollaboratorModalProps> = ({
  open,
  onClose,
  businessId,
  businessName,
  initialCollaborators,
}) => {
  const { t, i18n } = useTranslation(["business", "core"]);
  const lang = i18n.language || "es";
  const currentUserId = useAuthStore((state) => state.user?.id);

  // Queries for users and business actions
  const { data: usersResponse, isLoading: isLoadingUsers } = useUsers(
    { all: true },
    { enabled: open }
  );

  const { data: actionsResponse, isLoading: isLoadingActions } =
    useBusinessActions({ all: true }, { enabled: open });

  const assignMutation = useAssignCollaborators();

  // Rows state initialized directly
  const [rows, setRows] = useState<CollaboratorRowState[]>(() => {
    if (initialCollaborators && initialCollaborators.length > 0) {
      return initialCollaborators.map((c) => ({
        tempId: Math.random().toString(36).substring(2, 9),
        user_id: c.user_id,
        position: c.position || "",
        action_ids: c.action_ids || [],
      }));
    }
    return [createEmptyRow()];
  });

  // Options for users (excluding the current authenticated user)
  const userOptions = useMemo(() => {
    return (usersResponse?.data ?? [])
      .filter(
        (u: User) => !currentUserId || String(u.id) !== String(currentUserId)
      )
      .map((u: User) => ({
        value: String(u.id),
        label: `${u.name} (${u.email})`,
      }));
  }, [usersResponse, currentUserId]);

  // Options for business actions
  const actionOptions = useMemo(() => {
    return (actionsResponse?.data ?? []).map((ba: BusinessAction) => ({
      value: String(ba.id),
      label: getTranslatedName(ba.translates, ba.key, lang),
    }));
  }, [actionsResponse, lang]);

  // Handlers for rows
  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (tempId: string) => {
    setRows((prev) => {
      const filtered = prev.filter((r) => r.tempId !== tempId);
      return filtered.length === 0 ? [createEmptyRow()] : filtered;
    });
  };

  const handleUserChange = (tempId: string, userId: string | null) => {
    setRows((prev) =>
      prev.map((r) =>
        r.tempId === tempId ? { ...r, user_id: userId ?? "" } : r
      )
    );
  };

  const handlePositionChange = (tempId: string, position: string) => {
    setRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, position } : r))
    );
  };

  const handleActionsChange = (tempId: string, actionIds: string[]) => {
    setRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, action_ids: actionIds } : r))
    );
  };

  // Validation
  const validRows = rows.filter((r) => Boolean(r.user_id));
  const hasAtLeastOneCollaborator = validRows.length > 0;
  const allSelectedHaveActions =
    hasAtLeastOneCollaborator &&
    validRows.every((r) => r.action_ids.length > 0);

  const isFormValid = hasAtLeastOneCollaborator && allSelectedHaveActions;
  const isBusy =
    isLoadingUsers || isLoadingActions || assignMutation.isPending;

  const handleSubmit = async () => {
    if (!isFormValid || isBusy) return;

    try {
      await assignMutation.mutateAsync({
        businessId,
        payload: {
          users: validRows.map((r) => ({
            user_id: r.user_id,
            position: r.position.trim() || undefined,
            action_ids: r.action_ids,
          })),
        },
      });

      onClose();
    } catch {
      // Do not close modal on error, allowing user to retry
    }
  };

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="contained"
        color="error"
        onClick={onClose}
        disabled={isBusy}
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:cancel")}
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={handleSubmit}
        disabled={!isFormValid || isBusy}
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:save")}
      </Button>
    </ModalActionsContainer>
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={t("business:manage_collaborators_title")}
      subtitle={t("business:manage_collaborators_subtitle", {
        name: businessName,
      })}
      actions={modalActions}
    >
      <ModalContainer>
        {/* Banner rule explanation */}
        <Alert severity="info" sx={{ mb: 1 }}>
          {t("business:collaborators_info_banner")}
        </Alert>

        {/* Warning if a row has a user selected but 0 actions */}
        {validRows.some((r) => r.action_ids.length === 0) && (
          <Alert severity="warning">
            {t("business:collaborators_required_action_warning")}
          </Alert>
        )}

        {rows.map((row, index) => {
          // Available users for this row (excluding other selected rows)
          const otherSelectedUserIds = new Set(
            rows
              .filter((r) => r.tempId !== row.tempId && Boolean(r.user_id))
              .map((r) => r.user_id)
          );
          const availableUserOptions = userOptions.filter(
            (opt: { value: string; label: string }) =>
              !otherSelectedUserIds.has(opt.value)
          );

          return (
            <CollaboratorItemCard key={row.tempId}>
              <CollaboratorCardHeader>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PersonOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {`${t("business:collaborator_badge")} #${index + 1}`}
                  </Typography>
                </Box>
                <Tooltip title={t("business:remove_collaborator")}>
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={isBusy || (rows.length === 1 && !row.user_id)}
                      onClick={() => handleRemoveRow(row.tempId)}
                    >
                      <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </CollaboratorCardHeader>

              {/* User Selection */}
              <SelectSingleInput
                id={`collaborator-user-${row.tempId}`}
                label={t("business:select_user")}
                placeholder={t("business:select_user_placeholder")}
                options={availableUserOptions}
                value={row.user_id || null}
                onChange={(val: string | null) =>
                  handleUserChange(row.tempId, val)
                }
                disabled={isBusy}
                required
              />

              {/* When a user is selected, reveal the actions and position inputs */}
              {Boolean(row.user_id) && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <SelectMultipleInput
                    label={t("business:select_actions")}
                    placeholder={t("business:select_actions_placeholder")}
                    options={actionOptions}
                    value={row.action_ids}
                    onChange={(ids: string[]) =>
                      handleActionsChange(row.tempId, ids)
                    }
                    disabled={isBusy}
                    required
                    error={row.action_ids.length === 0}
                    helperText={
                      row.action_ids.length === 0
                        ? t("business:collaborators_required_action_warning")
                        : undefined
                    }
                  />

                  <TextInput
                    id={`collaborator-position-${row.tempId}`}
                    label={t("business:position_label")}
                    placeholder={t("business:position_placeholder")}
                    value={row.position}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handlePositionChange(row.tempId, e.target.value)
                    }
                    disabled={isBusy}
                  />
                </Box>
              )}
            </CollaboratorItemCard>
          );
        })}

        <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 1 }}>
          <Button
            type="button"
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddRow}
            disabled={isBusy}
            sx={{ borderRadius: 2 }}
          >
            {t("business:add_new_collaborator")}
          </Button>
        </Box>
      </ModalContainer>
    </BaseModal>
  );
};

const BusinessCollaboratorModal: FC<BusinessCollaboratorModalProps> = (props) => {
  const { open, businessId } = props;
  if (!open) return null;

  return (
    <BusinessCollaboratorModalInner
      key={`collab-modal-${businessId}`}
      {...props}
    />
  );
};

export default BusinessCollaboratorModal;
