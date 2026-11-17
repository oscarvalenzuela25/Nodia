import { Box, Button, IconButton, Stack, styled } from "@mui/material";

export const Content = styled(Stack)(({ theme }) => ({ gap: theme.spacing(2), minWidth: 0 }));
export const Result = styled(Box)(({ theme }) => ({
  minWidth: 0, padding: theme.spacing(2), borderRadius: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`, overflowWrap: "anywhere",
}));
export const Actions = styled(Stack)(({ theme }) => ({
  width: "100%", flexDirection: "column", gap: theme.spacing(1),
  [theme.breakpoints.up("sm")]: { flexDirection: "row", justifyContent: "flex-end" },
}));
export const ActionButton = styled(Button)(({ theme }) => ({
  minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" },
}));
export const DivideButton = styled(IconButton)({ width: 44, height: 44, flexShrink: 0 });
