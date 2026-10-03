import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Button, Typography, Box, LinearProgress, Tooltip, Chip } from "@mui/material";
import { sileo } from "sileo";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AiProviderHealthItem } from "../../infrastructure/types";
import { useGeminiEngines, useUpdateAiProvider } from "../../infrastructure/useServices";
import {
  CardContainer,
  CardHeader,
  ProviderInfo,
  IconBox,
  TitleBox,
  ProviderName,
  TagRow,
  SubtitleTag,
  StatusPill,
  StatusDot,
  MetricsGrid,
  MetricBlock,
  MetricLabel,
  MetricValue,
  FeatureSection,
  CodeBadge,
  CardActionsRow,
  SecondaryActionsGroup,
  ModesPanelsRow,
  ModePanelCard,
  ModePanelHeader,
  ModePanelBody,
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
} from "./styles";

interface ProviderCardProps {
  provider: AiProviderHealthItem;
  totalProviders?: number;
  onRenewSession?: (provider: AiProviderHealthItem) => void;
  onViewModels?: (provider: AiProviderHealthItem) => void;
  onConfigure?: (provider: AiProviderHealthItem) => void;
  onGoToDetail?: (provider: AiProviderHealthItem) => void;
}

const ProviderCard: FC<ProviderCardProps> = ({
  provider,
  totalProviders,
  onRenewSession,
  onViewModels,
  onConfigure,
  onGoToDetail,
}) => {
  const { t } = useTranslation(["ai_providers", "core"]);

  const isGemini = provider.key.toLowerCase().includes("gemini");
  const isMistral = provider.key.toLowerCase().includes("mistral");
  const isWebMode = provider.mode === "web_session";

  const { data: geminiEnginesData } = useGeminiEngines({
    enabled: isGemini,
  });

  const isAgenticActive = isGemini && geminiEnginesData?.agentic?.available === true
    && geminiEnginesData.agentic.authenticated === true;
  const isWebActive = isGemini && geminiEnginesData?.web?.available === true
    && geminiEnginesData.web.authenticated === true;

  // Provider Icon
  const renderProviderIcon = () => {
    if (isGemini) {
      return <AutoAwesomeOutlinedIcon sx={{ fontSize: 28 }} />;
    }
    if (isMistral) {
      return <HubOutlinedIcon sx={{ fontSize: 28 }} />;
    }
    return <SmartToyOutlinedIcon sx={{ fontSize: 28 }} />;
  };

  const updateProviderMutation = useUpdateAiProvider();
  const isUpdatingDefault = updateProviderMutation.isPending;

  const handleToggleDefaultProvider = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (provider.is_default) {
      sileo.info({
        title: t(
          "ai_providers:already_default_notice",
          "Este proveedor ya es el predeterminado. Para cambiarlo, active otro proveedor."
        ),
      });
      return;
    }

    if (e.target.checked && provider.id) {
      try {
        await updateProviderMutation.mutateAsync({
          id: provider.id,
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
  };

  const getStatusDotColor = () => {
    if (provider.status === "healthy") return "#10b981";
    if (provider.status === "expired" || provider.status === "degraded") return "#f59e0b";
    return "#64748b";
  };

  if (!provider.hasConnection || provider.status === "unconfigured") {
    return (
      <CardContainer>
        <CardHeader>
          <ProviderInfo>
            <IconBox>{renderProviderIcon()}</IconBox>
            <TitleBox>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ProviderName>{provider.name}</ProviderName>
                {provider.is_default && (
                  <Chip
                    size="small"
                    label={t("ai_providers:cards.default_badge", "Predeterminado")}
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
              <TagRow>
                <SubtitleTag>ID: {provider.key}</SubtitleTag>
              </TagRow>
            </TitleBox>
          </ProviderInfo>
          <StatusPill statusType="unconfigured">
            <StatusDot color="#64748b" />
            {t("ai_providers:cards.status_unconfigured", "SIN CONFIGURAR")}
          </StatusPill>
        </CardHeader>

        <Box sx={{ py: 3, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              "ai_providers:cards.unconfigured_desc",
              "Configure una sesión Web o Agentic para habilitar esta conexión."
            )}
          </Typography>
          {Boolean(totalProviders && totalProviders > 1) && (
            <Box sx={{ mb: 2, maxWidth: 360, mx: "auto" }}>
              <SwitchWrapper>
                <StyledFormControlLabel
                  control={
                    <StyledSwitch
                      checked={Boolean(provider.is_default)}
                      onChange={handleToggleDefaultProvider}
                      disabled={isUpdatingDefault}
                      data-testid={`default-provider-switch-${provider.key}`}
                    />
                  }
                  label={t("ai_providers:set_default_provider", "Proveedor Predeterminado")}
                  labelPlacement="start"
                />
              </SwitchWrapper>
            </Box>
          )}

          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap" }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SettingsOutlinedIcon />}
              onClick={() => onConfigure?.(provider)}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
            >
              {t("ai_providers:cards.configure_button", "Configurar Proveedor")}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<ArrowForwardOutlinedIcon />}
              onClick={() => onGoToDetail?.(provider)}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
            >
              {t("ai_providers:cards.go_to_detail", "Ir al detalle")}
            </Button>
          </Box>
        </Box>
      </CardContainer>
    );
  }

  return (
    <CardContainer>
      {/* HEADER */}
      <CardHeader>
        <ProviderInfo>
          <IconBox>{renderProviderIcon()}</IconBox>
          <TitleBox>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ProviderName>{provider.name}</ProviderName>
              {provider.is_default && (
                <Chip
                  size="small"
                  label={t("ai_providers:cards.default_badge", "Predeterminado")}
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
            <TagRow>
              <SubtitleTag>
                {(() => {
                  const modes: string[] = [];
                  if (provider.use_token_plan_agentic) modes.push("Agentic");
                  if (provider.use_token_plan_web) modes.push("Plan Web");
                  if (modes.length > 0) return `Modos: ${modes.join(" • ")}`;
                  return isWebMode
                    ? t("ai_providers:cards.mode_web", "Modo: Sesión Web Headless")
                    : t("ai_providers:connection.no_modes");
                })()}
              </SubtitleTag>
              <span>•</span>
              <SubtitleTag>
                {isWebMode
                  ? t("ai_providers:cards.tag_multimodal", "Extracción & Multi-modal")
                  : t("ai_providers:cards.tag_multimodal")}
              </SubtitleTag>
            </TagRow>
          </TitleBox>
        </ProviderInfo>

        <StatusPill statusType={provider.status}>
          <StatusDot color={getStatusDotColor()} />
          {provider.statusBadge}
        </StatusPill>
      </CardHeader>

      {/* STATS METRICS GRID */}
      <MetricsGrid>
        {/* Service State */}
        <MetricBlock>
          <MetricLabel>{t("ai_providers:cards.service_state", "Estado de servicio")}</MetricLabel>
          <MetricValue sx={{ color: provider.status === "expired" || provider.status === "degraded" ? "#f59e0b" : "#10b981" }}>
            {provider.status === "expired" || provider.status === "degraded" ? (
              <ErrorOutlineOutlinedIcon sx={{ fontSize: 16 }} />
            ) : (
              <CheckCircleOutlinedIcon sx={{ fontSize: 16 }} />
            )}
            {provider.serviceState}
          </MetricValue>
        </MetricBlock>

        {/* Last Check */}
        <MetricBlock>
          <MetricLabel>{t("ai_providers:cards.last_check", "Última comprobación")}</MetricLabel>
          <MetricValue>{provider.lastCheck}</MetricValue>
        </MetricBlock>
      </MetricsGrid>

      {/* MIDDLE FEATURE SECTION: MODE PANELS */}
      <FeatureSection>



        {/* MODES PANELS ROW */}
        {(() => {
          const hasScopedFields = Boolean(provider.fields?.token_plan_agentic || provider.fields?.token_plan_web || provider.fields?.api_key);
          const agenticFields = (provider.fields?.token_plan_agentic as Record<string, unknown>) || {};
          const agenticModel =
            (agenticFields.selected_model as string) ||
            (!hasScopedFields && provider.default_mode === "token_plan_agentic" ? provider.selectedModel : undefined);

          const webFields = (provider.fields?.token_plan_web as Record<string, unknown>) || {};
          const webModel =
            (webFields.selected_model as string) ||
            (!hasScopedFields && provider.default_mode === "token_plan_web" ? provider.selectedModel : undefined);

          const webQuota = geminiEnginesData?.web?.quota;

          return (
            <ModesPanelsRow>
              {/* MODO 1: AGENTIC */}
              {Boolean(provider.use_token_plan_agentic) && (
                <ModePanelCard>
                  <ModePanelHeader>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <PsychologyOutlinedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
                        {t("ai_providers:cards.panel_agentic_title", "Sesión Agéntica (Antigravity)")}
                      </Typography>
                    </Box>
                    <CodeBadge
                      sx={{
                        backgroundColor:
                          !isAgenticActive
                            ? "rgba(239, 68, 68, 0.1)"
                            : "rgba(16, 185, 129, 0.1)",
                        color: !isAgenticActive ? "#ef4444" : "#10b981",
                        borderColor:
                          !isAgenticActive
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(16, 185, 129, 0.2)",
                      }}
                    >
                      {!isAgenticActive
                        ? t("ai_providers:cards.panel_agentic_inactive", "No detectada")
                        : t("ai_providers:cards.panel_agentic_active", "Conectada")}
                    </CodeBadge>
                  </ModePanelHeader>
                  <ModePanelBody>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("ai_providers:cards.model_label", "Modelo")}:
                      </Typography>
                      <CodeBadge sx={{ fontStyle: agenticModel ? "normal" : "italic", opacity: agenticModel ? 1 : 0.7 }}>
                        {agenticModel || t("ai_providers:status_not_configured", "Sin asignar")}
                      </CodeBadge>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        "ai_providers:cards.panel_agentic_desc",
                        "Entorno agéntico Antigravity"
                      )}
                    </Typography>
                  </ModePanelBody>
                </ModePanelCard>
              )}

              {/* MODO 2: WEB */}
              {Boolean(provider.use_token_plan_web) && (
                <ModePanelCard>
                  <ModePanelHeader>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <DevicesOutlinedIcon sx={{ fontSize: 18, color: "info.main" }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
                        {t("ai_providers:cards.panel_web_title", "Sesión Web (Google One)")}
                      </Typography>
                    </Box>
                    <CodeBadge
                      sx={{
                        backgroundColor:
                          !isWebActive
                            ? "rgba(245, 158, 11, 0.1)"
                            : "rgba(16, 185, 129, 0.1)",
                        color: !isWebActive ? "#f59e0b" : "#10b981",
                        borderColor:
                          !isWebActive
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(16, 185, 129, 0.2)",
                      }}
                    >
                      {!isWebActive
                        ? t("ai_providers:cards.panel_web_inactive", "Requiere Login")
                        : t("ai_providers:cards.panel_web_active", "Autenticada")}
                    </CodeBadge>
                  </ModePanelHeader>
                  <ModePanelBody>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("ai_providers:cards.model_label", "Modelo")}:
                      </Typography>
                      <CodeBadge sx={{ fontStyle: webModel ? "normal" : "italic", opacity: webModel ? 1 : 0.7 }}>
                        {webModel || t("ai_providers:status_not_configured", "Sin asignar")}
                      </CodeBadge>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {t(
                        "ai_providers:cards.panel_web_desc",
                        "Sesión de navegador para modelos web"
                      )}
                    </Typography>

                    {/* QUOTA METRICS: FLASH & PRO */}
                    {Boolean(webQuota?.flash || webQuota?.pro) && (
                      <Box sx={{ display: "flex", gap: 1, mt: 0.5, width: "100%" }}>
                        {webQuota?.flash && Number.isFinite(webQuota.flash.usage_percentage) && (
                          <Tooltip title={t("ai_providers:cards.quota_flash_tooltip", "Cuota de solicitudes Gemini Flash")}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                                <Typography variant="caption" sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
                                  {t("ai_providers:cards.quota_flash_label", "Flash")}:
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: "0.6875rem", fontWeight: 700 }}>
                                  {webQuota.flash.usage_percentage ?? 0}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(webQuota.flash.usage_percentage ?? 0, 100)}
                                color="info"
                                sx={{ height: 4, borderRadius: 2 }}
                              />
                            </Box>
                          </Tooltip>
                        )}
                        {webQuota?.pro && Number.isFinite(webQuota.pro.usage_percentage) && (
                          <Tooltip title={t("ai_providers:cards.quota_pro_tooltip", "Cuota de solicitudes Gemini Pro")}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                                <Typography variant="caption" sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
                                  {t("ai_providers:cards.quota_pro_label", "Pro")}:
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: "0.6875rem", fontWeight: 700 }}>
                                  {webQuota.pro.usage_percentage ?? 0}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(webQuota.pro.usage_percentage ?? 0, 100)}
                                color="secondary"
                                sx={{ height: 4, borderRadius: 2 }}
                              />
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                    )}
                  </ModePanelBody>
                </ModePanelCard>
              )}




              {/* SIN MODOS ACTIVOS */}
              {!provider.use_token_plan_agentic &&
                !provider.use_token_plan_web && (
                  <ModePanelCard sx={{ gridColumn: "1 / -1" }}>
                    <ModePanelHeader>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <InfoOutlinedIcon sx={{ fontSize: 18, color: "warning.main" }} />
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary" }}>
                          {t("ai_providers:cards.panel_no_modes_title", "Sin modos activos")}
                        </Typography>
                      </Box>
                    </ModePanelHeader>
                    <ModePanelBody>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          "ai_providers:cards.panel_no_modes_desc",
                          "No se tiene información. No hay modos de conexión activos configurados."
                        )}
                      </Typography>
                    </ModePanelBody>
                  </ModePanelCard>
                )}
            </ModesPanelsRow>
          );
        })()}
      </FeatureSection>

      {/* DEFAULT PROVIDER SWITCH (IF MORE THAN 1 PROVIDER) */}
      {Boolean(totalProviders && totalProviders > 1) && (
        <SwitchWrapper>
          <StyledFormControlLabel
            control={
              <StyledSwitch
                checked={Boolean(provider.is_default)}
                onChange={handleToggleDefaultProvider}
                disabled={isUpdatingDefault}
                data-testid={`default-provider-switch-${provider.key}`}
              />
            }
            label={t("ai_providers:set_default_provider", "Proveedor Predeterminado")}
            labelPlacement="start"
          />
        </SwitchWrapper>
      )}

      {/* FOOTER ACTIONS */}
      <CardActionsRow>
        <SecondaryActionsGroup>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<ArrowForwardOutlinedIcon />}
            onClick={() => onGoToDetail?.(provider)}
            sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
          >
            {t("ai_providers:cards.go_to_detail", "Ir al detalle")}
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<SettingsOutlinedIcon />}
            onClick={() => onConfigure?.(provider)}
            sx={{ borderRadius: 1.5, textTransform: "none" }}
          >
            {t("ai_providers:cards.configure_button", "Configurar")}
          </Button>

          <Button
            size="small"
            variant="outlined"
            onClick={() => (onViewModels ? onViewModels(provider) : onGoToDetail?.(provider))}
            sx={{ borderRadius: 1.5, textTransform: "none" }}
          >
            {t("ai_providers:cards.models_button", "Modelos")}
          </Button>
        </SecondaryActionsGroup>

        {/* Primary CTA buttons */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {Boolean(provider.use_token_plan_web && provider.status === "expired") && (
            <Button
              variant="contained"
              size="small"
              startIcon={<DevicesOutlinedIcon />}
              onClick={() => onRenewSession?.(provider)}
              sx={{
                backgroundColor: "#6366f1",
                color: "#ffffff",
                fontWeight: 600,
                textTransform: "none",
                borderRadius: 1.5,
                px: 2,
                "&:hover": {
                  backgroundColor: "#4f46e5",
                },
              }}
            >
              {t("ai_providers:cards.renew_session_button", "Renovar Sesión (Navegador Remoto)")}
            </Button>
          )}


        </Box>
      </CardActionsRow>
    </CardContainer>
  );
};

export default ProviderCard;
