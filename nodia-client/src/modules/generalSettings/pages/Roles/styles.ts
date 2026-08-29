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

export const RoleInfo = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
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
      ? alpha(theme.palette.primary.main, 0.15)
      : alpha(theme.palette.primary.main, 0.08),
    color: isDark ? theme.palette.primary.light : theme.palette.primary.dark,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
    letterSpacing: "0.2px",
  };
});

export const ActionsWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  flexWrap: "wrap",
}));

export const ActionTag = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "category",
})<{ category?: string }>(({ theme, category }) => {
  const isDark = theme.palette.mode === "dark";

  let mainColor = theme.palette.primary.main;
  let bg = isDark ? alpha(mainColor, 0.16) : alpha(mainColor, 0.08);
  let text = isDark ? theme.palette.primary.light : theme.palette.primary.dark;
  let border = alpha(mainColor, 0.25);

  if (category === "users") {
    mainColor = theme.palette.secondary.main;
    bg = isDark ? alpha(mainColor, 0.16) : alpha(mainColor, 0.08);
    text = isDark ? theme.palette.secondary.light : theme.palette.secondary.dark;
    border = alpha(mainColor, 0.25);
  } else if (category === "settings") {
    mainColor = theme.palette.tertiary?.main ?? theme.palette.warning.main;
    bg = isDark ? alpha(mainColor, 0.16) : alpha(mainColor, 0.08);
    text = isDark
      ? theme.palette.tertiary?.light ?? theme.palette.warning.light
      : theme.palette.tertiary?.dark ?? theme.palette.warning.dark;
    border = alpha(mainColor, 0.25);
  } else if (category === "audit" || category === "reports") {
    mainColor = theme.palette.info.main;
    bg = isDark ? alpha(mainColor, 0.16) : alpha(mainColor, 0.08);
    text = isDark ? theme.palette.info.light : theme.palette.info.dark;
    border = alpha(mainColor, 0.25);
  }

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
});

export const MoreActionsChip = styled(Chip)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    fontSize: "0.75rem",
    fontWeight: 700,
    height: "24px",
    borderRadius: "6px",
    backgroundColor: isDark
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.06)",
    color: theme.palette.text.secondary,
    border: `1px solid ${theme.palette.border?.default ?? theme.palette.divider}`,
    cursor: "pointer",
    transition: theme.transitions.create(["background-color", "color"], {
      duration: theme.transitions.duration.shorter,
    }),
    "&:hover": {
      backgroundColor: isDark
        ? "rgba(255, 255, 255, 0.14)"
        : "rgba(0, 0, 0, 0.1)",
      color: theme.palette.text.primary,
    },
  };
});
