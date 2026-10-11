import { styled } from "@mui/material/styles";
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

export const ModeButton = styled(Button)(({ theme }) => ({
  minWidth: 0,
  minHeight: 44,
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  color: theme.palette.text.secondary,
  textTransform: "none",
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
