import { IconButton, Tooltip } from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useIndicatorHealth } from "./hooks/useIndicatorHealth";
import { enabledModes, modeHealth } from "./modeHealth";
import { Indicators, ModeButton, StatusBadge } from "./styles";

const modeIcons = {
  api_key: VpnKeyOutlinedIcon,
  agentic: PsychologyOutlinedIcon,
};

export default function AiProviderIndicators() {
  const { t } = useTranslation("layout");
  const navigate = useNavigate();
  const { data, provider, isFetching, isError, refreshHealth, isSessionValid } = useIndicatorHealth();
  // This optional group has no empty state when no default is configured.
  if (!isSessionValid || !provider || !data) return null;
  const modes = enabledModes(provider);
  if (modes.length === 0) return null;

  return (
    <Indicators role="group" aria-label={t("ai_indicators.group", { provider: provider.name })} aria-busy={isFetching}>
      {modes.map((mode) => {
        const Icon = modeIcons[mode];
        const state = modeHealth(provider, mode, data, isError);
        const label = t(state === "disabled" ? "ai_indicators.disabled_label" : "ai_indicators.label", { provider: provider.name, mode: t(`ai_indicators.${mode}`), status: t(`ai_indicators.${state}`) });
        return (
          <Tooltip key={mode} title={label}>
            <span>
              <ModeButton aria-label={label} disabled={isFetching || state === "disabled"} size="small" onClick={() => {
                const params = new URLSearchParams({ provider: provider.id, mode });
                navigate(`/ai-providers?${params}`);
              }}>
                <StatusBadge variant="dot" color={state === "disabled" ? "default" : state === "configured" || state === "healthy" || state === "session_ready" ? "success" : "error"} overlap="circular" anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                  <Icon fontSize="small" />
                </StatusBadge>
                {t(`ai_indicators.${mode}`)}
              </ModeButton>
            </span>
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
