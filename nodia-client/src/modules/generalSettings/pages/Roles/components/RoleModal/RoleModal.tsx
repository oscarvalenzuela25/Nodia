import type { FC, FormEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import SelectMultipleInput from "../../../../../../components/inputs/SelectMultipleInput";
import { useActions } from "../../../Actions";
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
  isSubmitting = false,
}) => {
  const { t, i18n } = useTranslation(["roles", "actions", "core"]);
  const isEditing = Boolean(initialData?.id);

  const {
    data: actionsResponse,
    isLoading: isLoadingActions,
    isFetching: isFetchingActions,
  } = useActions(
    { all: true, includes: false },
    { enabled: open }
  );

  const dynamicActionOptions = useMemo(() => {
    if (actionsResponse?.data && actionsResponse.data.length > 0) {
      return actionsResponse.data.map((act) => {
        const keyTrans = act.translates?.find((tr) => tr.key === "key");
        const lang = i18n.language?.startsWith("en") ? "en" : "es";
        const altLang = lang === "en" ? "es" : "en";
        const translated =
          keyTrans?.[lang] ||
          keyTrans?.[altLang] ||
          (i18n.exists(`actions:action_names.${act.key}`)
            ? t(`actions:action_names.${act.key}`)
            : i18n.exists(`roles:action_names.${act.key}`)
            ? t(`roles:action_names.${act.key}`)
            : null);
        const label = translated ? `${translated} (${act.key})` : act.key;
        return {
          value: act.key,
          label,
          category: act.key.split(".")[0],
        };
      });
    }
    return availableActions;
  }, [actionsResponse, availableActions, i18n.language, t, i18n]);

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
    if (!isFormValid || isSubmitting) return;

    const translates = [
      {
        key: "key",
        es: nameTranslations.es?.trim() || roleKey.trim(),
        en: nameTranslations.en?.trim() || roleKey.trim(),
      },
    ];

    const payload: RoleFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      key: roleKey.trim().toLowerCase(),
      nameTranslations,
      actions,
      translates,
    };

    onSubmit(payload);
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
        form="role-form"
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
      <FormContainer id="role-form" onSubmit={handleSubmit}>
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
            label={t("roles:form.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TranslationInput
          label={t("roles:form.key", "Identificador")}
          value={roleKey}
          onChangeKey={setRoleKey}
          placeholder={t("roles:form.key_placeholder", "ej: super_admin")}
          translations={nameTranslations}
          onChangeTranslations={setNameTranslations}
          sectionTitle={t(
            "roles:form.translations_title",
            "Traducciones del Identificador"
          )}
          sectionSubtitle={t(
            "roles:form.translations_subtitle",
            "Define cómo se mostrará el nombre del rol en cada idioma."
          )}
          required
          autoFocus={!isEditing}
          disabled={isSubmitting}
        />

        <SelectMultipleInput
          label={t("roles:form.actions", "Acciones Asociadas")}
          options={dynamicActionOptions}
          value={actions}
          onChange={setActions}
          placeholder={t(
            "roles:form.actions_placeholder",
            "Seleccionar acciones permitidas..."
          )}
          searchPlaceholder={t("core:search", "Buscar...")}
          disabled={isSubmitting || isLoadingActions || isFetchingActions}
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
