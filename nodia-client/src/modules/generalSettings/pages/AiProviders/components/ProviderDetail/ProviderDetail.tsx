import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import ApiKeyManager from "../ApiKeyManager";
import { getHttpErrorMessage, notifyHttpError } from "../../../../../../config/httpFeedback";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import type { FC } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Typography,
  Button,
  Tooltip,
  CircularProgress,
  Chip,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import DocumentScannerOutlinedIcon from "@mui/icons-material/DocumentScannerOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";
import AlertBanner from "../AlertBanner";
import SyncModelsModal from "./components/SyncModelsModal";
import AgenticLoginModal from "../AgenticLoginModal";
import {
  useAiProviders,
  useAiProvidersHealth,
  useSupportedAiProviders,
  useUpdateAiProvider,
  useSyncAiProviderModels,
  useGeminiEngines,
  useSelectableModels,
} from "../../infrastructure/useServices";
import type {
  SupportedModelDef,
} from "../../infrastructure/types";
import { getObservedWebQuota, getWebQuotaLabelKey } from "../../infrastructure/observations";
import type { ProviderDetailProps } from "./types";
import {
  DetailContainer,
  TopHeaderPanel,
  TopNavigationRow,
  BreadcrumbBox,
  BackLinkButton,
  BreadcrumbDivider,
  StatusPill,
  StatusDot,
  StyledTabs,
  StyledTab,
  EmptyModesBox,
  AgenticStatusCard,
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
  WebSessionBanner,
  CloudBridgeBox,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
  QuotaGrid,
  QuotaCard,
  QuotaHeader,
} from "./styles";

const ProviderDetail: FC<ProviderDetailProps> = ({
  providerId,
  onBack,
  onRenewSession,
  onConfigure,
}) => {
  const { t, i18n } = useTranslation(["ai_providers", "core"]);
  const [agenticLoginOpen, setAgenticLoginOpen] = useState(false);

  // Queries
  const {
    data: providersResponse,
    isLoading: isLoadingProviders,
    isError: providersError,
    isFetching: isFetchingProviders,
    refetch: refetchProviders,
  } = useAiProviders({
    all: true,
  });
  const {
    data: healthResponse,
    isLoading: isLoadingHealth,
    isError: healthError,
    isFetching: isFetchingHealth,
    refetch: refetchHealth,
  } = useAiProvidersHealth();
  const { data: supportedProviders = [] } = useSupportedAiProviders();
  const currentDbProvider = useMemo(() =>
    (providersResponse?.data ?? []).find((p) => p.id === providerId), [providersResponse?.data, providerId]);
  const currentHealthProvider = useMemo(() =>
    (healthResponse?.providers ?? []).find((p) => p.id === providerId), [healthResponse?.providers, providerId]);
  const providerKey = currentDbProvider?.catalog?.key ?? currentDbProvider?.key ?? currentHealthProvider?.key ?? "";
  const { data: geminiEnginesData, isError: enginesError, isFetching: isFetchingEngines } = useGeminiEngines({
    enabled: providerKey.toLowerCase() === "gemini",
  });

  const useTokenPlanWeb = Boolean(
    currentDbProvider?.use_token_plan_web !== undefined
      ? currentDbProvider.use_token_plan_web
      : currentHealthProvider?.use_token_plan_web !== undefined
      ? currentHealthProvider.use_token_plan_web
      : currentDbProvider?.mode === "web_session"
  );
  const useTokenPlanAgentic = Boolean(
    currentDbProvider?.use_token_plan_agentic !== undefined
      ? currentDbProvider.use_token_plan_agentic
      : currentHealthProvider?.use_token_plan_agentic !== undefined
      ? currentHealthProvider.use_token_plan_agentic
      : currentDbProvider?.default_mode === "token_plan_agentic"
  );

  const currentProviderAlerts = useMemo(() => {
    const alerts = (healthResponse?.alerts || []).filter(
      (a) => a.provider.toLowerCase() === providerKey.toLowerCase()
    );

    if (providerKey.toLowerCase() === "gemini" && useTokenPlanWeb) {
      if (geminiEnginesData?.web?.available === false || geminiEnginesData?.web?.authenticated === false) {
        const hasWebAlert = alerts.some(
          (a) => a.id.includes("web-expired") || a.actionType === "renew_session"
        );
        if (!hasWebAlert && (currentDbProvider || currentHealthProvider)) {
          const providerName =
            currentDbProvider?.name || currentHealthProvider?.name || "Google Gemini";
          const providerId = currentDbProvider?.id || currentHealthProvider?.id || "gemini";
          alerts.unshift({
            id: `alert-${providerId}-web-expired`,
            provider: "gemini",
            type: "incident",
            severity: "error",
            title: t("ai_providers:alerts.web_expired_title", { provider: providerName }),
            message:
              t("ai_providers:alerts.web_expired_message"),
            timeAgo: t("ai_providers:alerts.recent"),
            actionType: "renew_session",
            actionLabel: t("ai_providers:alerts.renew_session_now", "Renovar Sesión Ahora"),
          });
        }
      }
    }

    return alerts;
  }, [
    healthResponse?.alerts,
    providerKey,
    useTokenPlanWeb,
    geminiEnginesData,
    currentDbProvider,
    currentHealthProvider,
    t,
  ]);

  const useApiKey = currentDbProvider?.use_api_key === true;
  type ModeTabKey = "api_key" | "token_plan_web" | "token_plan_agentic";

  interface ModeTabItem {
    key: ModeTabKey;
    label: string;
    icon: React.ReactElement;
  }

  const availableTabs = useMemo(() => {
    const tabs: ModeTabItem[] = [];
    if (useApiKey) tabs.push({ key: "api_key", label: t("ai_providers:connection.api"), icon: <VpnKeyOutlinedIcon fontSize="small" /> });
    if (useTokenPlanWeb) {
      tabs.push({
        key: "token_plan_web",
        label: t("ai_providers:detail.tab_token_plan_web", "Token Plan (Web)"),
        icon: <LanguageOutlinedIcon fontSize="small" />,
      });
    }
    if (useTokenPlanAgentic) {
      tabs.push({
        key: "token_plan_agentic",
        label: t(
          "ai_providers:detail.tab_token_plan_agentic",
          "Token Plan (Agentic)"
        ),
        icon: <PsychologyOutlinedIcon fontSize="small" />,
      });
    }
    return tabs;
  }, [useApiKey, useTokenPlanWeb, useTokenPlanAgentic, t]);

  const [selectedTab, setSelectedTab] = useState<ModeTabKey | null>(null);

  const activeTab = useMemo<ModeTabKey | "">(() => {
    if (selectedTab && availableTabs.some((tab) => tab.key === selectedTab)) {
      return selectedTab;
    }
    const defaultMode = currentDbProvider?.default_mode as ModeTabKey | undefined;
    if (defaultMode && availableTabs.some((tab) => tab.key === defaultMode)) {
      return defaultMode;
    }
    return availableTabs[0]?.key || "";
  }, [selectedTab, availableTabs, currentDbProvider?.default_mode]);

  const supportedDef = useMemo(() => {
    return supportedProviders.find(
      (sp) => sp.key.toLowerCase() === providerKey.toLowerCase()
    );
  }, [supportedProviders, providerKey]);

  const providerName =
    currentDbProvider?.name ||
    currentHealthProvider?.name ||
    supportedDef?.name ||
    providerKey.charAt(0).toUpperCase() + providerKey.slice(1);

  // Mode-scoped fields (each mode has its own models and configuration)
  const providerFields = currentDbProvider?.fields;
  const modeFields = useMemo(() => {
    if (!activeTab || !providerFields) return {};
    const scoped = Boolean(providerFields.token_plan_web || providerFields.token_plan_agentic || providerFields.api_key);
    return (providerFields[activeTab] as Record<string, unknown>) || (scoped ? {} : providerFields);
  }, [providerFields, activeTab]);

  const { data: modelObservations, isError: modelsError, isLoading: modelsLoading, isFetching: modelsFetching, refetch: refetchModels } = useSelectableModels(
    { provider_id: currentDbProvider?.id, mode: activeTab || undefined },
    { enabled: Boolean(currentDbProvider?.id && activeTab) },
  );
  const webQuotas = getObservedWebQuota(geminiEnginesData?.web);
  const availableModels: SupportedModelDef[] = useMemo(() => {
    const hasScoped = Boolean(providerFields?.token_plan_agentic || providerFields?.token_plan_web || providerFields?.api_key);
    const saved = Array.isArray(modeFields.available_models) ? modeFields.available_models
      : !hasScoped && Array.isArray(providerFields?.available_models) ? providerFields.available_models : [];
    const observation = modelObservations?.find((entry) => entry.providerId === currentDbProvider?.id
      && entry.mode === activeTab && entry.models_source === "provider");
    return (saved as SupportedModelDef[]).map((model) => {
      const live = observation?.models.find((entry) => entry.id === model.id);
      return { id: model.id, name: model.name, displayName: model.displayName,
        description: live?.description ?? "", contextWindow: live?.contextWindow ?? undefined,
        capabilities: live?.capabilities ?? [], isRecommended: live?.isRecommended === true };
    });
  }, [modeFields, providerFields, modelObservations, currentDbProvider?.id, activeTab]);

  // Active Model strictly scoped to active mode
  const activeDbModel = useMemo(() => {
    if (typeof modeFields?.selected_model === "string" && modeFields.selected_model) {
      return modeFields.selected_model;
    }
    const hasAnyModeScoped =
      Boolean(providerFields?.token_plan_agentic) ||
      Boolean(providerFields?.token_plan_web) ||
      Boolean(providerFields?.api_key);
    if (!hasAnyModeScoped && typeof providerFields?.selected_model === "string") {
      return providerFields.selected_model;
    }
    return "";
  }, [modeFields, providerFields]);

  const [tabModelOverride, setTabModelOverride] = useState<{
    tab: string;
    model: string | null;
  }>({
    tab: activeTab,
    model: null,
  });

  const localSelectedModel =
    tabModelOverride.tab === activeTab ? tabModelOverride.model : null;
  const setLocalSelectedModel = (model: string | null) => {
    setTabModelOverride({ tab: activeTab, model });
  };
  const selectedModel = localSelectedModel ?? activeDbModel;

  // SDK transport option; this does not certify a model's reasoning capability.
  const supportsReasoning = geminiEnginesData?.web?.supported_options?.extended_thinking === true;

  const extendedThinkingEnabled = modeFields.enable_extended_thinking === true;

  // Informative OCR focus model scoped to active mode
  const ocrFocusedModelId =
    (modeFields?.ocr_focus_model as string) ||
    (modeFields?.ocr_model as string) ||
    "";

  // Mutations
  const updateProviderMutation = useUpdateAiProvider();
  const syncModelsMutation = useSyncAiProviderModels();

  const isInitialLoading = !currentDbProvider && (isLoadingProviders || isLoadingHealth);
  const isSoftLoading = (isFetchingHealth || isFetchingProviders) && !isInitialLoading;
  const isBusy =
    isInitialLoading ||
    isFetchingHealth ||
    isFetchingProviders ||
    isFetchingEngines ||
    modelsLoading ||
    modelsFetching ||
    updateProviderMutation.isPending ||
    syncModelsMutation.isPending;

  // Modals
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Actions
  const handleModelSelect = async (modelId: string) => {
    if (!currentDbProvider?.id || updateProviderMutation.isPending) return;
    setLocalSelectedModel(modelId);

    const modeKey = activeTab || currentDbProvider.default_mode || null;
    if (modeKey !== "token_plan_web" && modeKey !== "token_plan_agentic" && modeKey !== "api_key") return;
    const currentModeData = (currentDbProvider.fields?.[modeKey] as Record<string, unknown>) || {};
    const isDefaultMode = (currentDbProvider.default_mode || null) === modeKey;

    try {
      await updateProviderMutation.mutateAsync({
        id: currentDbProvider.id,
        data: {
          fields: {
            ...currentDbProvider.fields,
            [modeKey]: {
              ...currentModeData,
              selected_model: modelId,
            },
            ...(isDefaultMode ? { selected_model: modelId } : {}),
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
    } catch (error) {
      setLocalSelectedModel(null);
      sileo.error({
        title: t("core:server_error_toast"),
        description: getHttpErrorMessage(error),
      });
    }
  };

  const handleOpenSyncModal = () => {
    if (!canSyncModels) return;
    setIsSyncModalOpen(true);
  };

  const handleToggleExtendedThinking = async (checked: boolean) => {
    if (!currentDbProvider?.id || updateProviderMutation.isPending) return;
    const modeKey = activeTab || currentDbProvider.default_mode || null;
    if (modeKey !== "token_plan_web" && modeKey !== "token_plan_agentic" && modeKey !== "api_key") return;
    const currentModeData = (currentDbProvider.fields?.[modeKey] as Record<string, unknown>) || {};
    const isDefaultMode = (currentDbProvider.default_mode || null) === modeKey;

    try {
      await updateProviderMutation.mutateAsync({
        id: currentDbProvider.id,
        data: {
          fields: {
            ...currentDbProvider.fields,
            [modeKey]: {
              ...currentModeData,
              enable_extended_thinking: checked,
            },
            ...(isDefaultMode ? { enable_extended_thinking: checked } : {}),
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
    } catch (error) {
      sileo.error({
        title: t("core:server_error_toast"),
        description: getHttpErrorMessage(error),
      });
    }
  };

  const handleToggleOcrFocus = async (modelId: string) => {
    if (!currentDbProvider?.id || updateProviderMutation.isPending) return;
    const newFocus = ocrFocusedModelId === modelId ? null : modelId;
    const modeKey = activeTab || currentDbProvider.default_mode || null;
    if (modeKey !== "token_plan_web" && modeKey !== "token_plan_agentic" && modeKey !== "api_key") return;
    const currentModeData = (currentDbProvider.fields?.[modeKey] as Record<string, unknown>) || {};
    const isDefaultMode = (currentDbProvider.default_mode || null) === modeKey;

    try {
      await updateProviderMutation.mutateAsync({
        id: currentDbProvider.id,
        data: {
          fields: {
            ...currentDbProvider.fields,
            [modeKey]: {
              ...currentModeData,
              ocr_focus_model: newFocus,
              ocr_model: newFocus,
            },
            ...(isDefaultMode ? { ocr_focus_model: newFocus, ocr_model: newFocus } : {}),
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
    } catch (error) {
      sileo.error({
        title: t("core:server_error_toast"),
        description: getHttpErrorMessage(error),
      });
    }
  };

  const handleSetModelThinkingLevel = async (
    modelId: string,
    level: "low" | "medium" | "high"
  ) => {
    if (!currentDbProvider?.id || updateProviderMutation.isPending || !level) return;
    const modeKey = activeTab || currentDbProvider.default_mode || null;
    if (modeKey !== "token_plan_web" && modeKey !== "token_plan_agentic" && modeKey !== "api_key") return;
    const currentModeData = (currentDbProvider.fields?.[modeKey] as Record<string, unknown>) || {};
    const currentLevels = (currentModeData.thinking_levels as Record<string, string>) || {};
    const isDefaultMode = (currentDbProvider.default_mode || null) === modeKey;

    try {
      await updateProviderMutation.mutateAsync({
        id: currentDbProvider.id,
        data: {
          fields: {
            ...currentDbProvider.fields,
            [modeKey]: {
              ...currentModeData,
              ...(modelId ? { thinking_levels: {
                ...currentLevels,
                [modelId]: level,
              } } : {}),
              ...(!modelId || modelId === selectedModel ? { thinking_level: level } : {}),
            },
            ...(isDefaultMode && modelId === selectedModel ? { thinking_level: level } : {}),
          },
        },
      });
      sileo.success({
        title: t(
          "ai_providers:detail.thinking_level_saved",
          "Nivel de razonamiento actualizado correctamente"
        ),
      });
      refetchProviders();
    } catch (error) {
      sileo.error({
        title: t("core:server_error_toast"),
        description: getHttpErrorMessage(error),
      });
    }
  };

  const handleToggleModeDefault = async (mode: ModeTabKey) => {
    if (currentDbProvider?.id) {
      try {
        await updateProviderMutation.mutateAsync({
          id: currentDbProvider.id,
          data: { default_mode: mode },
        });
        sileo.success({
          title: t("ai_providers:default_mode_saved", "Modo predeterminado actualizado"),
        });
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        sileo.error({
          title: t("core:server_error_toast"),
          description: error?.response?.data?.message,
        });
      }
    }
  };

  const handleVerify = async () => {
    try {
      await refetchHealth({ throwOnError: true });
      sileo.success({
        title: t(
          "ai_providers:notifications.verify_success",
          "Estado de proveedores de IA actualizado"
        ),
      });
    } catch (error) {
      notifyHttpError(error);
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

  // The default channel's health (e.g. API without a key) does not authenticate Web.
  const isWebSessionActive = providerKey.toLowerCase() === "gemini"
    && geminiEnginesData?.web?.available === true
    && geminiEnginesData?.web?.authenticated === true;

  // Operational check:
  // Each subscription mode must have an explicitly operational session.
  // Token plan agentic mode requires agentic environment available.
  const isAgenticSessionActive = geminiEnginesData?.agentic?.available === true
    && geminiEnginesData?.agentic?.authenticated === true;
  const isAgenticStatusKnown = typeof geminiEnginesData?.agentic?.available === "boolean"
    && typeof geminiEnginesData.agentic.authenticated === "boolean";
  const agenticStatusLabel = t(!isAgenticStatusKnown ? "ai_providers:detail.agentic_status_unknown_badge"
    : isAgenticSessionActive ? "ai_providers:detail.agentic_status_active_badge" : "ai_providers:detail.agentic_status_inactive_badge");
  const isModeOperational = activeTab === "token_plan_web" ? isWebSessionActive
    : activeTab === "token_plan_agentic" ? isAgenticSessionActive
    : activeTab === "api_key" && (currentDbProvider?.api_keys?.some((key) => key.is_active && key.is_selected) ?? false);

  const canSyncModels =
    Boolean(currentDbProvider?.id) && isModeOperational && !isBusy;

  const syncDisabledReason = useMemo(() => {
    if (isModeOperational) return "";
    if (activeTab === "api_key") return t("ai_providers:api_keys.required");
    if (activeTab === "token_plan_web") {
      if (!isWebSessionActive) {
        return t(
          "ai_providers:detail.sync_disabled_unauthenticated",
          "El token del plan web no está autenticado o la sesión expiró. Debe autenticarse primero en el navegador remoto antes de sincronizar modelos."
        );
      }
      return t(
        "ai_providers:detail.sync_requires_operational",
        "Para actualizar modelos, la sesión web debe estar operativa. Inicia sesión en el navegador remoto primero."
      );
    }
    if (activeTab === "token_plan_agentic") {
      return t(!isAgenticStatusKnown ? "ai_providers:detail.agentic_desc_unknown" : "ai_providers:detail.agentic_desc_inactive");
    }
    return t(
      "ai_providers:detail.sync_disabled_generic",
      "El proveedor no se encuentra operativo para sincronizar modelos. Verifique el estado de conexión."
    );
  }, [isModeOperational, activeTab, isWebSessionActive, isAgenticStatusKnown, t]);

  return (
    <DetailContainer>
      <QueryErrorAlert isError={providersError || healthError || enginesError || modelsError} isFetching={isBusy} onRetry={() => Promise.all([refetchProviders(), refetchHealth(), refetchModels()])} />
      {/* UNIFIED TOP HEADER PANEL */}
      <TopHeaderPanel elevation={0}>
        <TopNavigationRow>
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
              {Boolean(currentDbProvider?.is_default) && (
                <Chip
                  size="small"
                  label={t("ai_providers:detail.default_badge", "Predeterminado")}
                  color="primary"
                  variant="filled"
                  sx={{
                    height: 20,
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    borderRadius: 1,
                  }}
                />
              )}
            </Box>
            <StatusPill statusType={statusType}>
              {statusLabel}
            </StatusPill>
          </BreadcrumbBox>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            {Boolean((providersResponse?.data?.length ?? 0) > 1) && (
              <SwitchWrapper sx={{ py: 0.5, px: 1.5, minWidth: 240 }}>
                <StyledFormControlLabel
                  control={
                    <StyledSwitch
                      checked={Boolean(currentDbProvider?.is_default)}
                      onChange={async (e) => {
                        if (currentDbProvider?.is_default) {
                          sileo.info({
                            title: t(
                              "ai_providers:already_default_notice",
                              "Este proveedor ya es el predeterminado. Para cambiarlo, active otro proveedor."
                            ),
                          });
                          return;
                        }
                        if (e.target.checked && currentDbProvider?.id) {
                          try {
                            await updateProviderMutation.mutateAsync({
                              id: currentDbProvider.id,
                              data: { is_default: true },
                            });
                            sileo.success({
                              title: t("ai_providers:default_provider_saved", "Proveedor predeterminado actualizado"),
                            });
                          } catch (err: unknown) {
                            const error = err as { response?: { data?: { message?: string } } };
                            sileo.error({
                              title: t("core:server_error_toast"),
                              description: error?.response?.data?.message,
                            });
                          }
                        }
                      }}
                      disabled={isBusy}
                      data-testid="detail-default-provider-switch"
                    />
                  }
                  label={t("ai_providers:set_default_provider", "Proveedor Predeterminado")}
                  labelPlacement="start"
                />
              </SwitchWrapper>
            )}

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
        </TopNavigationRow>

        {availableTabs.length > 0 && (
          <StyledTabs
            value={activeTab ? activeTab : false}
            onChange={(_, newValue: ModeTabKey) => setSelectedTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {availableTabs.map((tab) => {
              const isModeDefault = tab.key === (currentDbProvider?.default_mode || availableTabs[0]?.key);
              return (
                <StyledTab
                  key={tab.key}
                  value={tab.key}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <span>{tab.label}</span>
                      {isModeDefault && (
                        <Chip
                          size="small"
                          label={t("ai_providers:detail.default_badge", "Predeterminado")}
                          color="primary"
                          variant="filled"
                          sx={{
                            height: 18,
                            fontSize: "0.625rem",
                            fontWeight: 700,
                            borderRadius: 1,
                          }}
                        />
                      )}
                    </Box>
                  }
                  icon={tab.icon}
                  iconPosition="start"
                />
              );
            })}
          </StyledTabs>
        )}
      </TopHeaderPanel>

      {currentProviderAlerts.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <AlertBanner
            alerts={currentProviderAlerts}
            disabled={isBusy}
            onAuthenticateAgentic={providerKey === "gemini" ? () => setAgenticLoginOpen(true) : undefined}
            onCheckStatus={handleVerify}
            onRenewSession={onRenewSession}
            onConfigure={() => {
              if (onConfigure && currentHealthProvider) {
                onConfigure(currentHealthProvider);
              }
            }}
            onManageQuotas={() => {
              sileo.info({
                title: t("ai_providers:connection.quotas_title"),
                description: t("ai_providers:connection.quotas_description"),
              });
            }}
          />
        </Box>
      )}

      {isSoftLoading && (
        <LinearProgress sx={{ height: 2, borderRadius: 1 }} />
      )}


      {availableTabs.length === 0 ? (
        <DetailPanel>
          <EmptyModesBox>
            <InfoOutlinedIcon
              sx={{ fontSize: 48, color: "text.secondary", opacity: 0.7 }}
            />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {t(
                "ai_providers:detail.no_active_modes_title",
                "Sin modos de conexión activados"
              )}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 520 }}
            >
              {t(
                "ai_providers:detail.no_active_modes_desc",
                "Active un modo Web o Agentic para gestionar los modelos y la sesión de esta conexión."
              )}
            </Typography>
            {currentHealthProvider && onConfigure && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<SettingsOutlinedIcon fontSize="small" />}
                onClick={() => onConfigure(currentHealthProvider)}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 2,
                  mt: 1,
                }}
              >
                {t(
                  "ai_providers:detail.configure_modes_button",
                  "Configurar Modos de Conexión"
                )}
              </Button>
            )}
          </EmptyModesBox>
        </DetailPanel>
      ) : (
        <>
          {/* PANEL 1: PRODUCTION MODELS & AI PIPELINES */}
          <DetailPanel>
            <PanelHeader sx={{ flexDirection: "column", alignItems: "stretch", gap: 1.5 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <PanelTitle>
                  {t("ai_providers:detail.models_title", "Modelos")} ({providerName})
                </PanelTitle>
                {availableTabs.length > 1 && activeTab && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={currentDbProvider?.default_mode === activeTab}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleToggleModeDefault(activeTab);
                          }
                        }}
                        disabled={
                          isBusy ||
                          currentDbProvider?.default_mode === activeTab
                        }
                        data-testid="default-mode-checkbox"
                        size="small"
                        color="primary"
                        sx={{
                          p: 0.5,
                          "&.Mui-disabled": {
                            color:
                              currentDbProvider?.default_mode === activeTab
                                ? "primary.main"
                                : undefined,
                            opacity:
                              currentDbProvider?.default_mode === activeTab
                                ? 0.9
                                : 0.4,
                          },
                        }}
                      />
                    }
                    label={t(
                      "ai_providers:detail.default_mode_title",
                      "Modo Predeterminado"
                    )}
                    sx={{
                      m: 0,
                      userSelect: "none",
                      "& .MuiFormControlLabel-label": {
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color:
                          currentDbProvider?.default_mode === activeTab
                            ? "text.primary"
                            : "text.secondary",
                      },
                    }}
                  />
                )}
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "100%",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <PanelSubtitle sx={{ maxWidth: 760 }}>
                  {t(
                    "ai_providers:detail.models_subtitle",
                    "Configuración y asignación de arquitecturas de modelos generativos según carga de trabajo, costo operativo y contexto multimodal."
                  )}
                </PanelSubtitle>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                  {!isModeOperational && (
                    <Tooltip title={syncDisabledReason} arrow placement="top">
                      <Box
                        component="span"
                        data-testid="sync-models-disabled-info-icon"
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          color: "warning.main",
                          cursor: "help",
                        }}
                      >
                        <InfoOutlinedIcon sx={{ fontSize: 20 }} />
                      </Box>
                    </Tooltip>
                  )}
                  <Tooltip title={!isModeOperational ? syncDisabledReason : ""}>
                    <span>
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        startIcon={<SyncOutlinedIcon fontSize="small" />}
                        onClick={handleOpenSyncModal}
                        disabled={!canSyncModels}
                        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                      >
                        {t("ai_providers:detail.sync_models_button", "Actualizar modelos")}
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
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
              {!isModeOperational && (
                <Alert
                  severity="warning"
                  icon={<InfoOutlinedIcon />}
                  data-testid="sync-models-unoperational-alert"
                  sx={{ maxWidth: 520, borderRadius: 2, textAlign: "left", mt: 1 }}
                >
                  {syncDisabledReason}
                </Alert>
              )}
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mt: 1 }}>
                {!isModeOperational && (
                  <Tooltip title={syncDisabledReason} arrow placement="top">
                    <Box
                      component="span"
                      data-testid="sync-models-empty-disabled-info-icon"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        color: "warning.main",
                        cursor: "help",
                      }}
                    >
                      <InfoOutlinedIcon sx={{ fontSize: 20 }} />
                    </Box>
                  </Tooltip>
                )}
                <Tooltip title={!isModeOperational ? syncDisabledReason : ""}>
                  <span>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SyncOutlinedIcon fontSize="small" />}
                      onClick={handleOpenSyncModal}
                      disabled={!canSyncModels}
                      sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                    >
                      {t("ai_providers:detail.sync_models_button", "Actualizar modelos")}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          ) : (
            <ModelsGrid>
              {availableModels.map((model) => {
                const isSelected = selectedModel === model.id;
              const isOcrFocused = ocrFocusedModelId === model.id;
              const badgeAbbr = model.id.toLowerCase().includes("ocr")
                ? "OCR"
                : model.id.toLowerCase().includes("pro")
                ? "PRO"
                : model.id.toLowerCase().includes("flash")
                ? "FL"
                : model.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();

              const contextText = typeof model.contextWindow === "number" && model.contextWindow > 0
                ? t("ai_providers:detail.context_tokens", { tokens: model.contextWindow.toLocaleString(i18n.language) }) : null;
              const capabilities = model.capabilities ?? [];

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
                            {model.displayName || model.name || model.id}
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
                          {t("ai_providers:detail.saved_model_configuration")}
                        </Typography>
                      </Box>
                    </Box>

                    <FormControlLabel
                      control={
                        <StyledSwitch
                          checked={isSelected}
                          onChange={() => handleModelSelect(model.id)}
                          disabled={isBusy}
                          size="small"
                        />
                      }
                      label={t("ai_providers:detail.default_badge", "Predeterminado")}
                      labelPlacement="start"
                      sx={{
                        m: 0,
                        gap: 0.75,
                        userSelect: "none",
                        flexShrink: 0,
                        "& .MuiFormControlLabel-label": {
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: isSelected ? "text.primary" : "text.secondary",
                        },
                      }}
                    />
                  </ModelCardHeader>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.5, fontSize: "0.8125rem" }}
                  >
                    {model.description}
                  </Typography>

                  {(contextText || capabilities.length > 0) && <ModelMetricsGrid>
                    {contextText && <MetricColumn>
                      <MetricTitle>{t("ai_providers:detail.context_window")}</MetricTitle>
                      <MetricVal>{contextText}</MetricVal>
                    </MetricColumn>}
                    {capabilities.length > 0 && <MetricColumn>
                      <MetricTitle>{t("ai_providers:detail.capacity_multimodal")}</MetricTitle>
                      <MetricVal>{capabilities.join(", ")}</MetricVal>
                    </MetricColumn>}
                  </ModelMetricsGrid>}

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

                    <FormControlLabel
                      control={
                        <StyledSwitch
                          checked={isOcrFocused}
                          onChange={() => handleToggleOcrFocus(model.id)}
                          disabled={isBusy}
                          size="small"
                        />
                      }
                      label={t("ai_providers:detail.default_badge", "Predeterminado")}
                      labelPlacement="start"
                      sx={{
                        m: 0,
                        gap: 0.75,
                        userSelect: "none",
                        flexShrink: 0,
                        "& .MuiFormControlLabel-label": {
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: isOcrFocused ? "text.primary" : "text.secondary",
                        },
                      }}
                    />
                  </Box>

                  {/* API and Agentic reasoning preference per model */}
                  {(activeTab === "token_plan_agentic" || activeTab === "api_key") && (
                    <Box
                      sx={(theme) => ({
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        pt: 1.5,
                        mt: 1.5,
                        borderTop: `1px dashed ${theme.palette.divider}`,
                      })}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <PsychologyOutlinedIcon
                          sx={{
                            fontSize: 18,
                            color: "primary.main",
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: "text.primary",
                          }}
                        >
                          {t("ai_providers:detail.reasoning_level_label", "Razonamiento")}
                        </Typography>
                        <Tooltip
                          title={t(
                            "ai_providers:detail.reasoning_level_desc",
                            "Nivel de razonamiento (thinking) enviado para este modelo: Low, Medium o High."
                          )}
                        >
                          <InfoOutlinedIcon
                            sx={{ fontSize: 15, color: "text.disabled", cursor: "pointer" }}
                          />
                        </Tooltip>
                      </Box>

                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={
                          (modeFields?.thinking_levels as Record<string, string>)?.[model.id] ||
                          (model.id === selectedModel ? (modeFields?.thinking_level as string) : undefined) ||
                          null
                        }
                        onChange={(_, val) => {
                          if (val) handleSetModelThinkingLevel(model.id, val as "low" | "medium" | "high");
                        }}
                        disabled={isBusy}
                        sx={{
                          height: 26,
                          "& .MuiToggleButton-root": {
                            px: 1,
                            py: 0.25,
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            textTransform: "capitalize",
                            lineHeight: 1,
                          },
                        }}
                      >
                        <ToggleButton value="low" data-testid={`thinking-level-low-${model.id}`}>
                          {t("ai_providers:detail.level_low", "Low")}
                        </ToggleButton>
                        <ToggleButton value="medium" data-testid={`thinking-level-medium-${model.id}`}>
                          {t("ai_providers:detail.level_medium", "Medium")}
                        </ToggleButton>
                        <ToggleButton value="high" data-testid={`thinking-level-high-${model.id}`}>
                          {t("ai_providers:detail.level_high", "High")}
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  )}
                </ModelCardPaper>
              );
            })}
          </ModelsGrid>
        )}
        </Skeleton>

        {/* EXTENDED THINKING SECTION (WEB MODE ONLY) */}
        {(activeTab === "token_plan_agentic" || activeTab === "api_key") && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">{t(activeTab === "api_key"
              ? "ai_providers:detail.api_reasoning_preference"
              : "ai_providers:detail.agentic_reasoning_preference")}</Typography>
            {!availableModels.length && <ToggleButtonGroup exclusive size="small"
              aria-label={t("ai_providers:detail.reasoning_level_label")}
              value={modeFields.thinking_level ?? null} disabled={isBusy}
              onChange={(_event, level: "low" | "medium" | "high" | null) => { if (level) void handleSetModelThinkingLevel("", level); }}>
              {(["low", "medium", "high"] as const).map((level) => <ToggleButton key={level} value={level}>{t(`ai_providers:detail.level_${level}`)}</ToggleButton>)}
            </ToggleButtonGroup>}
          </Box>
        )}
        {activeTab === "token_plan_web" && (
          <Box sx={{ mt: 1 }}>
            <SwitchWrapper>
              <StyledFormControlLabel
                control={
                  <StyledSwitch
                    checked={extendedThinkingEnabled}
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
        )}
      </DetailPanel>

      {/* SUBPANEL: REMOTE WEB SESSION */}
      {activeTab === "api_key" && currentDbProvider && <DetailPanel><ApiKeyManager key={currentDbProvider.id} providerId={currentDbProvider.id} disabled={isBusy} /></DetailPanel>}
      {activeTab === "token_plan_web" && (
        <DetailPanel>
          <WebSessionBanner>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <StatusDot
                color={isWebSessionActive ? "#10b981" : "#f59e0b"}
              />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t("ai_providers:detail.web_session_status", "Estado de la Sesión Web")}:{" "}
                  {isWebSessionActive
                    ? t("ai_providers:detail.web_session_healthy")
                    : t("ai_providers:detail.status_expired", "Requiere Iniciar Sesión")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("ai_providers:detail.web_session_desc")}
                </Typography>
              </Box>
            </Box>

            <Chip
              size="small"
              label={t(isWebSessionActive ? "ai_providers:detail.web_authenticated" : "ai_providers:detail.web_authentication_required")}
              color={isWebSessionActive ? "success" : "warning"}
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
                {t("ai_providers:detail.cloud_bridge_desc")}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                <ShieldOutlinedIcon sx={{ fontSize: 16, color: "success.main" }} />
                <Typography variant="caption" color="text.secondary">
                  {t(
                    "ai_providers:detail.cloud_bridge_security",
                    "Abre el navegador remoto habilitado por el servicio para autenticar la sesión de Google."
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

          {/* QUOTA METRICS: WEB REQUEST LIMITS (FLASH & PRO) */}
          <Box sx={{ mt: 1 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                <SpeedOutlinedIcon fontSize="small" color="primary" />
                {t("ai_providers:detail.quota_title")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("ai_providers:detail.quota_web_desc")}
              </Typography>
            </Box>

            <QuotaGrid>
              {webQuotas.map((quota) => (
                <QuotaCard key={quota.key} elevation={0}>
                  <QuotaHeader>
                    <Tooltip title={quota.key} describeChild>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {t(getWebQuotaLabelKey(quota.key) ?? "ai_providers:detail.reported_quota_bucket", { bucket: quota.key })}
                      </Typography>
                    </Tooltip>
                    <Chip size="small" label={quota.percentage + "%"} />
                  </QuotaHeader>
                  {quota.remaining !== null && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                    {quota.total !== null ? t("ai_providers:detail.quota_remaining_units", { remaining: quota.remaining, total: quota.total })
                      : t("ai_providers:detail.quota_reported_units", { remaining: quota.remaining })}
                  </Typography>}
                  <LinearProgress variant="determinate" value={quota.percentage} sx={{ height: 6, borderRadius: 3 }} />
                </QuotaCard>
              ))}
              {!webQuotas.length && <Typography color="text.secondary">{t("ai_providers:detail.quota_unavailable")}</Typography>}
            </QuotaGrid>
          </Box>

        </DetailPanel>
      )}




      {/* SUBPANEL: ANTIGRAVITY AGENTIC STATUS */}
      {activeTab === "token_plan_agentic" && (
        <DetailPanel>
          <PanelHeader>
            <Box>
              <PanelTitle>
                <PsychologyOutlinedIcon color="primary" />
                {t(
                  "ai_providers:detail.agentic_environment_title",
                  "Entorno Agéntico Antigravity"
                )}
              </PanelTitle>
              <PanelSubtitle>
                {t(
                  "ai_providers:detail.agentic_environment_subtitle",
                  "Gestión del entorno de inferencia con sesión activa de Antigravity (Google One AI Premium)."
                )}
              </PanelSubtitle>
            </Box>
            {providerKey === "gemini" && <Button variant="outlined" disabled={isBusy}
              onClick={() => setAgenticLoginOpen(true)} sx={{ width: { xs: "100%", sm: "auto" } }}>
              {t("ai_providers:agentic_login.manage")}
            </Button>}
          </PanelHeader>

          <AgenticStatusCard elevation={0}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <StatusDot
                  color={
                    isAgenticSessionActive
                      ? "#10b981"
                      : "#64748b"
                  }
                />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {agenticStatusLabel}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      "ai_providers:engine_selection.agentic_title",
                      "Modo Agéntico (Antigravity)"
                    )}
                  </Typography>
                </Box>
              </Box>

              <Chip
                size="small"
                label={agenticStatusLabel}
                color={
                  isAgenticSessionActive ? "success" : "default"
                }
                sx={{ fontWeight: 700, fontSize: "0.75rem" }}
              />
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.6 }}
            >
              {t(!isAgenticStatusKnown ? "ai_providers:detail.agentic_desc_unknown"
                : isAgenticSessionActive ? "ai_providers:detail.agentic_desc_active" : "ai_providers:detail.agentic_desc_inactive")}
            </Typography>

            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}
            >
              <ShieldOutlinedIcon sx={{ fontSize: 16, color: "primary.main" }} />
              <Typography variant="caption" color="text.secondary">
                {t("ai_providers:engine_selection.agentic_desc")}
              </Typography>
            </Box>
          </AgenticStatusCard>

        </DetailPanel>
      )}
    </>
  )}

      {/* MODAL: SYNC MODELS */}
      {agenticLoginOpen && providerKey === "gemini" && <AgenticLoginModal key={providerId} onClose={() => setAgenticLoginOpen(false)} />}
      {currentDbProvider && (
        <SyncModelsModal
          open={isSyncModalOpen}
          provider={currentDbProvider}
          mode={activeTab}
          isOperational={isModeOperational}
          onClose={() => setIsSyncModalOpen(false)}
          onSuccess={() => {
            refetchProviders();
            refetchHealth();
          }}
        />
      )}


    </DetailContainer>
  );
};

export default ProviderDetail;
