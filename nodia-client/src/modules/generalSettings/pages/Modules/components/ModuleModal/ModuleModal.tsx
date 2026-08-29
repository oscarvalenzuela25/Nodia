import type { FC, FormEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import type { ModuleModalProps, ModuleFormData, ModuleType } from "./types";
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
  availableParents = [],
}) => {
  const { t } = useTranslation(["modules", "core"]);
  const isEditing = Boolean(initialData?.id);

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [moduleKey, setModuleKey] = useState<string>(initialData?.key ?? "");
  const [moduleType, setModuleType] = useState<ModuleType>(
    initialData?.type ?? "module"
  );
  const [parentId, setParentId] = useState<string | null>(
    initialData?.parentId ?? initialData?.parentKey ?? null
  );
  const [nameTranslations, setNameTranslations] = useState<
    Record<string, string>
  >(initialData?.nameTranslations ?? { es: "", en: "" });

  const typeOptions = useMemo(
    () => [
      { value: "module", label: t("modules:types.module", "Módulo") },
      { value: "submodule", label: t("modules:types.submodule", "Submódulo") },
    ],
    [t]
  );

  const isFormValid =
    moduleKey.trim().length > 0 &&
    (moduleType === "module" || Boolean(parentId));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const payload: ModuleFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: moduleKey.trim().toLowerCase(),
      type: moduleType,
      parentId: moduleType === "submodule" ? parentId : null,
      parentKey: moduleType === "submodule" ? parentId : null,
      nameTranslations: {
        es: nameTranslations.es?.trim() || "",
        en: nameTranslations.en?.trim() || "",
      },
    };

    onSubmit(payload);
    onClose();
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
      <FormContainer id="module-form" onSubmit={handleSubmit}>
        <SwitchWrapper>
          <StyledFormControlLabel
            control={
              <StyledSwitch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                name="isActive"
              />
            }
            label={t("modules:form.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TranslationInput
          label={t("modules:form.key", "Identificador / Key")}
          value={moduleKey}
          onChangeKey={setModuleKey}
          placeholder={t(
            "modules:form.key_placeholder",
            "ej: general_settings, users, security"
          )}
          translations={nameTranslations}
          onChangeTranslations={setNameTranslations}
          required
          autoFocus={!isEditing}
          sectionTitle={t(
            "modules:form.translations_title",
            "Traducciones del Nombre"
          )}
          sectionSubtitle={t(
            "modules:form.translations_subtitle",
            "Define cómo se mostrará el nombre del módulo en cada idioma."
          )}
        />

        <SelectSingleInput
          label={t("modules:form.type", "Tipo de Elemento")}
          options={typeOptions}
          value={moduleType}
          onChange={(val) => {
            if (val === "module" || val === "submodule") {
              setModuleType(val);
              if (val === "module") {
                setParentId(null);
              }
            }
          }}
          clearable={false}
          required
        />

        {moduleType === "submodule" && (
          <SelectSingleInput
            label={t(
              "modules:form.parent_module",
              "Módulo Padre (Requerido para submódulos)"
            )}
            options={availableParents}
            value={parentId}
            onChange={setParentId}
            placeholder={t(
              "modules:form.parent_module_placeholder",
              "Seleccionar módulo padre..."
            )}
            searchPlaceholder={t("core:search", "Buscar...")}
            required
            clearable={true}
          />
        )}
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
