import { Box, Button } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const TabStrip = styled(Box)(({ theme }) => ({
  display: "flex", flexWrap: "wrap", gap: theme.spacing(1), minWidth: 0, maxWidth: "100%", padding: theme.spacing(.5, 0),
}));
export const SaleTab = styled(Box, { shouldForwardProp: (prop) => prop !== "selected" })<{ selected: boolean }>(({ theme, selected }) => ({
  display: "flex", alignItems: "center", flexShrink: 0, minWidth: 180, maxWidth: 300,
  border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`, borderRadius: theme.spacing(1.5),
  backgroundColor: selected ? alpha(theme.palette.primary.main, .12) : theme.palette.background.paper,
  [theme.breakpoints.down("sm")]: { minWidth: 160, maxWidth: 260 },
}));
export const SaleButton = styled(Button)(({ theme }) => ({
  minHeight: 64, minWidth: 136, maxWidth: 252, textTransform: "none", padding: theme.spacing(1, 1.5),
  gap: theme.spacing(1), justifyContent: "flex-start", textAlign: "left", color: theme.palette.text.primary,
  [theme.breakpoints.down("sm")]: { minHeight: 56, minWidth: 116, maxWidth: 212 },
}));
