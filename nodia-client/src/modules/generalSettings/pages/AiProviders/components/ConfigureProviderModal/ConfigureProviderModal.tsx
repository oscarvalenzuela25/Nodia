import type { FC, FormEvent } from "react";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import { sileo } from "sileo";
import {
  useEnabledWebAiProviders,
  useUpdateAiProvider,
  useCreateAiApiKey,
  useSupportedAiProviders,
} from "../../infrastructure/useServices";
import type { ConfigureProviderModalProps } from "./types";
import {
  FormContainer,
  ProviderSummaryBox,
  ModeOptionsGrid,
  ModeOptionCard,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const ConfigureProviderModal: FC<ConfigureProviderModalProps> = ({
  open,
  provider,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation(["ai_providers", "core"]);

  const { data: webProvidersData } = useEnabledWebAiProviders();
  const { data: supportedProviders = [] } = useSupportedAiProviders();

  const enabledWebProviders = (webProvidersData?.enabled_providers || []).map(
    (p: string) => p.toLowerCase()
  );

  const isWebSupported = Boolean(
    provider?.key && enabledWebProviders.includes(provider.key.toLowerCase())
  );

  const currentSupportedProvider = useMemo(() => {
    if (!provider?.key) return null;
    return supportedProviders.find(
      (sp) => sp.key.toLowerCase() === provider.key.toLowerCase()
    );
  }, [supportedProviders, provider?.key]);

  const isGemini =
    (provider?.key || currentSupportedProvider?.key)?.toLowerCase() === "gemini";

  const modelOptions = useMemo(() => {
    let rawModels =
      provider?.availableModels && provider.availableModels.length > 0
        ? provider.availableModels
        : currentSupportedProvider?.availableModels || [];

    if (isGemini) {
      const filtered = rawModels.filter((m: any) => {
        const id = String(typeof m === "string" ? m : m.id || m.name || "").toLowerCase();
        const name = String(typeof m === "string" ? m : m.name || "").toLowerCase();
        return (
          !id.includes("2.5") &&
          !id.includes("2.0") &&
          !id.includes("1.5") &&
          !name.includes("2.5") &&
          !name.includes("2.0") &&
          !name.includes("1.5")
        );
      });
      rawModels =
        filtered.length > 0
          ? filtered
          : currentSupportedProvider?.availableModels || [];
    }

    return rawModels.map((m: any) => {
      if (typeof m === "string") {
        return { value: m, label: m };
      }
      return {
        value: m.id || m.name,
        label: `${m.name || m.id}${m.isRecommended ? ` (${t("core:recommended", "Recomendado")})` : ""}`,
        description: m.description,
      };
    });
  }, [provider?.availableModels, currentSupportedProvider, isGemini, t]);

  const ocrModelOptions = useMemo(() => {
    let rawModels =
      provider?.availableModels && provider.availableModels.length > 0
        ? provider.availableModels
        : currentSupportedProvider?.availableModels || [];

    if (isGemini) {
      const filtered = rawModels.filter((m: any) => {
        const id = String(typeof m === "string" ? m : m.id || m.name || "").toLowerCase();
        return !id.includes("2.5") && !id.includes("2.0") && !id.includes("1.5");
      });
      rawModels =
        filtered.length > 0
          ? filtered
          : currentSupportedProvider?.availableModels || [];
    }

    const ocrCandidateModels = rawModels.filter(
      (m: any) =>
        m.role === "ocr" ||
        m.capabilities?.includes("ocr") ||
        m.capabilities?.includes("vision")
    );
    const list = ocrCandidateModels.length > 0 ? ocrCandidateModels : rawModels;

    return list.map((m: any) => {
      if (typeof m === "string") {
        return { value: m, label: m };
      }
      return {
        value: m.id || m.name,
        label: `${m.name || m.id}${m.role === "ocr" ? ` (${t("ai_providers:modal_config.ocr_badge", "Especializado OCR")})` : ""}`,
        description: m.description,
      };
    });
  }, [provider?.availableModels, currentSupportedProvider, isGemini, t]);

  const hasOcrSupport = Boolean(
    currentSupportedProvider?.defaultOcrModel ||
      provider?.assignedModels?.ocr ||
      currentSupportedProvider?.availableModels?.some((m) => m.role === "ocr")
  );

  const [mode, setMode] = useState<"api_key" | "web_session">("api_key");
  const [selectedModel, setSelectedModel] = useState("");
  const [ocrModel, setOcrModel] = useState("");
  const [apiKeySecret, setApiKeySecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [apiKeyLabel, setApiKeyLabel] = useState("Primary Key");
  const [autoRotate, setAutoRotate] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Set default mode whenever provider changes or modal opens
  useEffect(() => {
    if (provider) {
      if (provider.mode === "web_session" && isWebSupported) {
        setMode("web_session");
      } else {
        setMode("api_key");
      }

      let defaultModel =
        provider.selectedModel ||
        currentSupportedProvider?.defaultSelectedModel ||
        (provider.availableModels?.[0]
          ? typeof provider.availableModels[0] === "string"
            ? provider.availableModels[0]
            : provider.availableModels[0].id
          : currentSupportedProvider?.availableModels?.[0]?.id || "");

      if (
        isGemini &&
        (!defaultModel ||
          defaultModel.includes("2.5") ||
          defaultModel.includes("2.0") ||
          defaultModel.includes("1.5"))
      ) {
        defaultModel = "gemini-flash";
      }

      const defaultOcr =
        provider.assignedModels?.ocr ||
        currentSupportedProvider?.defaultOcrModel ||
        "";

      setSelectedModel(defaultModel);
      setOcrModel(defaultOcr);
      setApiKeySecret("");
      setApiKeyLabel("Primary Key");
      setAutoRotate(provider.autoFailover !== "Desactivado");
      setIsActive(provider.isActive ?? true);
    }
  }, [provider, isWebSupported, currentSupportedProvider, open]);

  const updateProviderMutation = useUpdateAiProvider();
  const createApiKeyMutation = useCreateAiApiKey();

  const isSubmitting =
    updateProviderMutation.isPending || createApiKeyMutation.isPending;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!provider || isSubmitting) return;

    try {
      await updateProviderMutation.mutateAsync({
        id: provider.id,
        data: {
          mode,
          auto_rotate_api_keys: autoRotate,
          is_active: isActive,
          fields: {
            selected_model: selectedModel || undefined,
            ...(ocrModel ? { ocr_model: ocrModel } : {}),
            ...(mode === "web_session"
              ? { profile: "puppeteer_headless_v2" }
              : {}),
          },
        },
      });

      if (mode === "api_key" && apiKeySecret.trim()) {
        await createApiKeyMutation.mutateAsync({
          provider_id: provider.id,
          label: apiKeyLabel.trim() || "Primary Key",
          secret: apiKeySecret.trim(),
          is_selected: true,
          is_active: true,
        });
      }

      sileo.success({
        title: t(
          "ai_providers:notifications.provider_updated",
          "Configuración de proveedor guardada correctamente"
        ),
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      const serverMessage = error?.response?.data?.message;
      sileo.error({
        title: t(
          "ai_providers:notifications.provider_update_error",
          "No se pudo guardar la configuración del proveedor"
        ),
        description: Array.isArray(serverMessage)
          ? serverMessage.join(", ")
          : serverMessage,
      });
    }
  };

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="contained"
        color="error"
        onClick={handleClose}
        disabled={isSubmitting}
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
        form="configure-provider-form"
        variant="contained"
        color="primary"
        disabled={isSubmitting}
        onClick={handleSubmit}
        sx={(theme) => ({
          color: theme.palette.primary.contrastText,
          borderRadius: 2,
          px: 2.5,
        })}
      >
        {isSubmitting
          ? t("ai_providers:modal_config.saving", "Guardando...")
          : t("ai_providers:modal_config.save", "Guardar Configuración")}
      </Button>
    </ModalActionsContainer>
  );

  return (
    <BaseModal
      open={open}
      onClose={handleClose}
      title={t(
        "ai_providers:modal_config.title",
        "Configurar Conexión de Proveedor"
      )}
      size="md"
      actions={modalActions}
    >
      <FormContainer id="configure-provider-form" onSubmit={handleSubmit}>
        {/* PROVIDER SUMMARY HEADER */}
        {provider && (
          <ProviderSummaryBox>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {provider.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID técnico: <code>{provider.key}</code>
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                bgcolor: provider.hasConnection ? "success.main" : "warning.main",
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              {provider.hasConnection
                ? t("ai_providers:cards.status_available", "CONFIGURADO")
                : t("ai_providers:cards.status_unconfigured", "SIN CONFIGURAR")}
            </Typography>
          </ProviderSummaryBox>
        )}

        {/* MODE SELECTION */}
        <Box>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}
          >
            {t("ai_providers:modal_config.mode_label", "Método de Conexión")}
          </Typography>

          <ModeOptionsGrid>
            {/* API KEY OPTION */}
            <ModeOptionCard
              selected={mode === "api_key"}
              onClick={() => setMode("api_key")}
              elevation={0}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <VpnKeyOutlinedIcon
                  color={mode === "api_key" ? "primary" : "action"}
                  fontSize="small"
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t(
                    "ai_providers:modal_config.mode_api_title",
                    "API Key (Rotativa)"
                  )}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t(
                  "ai_providers:modal_config.mode_api_desc",
                  "Conexión directa vía endpoint oficial con pool de llaves y failover."
                )}
              </Typography>
            </ModeOptionCard>

            {/* WEB SESSION OPTION */}
            <ModeOptionCard
              selected={mode === "web_session"}
              disabled={!isWebSupported}
              onClick={() => {
                if (isWebSupported) setMode("web_session");
              }}
              elevation={0}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <DevicesOutlinedIcon
                  color={mode === "web_session" ? "primary" : "action"}
                  fontSize="small"
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t(
                    "ai_providers:modal_config.mode_web_title",
                    "Sesión Web Headless"
                  )}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {isWebSupported
                  ? t(
                      "ai_providers:modal_config.mode_web_desc",
                      "Autenticación en la nube sin costos por token para planes suscritos."
                    )
                  : t(
                      "ai_providers:modal_config.mode_web_disabled",
                      "No habilitado para este proveedor (requiere microservicio dedicado)."
                    )}
              </Typography>
            </ModeOptionCard>
          </ModeOptionsGrid>
        </Box>

        {/* MODEL SELECTION */}
        {modelOptions.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <SelectSingleInput
              label={t(
                "ai_providers:modal_config.model_label",
                "Modelo de IA Seleccionado"
              )}
              value={selectedModel || null}
              onChange={(val) => setSelectedModel(String(val || ""))}
              options={modelOptions}
              placeholder={t(
                "ai_providers:modal_config.model_placeholder",
                "Seleccionar modelo para inferencia..."
              )}
              helperText={t(
                "ai_providers:modal_config.model_helper",
                "Modelo predeterminado que procesará las consultas y tareas de inferencia de este proveedor."
              )}
              disabled={isSubmitting}
            />
          </Box>
        )}

        {/* OCR MODEL SELECTION */}
        {hasOcrSupport && ocrModelOptions.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <SelectSingleInput
              label={t(
                "ai_providers:modal_config.ocr_model_label",
                "Modelo de OCR Asignado"
              )}
              value={ocrModel || null}
              onChange={(val) => setOcrModel(String(val || ""))}
              options={ocrModelOptions}
              placeholder={t(
                "ai_providers:modal_config.ocr_model_placeholder",
                "Seleccionar modelo para OCR de documentos..."
              )}
              helperText={t(
                "ai_providers:modal_config.ocr_model_helper",
                "Modelo especializado en extracción óptica de comprobantes y documentos escaneados."
              )}
              disabled={isSubmitting}
            />
          </Box>
        )}

        {/* API KEY INPUTS */}
        {mode === "api_key" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: "text.primary" }}
              >
                {t(
                  "ai_providers:modal_config.api_key_label",
                  "API Key Secreta"
                )}
              </Typography>
              <TextField
                type={showSecret ? "text" : "password"}
                value={apiKeySecret}
                onChange={(e) => setApiKeySecret(e.target.value)}
                placeholder="sk-..."
                helperText={t(
                  "ai_providers:modal_config.api_key_helper",
                  "Se cifrará en reposo con AES-256-GCM. Solo se mostrarán los últimos 4 caracteres."
                )}
                disabled={isSubmitting}
                fullWidth
                size="small"
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

            {!apiKeySecret.trim() && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {t(
                  "ai_providers:modal_config.api_key_missing_notice",
                  "Atención: Si no ingresa una API Key ahora, el proveedor requerirá al menos una llave activa para habilitar las peticiones."
                )}
              </Alert>
            )}

            <TextInput
              label={t(
                "ai_providers:modal_config.key_label",
                "Etiqueta de la llave"
              )}
              value={apiKeyLabel}
              onChange={(e) => setApiKeyLabel(e.target.value)}
              placeholder="Primary Key, Fallback Key #2"
              disabled={isSubmitting}
            />

            <SwitchWrapper>
              <StyledFormControlLabel
                control={
                  <StyledSwitch
                    checked={autoRotate}
                    onChange={(e) => setAutoRotate(e.target.checked)}
                    disabled={isSubmitting}
                  />
                }
                label={t(
                  "ai_providers:modal_config.auto_rotate",
                  "Auto-rotar API Keys en caso de cuota excedida (429)"
                )}
                labelPlacement="start"
              />
            </SwitchWrapper>
          </Box>
        )}

        {/* WEB SESSION NOTICE */}
        {mode === "web_session" && (
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            {t(
              "ai_providers:modal_config.web_session_notice",
              "El modo sesión web headless se gestionará a través del microservicio de Puppeteer configurado. Podrá renovar cookies interactivamente cuando sea necesario."
            )}
          </Alert>
        )}

        {/* ACTIVE SWITCH */}
        <SwitchWrapper>
          <StyledFormControlLabel
            control={
              <StyledSwitch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSubmitting}
              />
            }
            label={t("ai_providers:modal_config.is_active", "Proveedor Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>
      </FormContainer>
    </BaseModal>
  );
};

export default ConfigureProviderModal;
