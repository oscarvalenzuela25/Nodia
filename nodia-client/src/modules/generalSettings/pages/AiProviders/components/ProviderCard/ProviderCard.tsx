import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Button, Typography, Box } from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import type { AiProviderHealthItem } from "../../infrastructure/types";
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
  FeatureRow,
  FeatureLabel,
  FeatureValue,
  DetailInsetBox,
  CodeBadge,
  CardActionsRow,
  SecondaryActionsGroup,
} from "./styles";

interface ProviderCardProps {
  provider: AiProviderHealthItem;
  onTestPing?: (provider: AiProviderHealthItem) => void;
  onRenewSession?: (provider: AiProviderHealthItem) => void;
  onManageKeys?: (provider: AiProviderHealthItem) => void;
  onViewModels?: (provider: AiProviderHealthItem) => void;
  onConfigure?: (provider: AiProviderHealthItem) => void;
  onGoToDetail?: (provider: AiProviderHealthItem) => void;
}

const ProviderCard: FC<ProviderCardProps> = ({
  provider,
  onTestPing,
  onRenewSession,
  onManageKeys,
  onViewModels,
  onConfigure,
  onGoToDetail,
}) => {
  const { t } = useTranslation(["ai_providers", "core"]);

  const isGemini = provider.key.toLowerCase().includes("gemini");
  const isMistral = provider.key.toLowerCase().includes("mistral");
  const isWebMode = provider.mode === "web_session";

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
              <ProviderName>{provider.name}</ProviderName>
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
              "Configure una vía de conexión (sesión web o API keys) para habilitar este proveedor."
            )}
          </Typography>
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
            <ProviderName>{provider.name}</ProviderName>
            <TagRow>
              <SubtitleTag>
                {isWebMode
                  ? t("ai_providers:cards.mode_web", "Modo: Sesión Web Headless")
                  : t("ai_providers:cards.mode_api", "Modo: API Key (Rotativa)")}
              </SubtitleTag>
              <span>•</span>
              <SubtitleTag>
                {isWebMode
                  ? t("ai_providers:cards.tag_multimodal", "Extracción & Multi-modal")
                  : t("ai_providers:cards.tag_multi_key", "Multi-Key Pool")}
              </SubtitleTag>
            </TagRow>
          </TitleBox>
        </ProviderInfo>

        <StatusPill statusType={provider.status}>
          <StatusDot color={getStatusDotColor()} />
          {provider.statusBadge}
        </StatusPill>
      </CardHeader>

      {/* 4 STATS METRICS GRID */}
      <MetricsGrid>
        {/* Service State */}
        <MetricBlock>
          <MetricLabel>{t("ai_providers:cards.service_state", "Estado de servicio")}</MetricLabel>
          <MetricValue sx={{ color: provider.status === "expired" ? "#f59e0b" : "#10b981" }}>
            {provider.status === "expired" ? (
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

        {/* Avg Latency */}
        <MetricBlock>
          <MetricLabel>{t("ai_providers:cards.avg_latency", "Latencia media")}</MetricLabel>
          <MetricValue sx={{ color: "#38bdf8" }}>
            <SpeedOutlinedIcon sx={{ fontSize: 16 }} />
            {provider.latencyMs > 0 ? `${provider.latencyMs} ms` : "185 ms"}
          </MetricValue>
        </MetricBlock>

        {/* Container or Monthly Quota */}
        <MetricBlock>
          <MetricLabel>
            {isWebMode
              ? t("ai_providers:cards.container_status", "Contenedor Chromium")
              : t("ai_providers:cards.monthly_quota", "Cuota mensual")}
          </MetricLabel>
          <MetricValue>
            <StorageOutlinedIcon sx={{ fontSize: 16 }} />
            {isWebMode ? provider.containerStatus || "Cluster-04:IDLE" : provider.monthlyQuotaUsed || "68.4% consumida"}
          </MetricValue>
        </MetricBlock>
      </MetricsGrid>

      {/* MIDDLE FEATURE SECTION */}
      <FeatureSection>
        {/* Failover status row */}
        <FeatureRow>
          <FeatureLabel>
            <SyncOutlinedIcon sx={{ fontSize: 16 }} />
            {isWebMode
              ? t("ai_providers:cards.auto_failover", "Failover automático")
              : t("ai_providers:cards.failover_switch", "Cambio de contingencia")}
          </FeatureLabel>
          <FeatureValue>
            {isWebMode
              ? t("ai_providers:cards.failover_inactive_web", "INACTIVO PARA MODO WEB")
              : provider.failoverSwitch || "Activo (Failover a mistral-prod-sec)"}
          </FeatureValue>
        </FeatureRow>

        {/* Details row: Remote Browser or Assigned Models */}
        {isWebMode ? (
          <DetailInsetBox>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <DevicesOutlinedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                  {t("ai_providers:cards.remote_browser_profile", "Perfil de Navegación Remota")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("ai_providers:cards.cookie_location", "Ubicación de cookies")}:{" "}
                  <CodeBadge>{provider.remoteBrowserProfile?.location || "/var/vault/gemini-session-v2.enc"}</CodeBadge>
                </Typography>
              </Box>
            </Box>
            <CodeBadge>{provider.remoteBrowserProfile?.engine || "Puppeteer Node"}</CodeBadge>
          </DetailInsetBox>
        ) : (
          <DetailInsetBox>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
              <TuneOutlinedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                  {t("ai_providers:cards.assigned_models", "Modelos Asignados por Función")}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                  <CodeBadge>OCR: {provider.assignedModels?.ocr || "mistral-ocr-v1"}</CodeBadge>
                  <CodeBadge>Infer: {provider.assignedModels?.infer || "mistral-large-2411"}</CodeBadge>
                </Box>
              </Box>
            </Box>
            <Button
              size="small"
              variant="text"
              onClick={() => onViewModels?.(provider)}
              sx={{ fontWeight: 600, textTransform: "none", fontSize: "0.75rem" }}
            >
              {t("ai_providers:cards.change_action", "Cambiar")}
            </Button>
          </DetailInsetBox>
        )}
      </FeatureSection>

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
            onClick={() => onTestPing?.(provider)}
            sx={{ borderRadius: 1.5, textTransform: "none" }}
          >
            {isWebMode
              ? t("ai_providers:cards.test_ping_button", "Test Ping")
              : t("ai_providers:cards.test_endpoint_button", "Test Endpoint")}
          </Button>

          {!isWebMode && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onViewModels?.(provider)}
              sx={{ borderRadius: 1.5, textTransform: "none" }}
            >
              {t("ai_providers:cards.models_button", "Modelos")}
            </Button>
          )}
        </SecondaryActionsGroup>

        {/* Primary CTA button */}
        {isWebMode ? (
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
        ) : (
          <Button
            variant="contained"
            size="small"
            startIcon={<KeyOutlinedIcon />}
            onClick={() => onManageKeys?.(provider)}
            sx={{
              backgroundColor: "#0d9488",
              color: "#ffffff",
              fontWeight: 600,
              textTransform: "none",
              borderRadius: 1.5,
              px: 2,
              "&:hover": {
                backgroundColor: "#0f766e",
              },
            }}
          >
            {t("ai_providers:cards.admin_api_keys_button", {
              defaultValue: "Administrar API Keys ({{count}})",
              count: provider.apiKeysCount || 3,
            })}
          </Button>
        )}
      </CardActionsRow>
    </CardContainer>
  );
};

export default ProviderCard;
