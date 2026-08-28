import type { FC, FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import SelectMultipleInput from "../../../../../../components/inputs/SelectMultipleInput";
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
}) => {
  const { t } = useTranslation(["users", "core"]);
  const isEditing = Boolean(initialData?.id);

  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive ?? true
  );
  const [name, setName] = useState<string>(initialData?.name ?? "");
  const [email, setEmail] = useState<string>(initialData?.email ?? "");
  const [roles, setRoles] = useState<string[]>(initialData?.roles ?? []);
  const [imageUrl, setImageUrl] = useState<string>(
    initialData?.imageUrl ?? ""
  );

  const isFormValid = email.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const payload: UserFormData = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      isActive,
      name: name.trim() || null,
      email: email.trim(),
      roles,
      imageUrl: imageUrl.trim() || null,
    };

    onSubmit(payload);
    onClose();
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
        />

        <TextInput
          label={t("users:form.email", "Correo Electrónico")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("users:form.email_placeholder", "correo@ejemplo.com")}
          name="email"
          type="email"
          required
        />

        <SelectMultipleInput
          label={t("users:form.roles", "Roles")}
          options={availableRoles}
          value={roles}
          onChange={setRoles}
          placeholder={t("users:form.roles_placeholder", "Seleccionar roles...")}
          searchPlaceholder={t("core:search", "Buscar...")}
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
