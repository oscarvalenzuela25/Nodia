import type { FC, FormEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import SelectMultipleInput from "../../../../../../components/inputs/SelectMultipleInput";
import { useActions } from "../../../Actions";
import type { RoleModalProps, RoleFormData } from "./types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const RoleModalInner: FC<RoleModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  availableActions = [],
  isSubmitting = false,
}) => {
  const { t } = useTranslation(["roles", "core"]);
  const isEditing = Boolean(initialData?.id);

  const {
    data: actionsResponse,
    isLoading: isLoadingActions,
    isFetching: isFetchingActions,
  } = useActions(
    { all: true, includes: false },
    { enabled: open }
  );

  const dynamicActionOptions = useMemo(() => {
    if (actionsResponse?.data && actionsResponse.data.length > 0) {
      return actionsResponse.data.map((act) => ({
        value: act.key,
        label: act.key,
        category: act.key.split(".")[0],
      }));
    }
    return availableActions;
  }, [actionsResponse, availableActions]);

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [roleKey, setRoleKey] = useState<string>(initialData?.key ?? "");
  const [actions, setActions] = useState<string[]>(
    initialData?.actions ?? []
  );

  const isFormValid = roleKey.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const payload: RoleFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: roleKey.trim().toLowerCase(),
      nameTranslations: initialData?.nameTranslations,
      actions,
    };

    onSubmit(payload);
  };

  const modalTitle = isEditing
    ? t("roles:edit_modal_title", "Actualizar Rol")
    : t("roles:create_modal_title", "Nuevo Rol");

  const submitButtonText = isEditing
    ? t("roles:update_role_button", "Actualizar Rol")
    : t("roles:create_role_button", "Crear Rol");

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="contained"
        color="error"
        onClick={onClose}
        disabled={isSubmitting}
        sx={(theme) => ({
          color: theme.palette.error.contrastText,
          borderRadius: 2,
          px: 2.5,
        })}
      >
        {t("core:cancel", "Cancelar")}
      </Button>
      <Button
        type="submit"
        form="role-form"
        variant="contained"
        color="primary"
        disabled={!isFormValid || isSubmitting}
        sx={(theme) => ({
          color: theme.palette.primary.contrastText,
          borderRadius: 2,
          px: 2.5,
        })}
      >
        {submitButtonText}
      </Button>
    </ModalActionsContainer>
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={modalTitle}
      size="sm"
      actions={modalActions}
    >
      <FormContainer id="role-form" onSubmit={handleSubmit}>
        <SwitchWrapper>
          <StyledFormControlLabel
            control={
              <StyledSwitch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                name="isActive"
                disabled={isSubmitting}
              />
            }
            label={t("roles:form.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TextInput
          label={t("roles:form.key", "Identificador / Key")}
          value={roleKey}
          onChange={(e) => setRoleKey(e.target.value)}
          placeholder={t("roles:form.key_placeholder", "ej: super_admin")}
          required
          autoFocus={!isEditing}
          disabled={isSubmitting}
          name="key"
        />

        <SelectMultipleInput
          label={t("roles:form.actions", "Acciones Asociadas")}
          options={dynamicActionOptions}
          value={actions}
          onChange={setActions}
          placeholder={t(
            "roles:form.actions_placeholder",
            "Seleccionar acciones permitidas..."
          )}
          searchPlaceholder={t("core:search", "Buscar...")}
          disabled={isSubmitting || isLoadingActions || isFetchingActions}
        />
      </FormContainer>
    </BaseModal>
  );
};

const RoleModal: FC<RoleModalProps> = (props) => {
  const { open, initialData } = props;
  if (!open) return null;

  return (
    <RoleModalInner
      key={initialData?.id ?? initialData?.key ?? "create-new-role"}
      {...props}
    />
  );
};

export default RoleModal;
