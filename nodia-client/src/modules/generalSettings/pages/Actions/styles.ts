import { styled, alpha } from "@mui/material/styles";
import { Box, Typography, Chip } from "@mui/material";

export const PageHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
}));

export const PageTitleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

export const PageTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
}));

export const PageSubtitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.text.secondary,
  maxWidth: "680px",
  lineHeight: 1.6,
}));

export const FilterRow = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
}));

export const ActiveFilters = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(3),
}));

export const TableTopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: theme.spacing(2.5),
  gap: theme.spacing(2),
  flexWrap: "wrap",
}));

export const StyledTableContainer = styled(Box)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    borderRadius:
      typeof theme.shape.borderRadius === "number"
        ? theme.shape.borderRadius * 2
        : 16,
    overflow: "hidden",
    boxShadow: theme.shadows[2],
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${borderColor}`,
  };
});

export const KeyBadge = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    display: "inline-flex",
    alignItems: "center",
    fontFamily: "monospace",
    fontSize: "0.8125rem",
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: "6px",
    backgroundColor: isDark
      ? alpha(theme.palette.secondary.main, 0.15)
      : alpha(theme.palette.secondary.main, 0.08),
    color: isDark ? theme.palette.secondary.light : theme.palette.secondary.dark,
    border: `1px solid ${alpha(theme.palette.secondary.main, 0.25)}`,
    letterSpacing: "0.2px",
  };
});

export const ModuleTag = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "hasModule" && prop !== "moduleKey",
})<{ hasModule?: boolean; moduleKey?: string | null }>(
  ({ theme, hasModule = true, moduleKey }) => {
    const isDark = theme.palette.mode === "dark";

    if (!hasModule || !moduleKey) {
      return {
        fontSize: "0.75rem",
        fontStyle: "italic",
        height: "24px",
        borderRadius: "6px",
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.04)",
        color: theme.palette.text.disabled,
        border: `1px dashed ${
          theme.palette.border?.default ?? theme.palette.divider
        }`,
      };
    }

    let mainColor = theme.palette.primary.main;
    if (moduleKey === "users") {
      mainColor = theme.palette.secondary.main;
    } else if (moduleKey === "settings") {
      mainColor = theme.palette.tertiary?.main ?? theme.palette.warning.main;
    } else if (moduleKey === "reports" || moduleKey === "auth") {
      mainColor = theme.palette.info.main;
    }

    const bg = isDark ? alpha(mainColor, 0.16) : alpha(mainColor, 0.08);
    const text = isDark ? alpha(mainColor, 0.95) : mainColor;
    const border = alpha(mainColor, 0.28);

    return {
      fontSize: "0.75rem",
      fontWeight: 600,
      height: "24px",
      borderRadius: "6px",
      backgroundColor: bg,
      color: text,
      border: `1px solid ${border}`,
      "& .MuiChip-label": {
        paddingLeft: "8px",
        paddingRight: "8px",
      },
    };
  }
);

export const DescriptionTypography = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  color: theme.palette.text.secondary,
  maxWidth: "340px",
  lineHeight: 1.5,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
}));
