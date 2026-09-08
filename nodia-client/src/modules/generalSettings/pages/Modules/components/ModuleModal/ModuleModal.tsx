import type { FC, FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import type { ModuleModalProps, ModuleFormData } from "./types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const ModuleModalInner: FC<ModuleModalProps> = ({
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
  const [moduleKey, setModuleKey] = useState<string>(initialData?.key ?? "");
  const [groupBy, setGroupBy] = useState<string>(initialData?.group_by ?? "");
  const [nameTranslations, setNameTranslations] = useState<
    Record<string, string>
  >(initialData?.nameTranslations ?? { es: "", en: "" });

  const isFormValid =
    moduleKey.trim().length > 0 && groupBy.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const translates = [
      {
        key: "key",
        es: nameTranslations.es?.trim() || moduleKey.trim(),
        en: nameTranslations.en?.trim() || moduleKey.trim(),
      },
    ];

    const payload: ModuleFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: moduleKey.trim().toLowerCase(),
      group_by: groupBy.trim(),
      nameTranslations,
      translates,
    };

    onSubmit(payload);
  };

  const modalTitle = isEditing
    ? t("modules:edit_modal_title", "Actualizar Módulo")
    : t("modules:create_modal_title", "Nuevo Módulo");

  const submitButtonText = isEditing
    ? t("modules:update_module_button", "Actualizar Módulo")
    : t("modules:create_module_button", "Crear Módulo");

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
        form="module-form"
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
      <FormContainer id="module-form" onSubmit={handleSubmit}>
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
          value={moduleKey}
          onChangeKey={setModuleKey}
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
            "Define cómo se mostrará el nombre del módulo en cada idioma."
          )}
          required
          autoFocus={!isEditing}
          disabled={isSubmitting}
        />

        <TextInput
          label={t("modules:form.group_by", "Grupo")}
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
          placeholder={t(
            "modules:form.group_by_placeholder",
            "ej: settings, catalog..."
          )}
          required
          disabled={isSubmitting}
          name="groupBy"
        />
      </FormContainer>
    </BaseModal>
  );
};

const ModuleModal: FC<ModuleModalProps> = (props) => {
  const { open, initialData } = props;
  if (!open) return null;

  return (
    <ModuleModalInner
      key={initialData?.id ?? initialData?.key ?? "create-new-module"}
      {...props}
    />
  );
};

export default ModuleModal;
