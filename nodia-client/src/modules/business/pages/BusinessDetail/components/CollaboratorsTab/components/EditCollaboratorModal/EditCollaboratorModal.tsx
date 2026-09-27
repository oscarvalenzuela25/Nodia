import type { FC, FormEvent, ChangeEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Box,
  Button,
  Typography,
} from "@mui/material";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";

import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import SelectMultipleInput from "../../../../../../../../components/inputs/SelectMultipleInput";
import { useBusinessActions } from "../../../../../../../generalSettings/pages/Actions/infrastructure/useServices";
import { useAssignCollaborators } from "../../../../../../infrastructure/useServices";
import { getTranslatedName } from "../../../../../../../../store/generalSettings/helpers";
import type { BusinessAction } from "../../../../../../../generalSettings/pages/Actions/types";
import type { EditCollaboratorModalProps } from "./types";
import {
  ModalContainer,
  UserCard,
  ModalActionsContainer,
} from "./styles";

const EditCollaboratorModalInner: FC<EditCollaboratorModalProps> = ({
  open,
  onClose,
  businessId,
  collaborator,
}) => {
  const { t, i18n } = useTranslation(["business", "core"]);
  const lang = i18n.language || "es";

  const [position, setPosition] = useState(collaborator?.position || "");
  const [actionIds, setActionIds] = useState<string[]>(
    collaborator?.action_ids || []
  );

  const { data: actionsResponse, isLoading: isLoadingActions } =
    useBusinessActions({ all: true }, { enabled: open });

  const assignMutation = useAssignCollaborators();

  const actionOptions = useMemo(() => {
    return (actionsResponse?.data ?? []).map((ba: BusinessAction) => ({
      value: String(ba.id),
      label: getTranslatedName(ba.translates, ba.key, lang),
    }));
  }, [actionsResponse, lang]);

  const isFormValid = actionIds.length > 0;
  const isBusy = isLoadingActions || assignMutation.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!collaborator || !isFormValid || isBusy) return;

    try {
      await assignMutation.mutateAsync({
        businessId,
        payload: {
          users: [
            {
              user_id: collaborator.user_id,
              position: position.trim() || undefined,
              action_ids: actionIds,
            },
          ],
        },
        successTitle: t("business:collaborator_updated_success"),
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
        type="submit"
        form="edit-collaborator-form"
        disabled={!isFormValid || isBusy}
        data-testid="save-edit-collab-btn"
        sx={{ borderRadius: 2, px: 2.5 }}
      >
        {t("business:save")}
      </Button>
    </ModalActionsContainer>
  );

  if (!collaborator) return null;

  const userName = collaborator.user?.name ?? `User #${collaborator.user_id}`;
  const userEmail = collaborator.user?.email;

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={t("business:edit_collaborator_title")}
      subtitle={t("business:edit_collaborator_subtitle", { name: userName })}
      actions={modalActions}
    >
      <ModalContainer id="edit-collaborator-form" onSubmit={handleSubmit}>
        {/* Collaborator Read-Only User Information Card */}
        <UserCard>
          <Avatar
            src={collaborator.user?.image_url ?? undefined}
            sx={{
              bgcolor: "primary.main",
              width: 44,
              height: 44,
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {collaborator.user?.name ? (
              collaborator.user.name.charAt(0).toUpperCase()
            ) : (
              <PersonOutlinedIcon />
            )}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {userName}
            </Typography>
            {userEmail && (
              <Typography variant="body2" color="text.secondary">
                {userEmail}
              </Typography>
            )}
          </Box>
        </UserCard>

        {/* Cargo / Posición */}
        <TextInput
          id="edit-collaborator-position"
          name="position"
          label={t("business:position_label")}
          placeholder={t("business:position_placeholder")}
          value={position}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setPosition(e.target.value)
          }
          disabled={isBusy}
          data-testid="edit-collab-position-input"
        />

        {/* Acciones Asignadas */}
        <SelectMultipleInput
          label={t("business:select_actions")}
          placeholder={t("business:select_actions_placeholder")}
          options={actionOptions}
          value={actionIds}
          onChange={setActionIds}
          disabled={isBusy}
          required
          error={actionIds.length === 0}
          helperText={
            actionIds.length === 0
              ? t("business:collaborators_required_action_warning")
              : undefined
          }
        />
      </ModalContainer>
    </BaseModal>
  );
};

export const EditCollaboratorModal: FC<EditCollaboratorModalProps> = (props) => {
  const { open, collaborator } = props;
  if (!open || !collaborator) return null;

  return (
    <EditCollaboratorModalInner
      key={`edit-collab-${collaborator.id}`}
      {...props}
    />
  );
};

export default EditCollaboratorModal;
