import type { FC, FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import type { ActionModalProps, ActionFormData } from "./types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const ActionModalInner: FC<ActionModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  availableModules = [],
}) => {
  const { t } = useTranslation(["actions", "core"]);
  const isEditing = Boolean(initialData?.id);

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [actionKey, setActionKey] = useState<string>(initialData?.key ?? "");
  const [nameTranslations, setNameTranslations] = useState<
    Record<string, string>
  >(initialData?.nameTranslations ?? { es: "", en: "" });
  const [moduleKey, setModuleKey] = useState<string | null>(
    initialData?.moduleKey ?? null
  );
  const [description, setDescription] = useState<string>(
    initialData?.description ?? ""
  );

  const isFormValid = actionKey.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const payload: ActionFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: actionKey.trim().toLowerCase(),
      nameTranslations: {
        es: nameTranslations.es?.trim() || "",
        en: nameTranslations.en?.trim() || "",
      },
      moduleKey: moduleKey || null,
      description: description.trim() || null,
    };

    onSubmit(payload);
    onClose();
  };

  const modalTitle = isEditing
    ? t("actions:edit_modal_title", "Actualizar Accionable")
    : t("actions:create_modal_title", "Nuevo Accionable");

  const submitButtonText = isEditing
    ? t("actions:update_action_button", "Actualizar Accionable")
    : t("actions:create_action_button", "Crear Accionable");

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
        form="action-form"
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
      <FormContainer id="action-form" onSubmit={handleSubmit}>
        <SwitchWrapper>
          <StyledFormControlLabel
            control={
              <StyledSwitch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                name="isActive"
              />
            }
            label={t("actions:form.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TranslationInput
          label={t("actions:form.key", "Identificador / Key")}
          value={actionKey}
          onChangeKey={setActionKey}
          placeholder={t(
            "actions:form.key_placeholder",
            "ej: users.create, roles.manage"
          )}
          translations={nameTranslations}
          onChangeTranslations={setNameTranslations}
          required
          autoFocus={!isEditing}
          sectionTitle={t(
            "actions:form.translations_title",
            "Traducciones del Nombre"
          )}
          sectionSubtitle={t(
            "actions:form.translations_subtitle",
            "Define cómo se mostrará el nombre del accionable en cada idioma."
          )}
        />

        <SelectSingleInput
          label={t("actions:form.module", "Módulo Asociado (Opcional)")}
          options={availableModules}
          value={moduleKey}
          onChange={setModuleKey}
          placeholder={t(
            "actions:form.module_placeholder",
            "Seleccionar módulo..."
          )}
          searchPlaceholder={t("core:search", "Buscar...")}
          clearable
        />

        <TextInput
          label={t("actions:form.description", "Descripción")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(
            "actions:form.description_placeholder",
            "Describe el propósito funcional o técnico de este accionable..."
          )}
          name="description"
          multiline
          rows={3}
        />
      </FormContainer>
    </BaseModal>
  );
};

const ActionModal: FC<ActionModalProps> = (props) => {
  const { open, initialData } = props;
  if (!open) return null;

  return (
    <ActionModalInner
      key={initialData?.id ?? initialData?.key ?? "create-new-action"}
      {...props}
    />
  );
};

export default ActionModal;
