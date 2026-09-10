import type { FC, FormEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import TextInput from "../../../../../../components/inputs/TextInput";
import { useModuleGroups } from "../../infrastructure/useServices";
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
  const { t, i18n } = useTranslation(["modules", "core"]);
  const isEditing = Boolean(initialData?.id);

  const domain =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:5173";

  const { data: groupsResponse, isLoading: isLoadingGroups } = useModuleGroups({
    all: true,
  });

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [moduleKey, setModuleKey] = useState<string>(initialData?.key ?? "");
  const [link, setLink] = useState<string>(initialData?.link ?? "");
  const [moduleGroupId, setModuleGroupId] = useState<string | null>(
    initialData?.module_group_id ?? null
  );
  const [nameTranslations, setNameTranslations] = useState<
    Record<string, string>
  >(initialData?.nameTranslations ?? { es: "", en: "" });

  const groupsData = groupsResponse?.data;
  const groupOptions = useMemo(() => {
    if (!groupsData) return [];
    const lang = i18n.language?.startsWith("en") ? "en" : "es";
    const altLang = lang === "en" ? "es" : "en";

    return groupsData.map((group) => {
      const trans = group.translates?.find((tr) => tr.key === "key");
      const translatedName = trans?.[lang] || trans?.[altLang];
      const label =
        translatedName && translatedName !== group.key
          ? `${translatedName} (${group.key})`
          : group.key;

      return {
        value: group.id,
        label,
      };
    });
  }, [groupsData, i18n.language]);

  const isFormValid =
    moduleKey.trim().length > 0 &&
    Boolean(moduleGroupId) &&
    link.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !moduleGroupId || isSubmitting) return;

    const translates = [
      {
        key: "key",
        es: nameTranslations.es?.trim() || moduleKey.trim(),
        en: nameTranslations.en?.trim() || moduleKey.trim(),
      },
    ];

    const normalizedLink = link.trim().startsWith("/")
      ? link.trim()
      : `/${link.trim()}`;

    const payload: ModuleFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: moduleKey.trim().toLowerCase(),
      module_group_id: moduleGroupId,
      link: normalizedLink,
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
          label={t("modules:form.link", "Ruta")}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={t("modules:form.link_placeholder", "ej: /settings/users")}
          helperText={
            link.trim()
              ? `${t("modules:form.link_preview", "URL completa")}: ${domain}${
                  link.trim().startsWith("/") ? link.trim() : `/${link.trim()}`
                }`
              : t(
                  "modules:form.link_helper",
                  "Ruta relativa del módulo en la aplicación."
                )
          }
          required
          disabled={isSubmitting}
        />

        <SelectSingleInput
          label={t("modules:form.group", "Grupo")}
          options={groupOptions}
          value={moduleGroupId}
          onChange={setModuleGroupId}
          placeholder={t(
            "modules:form.group_placeholder",
            "Seleccionar grupo..."
          )}
          required
          disabled={isSubmitting || isLoadingGroups}
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
