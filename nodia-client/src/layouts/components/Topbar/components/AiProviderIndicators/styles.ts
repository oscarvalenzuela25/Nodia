import { styled, type Theme } from "@mui/material/styles";
import { Badge, Button, Stack } from "@mui/material";

export const Indicators = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
  gridColumn: "1 / -1",
  gridRow: 2,
  gap: theme.spacing(0.5),
  [theme.breakpoints.up("sm")]: {
    gridColumn: 2,
    gridRow: 1,
  },
}));

const indicatorStyle = (theme: Theme) => ({
  minWidth: 0,
  minHeight: 44,
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  color: theme.palette.text.secondary,
  textTransform: "none" as const,
});

export const ModeButton = styled(Button)(({ theme }) => indicatorStyle(theme));

export const ModeLabel = styled("span")(({ theme }) => ({
  ...theme.typography.button,
  ...indicatorStyle(theme),
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  borderRadius: theme.shape.borderRadius,
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
}));

export const StatusBadge = styled(Badge)(({ theme }) => ({
  "& .MuiBadge-badge": {
    width: 8,
    height: 8,
    minWidth: 8,
    borderRadius: "50%",
    boxShadow: `0 0 0 2px ${theme.palette.background.default}`,
  },
  "& .MuiBadge-badge:not(.MuiBadge-colorSuccess):not(.MuiBadge-colorError)": {
    backgroundColor: theme.palette.text.disabled,
  },
}));
