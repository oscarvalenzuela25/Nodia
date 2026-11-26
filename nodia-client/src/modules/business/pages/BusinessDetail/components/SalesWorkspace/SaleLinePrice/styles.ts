import { Box, Button, IconButton } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const PriceDisplay = styled(Box)(({ theme }) => ({
  display: "var(--pos-price-display-layout, flex)", flexWrap: "wrap", alignItems: "center", gap: theme.spacing(.5), minWidth: 0,
  "& > span": { gridColumn: 2, gridRow: "1 / -1", alignSelf: "center", display: "inline-flex" },
}));

export const PriceEditor = styled(Box)(({ theme }) => ({
  gridArea: "editor",
  minWidth: 0,
  display: "grid",
  alignItems: "end",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(1),
  padding: theme.spacing(1.25),
  border: `1px solid ${alpha(theme.palette.primary.main, .32)}`,
  borderRadius: theme.spacing(1.25),
  backgroundColor: theme.palette.background.paper,
  "@container (min-width: 42rem)": {
    "[data-enlarged='false'] &": { gridTemplateColumns: "minmax(0, 9rem) minmax(0, 1fr)" },
  },
}));

export const PriceActions = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(.75),
  minWidth: 0,
  "@container (max-width: 22rem)": {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)",
    "& > :first-of-type": { gridColumn: "1 / -1" },
  },
}));

export const PriceSaveAction = styled(Button)(({ theme }) => ({
  minWidth: 0,
  minHeight: 44,
  paddingInline: theme.spacing(1.25),
  lineHeight: 1.3,
  overflowWrap: "anywhere",
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

export const EditPriceAction = styled(IconButton)({ minWidth: 44, minHeight: 44, flexShrink: 0 });
