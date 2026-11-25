import { Box, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";

export const PriceDisplay = styled(Box)(({ theme }) => ({
  display: "var(--pos-price-display-layout, flex)", flexWrap: "wrap", alignItems: "center", gap: theme.spacing(.5), minWidth: 0,
  "& > span": { gridColumn: 2, gridRow: "1 / -1", alignSelf: "center", display: "inline-flex" },
}));

export const PriceEditor = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 108px) max-content", alignItems: "center",
  columnGap: theme.spacing(.5), rowGap: theme.spacing(.75), width: "100%", maxWidth: 252, minWidth: 0,
}));

export const PriceLabel = styled("label")(({ theme }) => ({
  ...theme.typography.body2, gridColumn: "1 / -1", fontWeight: 600, fontSize: ".875rem",
  color: theme.palette.text.primary, userSelect: "none",
}));

export const PriceActions = styled(Box)(({ theme }) => ({
  display: "flex", alignItems: "center", gap: theme.spacing(.5),
  "& > span": { display: "inline-flex" },
}));

export const PriceAction = styled(IconButton)({ minWidth: 44, minHeight: 44, flexShrink: 0 });
