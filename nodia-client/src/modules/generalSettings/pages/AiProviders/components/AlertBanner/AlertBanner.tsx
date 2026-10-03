import type { FC } from "react";
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
  onRenewSession?: (provider: string) => void;
  onManageQuotas?: (provider: string) => void;
  onConfigure?: (provider: string) => void;
}

const AlertBanner: FC<AlertBannerProps> = ({
  alerts,
  onRenewSession,
  onManageQuotas,
  onConfigure,
}) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <AlertsWrapper>
      {alerts.map((alert) => {
        const isIncident = alert.type === "incident";
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
                <BannerTitle alertType={alert.type}>{alert.title}</BannerTitle>
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
                <BannerMessage>{alert.message}</BannerMessage>
              </MessageContainer>

              {alert.actionType === "renew_session" ? (
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewOutlinedIcon />}
                  onClick={() => onRenewSession?.(alert.provider)}
                  sx={{
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
                  {alert.actionLabel}
                </Button>
              ) : alert.actionType === "configure" ? (
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<SettingsOutlinedIcon />}
                  onClick={() => {
                    if (onConfigure) {
                      onConfigure(alert.provider);
                    } else if (onManageQuotas) {
                      onManageQuotas(alert.provider);
                    }
                  }}
                  sx={{
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
                  {alert.actionLabel}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<SettingsOutlinedIcon />}
                  onClick={() => onManageQuotas?.(alert.provider)}
                  sx={{
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
                  {alert.actionLabel}
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
