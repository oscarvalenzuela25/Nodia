import { Box, ButtonBase } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";

export const FilterTrigger = styled(ButtonBase, {
  shouldForwardProp: (prop) => prop !== "hasActiveFilters",
})<{ hasActiveFilters?: boolean }>(({ theme, hasActiveFilters }) => {
  const defaultBorder = theme.palette.border?.default ?? theme.palette.divider;

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 2),
    borderRadius: 24,
    fontSize: "0.875rem",
    fontWeight: 600,
    lineHeight: 1.5,
    cursor: "pointer",
    backgroundColor: hasActiveFilters
      ? alpha(theme.palette.primary.main, 0.12)
      : theme.palette.background.paper,
    color: hasActiveFilters
      ? theme.palette.primary.main
      : theme.palette.text.primary,
    border: `1.5px solid ${
      hasActiveFilters ? theme.palette.primary.main : defaultBorder
    }`,
    boxShadow:
      theme.palette.mode === "dark"
        ? `0 2px 8px ${alpha(theme.palette.common.black, 0.4)}`
        : `0 2px 6px ${alpha(theme.palette.primary.main, 0.06)}`,
    transition: theme.transitions.create(
      ["background-color", "border-color", "box-shadow", "transform", "color"],
      { duration: theme.transitions.duration.shorter }
    ),
    "&:hover": {
      transform: "translateY(-1px)",
      borderColor: theme.palette.primary.main,
      backgroundColor: alpha(
        theme.palette.primary.main,
        theme.palette.mode === "dark" ? 0.2 : 0.08
      ),
      boxShadow:
        theme.palette.mode === "dark"
          ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
          : `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
    },
    "&:active": {
      transform: "translateY(0px)",
    },
  };
});

export const FilterBadge = styled("span")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "20px",
  height: "20px",
  padding: "0 6px",
  borderRadius: "10px",
  fontSize: "0.75rem",
  fontWeight: 700,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  marginLeft: "2px",
}));

export const FilterActionsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  gap: theme.spacing(2),
}));

export const FilterRightActions = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2), // 16px
}));
