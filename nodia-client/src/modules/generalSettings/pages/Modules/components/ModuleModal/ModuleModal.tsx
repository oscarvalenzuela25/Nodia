import type { FC, FormEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import IconSelect from "../../../../../../components/inputs/IconSelect";
import { useModuleGroups, useModules } from "../../infrastructure/useServices";
import { APP_AVAILABLE_ROUTES } from "../../constants/routes";
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

  const { data: modulesResponse, isLoading: isLoadingModules } = useModules({
    all: true,
  });

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [moduleKey, setModuleKey] = useState<string>(initialData?.key ?? "");
  const [link, setLink] = useState<string>(initialData?.link ?? "");
  const [icon, setIcon] = useState<string | null>(initialData?.icon ?? null);
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

  const occupiedLinks = useMemo(() => {
    const list = modulesResponse?.data ?? [];
    const set = new Set<string>();
    for (const mod of list) {
      if (isEditing && String(mod.id) === String(initialData?.id)) {
        continue;
      }
      if (mod.link) {
        const norm = mod.link.trim().startsWith("/")
          ? mod.link.trim()
          : `/${mod.link.trim()}`;
        set.add(norm);
      }
    }
    return set;
  }, [modulesResponse?.data, isEditing, initialData?.id]);

  const routeOptions = useMemo(() => {
    const currentLink = initialData?.link
      ? initialData.link.trim().startsWith("/")
        ? initialData.link.trim()
        : `/${initialData.link.trim()}`
      : null;

    const available = APP_AVAILABLE_ROUTES.filter(
      (r) => !occupiedLinks.has(r.value) || r.value === currentLink,
    ).map((r) => {
      const translatedName = t(r.labelKey, r.defaultLabel);
      const label = translatedName.includes(`(${r.value})`)
        ? translatedName
        : `${translatedName} (${r.value})`;

      return {
        value: r.value,
        label,
      };
    });

    if (currentLink && !available.some((opt) => opt.value === currentLink)) {
      available.unshift({
        value: currentLink,
        label: `${currentLink} (${t("modules:routes.current", "Actual")})`,
      });
    }

    return available;
  }, [occupiedLinks, initialData?.link, t]);

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
      icon: icon || null,
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
      size="md"
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

        <SelectSingleInput
          label={t("modules:form.link", "Ruta")}
          options={routeOptions}
          value={link ? (link.startsWith("/") ? link : `/${link}`) : null}
          onChange={(val) => setLink(val ?? "")}
          placeholder={t(
            "modules:form.link_select_placeholder",
            "Seleccionar ruta disponible..."
          )}
          searchPlaceholder={t(
            "modules:form.link_search_placeholder",
            "Buscar ruta..."
          )}
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
          disabled={isSubmitting || isLoadingModules}
          dataTestId="module-link-select"
        />

        <IconSelect
          label={t("modules:form.icon", "Ícono")}
          value={icon}
          onChange={setIcon}
          placeholder={t("modules:form.icon_placeholder", "Por defecto (automático)")}
          helperText={t(
            "modules:form.icon_helper",
            "Selecciona un ícono representativo de Material-UI para este elemento."
          )}
          disabled={isSubmitting}
          data-testid="module-icon-select"
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
