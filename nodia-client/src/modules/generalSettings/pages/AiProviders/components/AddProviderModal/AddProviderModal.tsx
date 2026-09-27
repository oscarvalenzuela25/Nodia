import type { FC, FormEvent } from "react";
import { useState, useMemo } from "react";
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
import TranslationInput from "../../../../../../components/inputs/TranslationInput";
import TextInput from "../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import { sileo } from "sileo";
import {
  useCreateAiProvider,
  useCreateAiApiKey,
  useSupportedAiProviders,
  useEnabledWebAiProviders,
} from "../../infrastructure/useServices";
import type { AddProviderModalProps } from "./types";
import {
  FormContainer,
  ModeOptionsGrid,
  ModeOptionCard,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  ModalActionsContainer,
} from "./styles";

const AddProviderModal: FC<AddProviderModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation(["ai_providers", "core"]);

  const [key, setKey] = useState("");
  const [nameTranslations, setNameTranslations] = useState<Record<string, string>>({
    es: "",
    en: "",
  });
  const [isActive, setIsActive] = useState(true);
  const [mode, setMode] = useState<"api_key" | "web_session">("api_key");
  const [selectedModel, setSelectedModel] = useState("");
  const [ocrModel, setOcrModel] = useState("");
  const [apiKeySecret, setApiKeySecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [apiKeyLabel, setApiKeyLabel] = useState("Primary Key");
  const [autoRotate, setAutoRotate] = useState(true);

  const { data: supportedProviders = [] } = useSupportedAiProviders();
  const { data: webProvidersData } = useEnabledWebAiProviders();
  const createProviderMutation = useCreateAiProvider();
  const createApiKeyMutation = useCreateAiApiKey();

  const enabledWebProviders = useMemo(() => {
    return (webProvidersData?.enabled_providers || []).map((p: string) =>
      p.toLowerCase()
    );
  }, [webProvidersData?.enabled_providers]);

  const selectedSupportedProvider = useMemo(() => {
    if (!key) return null;
    return (
      supportedProviders.find(
        (p) => p.key.toLowerCase() === key.toLowerCase()
      ) || null
    );
  }, [supportedProviders, key]);

  const isWebSupported = Boolean(
    key &&
      enabledWebProviders.includes(key.toLowerCase()) &&
      selectedSupportedProvider?.supportedModes?.includes("web_session")
  );

  const providerOptions = useMemo(() => {
    return supportedProviders.map((p) => ({
      value: p.key,
      label: p.name,
      description: p.description,
    }));
  }, [supportedProviders]);

  const modelOptions = useMemo(() => {
    const list = selectedSupportedProvider?.availableModels || [];
    return list.map((m) => ({
      value: m.id,
      label: `${m.name}${m.isRecommended ? ` (${t("core:recommended", "Recomendado")})` : ""}`,
      description: m.description,
    }));
  }, [selectedSupportedProvider, t]);

  const ocrModelOptions = useMemo(() => {
    const list = selectedSupportedProvider?.availableModels || [];
    const ocrCandidates = list.filter(
      (m) =>
        m.role === "ocr" ||
        m.capabilities?.includes("ocr") ||
        m.capabilities?.includes("vision")
    );
    const optionsSource = ocrCandidates.length > 0 ? ocrCandidates : list;
    return optionsSource.map((m) => ({
      value: m.id,
      label: `${m.name}${m.role === "ocr" ? ` (${t("ai_providers:modal_create.ocr_badge", "Especializado OCR")})` : ""}`,
      description: m.description,
    }));
  }, [selectedSupportedProvider, t]);

  const hasOcrSupport = Boolean(
    selectedSupportedProvider?.defaultOcrModel ||
      selectedSupportedProvider?.availableModels?.some((m) => m.role === "ocr")
  );

  const handleSelectProvider = (val: string | number | null) => {
    const selectedKey = String(val || "").toLowerCase();
    setKey(selectedKey);
    const found = supportedProviders.find(
      (p) => p.key.toLowerCase() === selectedKey
    );
    if (found) {
      setNameTranslations({
        es: found.name,
        en: found.name,
      });
      const webAllowed =
        enabledWebProviders.includes(selectedKey) &&
        found.supportedModes?.includes("web_session");
      if (found.defaultMode === "web_session" && webAllowed) {
        setMode("web_session");
      } else {
        setMode("api_key");
      }
      setSelectedModel(
        found.defaultSelectedModel || (found.availableModels?.[0]?.id ?? "")
      );
      setOcrModel(found.defaultOcrModel || "");
      setApiKeySecret("");
      setApiKeyLabel("Primary Key");
      setAutoRotate(true);
    }
  };

  const handleReset = () => {
    setKey("");
    setNameTranslations({ es: "", en: "" });
    setIsActive(true);
    setMode("api_key");
    setSelectedModel("");
    setOcrModel("");
    setApiKeySecret("");
    setShowSecret(false);
    setApiKeyLabel("Primary Key");
    setAutoRotate(true);
  };

  const isSubmitting =
    createProviderMutation.isPending || createApiKeyMutation.isPending;

  const handleClose = () => {
    if (isSubmitting) return;
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanKey = key.trim().toLowerCase();
    if (!cleanKey || isSubmitting) return;

    const translates = [
      {
        key: "key",
        es: nameTranslations.es?.trim() || cleanKey,
        en: nameTranslations.en?.trim() || cleanKey,
      },
    ];

    const fields: Record<string, any> = {};
    if (selectedModel) {
      fields.selected_model = selectedModel;
    }
    if (ocrModel) {
      fields.ocr_model = ocrModel;
    }
    if (selectedSupportedProvider?.availableModels) {
      fields.available_models = selectedSupportedProvider.availableModels;
    }
    if (mode === "web_session") {
      fields.profile = "puppeteer_headless_v2";
    }

    try {
      const created = await createProviderMutation.mutateAsync({
        key: cleanKey,
        mode,
        fields: Object.keys(fields).length > 0 ? fields : undefined,
        auto_rotate_api_keys: autoRotate,
        is_active: isActive,
        translates,
      });

      if (mode === "api_key" && apiKeySecret.trim()) {
        await createApiKeyMutation.mutateAsync({
          provider_id: created.id,
          label: apiKeyLabel.trim() || "Primary Key",
          secret: apiKeySecret.trim(),
          is_selected: true,
          is_active: true,
        });
      }

      sileo.success({
        title: t(
          "ai_providers:notifications.provider_created",
          "Proveedor añadido correctamente"
        ),
      });

      handleReset();
      onSuccess?.();
      onClose();
    } catch (error: any) {
      const serverMessage = error?.response?.data?.message;
      sileo.error({
        title: t(
          "ai_providers:notifications.provider_create_error",
          "No se pudo añadir el proveedor"
        ),
        description: Array.isArray(serverMessage)
          ? serverMessage.join(", ")
          : serverMessage,
      });
    }
  };

  const isFormValid = key.trim().length > 0;

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
        {t("ai_providers:modal_create.cancel", "Cancelar")}
      </Button>
      <Button
        type="submit"
        form="add-provider-form"
        variant="contained"
        color="primary"
        disabled={!isFormValid || isSubmitting}
        sx={(theme) => ({
          color: theme.palette.primary.contrastText,
          borderRadius: 2,
          px: 2.5,
        })}
      >
        {isSubmitting
          ? t("ai_providers:modal_create.submitting", "Creando Proveedor...")
          : t("ai_providers:modal_create.submit", "Crear Proveedor")}
      </Button>
    </ModalActionsContainer>
  );

  return (
    <BaseModal
      open={open}
      onClose={handleClose}
      title={t("ai_providers:modal_create.title", "Añadir Proveedor de IA")}
      size="md"
      actions={modalActions}
    >
      <FormContainer id="add-provider-form" onSubmit={handleSubmit}>
        {providerOptions.length > 0 && (
          <SelectSingleInput
            label={t(
              "ai_providers:modal_create.select_provider_label",
              "Proveedor del Catálogo"
            )}
            placeholder={t(
              "ai_providers:modal_create.select_provider_placeholder",
              "Seleccionar proveedor soportado..."
            )}
            helperText={t(
              "ai_providers:modal_create.select_provider_helper",
              "Selecciona un proveedor soportado para precargar sus opciones y modelos predeterminados."
            )}
            options={providerOptions}
            value={key || null}
            onChange={handleSelectProvider}
            disabled={isSubmitting}
            clearable
          />
        )}

        <TranslationInput
          label={t("ai_providers:modal_create.key", "Identificador")}
          value={key}
          onChangeKey={(val) => setKey(val.toLowerCase())}
          placeholder={t(
            "ai_providers:modal_create.key_placeholder",
            "ej: gemini, mistral, openai, anthropic"
          )}
          keyHelperText={t(
            "ai_providers:modal_create.key_helper",
            "Clave técnica en minúsculas para identificar el proveedor en el sistema."
          )}
          translations={nameTranslations}
          onChangeTranslations={setNameTranslations}
          sectionTitle={t(
            "ai_providers:modal_create.translations_title",
            "Traducciones del Identificador"
          )}
          sectionSubtitle={t(
            "ai_providers:modal_create.translations_subtitle",
            "Define cómo se mostrará el nombre del proveedor en cada idioma."
          )}
          required
          autoFocus={!key}
          disabled={isSubmitting}
        />

        {/* MODE SELECTION */}
        <Box>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}
          >
            {t("ai_providers:modal_create.mode_label", "Método de Conexión")}
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
                    "ai_providers:modal_create.mode_api_title",
                    "API Key (Rotativa)"
                  )}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t(
                  "ai_providers:modal_create.mode_api_desc",
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
                    "ai_providers:modal_create.mode_web_title",
                    "Sesión Web Headless"
                  )}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {isWebSupported
                  ? t(
                      "ai_providers:modal_create.mode_web_desc",
                      "Autenticación en la nube sin costos por token para planes suscritos."
                    )
                  : t(
                      "ai_providers:modal_create.mode_web_disabled",
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
                "ai_providers:modal_create.model_label",
                "Modelo de IA Seleccionado"
              )}
              value={selectedModel || null}
              onChange={(val) => setSelectedModel(String(val || ""))}
              options={modelOptions}
              placeholder={t(
                "ai_providers:modal_create.model_placeholder",
                "Seleccionar modelo para inferencia..."
              )}
              helperText={t(
                "ai_providers:modal_create.model_helper",
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
                "ai_providers:modal_create.ocr_model_label",
                "Modelo de OCR Asignado"
              )}
              value={ocrModel || null}
              onChange={(val) => setOcrModel(String(val || ""))}
              options={ocrModelOptions}
              placeholder={t(
                "ai_providers:modal_create.ocr_model_placeholder",
                "Seleccionar modelo para OCR de documentos..."
              )}
              helperText={t(
                "ai_providers:modal_create.ocr_model_helper",
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
                  "ai_providers:modal_create.api_key_label",
                  "API Key Secreta (Opcional)"
                )}
              </Typography>
              <TextField
                type={showSecret ? "text" : "password"}
                value={apiKeySecret}
                onChange={(e) => setApiKeySecret(e.target.value)}
                placeholder={t(
                  "ai_providers:modal_create.api_key_placeholder",
                  "sk-..."
                )}
                helperText={t(
                  "ai_providers:modal_create.api_key_helper",
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
                  "ai_providers:modal_create.api_key_missing_notice",
                  "Atención: Si no ingresa una API Key ahora, el proveedor requerirá al menos una llave activa para habilitar las peticiones."
                )}
              </Alert>
            )}

            <TextInput
              label={t(
                "ai_providers:modal_create.key_label",
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
                  "ai_providers:modal_create.auto_rotate",
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
              "ai_providers:modal_create.web_session_notice",
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
                name="isActive"
                disabled={isSubmitting}
              />
            }
            label={t("ai_providers:modal_create.active", "Activo")}
            labelPlacement="start"
          />
        </SwitchWrapper>
      </FormContainer>
    </BaseModal>
  );
};

export default AddProviderModal;
