import type { FC, FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Typography } from "@mui/material";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import type { ActionModalProps, ActionFormData } from "./types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
  DescriptionBox,
  DescriptionHeader,
  HeaderTitleContainer,
  HeaderTitle,
  HeaderSubtitle,
  LanguagesGrid,
  LanguageFieldContainer,
  LanguageLabel,
  LanguageBadge,
} from "./styles";

const ActionModalInner: FC<ActionModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false,
}) => {
  const { t } = useTranslation(["actions", "core"]);
  const isEditing = Boolean(initialData?.id);

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [actionKey, setActionKey] = useState<string>(initialData?.key ?? "");
  const [nameTranslations, setNameTranslations] = useState<Record<string, string>>(
    initialData?.nameTranslations ?? { es: "", en: "" }
  );
  const [descriptionTranslations, setDescriptionTranslations] = useState<
    Record<string, string>
  >(initialData?.descriptionTranslations ?? { es: "", en: "" });

  const isFormValid = actionKey.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const translates = [
      {
        key: "key",
        es: nameTranslations.es?.trim() || actionKey.trim(),
        en: nameTranslations.en?.trim() || actionKey.trim(),
      },
      {
        key: "comment",
        es: descriptionTranslations.es?.trim() ?? "",
        en: descriptionTranslations.en?.trim() ?? "",
      },
    ];

    const payload: ActionFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: actionKey.trim().toLowerCase(),
      nameTranslations,
      descriptionTranslations,
      description: null,
      translates,
    };

    onSubmit(payload);
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
        form="action-form"
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
      <FormContainer id="action-form" onSubmit={handleSubmit}>
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
            label={t("actions:form.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TranslationInput
          label={t("actions:form.key", "Identificador")}
          value={actionKey}
          onChangeKey={setActionKey}
          placeholder={t(
            "actions:form.key_placeholder",
            "ej: users.create, roles.manage"
          )}
          translations={nameTranslations}
          onChangeTranslations={setNameTranslations}
          sectionTitle={t(
            "actions:form.translations_title",
            "Traducciones del Identificador"
          )}
          sectionSubtitle={t(
            "actions:form.translations_subtitle",
            "Define cómo se mostrará el nombre del accionable en cada idioma."
          )}
          required
          autoFocus={!isEditing}
          disabled={isSubmitting}
        />

        <DescriptionBox>
          <DescriptionHeader>
            <HeaderTitleContainer>
              <TranslateOutlinedIcon
                fontSize="small"
                sx={{ color: "primary.main", fontSize: "1.1rem" }}
              />
              <Box>
                <HeaderTitle>
                  {t(
                    "actions:form.description_translations_title",
                    "Traducciones de la Descripción"
                  )}
                </HeaderTitle>
                <HeaderSubtitle>
                  {t(
                    "actions:form.description_translations_subtitle",
                    "Define cómo se describirá la acción en cada idioma."
                  )}
                </HeaderSubtitle>
              </Box>
            </HeaderTitleContainer>
          </DescriptionHeader>

          <LanguagesGrid>
            <LanguageFieldContainer>
              <LanguageLabel htmlFor="action-desc-es">
                <LanguageBadge langCode="es">es</LanguageBadge>
                <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
                  {t("actions:form.description_es", "Descripción (Español)")}
                </Typography>
              </LanguageLabel>
              <TextInput
                id="action-desc-es"
                name="description_es"
                value={descriptionTranslations.es}
                onChange={(e) =>
                  setDescriptionTranslations((prev) => ({
                    ...prev,
                    es: e.target.value,
                  }))
                }
                placeholder={t(
                  "actions:form.description_es_placeholder",
                  "ej: Permite crear y gestionar nuevos usuarios"
                )}
                disabled={isSubmitting}
                fullWidth
              />
            </LanguageFieldContainer>

            <LanguageFieldContainer>
              <LanguageLabel htmlFor="action-desc-en">
                <LanguageBadge langCode="en">en</LanguageBadge>
                <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
                  {t("actions:form.description_en", "Descripción (Inglés)")}
                </Typography>
              </LanguageLabel>
              <TextInput
                id="action-desc-en"
                name="description_en"
                value={descriptionTranslations.en}
                onChange={(e) =>
                  setDescriptionTranslations((prev) => ({
                    ...prev,
                    en: e.target.value,
                  }))
                }
                placeholder={t(
                  "actions:form.description_en_placeholder",
                  "ej: Allows creating and managing new users"
                )}
                disabled={isSubmitting}
                fullWidth
              />
            </LanguageFieldContainer>
          </LanguagesGrid>
        </DescriptionBox>
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
