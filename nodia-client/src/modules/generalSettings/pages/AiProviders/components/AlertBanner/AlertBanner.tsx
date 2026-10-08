import type { FC } from "react";
import { useTranslation } from "react-i18next";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import { Button } from "@mui/material";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import type { AiProviderAlert } from "../../infrastructure/types";
import {
  AlertsWrapper,
  BannerCard,
  BannerHeader,
  TitleContainer,
  BannerTitle,
  TimeBadge,
  BannerContent,
  MessageContainer,
  BannerMessage,
} from "./styles";

interface AlertBannerProps {
  alerts: AiProviderAlert[];
  disabled?: boolean;
  onAuthenticateAgentic?: () => void;
  onCheckStatus?: () => void;
  onRenewSession?: (provider: string) => void;
  onManageQuotas?: (provider: string) => void;
  onConfigure?: (provider: string) => void;
}

const AlertBanner: FC<AlertBannerProps> = ({
  alerts,
  disabled = false,
  onAuthenticateAgentic,
  onCheckStatus,
  onRenewSession,
  onManageQuotas,
  onConfigure,
}) => {
  const { t } = useTranslation("ai_providers");
  if (!alerts || alerts.length === 0) return null;

  return (
    <AlertsWrapper>
      {alerts.map((alert) => {
        const isIncident = alert.type === "incident";
        const title = alert.reason && alert.providerName
          ? t(`ai_providers:alerts.${alert.reason}_title`, { provider: alert.providerName }) : alert.title;
        const message = alert.reason ? t(`ai_providers:alerts.${alert.reason}_message`) : alert.message;
        const action = alert.actionType === "authenticate_agentic" ? onAuthenticateAgentic
          : alert.actionType === "check_status" ? onCheckStatus
            : alert.actionType === "renew_session" && onRenewSession ? () => onRenewSession(alert.provider)
              : alert.actionType === "configure" && onConfigure ? () => onConfigure(alert.provider)
                : alert.actionType === "manage_quotas" && onManageQuotas ? () => onManageQuotas(alert.provider) : undefined;
        const actionLabel = alert.actionType === "authenticate_agentic" ? t("ai_providers:agentic_login.manage")
          : alert.actionType === "check_status" ? t("ai_providers:alerts.check_status") : alert.actionLabel;
        const actionIcon = alert.actionType === "check_status" ? <SyncOutlinedIcon />
          : alert.actionType === "renew_session" || alert.actionType === "authenticate_agentic"
            ? <OpenInNewOutlinedIcon /> : <SettingsOutlinedIcon />;
        const accentColor =
          alert.severity === "error"
            ? "#ef4444"
            : alert.type === "warning"
            ? "#f59e0b"
            : alert.type === "failover"
            ? "#10b981"
            : "#3b82f6";

        return (
          <BannerCard key={alert.id} alertType={alert.type}>
            <BannerHeader>
              <TitleContainer>
                {isIncident ? (
                  <WarningAmberOutlinedIcon sx={{ color: accentColor, fontSize: 18 }} />
                ) : (
                  <AltRouteOutlinedIcon sx={{ color: accentColor, fontSize: 18 }} />
                )}
                <BannerTitle alertType={alert.type}>{title}</BannerTitle>
              </TitleContainer>
              {alert.timeAgo && <TimeBadge>{alert.timeAgo}</TimeBadge>}
            </BannerHeader>

            <BannerContent>
              <MessageContainer>
                {isIncident ? (
                  <WarningAmberOutlinedIcon sx={{ color: accentColor, fontSize: 24, mt: 0.2 }} />
                ) : (
                  <AltRouteOutlinedIcon sx={{ color: accentColor, fontSize: 24, mt: 0.2 }} />
                )}
                <BannerMessage>{message}</BannerMessage>
              </MessageContainer>

              {action && (
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={actionIcon}
                  onClick={action}
                  disabled={disabled}
                  sx={{
                    width: { xs: "100%", sm: "auto" },
                    borderColor: accentColor,
                    color: accentColor,
                    fontWeight: 600,
                    textTransform: "none",
                    borderRadius: 1.5,
                    px: 2,
                    "&:hover": {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}1A`,
                    },
                  }}
                >
                  {actionLabel}
                </Button>
              )}
            </BannerContent>
          </BannerCard>
        );
      })}
    </AlertsWrapper>
  );
};

export default AlertBanner;
