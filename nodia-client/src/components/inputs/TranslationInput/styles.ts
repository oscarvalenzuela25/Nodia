import { styled } from "@mui/material/styles";
import { Box, Typography, TextField } from "@mui/material";

export const RootContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "fullWidth",
})<{ fullWidth?: boolean }>(({ fullWidth = true }) => ({
  display: "flex",
  flexDirection: "column",
  width: fullWidth ? "100%" : "auto",
}));

export const LabelTypography = styled("label")(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: 600,
  marginBottom: theme.spacing(0.75),
  color: theme.palette.text.primary,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
}));

export const RequiredStar = styled("span")(({ theme }) => ({
  color: theme.palette.error.main,
  fontWeight: 700,
}));

export const TranslationsBox = styled(Box)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;
  const isDark = theme.palette.mode === "dark";

  return {
    marginTop: theme.spacing(1.5),
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
    transition: theme.transitions.create(["all"], {
      duration: theme.transitions.duration.shorter,
    }),
  };
});

export const TranslationsHeader = styled(Box)(({ theme }) => ({
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

export const HeaderTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.caption,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: theme.palette.primary.main,
}));

export const HeaderSubtitle = styled(Typography)(({ theme }) => ({
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

export const StyledTextField = styled(TextField)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    "& .MuiOutlinedInput-root": {
      borderRadius:
        typeof theme.shape.borderRadius === "number"
          ? theme.shape.borderRadius
          : 8,
      backgroundColor: isDark
        ? theme.palette.background.paper
        : theme.palette.background.surface,
      transition: theme.transitions.create(["border-color", "box-shadow"], {
        duration: theme.transitions.duration.shorter,
      }),
      "& fieldset": {
        borderColor: borderColor,
      },
      "&:hover fieldset": {
        borderColor: theme.palette.primary.light,
      },
      "&.Mui-focused fieldset": {
        borderColor: theme.palette.primary.main,
        borderWidth: "1.5px",
      },
    },
    "& .MuiOutlinedInput-input": {
      padding: "10px 14px",
      fontSize: "0.875rem",
      color: theme.palette.text.primary,
      "&::placeholder": {
        color: theme.palette.text.disabled,
        opacity: 1,
      },
    },
  };
});
