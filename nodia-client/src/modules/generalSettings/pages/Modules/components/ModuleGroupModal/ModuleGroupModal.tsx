import type { FC, FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import type { ModuleGroupModalProps, ModuleGroupFormData } from "./types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const ModuleGroupModalInner: FC<ModuleGroupModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false,
}) => {
  const { t } = useTranslation(["modules", "core"]);
  const isEditing = Boolean(initialData?.id);

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [groupKey, setGroupKey] = useState<string>(initialData?.key ?? "");
  const [nameTranslations, setNameTranslations] = useState<
    Record<string, string>
  >(initialData?.nameTranslations ?? { es: "", en: "" });

  const isFormValid = groupKey.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const translates = [
      {
        key: "key",
        es: nameTranslations.es?.trim() || groupKey.trim(),
        en: nameTranslations.en?.trim() || groupKey.trim(),
      },
    ];

    const payload: ModuleGroupFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: groupKey.trim().toLowerCase(),
      nameTranslations,
      translates,
    };

    onSubmit(payload);
  };

  const modalTitle = isEditing
    ? t("modules:groups.edit_modal_title", "Actualizar Grupo de Módulos")
    : t("modules:groups.create_modal_title", "Nuevo Grupo de Módulos");

  const submitButtonText = isEditing
    ? t("modules:groups.update_button", "Actualizar Grupo")
    : t("modules:groups.create_button", "Crear Grupo");

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
        form="module-group-form"
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
      <FormContainer id="module-group-form" onSubmit={handleSubmit}>
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
            label={t("modules:form.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TranslationInput
          label={t("modules:form.key", "Identificador")}
          value={groupKey}
          onChangeKey={setGroupKey}
          placeholder={t(
            "modules:form.key_placeholder",
            "ej: users, roles, settings"
          )}
          translations={nameTranslations}
          onChangeTranslations={setNameTranslations}
          sectionTitle={t(
            "modules:form.translations_title",
            "Traducciones del Identificador"
          )}
          sectionSubtitle={t(
            "modules:form.translations_subtitle",
            "Define cómo se mostrará el nombre del grupo en cada idioma."
          )}
          required
          autoFocus={!isEditing}
          disabled={isSubmitting}
        />
      </FormContainer>
    </BaseModal>
  );
};

const ModuleGroupModal: FC<ModuleGroupModalProps> = (props) => {
  const { open, initialData } = props;
  if (!open) return null;

  return (
    <ModuleGroupModalInner
      key={initialData?.id ?? initialData?.key ?? "create-new-group"}
      {...props}
    />
  );
};

export default ModuleGroupModal;
