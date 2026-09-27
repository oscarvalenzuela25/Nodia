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
}

const AlertBanner: FC<AlertBannerProps> = ({
  alerts,
  onRenewSession,
  onManageQuotas,
}) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <AlertsWrapper>
      {alerts.map((alert) => {
        const isIncident = alert.type === "incident";
        const accentColor = isIncident ? "#f59e0b" : "#10b981";

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
