import { useEffect, useRef } from "react";
import { IconButton, Tooltip } from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { sileo } from "sileo";
import useAuthStore, { hasValidatedSession } from "../../../../../store/authStore";
import { useIndicatorHealth } from "./hooks/useIndicatorHealth";
import { isTopbarAuthorizationError, useTopbarAiStatus } from "./infrastructure/useServices";
import { agenticModeHealth, apiKeyModeHealth, enabledModes, modeHealth, type ModeState, type ProviderMode } from "./modeHealth";
import { Indicators, ModeButton, ModeLabel, StatusBadge } from "./styles";

const modeIcons = {
  api_key: VpnKeyOutlinedIcon,
  agentic: PsychologyOutlinedIcon,
};

export default function AiProviderIndicators({ canManageAi }: { canManageAi: boolean }) {
  return canManageAi ? <AdminIndicators /> : <BusinessIndicators />;
}

function AdminIndicators() {
  const navigate = useNavigate();
  const { data, provider, isFetching, isError, refreshHealth, isSessionValid } = useIndicatorHealth();
  if (!isSessionValid || !provider || !data) return null;

  return <IndicatorGroup
    providerName={provider.name}
    modes={enabledModes(provider)}
    getState={(mode) => modeHealth(provider, mode, data, isError)}
    isFetching={isFetching}
    refreshHealth={refreshHealth}
    openMode={(mode) => {
      const params = new URLSearchParams({ provider: provider.id, mode });
      navigate(`/ai-providers?${params}`);
    }}
  />;
}

function BusinessIndicators() {
  const { t } = useTranslation("layout");
  const { status, isSessionValid, sessionVersion } = useTopbarAiStatus();
  const pending = useRef(false);
  const currentSession = useRef<number | null>(null);
  useEffect(() => {
    currentSession.current = isSessionValid ? sessionVersion : null;
    return () => { currentSession.current = null; };
  }, [isSessionValid, sessionVersion]);

  const provider = status.data?.provider;
  if (!isSessionValid || isTopbarAuthorizationError(status.error) || !provider) return null;

  const refreshHealth = async () => {
    if (status.isFetching || pending.current) return;
    pending.current = true;
    try {
      const result = await status.refetch({ cancelRefetch: false });
      const auth = useAuthStore.getState();
      if (result.isSuccess && currentSession.current === sessionVersion
        && auth.sessionVersion === sessionVersion && hasValidatedSession(auth)) {
        sileo.success({ title: t("ai_indicators.refreshed") });
      }
    } finally {
      pending.current = false;
    }
  };

  return <IndicatorGroup
    providerName={provider.name}
    modes={enabledModes(provider)}
    getState={(mode) => mode === "api_key" ? apiKeyModeHealth(provider.hasApiKey)
      : agenticModeHealth(provider.isActive, provider.agentic, status.isError)}
    isFetching={status.isFetching}
    refreshHealth={refreshHealth}
  />;
}

type IndicatorGroupProps = {
  providerName: string;
  modes: ProviderMode[];
  getState: (mode: ProviderMode) => ModeState;
  isFetching: boolean;
  refreshHealth: () => void;
  openMode?: (mode: ProviderMode) => void;
};

function IndicatorGroup({ providerName, modes, getState, isFetching, refreshHealth, openMode }: IndicatorGroupProps) {
  const { t } = useTranslation("layout");
  if (modes.length === 0) return null;

  return (
    <Indicators role="group" aria-label={t("ai_indicators.group", { provider: providerName })} aria-busy={isFetching}>
      {modes.map((mode) => {
        const Icon = modeIcons[mode];
        const state = getState(mode);
        const modeName = t(`ai_indicators.${mode}`);
        const label = t(openMode && state !== "disabled" ? "ai_indicators.label" : "ai_indicators.status_label", { provider: providerName, mode: modeName, status: t(`ai_indicators.${state}`) });
        const content = <>
          <StatusBadge variant="dot" color={state === "disabled" ? "default" : state === "configured" || state === "healthy" || state === "session_ready" ? "success" : "error"} overlap="circular" anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
            <Icon fontSize="small" />
          </StatusBadge>
          {modeName}
        </>;
        return (
          <Tooltip key={mode} title={label}>
            {openMode ? <span>
              <ModeButton aria-label={label} disabled={isFetching || state === "disabled"} size="small" onClick={() => openMode(mode)}>
                {content}
              </ModeButton>
            </span> : <ModeLabel role="img" aria-label={label} tabIndex={0}>{content}</ModeLabel>}
          </Tooltip>
        );
      })}
      <Tooltip title={t("ai_indicators.refresh")}>
        <span>
          <IconButton
            aria-label={t("ai_indicators.refresh")}
            size="small"
            loading={isFetching}
            onClick={refreshHealth}
            sx={{ width: 44, height: 44, flexShrink: 0, color: "text.secondary" }}
          >
            <RefreshOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Indicators>
  );
}
