import { Box, FormControlLabel, Switch } from "@mui/material";
import { styled } from "@mui/material/styles";

export const FormContainer = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2.5),
}));

export const SwitchWrapper = styled(Box)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1, 1.5),
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
  "& .MuiFormControlLabel-label": {
    fontWeight: 600,
    fontSize: "0.875rem",
    color: theme.palette.text.primary,
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

export const ModalActionsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing(2),
  width: "100%",
}));

export const DescriptionBox = styled(Box)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;
  const isDark = theme.palette.mode === "dark";

  return {
    padding: theme.spacing(2),
    borderRadius:
      typeof theme.shape.borderRadius === "number"
        ? theme.shape.borderRadius * 1.5
        : 10,
    backgroundColor: isDark
      ? "rgba(255, 255, 255, 0.02)"
      : "rgba(0, 0, 0, 0.015)",
    border: `1px solid ${borderColor}`,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.75),
  };
});

export const DescriptionHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1),
}));

export const HeaderTitleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

export const HeaderTitle = styled(Box)(({ theme }) => ({
  ...theme.typography.caption,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: theme.palette.primary.main,
}));

export const HeaderSubtitle = styled(Box)(({ theme }) => ({
  ...theme.typography.caption,
  color: theme.palette.text.secondary,
  fontSize: "0.75rem",
}));

export const LanguagesGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: theme.spacing(1.5),
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "1fr 1fr",
  },
}));

export const LanguageFieldContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.5),
}));

export const LanguageLabel = styled("label")(({ theme }) => ({
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: theme.palette.text.secondary,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
}));

export const LanguageBadge = styled("span", {
  shouldForwardProp: (prop) => prop !== "langCode",
})<{ langCode?: string }>(({ theme, langCode }) => {
  const isEs = langCode === "es";
  const bg = isEs ? theme.palette.primary.main : theme.palette.secondary.main;
  const color = isEs
    ? theme.palette.primary.contrastText
    : theme.palette.secondary.contrastText;

  return {
    fontSize: "0.6875rem",
    fontWeight: 700,
    textTransform: "uppercase",
    padding: "2px 6px",
    borderRadius: "4px",
    backgroundColor: bg,
    color: color,
    lineHeight: 1.2,
  };
});

