import { Tooltip } from "@mui/material";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAiProvidersHealth } from "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useServices";
import { PROVIDER_MODES, modeHealth } from "./modeHealth";
import { Indicators, ModeButton, StatusBadge } from "./styles";

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
      {PROVIDER_MODES.map((mode) => {
        const Icon = modeIcons[mode];
        const state = modeHealth(provider, mode, data, isError);
        const label = t(state === "disabled" ? "ai_indicators.disabled_label" : "ai_indicators.label", { provider: provider.name, mode: t(`ai_indicators.${mode}`), status: t(`ai_indicators.${state}`) });
        return (
          <Tooltip key={mode} title={label}>
            <span>
              <ModeButton aria-label={label} disabled={isFetching || state === "disabled"} size="small" onClick={() => {
                const params = new URLSearchParams({ provider: provider.id, mode });
                navigate(`/settings/ai-providers?${params}`);
              }}>
                <StatusBadge variant="dot" color={state === "disabled" ? "default" : state === "healthy" || state === "session_ready" ? "success" : "error"} overlap="circular" anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                  <Icon fontSize="small" />
                </StatusBadge>
                {t(`ai_indicators.${mode}`)}
              </ModeButton>
            </span>
          </Tooltip>
        );
      })}
    </Indicators>
  );
}
