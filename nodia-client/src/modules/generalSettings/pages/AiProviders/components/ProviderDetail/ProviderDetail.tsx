import type { FC } from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  LinearProgress,
  alpha,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import RadioButtonUncheckedOutlinedIcon from "@mui/icons-material/RadioButtonUncheckedOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import DocumentScannerOutlinedIcon from "@mui/icons-material/DocumentScannerOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import InputSearch from "../../../../../../components/inputs/InputSearch";
import AiEventsTable from "../AiEventsTable";
import TraceModal from "../TraceModal";
import AddApiKeyModal from "./components/AddApiKeyModal";
import SyncModelsModal from "./components/SyncModelsModal";
import {
  useAiProviders,
  useAiProvidersHealth,
  useSupportedAiProviders,
  useEnabledWebAiProviders,
  useUpdateAiProvider,
  useSyncAiProviderModels,
  useAiApiKeys,
  useUpdateAiApiKey,
  useDeleteAiApiKey,
  useAiProviderEvents,
} from "../../infrastructure/useServices";
import type {
  SupportedModelDef,
  AiApiKeyEntity,
  AiProviderEventEntity,
} from "../../infrastructure/types";
import type { ProviderDetailProps } from "./types";
import {
  DetailContainer,
  TopNavigationBox,
  BreadcrumbBox,
  BackLinkButton,
  BreadcrumbDivider,
  StatusPill,
  StatusDot,
  DetailPanel,
  PanelHeader,
  PanelTitle,
  PanelSubtitle,
  ModelsGrid,
  ModelCardPaper,
  ModelCardHeader,
  ModelBadge,
  ModelMetricsGrid,
  MetricColumn,
  MetricTitle,
  MetricVal,
  ModeSectionGrid,
  ModeCardPaper,
  WebSessionBanner,
  CloudBridgeBox,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  TableTopBar,
  StyledTableContainer,
  StyledTableHead,
  HeadCell,
  BodyRow,
  BodyCell,
  EmptyBox,
} from "./styles";

const ProviderDetail: FC<ProviderDetailProps> = ({
  providerKey,
  onBack,
  onRenewSession,
  onConfigure,
}) => {
  const { t } = useTranslation(["ai_providers", "core"]);
  const logsRef = useRef<HTMLDivElement | null>(null);

  // Queries
  const {
    data: providersResponse,
    isLoading: isLoadingProviders,
    isFetching: isFetchingProviders,
    refetch: refetchProviders,
  } = useAiProviders({
    all: true,
  });
  const {
    data: healthResponse,
    isLoading: isLoadingHealth,
    isFetching: isFetchingHealth,
    refetch: refetchHealth,
  } = useAiProvidersHealth();
  const { data: supportedProviders = [] } = useSupportedAiProviders();
  const { data: webProvidersData } = useEnabledWebAiProviders();

  // Selected Provider data
  const currentDbProvider = useMemo(() => {
    return (providersResponse?.data || []).find(
      (p) => p.key.toLowerCase() === providerKey.toLowerCase()
    );
  }, [providersResponse?.data, providerKey]);

  const currentHealthProvider = useMemo(() => {
    return (healthResponse?.providers || []).find(
      (p) => p.key.toLowerCase() === providerKey.toLowerCase()
    );
  }, [healthResponse?.providers, providerKey]);

  const supportedDef = useMemo(() => {
    return supportedProviders.find(
      (sp) => sp.key.toLowerCase() === providerKey.toLowerCase()
    );
  }, [supportedProviders, providerKey]);

  const enabledWebProviders = useMemo(() => {
    return (webProvidersData?.enabled_providers || []).map((p: string) =>
      p.toLowerCase()
    );
  }, [webProvidersData?.enabled_providers]);

  const isWebSupported = Boolean(
    providerKey && enabledWebProviders.includes(providerKey.toLowerCase())
  );

  const providerName =
    currentDbProvider?.name ||
    currentHealthProvider?.name ||
    supportedDef?.name ||
    providerKey.charAt(0).toUpperCase() + providerKey.slice(1);

  const currentMode =
    currentDbProvider?.mode ||
    currentHealthProvider?.mode ||
    (isWebSupported ? "web_session" : "api_key");

  // Models list (dynamic, strictly from DB fields)
  const availableModels: SupportedModelDef[] = useMemo(() => {
    if (
      currentDbProvider?.fields?.available_models &&
      Array.isArray(currentDbProvider.fields.available_models)
    ) {
      return currentDbProvider.fields.available_models;
    }
    return [];
  }, [currentDbProvider]);

  // Active Model
  const [selectedModel, setSelectedModel] = useState<string>("");

  useEffect(() => {
    const activeModel = currentDbProvider?.fields?.selected_model || "";
    setSelectedModel(activeModel);
  }, [currentDbProvider]);

  // Extended Thinking capability detection
  const activeModelDef = useMemo(() => {
    return availableModels.find((m) => m.id === selectedModel);
  }, [availableModels, selectedModel]);

  const supportsReasoning = Boolean(
    activeModelDef?.capabilities?.includes("reasoning") ||
      activeModelDef?.id?.toLowerCase().includes("thinking") ||
      (providerKey.toLowerCase() === "gemini" &&
        !activeModelDef?.id?.toLowerCase().includes("lite"))
  );

  const extendedThinkingEnabled = Boolean(
    currentDbProvider?.fields?.enable_extended_thinking
  );

  // Informative OCR focus model
  const ocrFocusedModelId =
    currentDbProvider?.fields?.ocr_focus_model ||
    currentDbProvider?.fields?.ocr_model ||
    "";

  // Auto-reconnect switch state
  const [autoReconnect, setAutoReconnect] = useState(true);

  useEffect(() => {
    if (typeof currentDbProvider?.fields?.auto_reconnect === "boolean") {
      setAutoReconnect(currentDbProvider.fields.auto_reconnect);
    }
  }, [currentDbProvider]);

  // API Keys Query
  const {
    data: apiKeysResponse,
    isLoading: isLoadingApiKeys,
    isFetching: isFetchingApiKeys,
    refetch: refetchApiKeys,
  } = useAiApiKeys(
    currentDbProvider?.id
      ? {
          all: true,
          q: { provider_id_eq: currentDbProvider.id },
        }
      : undefined
  );
  const apiKeysList = apiKeysResponse?.data || [];

  // API Keys Table State (Search & Pagination)
  const [apiKeySearch, setApiKeySearch] = useState("");
  const [apiKeyPage, setApiKeyPage] = useState(0);
  const [apiKeyLimit, setApiKeyLimit] = useState(10);

  const filteredApiKeys = useMemo(() => {
    if (!apiKeySearch.trim()) return apiKeysList;
    const term = apiKeySearch.toLowerCase().trim();
    return apiKeysList.filter(
      (k) =>
        k.label?.toLowerCase().includes(term) ||
        k.display_hint?.toLowerCase().includes(term)
    );
  }, [apiKeysList, apiKeySearch]);

  const paginatedApiKeys = useMemo(() => {
    const start = apiKeyPage * apiKeyLimit;
    return filteredApiKeys.slice(start, start + apiKeyLimit);
  }, [filteredApiKeys, apiKeyPage, apiKeyLimit]);

  // Events Table Query
  const [eventPage, setEventPage] = useState(0);
  const [eventLimit, setEventLimit] = useState(10);
  const [eventSearch, setEventSearch] = useState("");
  const [selectedTraceEvent, setSelectedTraceEvent] =
    useState<AiProviderEventEntity | null>(null);

  const eventQueryParams = useMemo(() => {
    const q: Record<string, any> = {};
    if (currentDbProvider?.id) {
      q.provider_id_eq = currentDbProvider.id;
    }
    if (eventSearch.trim()) {
      q.message_or_event_type_cont = eventSearch.trim();
    }
    return {
      page: eventPage + 1,
      limit: eventLimit,
      includes: true,
      q,
    };
  }, [currentDbProvider?.id, eventSearch, eventPage, eventLimit]);

  const {
    data: eventsResponse,
    isLoading: isLoadingEvents,
    isFetching: isFetchingEvents,
  } = useAiProviderEvents(eventQueryParams);

  // Mutations
  const updateProviderMutation = useUpdateAiProvider();
  const syncModelsMutation = useSyncAiProviderModels();
  const updateApiKeyMutation = useUpdateAiApiKey();
  const deleteApiKeyMutation = useDeleteAiApiKey();

  const isInitialLoading = !currentDbProvider && (isLoadingProviders || isLoadingHealth);
  const isSoftLoading = (isFetchingHealth || isFetchingProviders) && !isInitialLoading;
  const isBusy =
    isInitialLoading ||
    isFetchingHealth ||
    isFetchingProviders ||
    updateProviderMutation.isPending ||
    syncModelsMutation.isPending;

  // Modals
  const [isAddKeyModalOpen, setIsAddKeyModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<AiApiKeyEntity | null>(null);

  // Actions
  const handleModelSelect = async (modelId: string) => {
    if (!currentDbProvider?.id || updateProviderMutation.isPending) return;
    setSelectedModel(modelId);

    try {
      await updateProviderMutation.mutateAsync({
        id: currentDbProvider.id,
        data: {
          fields: {
            ...currentDbProvider.fields,
            selected_model: modelId,
          },
        },
      });
      sileo.success({
        title: t(
          "ai_providers:detail.params_saved",
          "Modelo activo actualizado correctamente"
        ),
      });
      refetchProviders();
      refetchHealth();
    } catch {
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
      });
    }
  };

  const handleOpenSyncModal = () => {
    setIsSyncModalOpen(true);
  };

  const handleToggleExtendedThinking = async (checked: boolean) => {
    if (!currentDbProvider?.id || updateProviderMutation.isPending) return;
    try {
      await updateProviderMutation.mutateAsync({
        id: currentDbProvider.id,
        data: {
          fields: {
            ...currentDbProvider.fields,
            enable_extended_thinking: checked,
          },
        },
      });
      sileo.success({
        title: t(
          "ai_providers:detail.extended_thinking_saved",
          "Preferencia de razonamiento extendido actualizada"
        ),
      });
      refetchProviders();
    } catch {
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
      });
    }
  };

  const handleToggleOcrFocus = async (modelId: string) => {
    if (!currentDbProvider?.id || updateProviderMutation.isPending) return;
    const newFocus = ocrFocusedModelId === modelId ? null : modelId;
    try {
      await updateProviderMutation.mutateAsync({
        id: currentDbProvider.id,
        data: {
          fields: {
            ...currentDbProvider.fields,
            ocr_focus_model: newFocus,
          },
        },
      });
      sileo.success({
        title: t(
          "ai_providers:detail.ocr_focus_saved",
          "Preferencia de foco OCR actualizada"
        ),
      });
      refetchProviders();
    } catch {
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
      });
    }
  };

  const handleToggleAutoReconnect = async (checked: boolean) => {
    setAutoReconnect(checked);
    if (!currentDbProvider?.id || updateProviderMutation.isPending) return;

    try {
      await updateProviderMutation.mutateAsync({
        id: currentDbProvider.id,
        data: {
          fields: {
            ...currentDbProvider.fields,
            auto_reconnect: checked,
          },
        },
      });
      sileo.success({
        title: t(
          "ai_providers:detail.auto_reconnect_saved",
          "Preferencia de auto-reconexión actualizada"
        ),
      });
      refetchProviders();
    } catch {
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
      });
    }
  };

  const handleSwitchMode = async (newMode: "api_key" | "web_session") => {
    if (
      !currentDbProvider?.id ||
      newMode === currentMode ||
      updateProviderMutation.isPending
    )
      return;
    if (newMode === "web_session" && !isWebSupported) return;

    try {
      await updateProviderMutation.mutateAsync({
        id: currentDbProvider.id,
        data: {
          mode: newMode,
        },
      });
      sileo.success({
        title: t("ai_providers:detail.mode_switched", {
          mode:
            newMode === "web_session"
              ? "Sesión Web (Navegador Remoto)"
              : "API Key (Rotativa)",
        }),
      });
      refetchProviders();
      refetchHealth();
    } catch {
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
      });
    }
  };

  const handleMakeKeyPrimary = async (key: AiApiKeyEntity) => {
    if (updateApiKeyMutation.isPending) return;
    try {
      await updateApiKeyMutation.mutateAsync({
        id: key.id,
        payload: {
          is_selected: true,
        },
      });
      sileo.success({
        title: t(
          "ai_providers:detail.key_selected_success",
          "Clave principal actualizada"
        ),
      });
      refetchApiKeys();
      refetchHealth();
    } catch {
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
      });
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete || deleteApiKeyMutation.isPending) return;
    try {
      await deleteApiKeyMutation.mutateAsync(keyToDelete.id);
      sileo.success({
        title: t(
          "ai_providers:detail.key_deleted_success",
          "Clave de API eliminada correctamente"
        ),
      });
      setKeyToDelete(null);
      refetchApiKeys();
      refetchHealth();
    } catch {
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
      });
    }
  };

  const handleVerify = async () => {
    try {
      await refetchHealth();
      sileo.success({
        title: t(
          "ai_providers:notifications.verify_success",
          "Estado de proveedores de IA actualizado"
        ),
      });
    } catch {
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
      });
    }
  };

  const statusType = currentHealthProvider?.status || "unconfigured";
  const statusLabel =
    statusType === "healthy"
      ? t("ai_providers:detail.status_healthy", "Disponible")
      : statusType === "expired"
      ? t("ai_providers:detail.status_expired", "Requiere Iniciar Sesión")
      : statusType === "degraded"
      ? t("ai_providers:detail.status_degraded", "Degradado")
      : t("ai_providers:detail.status_unconfigured", "Sin Configurar");

  return (
    <DetailContainer>
      {/* TOP NAVIGATION BREADCRUMB */}
      <TopNavigationBox>
        <BreadcrumbBox>
          <BackLinkButton
            startIcon={<ArrowBackOutlinedIcon />}
            onClick={onBack}
          >
            {t("ai_providers:detail.back_to_providers", "Volver a Proveedores")}
          </BackLinkButton>
          <BreadcrumbDivider>|</BreadcrumbDivider>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {t("ai_providers:detail.active_provider", "Proveedor Activo")}:
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <StatusDot
              color={
                statusType === "healthy"
                  ? "#10b981"
                  : statusType === "expired"
                  ? "#f59e0b"
                  : "#64748b"
              }
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {providerName}
            </Typography>
          </Box>
          <StatusPill statusType={statusType}>
            {statusLabel}
          </StatusPill>
        </BreadcrumbBox>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={
              isFetchingHealth ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SyncOutlinedIcon fontSize="small" />
              )
            }
            onClick={handleVerify}
            disabled={isBusy}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
          >
            {t("ai_providers:detail.verify_state", "Verificar estado")}
          </Button>
          {currentHealthProvider && onConfigure && (
            <Button
              variant="contained"
              size="small"
              color="primary"
              startIcon={<SettingsOutlinedIcon fontSize="small" />}
              onClick={() => onConfigure(currentHealthProvider)}
              disabled={isBusy}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
            >
              {t("ai_providers:detail.configure_provider", "Configurar")}
            </Button>
          )}
        </Box>
      </TopNavigationBox>

      {isSoftLoading && (
        <LinearProgress sx={{ height: 2, borderRadius: 1 }} />
      )}

      {/* PANEL 1: PRODUCTION MODELS & AI PIPELINES */}
      <DetailPanel>
        <PanelHeader>
          <Box>
            <PanelTitle>
              {t("ai_providers:detail.models_title", "Modelos")} ({providerName})
            </PanelTitle>
            <PanelSubtitle>
              {t(
                "ai_providers:detail.models_subtitle",
                "Configuración y asignación de arquitecturas de modelos generativos según carga de trabajo, costo operativo y contexto multimodal."
              )}
            </PanelSubtitle>
          </Box>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<SyncOutlinedIcon fontSize="small" />}
            onClick={handleOpenSyncModal}
            disabled={!currentDbProvider?.id}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
          >
            {t("ai_providers:detail.sync_models_button", "Actualizar modelos")}
          </Button>
        </PanelHeader>

        {/* MODELS GRID */}
        <Skeleton loading={isInitialLoading}>
          {availableModels.length === 0 ? (
            <Box
              sx={(theme) => ({
                p: 4,
                textAlign: "center",
                borderRadius: 3,
                border: `1px dashed ${theme.palette.divider}`,
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? alpha("#ffffff", 0.02)
                    : alpha("#000000", 0.01),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
                my: 2,
              })}
            >
              <PsychologyOutlinedIcon
                sx={{ fontSize: 44, color: "text.secondary", opacity: 0.7 }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t("ai_providers:detail.empty_models_title", "Sin modelos asignados")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
                {t(
                  "ai_providers:detail.empty_models_desc",
                  "Este proveedor aún no tiene modelos cargados. Haz clic en 'Actualizar modelos' para consultar y sincronizar los modelos disponibles directamente desde la API del proveedor."
                )}
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<SyncOutlinedIcon fontSize="small" />}
                onClick={handleOpenSyncModal}
                disabled={!currentDbProvider?.id}
                sx={{ mt: 1, borderRadius: 2, textTransform: "none", fontWeight: 600 }}
              >
                {t("ai_providers:detail.sync_models_button", "Actualizar modelos")}
              </Button>
            </Box>
          ) : (
            <ModelsGrid>
              {availableModels.map((model) => {
                const isSelected = selectedModel === model.id;
              const isOcrFocused = ocrFocusedModelId === model.id;
              const badgeAbbr = model.id.toLowerCase().includes("pro")
                ? "PRO"
                : model.id.toLowerCase().includes("flash")
                ? "FL"
                : model.id.toLowerCase().includes("ocr")
                ? "OCR"
                : model.id.toLowerCase().includes("gpt-4o-mini")
                ? "4OM"
                : model.id.toLowerCase().includes("gpt-4o")
                ? "4O"
                : model.id.slice(0, 3).toUpperCase();

              const roleSubtitle =
                model.role === "ocr"
                  ? t(
                      "ai_providers:detail.model_specialized_ocr",
                      "Extracción Óptica Especializada de Documentos"
                    )
                  : model.isRecommended
                  ? t(
                      "ai_providers:detail.model_primary_reasoning",
                      "Modelo Primario de Razonamiento Complejo"
                    )
                  : t(
                      "ai_providers:detail.model_fast_extractor",
                      "Extractor Ligero & Micro-tareas de Alta Velocidad"
                    );

              const contextText = model.contextWindow
                ? `${(model.contextWindow / 1000000).toFixed(1).replace(".0", "")}M Tokens`
                : "128K Tokens";
              const capText = model.capabilities?.includes("vision")
                ? "Texto/Audio/Video"
                : model.role === "ocr"
                ? "OCR / Docs"
                : "Texto / JSON";

              return (
                <ModelCardPaper key={model.id} selected={isSelected}>
                  <ModelCardHeader>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <ModelBadge>{badgeAbbr}</ModelBadge>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 700 }}
                          >
                            {model.name || model.id}
                          </Typography>
                          <StatusDot
                            color={isSelected ? "#10b981" : "#64748b"}
                          />
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{ fontFamily: "monospace", color: "text.secondary", display: "block" }}
                        >
                          {model.id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {roleSubtitle}
                        </Typography>
                      </Box>
                    </Box>

                    <StyledSwitch
                      checked={isSelected}
                      onChange={() => handleModelSelect(model.id)}
                      disabled={isBusy}
                      size="small"
                    />
                  </ModelCardHeader>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.5, fontSize: "0.8125rem" }}
                  >
                    {model.description}
                  </Typography>

                  <ModelMetricsGrid>
                    <MetricColumn>
                      <MetricTitle>
                        {t("ai_providers:detail.context_window", "Ventana Contexto")}
                      </MetricTitle>
                      <MetricVal>{contextText}</MetricVal>
                    </MetricColumn>
                    <MetricColumn>
                      <MetricTitle>
                        {t("ai_providers:detail.capacity_multimodal", "Capacidad")}
                      </MetricTitle>
                      <MetricVal>{capText}</MetricVal>
                    </MetricColumn>
                  </ModelMetricsGrid>

                  {/* INFORMATIVE OCR FOCUS SWITCH */}
                  <Box
                    sx={(theme) => ({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      pt: 1.5,
                      borderTop: `1px dashed ${theme.palette.divider}`,
                    })}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <DocumentScannerOutlinedIcon
                        sx={{
                          fontSize: 18,
                          color: isOcrFocused ? "info.main" : "text.secondary",
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          color: isOcrFocused ? "info.main" : "text.secondary",
                        }}
                      >
                        {t("ai_providers:detail.ocr_focus_tag", "Foco OCR (Informativo)")}
                      </Typography>
                      <Tooltip
                        title={t(
                          "ai_providers:detail.ocr_focus_desc",
                          "Marca este modelo como recomendado para tareas de OCR. Nota: La inferencia se ejecutará con el modelo seleccionado actualmente."
                        )}
                      >
                        <InfoOutlinedIcon
                          sx={{ fontSize: 15, color: "text.disabled", cursor: "pointer" }}
                        />
                      </Tooltip>
                    </Box>

                    <StyledSwitch
                      checked={isOcrFocused}
                      onChange={() => handleToggleOcrFocus(model.id)}
                      disabled={isBusy}
                      size="small"
                    />
                  </Box>
                </ModelCardPaper>
              );
            })}
          </ModelsGrid>
        )}
        </Skeleton>

        {/* EXTENDED THINKING SECTION */}
        <Box sx={{ mt: 1 }}>
          <SwitchWrapper>
            <StyledFormControlLabel
              control={
                <StyledSwitch
                  checked={extendedThinkingEnabled && supportsReasoning}
                  disabled={!supportsReasoning || isBusy}
                  onChange={(e) => handleToggleExtendedThinking(e.target.checked)}
                />
              }
              label={
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <PsychologyOutlinedIcon
                      sx={{
                        fontSize: 20,
                        color: supportsReasoning ? "primary.main" : "text.disabled",
                      }}
                    />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {t(
                        "ai_providers:detail.extended_thinking_title",
                        "Razonamiento Extendido"
                      )}
                    </Typography>
                    {supportsReasoning ? (
                      <Chip
                        size="small"
                        label={t(
                          "ai_providers:detail.extended_thinking_supported",
                          "Razonamiento Soportado"
                        )}
                        color="primary"
                        sx={{ height: 20, fontSize: "0.6875rem", fontWeight: 700 }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        label={t(
                          "ai_providers:detail.extended_thinking_not_supported",
                          "No disponible para este modelo"
                        )}
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.6875rem" }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {supportsReasoning
                      ? t(
                          "ai_providers:detail.extended_thinking_desc",
                          "Habilita pasos de deliberación y razonamiento profundo previo a la respuesta. Aplica solo a modelos con capacidad de razonamiento detectada."
                        )
                      : t(
                          "ai_providers:detail.extended_thinking_not_supported",
                          "Este modelo no cuenta con capacidad de razonamiento extendido."
                        )}
                  </Typography>
                </Box>
              }
              labelPlacement="start"
            />
          </SwitchWrapper>
        </Box>
      </DetailPanel>

      {/* PANEL 2: EXCLUSIVE OPERATION MODE */}
      <DetailPanel>
        <PanelHeader>
          <Box>
            <PanelTitle>
              {t(
                "ai_providers:detail.exclusive_mode_title",
                "MODO DE OPERACIÓN EXCLUSIVO"
              )}
            </PanelTitle>
            <PanelSubtitle>
              {t(
                "ai_providers:detail.exclusive_mode_subtitle",
                "La alternancia es estrictamente manual. Un fallo operacional nunca cambiará el modo por defecto."
              )}
            </PanelSubtitle>
          </Box>
        </PanelHeader>

        <ModeSectionGrid>
          {/* WEB SESSION OPTION */}
          <ModeCardPaper
            selected={currentMode === "web_session"}
            disabled={!isWebSupported}
            onClick={() => handleSwitchMode("web_session")}
            elevation={0}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <DevicesOutlinedIcon
                  color={currentMode === "web_session" ? "primary" : "action"}
                />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t(
                    "ai_providers:detail.mode_web_title",
                    "Sesión Web (Navegador Remoto)"
                  )}
                </Typography>
              </Box>

              {currentMode === "web_session" ? (
                <Chip
                  size="small"
                  color="primary"
                  icon={<CheckCircleOutlinedIcon />}
                  label={t(
                    "ai_providers:detail.mode_currently_selected",
                    "Modo Seleccionado Actualmente"
                  )}
                  sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                />
              ) : (
                <Chip
                  size="small"
                  variant="outlined"
                  label={t("ai_providers:detail.mode_alternative", "Modo Alternativo")}
                  sx={{ fontSize: "0.75rem" }}
                />
              )}
            </Box>

            <Typography variant="body2" color="text.secondary">
              {isWebSupported
                ? t(
                    "ai_providers:detail.mode_web_desc",
                    "Simula navegación headless interactiva para cuentas corporativas con login unificado. Recomendado para agentes de scraping, razonamiento extendido y cuotas no-API."
                  )
                : t(
                    "ai_providers:detail.mode_web_disabled",
                    "No habilitado para este proveedor (requiere microservicio dedicado)."
                  )}
            </Typography>
          </ModeCardPaper>

          {/* API KEY OPTION */}
          <ModeCardPaper
            selected={currentMode === "api_key"}
            onClick={() => handleSwitchMode("api_key")}
            elevation={0}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <VpnKeyOutlinedIcon
                  color={currentMode === "api_key" ? "primary" : "action"}
                />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t(
                    "ai_providers:detail.mode_api_title",
                    "API Key (AI Studio / Endpoint Oficial)"
                  )}
                </Typography>
              </Box>

              {currentMode === "api_key" ? (
                <Chip
                  size="small"
                  color="primary"
                  icon={<CheckCircleOutlinedIcon />}
                  label={t(
                    "ai_providers:detail.mode_currently_selected",
                    "Modo Seleccionado Actualmente"
                  )}
                  sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                />
              ) : (
                <Chip
                  size="small"
                  variant="outlined"
                  label={t("ai_providers:detail.mode_alternative", "Modo Alternativo")}
                  sx={{ fontSize: "0.75rem" }}
                />
              )}
            </Box>

            <Typography variant="body2" color="text.secondary">
              {t(
                "ai_providers:detail.mode_api_desc",
                "Conexión directa mediante tokens de API REST estándar. Adecuado para payloads estructurados y baja latencia de respuesta internacional."
              )}
            </Typography>
          </ModeCardPaper>
        </ModeSectionGrid>
      </DetailPanel>

      {/* PANEL 3: REMOTE WEB SESSION SECTION (Shown when web mode supported) */}
      {isWebSupported && (
        <DetailPanel>
          <WebSessionBanner>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <StatusDot
                color={statusType === "healthy" ? "#10b981" : "#f59e0b"}
              />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t("ai_providers:detail.web_session_status", "Estado de la Sesión Web")}:{" "}
                  {statusType === "healthy"
                    ? t("ai_providers:detail.web_session_healthy", "Activa y Saludable")
                    : t("ai_providers:detail.status_expired", "Requiere Iniciar Sesión")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    "ai_providers:detail.web_session_desc",
                    "Token de autenticación persistente renovado por expiración de cookies de sesión corporativa."
                  )}
                </Typography>
              </Box>
            </Box>

            <Chip
              size="small"
              label={statusType === "healthy" ? "SESIÓN OPERATIVA" : "AUTENTICACIÓN REQUERIDA"}
              color={statusType === "healthy" ? "success" : "warning"}
              sx={{ fontWeight: 700, fontSize: "0.75rem" }}
            />
          </WebSessionBanner>

          {/* CLOUD AUTHENTICATION BRIDGE */}
          <CloudBridgeBox>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxWidth: 650 }}>
              <Typography
                variant="caption"
                sx={{
                  color: "primary.main",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                }}
              >
                {t(
                  "ai_providers:detail.cloud_bridge_badge",
                  "PUENTE DE AUTENTICACIÓN CLOUD"
                )}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {t(
                  "ai_providers:detail.cloud_bridge_title",
                  "Iniciar Sesión Segura en Navegador Remoto"
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {t(
                  "ai_providers:detail.cloud_bridge_desc",
                  "Al hacer clic, se iniciará una pestaña temporal segura de navegador en la nube con streaming remoto para autenticar la cuenta de Google. Las credenciales se procesan en el entorno aislado de Google sin exponer contraseñas a los servidores centrales de Nodia."
                )}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                <ShieldOutlinedIcon sx={{ fontSize: 16, color: "success.main" }} />
                <Typography variant="caption" color="text.secondary">
                  {t(
                    "ai_providers:detail.cloud_bridge_security",
                    "Conexión cifrada TLS 1.3 con soporte de Llaves de Seguridad FIDO2 / 2FA."
                  )}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<LanguageOutlinedIcon />}
                onClick={onRenewSession}
                sx={{
                  py: 1.5,
                  px: 3,
                  fontWeight: 700,
                  borderRadius: 2,
                  textTransform: "none",
                  boxShadow: 3,
                }}
              >
                {t(
                  "ai_providers:detail.launch_remote_browser",
                  "Iniciar Sesión en Navegador Remoto"
                )}
              </Button>
              <Typography variant="caption" color="text.secondary">
                {t(
                  "ai_providers:detail.remote_browser_caption",
                  "Abre popup WebRTC seguro (no-vnc)"
                )}
              </Typography>
            </Box>
          </CloudBridgeBox>

          {/* OPERATIONAL PARAMETERS */}
          <Box sx={{ mt: 1 }}>
            <SwitchWrapper>
              <StyledFormControlLabel
                control={
                  <StyledSwitch
                    checked={autoReconnect}
                    onChange={(e) => handleToggleAutoReconnect(e.target.checked)}
                    disabled={updateProviderMutation.isPending}
                  />
                }
                label={t(
                  "ai_providers:detail.auto_reconnect",
                  "Auto-reconexión y persistencia de cookies en segundo plano (Playwright Daemon)"
                )}
                labelPlacement="start"
              />
            </SwitchWrapper>
          </Box>
        </DetailPanel>
      )}

      {/* PANEL 4: API KEYS MANAGEMENT ("la tabla de siempre") */}
      <DetailPanel>
        <TableTopBar sx={{ flexDirection: "column", alignItems: "stretch", gap: 2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
              width: "100%",
            }}
          >
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <VpnKeyOutlinedIcon color="primary" />
                <PanelTitle>
                  {t("ai_providers:detail.api_keys_title", "Administrador de API Keys")}
                </PanelTitle>
                <Chip
                  size="small"
                  color={currentMode === "api_key" ? "primary" : "default"}
                  label={
                    currentMode === "api_key"
                      ? t("ai_providers:detail.api_keys_badge_primary", "Modo Primario")
                      : t("ai_providers:detail.api_keys_badge_secondary", "Modo Secundario")
                  }
                  sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                />
              </Box>
              <PanelSubtitle sx={{ mt: 0.5 }}>
                {t(
                  "ai_providers:detail.api_keys_subtitle",
                  "Pool de llaves API con failover autónomo y rotación automática en caso de cuota excedida (429)."
                )}
              </PanelSubtitle>
            </Box>

            <Button
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutlineOutlinedIcon />}
              onClick={() => setIsAddKeyModalOpen(true)}
              sx={(theme) => ({
                borderRadius: 2,
                fontWeight: 600,
                textTransform: "none",
                color: theme.palette.primary.contrastText,
              })}
            >
              {t("ai_providers:detail.add_key_button", "Agregar Nueva API Key")}
            </Button>
          </Box>

          <Box sx={{ width: { xs: "100%", sm: 320 } }}>
            <InputSearch
              value={apiKeySearch}
              onChange={(val) => {
                setApiKeySearch(val);
                setApiKeyPage(0);
              }}
              placeholder={t(
                "ai_providers:detail.search_api_keys",
                "Buscar por alias o prefijo..."
              )}
              size="small"
              fullWidth
            />
          </Box>
        </TableTopBar>

        {isFetchingApiKeys && !isLoadingApiKeys && (
          <LinearProgress sx={{ borderRadius: 1, height: 2, my: -1 }} />
        )}

        <Skeleton loading={isLoadingApiKeys}>
          <StyledTableContainer>
            <Table size="small">
              <StyledTableHead>
                <TableRow>
                  <HeadCell>
                    {t("ai_providers:detail.col_alias", "ALIAS / ETIQUETA")}
                  </HeadCell>
                  <HeadCell>
                    {t("ai_providers:detail.col_hint", "PREFIJO DE CLAVE")}
                  </HeadCell>
                  <HeadCell>
                    {t("ai_providers:detail.col_health", "ESTADO")}
                  </HeadCell>
                  <HeadCell>
                    {t("ai_providers:detail.col_primary", "ROTACIÓN / PRINCIPAL")}
                  </HeadCell>
                  <HeadCell align="right">
                    {t("ai_providers:detail.col_actions", "ACCIÓN")}
                  </HeadCell>
                </TableRow>
              </StyledTableHead>
              <TableBody>
                {filteredApiKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                      <EmptyBox>
                        <VpnKeyOutlinedIcon sx={{ fontSize: 40, color: "text.disabled" }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {apiKeysList.length === 0
                            ? t(
                                "ai_providers:detail.empty_api_keys",
                                "No hay claves de API registradas para este proveedor."
                              )
                            : t(
                                "ai_providers:detail.no_matching_api_keys",
                                "No se encontraron claves que coincidan con la búsqueda."
                              )}
                        </Typography>
                        {apiKeysList.length === 0 && (
                          <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            startIcon={<AddCircleOutlineOutlinedIcon />}
                            onClick={() => setIsAddKeyModalOpen(true)}
                            sx={(theme) => ({
                              mt: 0.5,
                              borderRadius: 2,
                              color: theme.palette.primary.contrastText,
                            })}
                          >
                            {t("ai_providers:detail.add_key_button", "Agregar Nueva API Key")}
                          </Button>
                        )}
                      </EmptyBox>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedApiKeys.map((apiKey) => {
                    const isValid =
                      apiKey.health_state === "valid" ||
                      apiKey.health_state === "untested";
                    const isCooldown = apiKey.health_state === "cooldown";

                    return (
                      <BodyRow key={apiKey.id}>
                        <BodyCell sx={{ fontWeight: 600 }}>{apiKey.label}</BodyCell>
                        <BodyCell sx={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>
                          {apiKey.display_hint || "sk-...****"}
                        </BodyCell>
                        <BodyCell>
                          <Chip
                            size="small"
                            label={
                              isValid
                                ? t("ai_providers:detail.key_valid", "Válida")
                                : isCooldown
                                ? t("ai_providers:detail.key_cooldown", "Cooldown (429)")
                                : t("ai_providers:detail.key_needs_review", "Revisar")
                            }
                            color={isValid ? "success" : isCooldown ? "warning" : "error"}
                            sx={{ fontWeight: 700, fontSize: "0.75rem", height: 22 }}
                          />
                        </BodyCell>
                        <BodyCell>
                          <Tooltip
                            title={
                              apiKey.is_selected
                                ? t("ai_providers:detail.key_valid", "Clave Principal")
                                : t("ai_providers:detail.make_primary", "Establecer como principal")
                            }
                          >
                            <IconButton
                              size="small"
                              color={apiKey.is_selected ? "primary" : "default"}
                              onClick={() => handleMakeKeyPrimary(apiKey)}
                              disabled={updateApiKeyMutation.isPending}
                            >
                              {apiKey.is_selected ? (
                                <CheckCircleOutlinedIcon fontSize="small" />
                              ) : (
                                <RadioButtonUncheckedOutlinedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </BodyCell>
                        <BodyCell align="right">
                          <Tooltip title={t("ai_providers:detail.delete_key", "Eliminar Clave")}>
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={t("ai_providers:detail.delete_key", "Eliminar Clave")}
                              data-testid="delete-api-key-btn"
                              onClick={() => setKeyToDelete(apiKey)}
                              disabled={deleteApiKeyMutation.isPending}
                            >
                              <DeleteOutlineOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </BodyCell>
                      </BodyRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </Skeleton>

        {filteredApiKeys.length > 0 && (
          <TablePagination
            component="div"
            count={filteredApiKeys.length}
            page={apiKeyPage}
            onPageChange={(_, newPage) => setApiKeyPage(newPage)}
            rowsPerPage={apiKeyLimit}
            onRowsPerPageChange={(e) => {
              setApiKeyLimit(parseInt(e.target.value, 10));
              setApiKeyPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25]}
            labelRowsPerPage={t("core:pagination.rows_per_page", "Filas por página:")}
          />
        )}
      </DetailPanel>

      {/* PANEL 5: AUDIT LOGS FOR THIS PROVIDER */}
      <Box ref={logsRef}>
        <AiEventsTable
          events={eventsResponse?.data || []}
          isLoading={isLoadingEvents}
          isFetching={isFetchingEvents}
          totalItems={eventsResponse?.meta?.total_items || 0}
          page={eventPage}
          limit={eventLimit}
          searchValue={eventSearch}
          onSearchChange={(val) => {
            setEventSearch(val);
            setEventPage(0);
          }}
          onPageChange={setEventPage}
          onRowsPerPageChange={(newLimit) => {
            setEventLimit(newLimit);
            setEventPage(0);
          }}
          onViewTrace={(event) => setSelectedTraceEvent(event)}
        />
      </Box>

      {/* MODAL: ADD API KEY */}
      {currentDbProvider && (
        <AddApiKeyModal
          open={isAddKeyModalOpen}
          providerId={currentDbProvider.id}
          providerName={providerName}
          onClose={() => setIsAddKeyModalOpen(false)}
          onSuccess={() => {
            refetchApiKeys();
            refetchHealth();
          }}
        />
      )}

      {/* MODAL: SYNC MODELS */}
      {currentDbProvider && (
        <SyncModelsModal
          open={isSyncModalOpen}
          provider={currentDbProvider}
          onClose={() => setIsSyncModalOpen(false)}
          onSuccess={() => {
            refetchProviders();
            refetchHealth();
          }}
        />
      )}

      {/* DIALOG: CONFIRM DELETE API KEY */}
      <ConfirmDialog
        open={Boolean(keyToDelete)}
        title={t("ai_providers:detail.delete_key_title", "Eliminar Clave de API")}
        message={t(
          "ai_providers:detail.delete_key_confirm",
          "¿Está seguro de eliminar esta clave de API?"
        )}
        onClose={() => setKeyToDelete(null)}
        onConfirm={handleDeleteKey}
      />

      {/* MODAL: TRACE VIEWER */}
      <TraceModal
        open={Boolean(selectedTraceEvent)}
        event={selectedTraceEvent}
        onClose={() => setSelectedTraceEvent(null)}
      />
    </DetailContainer>
  );
};

export default ProviderDetail;
