import type { FC, FormEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import SelectMultipleInput from "../../../../../../components/inputs/SelectMultipleInput";
import { useRoles } from "../../../Roles";
import { useModules } from "../../../Modules";
import { formatEntityLabel } from "../../utils";
import type { UserModalProps, UserFormData } from "./types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const DEFAULT_ROLES = ["Admin", "User", "Manager", "SuperAdmin", "Editor"];

const UserModalInner: FC<UserModalProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  availableRoles = DEFAULT_ROLES,
  availableModules = [],
  isSubmitting = false,
}) => {
  const { t, i18n } = useTranslation(["users", "modules", "roles", "core"]);
  const isEditing = Boolean(initialData?.id);

  const {
    data: rolesResponse,
    isLoading: isLoadingRoles,
    isFetching: isFetchingRoles,
  } = useRoles(
    { all: true, includes: false },
    { enabled: open }
  );

  const {
    data: modulesResponse,
    isLoading: isLoadingModules,
    isFetching: isFetchingModules,
  } = useModules(
    { all: true, includes: false },
    { enabled: open }
  );

  const dynamicRoleOptions = useMemo(() => {
    if (rolesResponse?.data && rolesResponse.data.length > 0) {
      return rolesResponse.data.map((r) => ({
        value: r.id,
        label: formatEntityLabel(r, i18n.language, (key) =>
          i18n.exists(`roles:role_names.${key}`)
            ? t(`roles:role_names.${key}`)
            : null
        ),
      }));
    }
    return (availableRoles ?? []).map((opt) => {
      if (typeof opt === "string") {
        return {
          value: opt,
          label: formatEntityLabel(opt, i18n.language, (key) =>
            i18n.exists(`roles:role_names.${key}`)
              ? t(`roles:role_names.${key}`)
              : null
          ),
        };
      }
      return opt;
    });
  }, [rolesResponse, availableRoles, i18n.language, i18n, t]);

  const dynamicModuleOptions = useMemo(() => {
    if (modulesResponse?.data && modulesResponse.data.length > 0) {
      return modulesResponse.data.map((m) => ({
        value: m.id,
        label: formatEntityLabel(m, i18n.language, (key) =>
          i18n.exists(`modules:module_names.${key}`)
            ? t(`modules:module_names.${key}`)
            : null
        ),
      }));
    }
    return (availableModules ?? []).map((opt) => {
      if (typeof opt === "string") {
        return {
          value: opt,
          label: formatEntityLabel(opt, i18n.language, (key) =>
            i18n.exists(`modules:module_names.${key}`)
              ? t(`modules:module_names.${key}`)
              : null
          ),
        };
      }
      return opt;
    });
  }, [modulesResponse, availableModules, i18n.language, i18n, t]);

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [name, setName] = useState<string>(initialData?.name ?? "");
  const [email, setEmail] = useState<string>(initialData?.email ?? "");
  const [roles, setRoles] = useState<string[]>(initialData?.roles ?? []);
  const [modules, setModules] = useState<string[]>(initialData?.modules ?? []);
  const [imageUrl, setImageUrl] = useState<string>(
    initialData?.imageUrl ?? ""
  );

  const isFormValid = email.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const payload: UserFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      name: name.trim() || null,
      email: email.trim(),
      roles,
      modules,
      imageUrl: imageUrl.trim() || null,
    };

    onSubmit(payload);
  };

  const modalTitle = isEditing
    ? t("users:edit_modal_title", "Actualizar Usuario")
    : t("users:create_modal_title", "Nuevo Usuario");

  const submitButtonText = isEditing
    ? t("users:update_user_button", "Actualizar Usuario")
    : t("users:create_user_button", "Crear Usuario");

  const actions = (
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
        form="user-form"
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
      actions={actions}
    >
      <FormContainer id="user-form" onSubmit={handleSubmit}>
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
            label={t("users:form.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>

        <TextInput
          label={t("users:form.name", "Nombre")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("users:form.name_placeholder", "Ingresa el nombre")}
          name="name"
          disabled={isSubmitting}
        />

        <TextInput
          label={t("users:form.email", "Correo Electrónico")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("users:form.email_placeholder", "correo@ejemplo.com")}
          name="email"
          type="email"
          required
          disabled={isSubmitting}
        />

        <SelectMultipleInput
          label={t("users:form.roles", "Roles")}
          options={dynamicRoleOptions}
          value={roles}
          onChange={setRoles}
          placeholder={t("users:form.roles_placeholder", "Seleccionar roles...")}
          searchPlaceholder={t("core:search", "Buscar...")}
          disabled={isLoadingRoles || isFetchingRoles || isSubmitting}
        />

        <SelectMultipleInput
          label={t("users:form.modules", "Módulos")}
          options={dynamicModuleOptions}
          value={modules}
          onChange={setModules}
          placeholder={t("users:form.modules_placeholder", "Seleccionar módulos...")}
          searchPlaceholder={t("core:search", "Buscar...")}
          disabled={isLoadingModules || isFetchingModules || isSubmitting}
        />

        <TextInput
          label={t("users:form.image_url", "URL de imagen")}
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder={t(
            "users:form.image_url_placeholder",
            "https://ejemplo.com/imagen.jpg"
          )}
          name="imageUrl"
          disabled={isSubmitting}
        />
      </FormContainer>
    </BaseModal>
  );
};

const UserModal: FC<UserModalProps> = (props) => {
  const { open, initialData } = props;
  if (!open) return null;

  return (
    <UserModalInner
      key={initialData?.id ?? "create-new-user"}
      {...props}
    />
  );
};

export default UserModal;
