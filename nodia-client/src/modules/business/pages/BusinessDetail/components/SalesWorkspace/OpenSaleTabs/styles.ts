import { Box, Button } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const TabStrip = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 135px), 1fr))",
  gap: theme.spacing(1),
  minWidth: 0,
  "&[aria-orientation='vertical']": { gridTemplateColumns: "minmax(0, 1fr)" },
}));
export const SaleTab = styled(Box, { shouldForwardProp: (prop) => prop !== "selected" })<{ selected: boolean }>(({ theme, selected }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0,
  "--sale-close-size": "44px",
  border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`, borderRadius: theme.spacing(1.5),
  backgroundColor: selected ? alpha(theme.palette.primary.main, .12) : theme.palette.background.paper,
}));
export const SaleButton = styled(Button)(({ theme }) => ({
  gridArea: "1 / 1", minHeight: 52, minWidth: 0, textTransform: "none", borderRadius: "inherit",
  paddingBlock: theme.spacing(.75), paddingInline: `${theme.spacing(1.25)} var(--sale-close-size)`, gap: theme.spacing(.5),
  justifyContent: "flex-start", textAlign: "start", color: theme.palette.text.primary,
  overflowWrap: "anywhere",
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
}));
