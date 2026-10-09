import { IconButton, Tooltip } from "@mui/material";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAiProvidersHealth } from "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useServices";
import { enabledModes, modeHealth } from "./modeHealth";
import { Indicators, StatusBadge } from "./styles";

const modeIcons = {
  api_key: VpnKeyOutlinedIcon,
  token_plan_web: LanguageOutlinedIcon,
  token_plan_agentic: PsychologyOutlinedIcon,
};

export default function AiProviderIndicators() {
  const { t } = useTranslation("layout");
  const navigate = useNavigate();
  const { data, isFetching, isError } = useAiProvidersHealth();
  const provider = data?.providers?.find((item) => item.is_default === true);
  // This optional group has no empty state when no default is configured.
  if (!provider || !data) return null;

  return (
    <Indicators role="group" aria-label={t("ai_indicators.group", { provider: provider.name })} aria-busy={isFetching}>
      {enabledModes(provider).map((mode) => {
        const Icon = modeIcons[mode];
        const state = modeHealth(provider, mode, data, isError);
        const label = t("ai_indicators.label", { provider: provider.name, mode: t(`ai_indicators.${mode}`), status: t(`ai_indicators.${state}`) });
        return (
          <Tooltip key={mode} title={label}>
            <span>
              <IconButton aria-label={label} disabled={isFetching} size="small" onClick={() => {
                const params = new URLSearchParams({ provider: provider.id, mode });
                navigate(`/settings/ai-providers?${params}`);
              }}>
                <StatusBadge variant="dot" color={state === "healthy" || state === "session_ready" ? "success" : "error"} overlap="circular" anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                  <Icon fontSize="small" />
                </StatusBadge>
              </IconButton>
            </span>
          </Tooltip>
        );
      })}
    </Indicators>
  );
}
