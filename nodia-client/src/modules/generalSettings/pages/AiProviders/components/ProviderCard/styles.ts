import { styled, alpha } from "@mui/material/styles";
import { Box, Paper, Typography } from "@mui/material";

export const CardContainer = styled(Paper)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  padding: theme.spacing(4), // 32px according to AGENTS.md guideline!
  borderRadius: Number(theme.shape.borderRadius) * 2,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.palette.mode === "dark"
    ? "0 4px 20px 0 rgba(0, 0, 0, 0.4)"
    : "0 4px 20px 0 rgba(0, 0, 0, 0.05)",
  transition: theme.transitions.create(["box-shadow", "border-color"], {
    duration: theme.transitions.duration.shorter,
  }),
  "&:hover": {
    borderColor: alpha(theme.palette.primary.main, 0.4),
  },
}));

export const CardHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  flexWrap: "wrap",
}));

export const ProviderInfo = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
}));

export const IconBox = styled(Box)(({ theme }) => ({
  width: 48,
  height: 48,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
}));

export const TitleBox = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  gap: 2,
}));

export const ProviderName = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: "1.25rem",
  color: theme.palette.text.primary,
}));

export const TagRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flexWrap: "wrap",
}));

export const SubtitleTag = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  color: theme.palette.text.secondary,
  fontWeight: 500,
}));

export const StatusPill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "statusType",
})<{ statusType: "healthy" | "expired" | "degraded" | "unconfigured" }>(({ theme, statusType }) => {
  let mainColor = theme.palette.success.main;
  if (statusType === "expired" || statusType === "degraded") {
    mainColor = "#f59e0b";
  } else if (statusType === "unconfigured") {
    mainColor = theme.palette.text.disabled;
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: 9999,
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    backgroundColor: alpha(mainColor, 0.12),
    color: mainColor,
    border: `1px solid ${alpha(mainColor, 0.3)}`,
  };
});

export const StatusDot = styled("span", {
  shouldForwardProp: (prop) => prop !== "color",
})<{ color: string }>(({ color }) => ({
  width: 7,
  height: 7,
  borderRadius: "50%",
  backgroundColor: color,
  boxShadow: `0 0 6px ${color}`,
}));

export const MetricsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  backgroundColor: alpha(theme.palette.background.default, 0.6),
  border: `1px solid ${theme.palette.divider}`,
}));

export const MetricBlock = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  gap: 4,
}));

export const MetricLabel = styled(Typography)(({ theme }) => ({
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
}));

export const MetricValue = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  fontSize: "0.875rem",
  fontWeight: 700,
  color: theme.palette.text.primary,
}));

export const FeatureSection = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
}));

export const FeatureRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1.25, 1.75),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.background.default, 0.4),
  border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
  fontSize: "0.8125rem",
}));

export const FeatureLabel = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
  fontWeight: 500,
}));

export const FeatureValue = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: "0.8125rem",
  color: theme.palette.text.primary,
}));

export const DetailInsetBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.background.default, 0.7),
  border: `1px solid ${theme.palette.divider}`,
}));

export const CodeBadge = styled("span")(({ theme }) => ({
  fontFamily: "monospace",
  fontSize: "0.75rem",
  padding: theme.spacing(0.2, 0.6),
  borderRadius: 4,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
}));

export const CardActionsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  marginTop: "auto",
}));

export const SecondaryActionsGroup = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));
