import type { FC, FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import SelectMultipleInput from "../../../../../../components/inputs/SelectMultipleInput";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
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
}) => {
  const { t } = useTranslation(["roles", "core"]);
  const isEditing = Boolean(initialData?.id);

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [roleKey, setRoleKey] = useState<string>(initialData?.key ?? "");
  const [nameTranslations, setNameTranslations] = useState<
    Record<string, string>
  >(initialData?.nameTranslations ?? { es: "", en: "" });
  const [actions, setActions] = useState<string[]>(
    initialData?.actions ?? []
  );

  const isFormValid = roleKey.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const payload: RoleFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: roleKey.trim().toLowerCase(),
      nameTranslations: {
        es: nameTranslations.es?.trim() || "",
        en: nameTranslations.en?.trim() || "",
      },
      actions,
    };

    onSubmit(payload);
    onClose();
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
        disabled={!isFormValid}
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
              />
            }
            label={t("roles:form.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TranslationInput
          label={t("roles:form.key", "Identificador / Key")}
          value={roleKey}
          onChangeKey={setRoleKey}
          placeholder={t("roles:form.key_placeholder", "ej: super_admin")}
          translations={nameTranslations}
          onChangeTranslations={setNameTranslations}
          required
          autoFocus={!isEditing}
          sectionTitle={t("roles:form.translations_title", "Traducciones del Nombre")}
          sectionSubtitle={t(
            "roles:form.translations_subtitle",
            "Define cómo se mostrará el nombre del rol en cada idioma."
          )}
        />

        <SelectMultipleInput
          label={t("roles:form.actions", "Acciones Asociadas")}
          options={availableActions}
          value={actions}
          onChange={setActions}
          placeholder={t(
            "roles:form.actions_placeholder",
            "Seleccionar acciones permitidas..."
          )}
          searchPlaceholder={t("core:search", "Buscar...")}
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
