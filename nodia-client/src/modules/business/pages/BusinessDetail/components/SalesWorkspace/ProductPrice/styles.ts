import { Box, Chip, Typography } from "@mui/material";
import { darken, getContrastRatio, styled, type Theme } from "@mui/material/styles";

const offerInk = (theme: Theme) => {
  const tones = theme.palette.mode === "dark"
    ? [theme.palette.warning.light, theme.palette.warning.main, theme.palette.warning.dark]
    : [darken(theme.palette.warning.dark, .25), theme.palette.warning.dark];
  return tones.find((color) => getContrastRatio(color, theme.palette.background.paper) >= 4.5) ?? theme.palette.text.primary;
};

export const Price = styled(Box)(({ theme }) => ({ display: "grid", justifyItems: "start", gap: theme.spacing(.5), minWidth: 0, overflowWrap: "anywhere" }));
export const Amount = styled(Typography, { shouldForwardProp: (prop) => prop !== "onOffer" })<{ onOffer: boolean }>(({ theme, onOffer }) => ({
  color: onOffer ? offerInk(theme) : theme.palette.text.primary, fontWeight: 700, fontSize: "calc(1.125rem * var(--sale-font-scale, 1))", lineHeight: 1.3,
}));
export const OfferChip = styled(Chip)(({ theme }) => ({ color: offerInk(theme), borderColor: offerInk(theme), fontWeight: 700, maxWidth: "100%" }));
export const RegularAmount = styled(Typography)(({ theme }) => ({ color: theme.palette.text.secondary, lineHeight: 1.4, fontSize: "calc(.875rem * var(--sale-font-scale, 1))" }));
