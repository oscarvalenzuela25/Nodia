import { styled, alpha } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";

export const AlertsWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  width: "100%",
}));

export const BannerCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== "alertType",
})<{ alertType: "incident" | "failover" | "warning" | "info" }>(({ theme, alertType }) => {
  const mainColor =
    alertType === "incident"
      ? "#ef4444"
      : alertType === "warning"
      ? "#f59e0b"
      : alertType === "failover"
      ? "#10b981"
      : "#3b82f6";
  const bgAlpha = alpha(mainColor, 0.08);
  const borderAlpha = alpha(mainColor, 0.35);

  return {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2, 2.5),
    borderRadius: Number(theme.shape.borderRadius) * 1.5,
    backgroundColor: bgAlpha,
    border: `1px solid ${borderAlpha}`,
    boxShadow: `0 0 15px -3px ${alpha(mainColor, 0.15)}`,
    transition: theme.transitions.create(["border-color", "box-shadow"], {
      duration: theme.transitions.duration.shorter,
    }),
  };
});

export const BannerHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(1),
}));

export const TitleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

export const BannerTitle = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "alertType",
})<{ alertType: string }>(({ alertType }) => ({
  fontWeight: 700,
  fontSize: "0.875rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color:
    alertType === "incident"
      ? "#ef4444"
      : alertType === "warning"
      ? "#f59e0b"
      : alertType === "failover"
      ? "#10b981"
      : "#3b82f6",
}));

export const TimeBadge = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.25, 1),
  borderRadius: 9999,
  fontSize: "0.75rem",
  fontWeight: 600,
  backgroundColor: alpha(theme.palette.text.primary, 0.08),
  color: theme.palette.text.secondary,
}));

export const BannerContent = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(2),
}));

export const MessageContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1.5),
  flex: 1,
  minWidth: 260,
}));

export const BannerMessage = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  color: theme.palette.text.primary,
  lineHeight: 1.5,
}));

export const CodeChip = styled("span")(({ theme }) => ({
  fontFamily: "monospace",
  fontSize: "0.8125rem",
  fontWeight: 600,
  padding: theme.spacing(0.2, 0.6),
  borderRadius: 4,
  backgroundColor: alpha(theme.palette.common.black, 0.35),
  border: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
}));
