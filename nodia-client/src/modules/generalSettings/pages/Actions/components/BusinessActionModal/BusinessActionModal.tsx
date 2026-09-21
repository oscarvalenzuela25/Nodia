import type { FC, FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Collapse } from "@mui/material";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import type { BusinessActionModalProps } from "./types";
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

const BusinessActionModalInner: FC<BusinessActionModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false,
}) => {
  const { t } = useTranslation(["actions", "core"]);
  const isEditing = Boolean(initialData?.id);

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.is_active ?? true
  );
  const [actionKey, setActionKey] = useState<string>(initialData?.key ?? "");
  const [hasDescription, setHasDescription] = useState<boolean>(
    initialData?.has_description ?? false
  );

  const [nameTranslations, setNameTranslations] = useState<Record<string, string>>(
    () => {
      const keyTrans = initialData?.translates?.find((tr) => tr.key === "key");
      return {
        es: keyTrans?.es ?? initialData?.nameTranslations?.es ?? "",
        en: keyTrans?.en ?? initialData?.nameTranslations?.en ?? "",
      };
    }
  );

  const [descriptionTranslations, setDescriptionTranslations] = useState<
    Record<string, string>
  >(() => {
    const descTrans = initialData?.translates?.find(
      (tr) => tr.key === "description" || tr.key === "comment"
    );
    return {
      es: descTrans?.es ?? initialData?.descriptionTranslations?.es ?? "",
      en: descTrans?.en ?? initialData?.descriptionTranslations?.en ?? "",
    };
  });

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
    ];

    if (hasDescription) {
      translates.push({
        key: "description",
        es: descriptionTranslations.es?.trim() ?? "",
        en: descriptionTranslations.en?.trim() ?? "",
      });
    }

    onSubmit({
      ...(initialData?.id ? { id: initialData.id } : {}),
      is_active: isActive,
      key: actionKey.trim().toLowerCase(),
      has_description: hasDescription,
      translates,
    });
  };

  const modalTitle = isEditing
    ? t("actions:edit_business_action", "Actualizar Acción de Negocio")
    : t("actions:new_business_action", "Nueva Acción de Negocio");

  const submitButtonText = isEditing
    ? t("actions:update_action_button", "Actualizar")
    : t("actions:create_action_button", "Crear");

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
        form="business-action-form"
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
      subtitle={t(
        "actions:business_actions_subtitle",
        "Catálogo de permisos asignables a colaboradores dentro de cada negocio."
      )}
      actions={modalActions}
    >
      <FormContainer id="business-action-form" onSubmit={handleSubmit}>
        <SwitchWrapper>
          <StyledFormControlLabel
            control={
              <StyledSwitch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSubmitting}
                color="success"
              />
            }
            label={t("actions:form.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TextInput
          id="business-action-key"
          name="key"
          label={t("actions:form.key", "Identificador")}
          placeholder={t("actions:form.key_placeholder", "ej: products.create")}
          helperText={t(
            "actions:form.key_helper",
            "Identificador único utilizado internamente por el sistema."
          )}
          value={actionKey}
          onChange={(e) => setActionKey(e.target.value)}
          disabled={isSubmitting}
          fullWidth
          required
        />

        {/* Translation: Name / Key */}
        <DescriptionBox>
          <DescriptionHeader>
            <HeaderTitleContainer>
              <TranslateOutlinedIcon color="primary" sx={{ fontSize: 18 }} />
              <HeaderTitle>
                {t(
                  "actions:form.translations_title",
                  "Traducciones del Identificador"
                )}
              </HeaderTitle>
            </HeaderTitleContainer>
          </DescriptionHeader>

          <HeaderSubtitle>
            {t(
              "actions:form.translations_subtitle",
              "Define cómo se mostrará el nombre del accionable en cada idioma."
            )}
          </HeaderSubtitle>

          <LanguagesGrid>
            <LanguageFieldContainer>
              <LanguageLabel htmlFor="business-action-name-es">
                <LanguageBadge langCode="es">ES</LanguageBadge>
                {t("actions:form.name_es", "Nombre (Español)")}
              </LanguageLabel>
              <TextInput
                id="business-action-name-es"
                name="name_es"
                placeholder={t(
                  "actions:form.name_es_placeholder",
                  "ej: Crear Productos"
                )}
                value={nameTranslations.es}
                onChange={(e) =>
                  setNameTranslations((prev) => ({ ...prev, es: e.target.value }))
                }
                disabled={isSubmitting}
                fullWidth
              />
            </LanguageFieldContainer>

            <LanguageFieldContainer>
              <LanguageLabel htmlFor="business-action-name-en">
                <LanguageBadge langCode="en">EN</LanguageBadge>
                {t("actions:form.name_en", "Nombre (Inglés)")}
              </LanguageLabel>
              <TextInput
                id="business-action-name-en"
                name="name_en"
                placeholder={t(
                  "actions:form.name_en_placeholder",
                  "ej: Create Products"
                )}
                value={nameTranslations.en}
                onChange={(e) =>
                  setNameTranslations((prev) => ({ ...prev, en: e.target.value }))
                }
                disabled={isSubmitting}
                fullWidth
              />
            </LanguageFieldContainer>
          </LanguagesGrid>
        </DescriptionBox>

        {/* Has Description Toggle */}
        <SwitchWrapper>
          <StyledFormControlLabel
            control={
              <StyledSwitch
                checked={hasDescription}
                onChange={(e) => setHasDescription(e.target.checked)}
                disabled={isSubmitting}
                color="primary"
              />
            }
            label={t("actions:form.description", "Descripción")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        {/* Translation: Description */}
        <Collapse in={hasDescription}>
          <DescriptionBox sx={{ mt: 1 }}>
            <DescriptionHeader>
              <HeaderTitleContainer>
                <DescriptionOutlinedIcon color="primary" sx={{ fontSize: 18 }} />
                <HeaderTitle>
                  {t(
                    "actions:form.description_translations_title",
                    "Traducciones de la Descripción"
                  )}
                </HeaderTitle>
              </HeaderTitleContainer>
            </DescriptionHeader>

            <HeaderSubtitle>
              {t(
                "actions:form.description_translations_subtitle",
                "Define cómo se describirá la acción en cada idioma."
              )}
            </HeaderSubtitle>

            <LanguagesGrid>
              <LanguageFieldContainer>
                <LanguageLabel htmlFor="business-action-desc-es">
                  <LanguageBadge langCode="es">ES</LanguageBadge>
                  {t("actions:form.description_es", "Descripción (Español)")}
                </LanguageLabel>
                <TextInput
                  id="business-action-desc-es"
                  name="description_es"
                  placeholder={t(
                    "actions:form.description_es_placeholder",
                    "ej: Permite registrar y gestionar nuevos productos"
                  )}
                  value={descriptionTranslations.es}
                  onChange={(e) =>
                    setDescriptionTranslations((prev) => ({
                      ...prev,
                      es: e.target.value,
                    }))
                  }
                  disabled={isSubmitting}
                  fullWidth
                  multiline
                  rows={2}
                />
              </LanguageFieldContainer>

              <LanguageFieldContainer>
                <LanguageLabel htmlFor="business-action-desc-en">
                  <LanguageBadge langCode="en">EN</LanguageBadge>
                  {t("actions:form.description_en", "Descripción (Inglés)")}
                </LanguageLabel>
                <TextInput
                  id="business-action-desc-en"
                  name="description_en"
                  placeholder={t(
                    "actions:form.description_en_placeholder",
                    "ej: Allows creating and managing new products"
                  )}
                  value={descriptionTranslations.en}
                  onChange={(e) =>
                    setDescriptionTranslations((prev) => ({
                      ...prev,
                      en: e.target.value,
                    }))
                  }
                  disabled={isSubmitting}
                  fullWidth
                  multiline
                  rows={2}
                />
              </LanguageFieldContainer>
            </LanguagesGrid>
          </DescriptionBox>
        </Collapse>
      </FormContainer>
    </BaseModal>
  );
};

const BusinessActionModal: FC<BusinessActionModalProps> = (props) => {
  const { open, initialData } = props;
  if (!open) return null;

  return (
    <BusinessActionModalInner
      key={initialData?.id ?? initialData?.key ?? "create-new-business-action"}
      {...props}
    />
  );
};

export default BusinessActionModal;
