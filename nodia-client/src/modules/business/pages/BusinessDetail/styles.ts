import { styled, alpha } from "@mui/material/styles";
import { Box, Card, Typography, Tabs as MuiTabs, Tab as MuiTab } from "@mui/material";

export const DetailContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  width: "100%",
  margin: "0 auto",
}));

export const HeaderCard = styled(Card)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";

  return {
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: isDark
      ? "0 4px 20px rgba(0, 0, 0, 0.5)"
      : "0 4px 16px rgba(0, 0, 0, 0.04)",
    backgroundColor: isDark ? "#1a212b" : "#ffffff",
    overflow: "hidden",
  };
});

export const HeaderTopSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3.5, 3.5, 2.5),
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(2.5),
}));

export const BusinessAvatarBox = styled(Box)(({ theme }) => ({
  width: 54,
  height: 54,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: alpha(theme.palette.primary.main, 0.15),
  color: theme.palette.primary.main,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
  flexShrink: 0,
}));

export const HeaderInfoContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(2),
  flex: 1,
  minWidth: 280,
}));

export const HeaderMetaRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(0.75),
}));

export const HeaderActions = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flexWrap: "wrap",
}));

export const TabsWrapper = styled(Box)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(0, 2),
  backgroundColor:
    theme.palette.mode === "dark"
      ? "rgba(0, 0, 0, 0.2)"
      : alpha(theme.palette.grey[100], 0.5),
}));

export const StyledTabs = styled(MuiTabs)(({ theme }) => ({
  minHeight: 48,
  "& .MuiTabs-indicator": {
    height: 3,
    borderRadius: "3px 3px 0 0",
    backgroundColor: theme.palette.primary.main,
  },
}));

export const StyledTab = styled(MuiTab)(({ theme }) => ({
  minHeight: 48,
  textTransform: "none",
  fontWeight: 500,
  fontSize: "0.875rem",
  padding: theme.spacing(1, 2),
  color: theme.palette.text.secondary,
  gap: theme.spacing(1),
  transition: "color 0.2s ease-in-out",
  "&.Mui-selected": {
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
  "&:hover": {
    color: theme.palette.text.primary,
  },
}));

export const StatusPill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active: boolean }>(({ theme, active }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 10px",
  borderRadius: 16,
  fontSize: "0.75rem",
  fontWeight: 600,
  backgroundColor: active
    ? alpha(theme.palette.success.main, 0.15)
    : alpha(theme.palette.error.main, 0.15),
  color: active ? theme.palette.success.main : theme.palette.error.main,
  border: `1px solid ${
    active
      ? alpha(theme.palette.success.main, 0.3)
      : alpha(theme.palette.error.main, 0.3)
  }`,
}));

export const StatusDot = styled("span", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active: boolean }>(({ theme, active }) => ({
  width: 7,
  height: 7,
  borderRadius: "50%",
  backgroundColor: active
    ? theme.palette.success.main
    : theme.palette.error.main,
  boxShadow: active
    ? `0 0 6px ${theme.palette.success.main}`
    : `0 0 6px ${theme.palette.error.main}`,
}));

export const StockDot = styled("span", {
  shouldForwardProp: (prop) => prop !== "status",
})<{ status: "normal" | "low" | "out" }>(({ theme, status }) => {
  const color =
    status === "normal"
      ? theme.palette.success.main
      : status === "low"
      ? theme.palette.warning.main
      : theme.palette.error.main;

  return {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: color,
    boxShadow: `0 0 6px ${color}`,
  };
});

// KPI Cards for Overview
export const KpiCard = styled(Card)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";

  return {
    padding: theme.spacing(2.5),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    backgroundColor: isDark ? "#1a212b" : "#ffffff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
    transition: "transform 0.2s ease-in-out, border-color 0.2s ease-in-out",
    "&:hover": {
      transform: "translateY(-2px)",
      borderColor: theme.palette.primary.main,
    },
  };
});

export const KpiTop = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: theme.spacing(1),
}));

export const KpiLabel = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: theme.palette.text.secondary,
  textTransform: "uppercase",
}));

export const KpiTitle = styled(Typography)(({ theme }) => ({
  fontSize: "1.25rem",
  fontWeight: 600,
  lineHeight: 1.4,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5),
}));

export const KpiValue = styled(Box)(({ theme }) => ({
  ...theme.typography.h4,
  fontWeight: 700,
  color: theme.palette.text.primary,
  display: "flex",
  alignItems: "baseline",
  gap: theme.spacing(1),
  margin: theme.spacing(0.5, 0),
}));

export const KpiFooter = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingTop: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
  marginTop: theme.spacing(2),
  ...theme.typography.caption,
  color: theme.palette.text.secondary,
}));

// Section and Widget Cards
export const SectionCard = styled(Card)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";

  return {
    padding: theme.spacing(3),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    backgroundColor: isDark ? "#1a212b" : "#ffffff",
  };
});

export const SectionHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: theme.spacing(2.5),
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
}));

export const SectionTitle = styled(Box)(({ theme }) => ({
  ...theme.typography.h6,
  fontSize: "1.25rem",
  fontWeight: 600,
  color: theme.palette.text.primary,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

export const ScrollablePanelContent = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  const thumbColor = isDark
    ? alpha("#ffffff", 0.2)
    : alpha("#000000", 0.2);
  const thumbHoverColor = isDark
    ? alpha("#ffffff", 0.35)
    : alpha("#000000", 0.35);

  return {
    maxHeight: 490,
    overflowY: "auto",
    overflowX: "hidden",
    scrollbarWidth: "thin",
    scrollbarColor: `${thumbColor} transparent`,
    "&::-webkit-scrollbar": {
      width: 6,
      height: 6,
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent !important",
    },
    "&::-webkit-scrollbar-thumb": {
      borderRadius: 9999,
      backgroundColor: thumbColor,
      "&:hover": {
        backgroundColor: thumbHoverColor,
      },
    },
    "&::-webkit-scrollbar-button": {
      display: "none !important",
      width: 0,
      height: 0,
    },
  };
});

// Dropzone for Bulk Import
export const DropzoneBox = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";

  return {
    padding: theme.spacing(4, 2),
    borderRadius: 12,
    border: `2px dashed ${theme.palette.divider}`,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "#fafafa",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s, background-color 0.2s",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      backgroundColor: isDark
        ? alpha(theme.palette.primary.main, 0.04)
        : alpha(theme.palette.primary.main, 0.02),
    },
  };
});

export const ErrorBadge = styled(Box)(({ theme }) => ({
  width: 12,
  height: 12,
  borderRadius: "50%",
  backgroundColor: theme.palette.error.main,
  boxShadow: `0 0 8px ${theme.palette.error.main}`,
  flexShrink: 0,
}));

export const ValidBadge = styled(Box)(({ theme }) => ({
  width: 12,
  height: 12,
  borderRadius: "50%",
  backgroundColor: theme.palette.success.main,
  boxShadow: `0 0 8px ${theme.palette.success.main}`,
  flexShrink: 0,
}));
