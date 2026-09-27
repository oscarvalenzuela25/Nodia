import type { FC, FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Typography,
  Box,
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import BaseModal from "../../../../../../../../components/BaseModal";
import TextInput from "../../../../../../../../components/inputs/TextInput";
import { sileo } from "sileo";
import { useCreateAiApiKey } from "../../../../infrastructure/useServices";
import type { AddApiKeyModalProps } from "./types";
import {
  FormContainer,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const AddApiKeyModal: FC<AddApiKeyModalProps> = ({
  open,
  providerId,
  providerName,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation(["ai_providers", "core"]);

  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [label, setLabel] = useState("");
  const [isSelected, setIsSelected] = useState(true);

  const createApiKeyMutation = useCreateAiApiKey();

  const handleReset = () => {
    setSecret("");
    setShowSecret(false);
    setLabel("");
    setIsSelected(true);
  };

  const handleClose = () => {
    if (createApiKeyMutation.isPending) return;
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!secret.trim() || createApiKeyMutation.isPending) return;

    try {
      await createApiKeyMutation.mutateAsync({
        provider_id: providerId,
        label: label.trim() || "Primary Key",
        secret: secret.trim(),
        is_selected: isSelected,
        is_active: true,
      });

      sileo.success({
        title: t(
          "ai_providers:detail.key_created_success",
          "Clave de API registrada correctamente"
        ),
      });

      handleReset();
      onSuccess?.();
      onClose();
    } catch (error: any) {
      const serverMessage = error?.response?.data?.message;
      sileo.error({
        title: t(
          "ai_providers:detail.key_create_error",
          "No se pudo registrar la clave de API"
        ),
        description: Array.isArray(serverMessage)
          ? serverMessage.join(", ")
          : serverMessage,
      });
    }
  };

  const isValid = secret.trim().length > 0;

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="contained"
        color="error"
        onClick={handleClose}
        disabled={createApiKeyMutation.isPending}
        sx={(theme) => ({
          color: theme.palette.error.contrastText,
          borderRadius: 2,
          px: 2.5,
        })}
      >
        {t("ai_providers:modal_config.cancel", "Cancelar")}
      </Button>
      <Button
        type="submit"
        form="add-api-key-form"
        variant="contained"
        color="primary"
        disabled={!isValid || createApiKeyMutation.isPending}
        sx={(theme) => ({
          color: theme.palette.primary.contrastText,
          borderRadius: 2,
          px: 2.5,
        })}
      >
        {createApiKeyMutation.isPending
          ? t("ai_providers:modal_config.saving", "Guardando...")
          : t("ai_providers:detail.add_key_submit", "Guardar Clave")}
      </Button>
    </ModalActionsContainer>
  );

  return (
    <BaseModal
      open={open}
      onClose={handleClose}
      title={`${t("ai_providers:detail.modal_add_key_title", "Agregar Clave de API")} - ${providerName}`}
      size="sm"
      actions={modalActions}
    >
      <FormContainer id="add-api-key-form" onSubmit={handleSubmit}>
        <TextInput
          label={t("ai_providers:detail.key_label_label", "Etiqueta / Alias")}
          placeholder={t(
            "ai_providers:detail.key_label_placeholder",
            "ej: mistral-prod-primary"
          )}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={createApiKeyMutation.isPending}
        />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: "text.primary" }}
          >
            {t("ai_providers:detail.key_secret_label", "Secreto de la Clave API")} *
          </Typography>
          <TextField
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="sk-..."
            helperText={t(
              "ai_providers:detail.key_secret_helper",
              "Se almacenará cifrada con AES-256-GCM."
            )}
            disabled={createApiKeyMutation.isPending}
            fullWidth
            size="small"
            required
            autoFocus
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowSecret(!showSecret)}
                      edge="end"
                    >
                      {showSecret ? (
                        <VisibilityOffOutlinedIcon fontSize="small" />
                      ) : (
                        <VisibilityOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <SwitchWrapper>
          <StyledFormControlLabel
            control={
              <StyledSwitch
                checked={isSelected}
                onChange={(e) => setIsSelected(e.target.checked)}
                disabled={createApiKeyMutation.isPending}
              />
            }
            label={t(
              "ai_providers:detail.key_is_selected",
              "Establecer como clave activa principal inmediatamente"
            )}
            labelPlacement="start"
          />
        </SwitchWrapper>
      </FormContainer>
    </BaseModal>
  );
};

export default AddApiKeyModal;
