import type { FC, FormEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
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
  isSubmitting = false,
  isLoadingParents = false,
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
    if (!isFormValid || isSubmitting) return;

    const payload: ModuleFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: moduleKey.trim().toLowerCase(),
      type: moduleType,
      parentId: moduleType === "submodule" ? parentId : null,
      parentKey: moduleType === "submodule" ? parentId : null,
      nameTranslations: initialData?.nameTranslations ?? { es: "", en: "" },
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

        <TextInput
          label={t("modules:form.key", "Identificador / Key")}
          value={moduleKey}
          onChange={(e) => setModuleKey(e.target.value)}
          placeholder={t(
            "modules:form.key_placeholder",
            "ej: general_settings, users, security"
          )}
          required
          autoFocus={!isEditing}
          name="key"
          disabled={isSubmitting}
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
          disabled={isSubmitting}
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
            disabled={isSubmitting || isLoadingParents}
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
