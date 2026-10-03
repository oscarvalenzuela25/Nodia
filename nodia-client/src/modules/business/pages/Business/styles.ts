import { styled } from "@mui/material/styles";
import { Box, Card, Typography, FormControlLabel, Switch } from "@mui/material";

export const PageHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
}));

export const HeaderTopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(1),
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "stretch",
    "& > button": {
      width: "100%",
    },
  },
}));

export const PageTitleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

export const PageTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h4,
  fontSize: "1.5rem",
  [theme.breakpoints.up("sm")]: {
    fontSize: "1.875rem",
  },
  [theme.breakpoints.up("md")]: {
    fontSize: "2.125rem",
  },
  color: theme.palette.text.primary,
  fontWeight: 700,
}));

export const PageSubtitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.text.secondary,
  maxWidth: "680px",
  lineHeight: 1.6,
}));

export const FilterBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "stretch",
    "& > *": {
      width: "100%",
    },
  },
}));

export const FilterActions = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  flexWrap: "wrap",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    "& > *": {
      width: "100%",
    },
    "& .MuiToggleButtonGroup-root": {
      width: "100%",
      display: "flex",
      "& .MuiToggleButton-root": {
        flex: 1,
      },
    },
  },
}));

export const SwitchWrapper = styled(Box)(({ theme }) => {
  const borderColor = theme.palette.divider;

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(0.5, 1.5),
    minHeight: 38,
    boxSizing: "border-box",
    borderRadius:
      typeof theme.shape.borderRadius === "number"
        ? theme.shape.borderRadius * 1.5
        : 8,
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.03)"
        : "rgba(0, 0, 0, 0.02)",
    border: `1px solid ${borderColor}`,
  };
});

export const StyledFormControlLabel = styled(FormControlLabel)(({ theme }) => ({
  margin: 0,
  width: "100%",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  "& .MuiFormControlLabel-label": {
    fontWeight: 600,
    fontSize: "0.875rem",
    color: theme.palette.text.primary,
    whiteSpace: "nowrap",
  },
}));

export const StyledSwitch = styled(Switch)(({ theme }) => ({
  "& .MuiSwitch-switchBase.Mui-checked": {
    color: theme.palette.success.main,
    "&:hover": {
      backgroundColor: "rgba(56, 142, 60, 0.08)",
    },
  },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
    backgroundColor: theme.palette.success.main,
  },
}));

export const CardsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(1, 1fr)",
  gap: theme.spacing(3),
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "repeat(2, 1fr)",
  },
  [theme.breakpoints.up("md")]: {
    gridTemplateColumns: "repeat(3, 1fr)",
  },
}));

export const BusinessCard = styled(Card)(({ theme }) => {
  const borderColor = theme.palette.divider;

  return {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: theme.spacing(2.5),
    borderRadius: 12,
    border: `1px solid ${borderColor}`,
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 2px 8px rgba(0, 0, 0, 0.4)"
        : "0 2px 10px rgba(0, 0, 0, 0.04)",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.02)"
        : "#ffffff",
    "&:hover": {
      transform: "translateY(-3px)",
      boxShadow:
        theme.palette.mode === "dark"
          ? "0 8px 24px rgba(0, 0, 0, 0.6)"
          : "0 8px 24px rgba(0, 0, 0, 0.08)",
      borderColor: theme.palette.primary.main,
    },
  };
});

export const CardHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
}));

export const TitleAndStatus = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.25),
  minWidth: 0,
}));

export const StatusDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active: boolean }>(({ theme, active }) => ({
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
  backgroundColor: active
    ? theme.palette.success.main
    : theme.palette.error.main,
  boxShadow: active
    ? "0 0 8px rgba(46, 125, 50, 0.5)"
    : "0 0 8px rgba(211, 47, 47, 0.5)",
}));

export const BusinessName = styled(Typography)(({ theme }) => ({
  ...theme.typography.h6,
  fontWeight: 600,
  color: theme.palette.text.primary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

export const DescriptionLine = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.palette.text.secondary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  marginBottom: theme.spacing(2),
  cursor: "default",
}));

export const ChipsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2.5),
}));

export const CardFooter = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingTop: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
  marginTop: "auto",
}));

export const EmptyStateContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(8, 3),
  textAlign: "center",
  borderRadius: 12,
  border: `1px dashed ${theme.palette.divider}`,
  backgroundColor:
    theme.palette.mode === "dark"
      ? "rgba(255, 255, 255, 0.01)"
      : "rgba(0, 0, 0, 0.01)",
  gap: theme.spacing(2),
}));
