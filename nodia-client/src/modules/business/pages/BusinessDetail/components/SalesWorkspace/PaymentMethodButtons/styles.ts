import { Box, Button, Typography } from "@mui/material";
import { alpha, decomposeColor, recomposeColor, rgbToHex, styled } from "@mui/material/styles";
import { mixColor, readableColor } from "../../../../../../../themes/contrast";
import { spaciousCheckout, wideCheckout } from "../styles";

export const MethodLabel = styled(Typography)(({ theme }) => ({
  fontSize: "1rem", fontWeight: 700, marginBottom: theme.spacing(.75),
  [wideCheckout]: { fontSize: "1.25rem" },
  [spaciousCheckout]: { fontSize: "1.375rem", marginBottom: theme.spacing(1) },
}));

export const MethodGrid = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: theme.spacing(.75),
  [spaciousCheckout]: { gap: theme.spacing(1) },
}));

type PaymentTone = "success" | "primary" | "warning" | "info";
const toOpaqueHex = (value: string) => rgbToHex(recomposeColor(decomposeColor(value))).slice(0, 7);

export const MethodButton = styled(Button, { shouldForwardProp: (prop) => prop !== "tone" })<{ tone: PaymentTone }>(({ theme, tone }) => {
  const palette = theme.palette;
  const color = tone === "info" && palette.info.main === palette.primary.main ? palette.secondary : palette[tone];
  const surface = toOpaqueHex(palette.background.paper);
  const accent = toOpaqueHex(color.main);
  const baseFill = mixColor(surface, accent, .09);
  const selectedFill = mixColor(surface, accent, .21);
  const hoverFill = mixColor(surface, accent, .26);
  const ink = readableColor(accent, [baseFill, selectedFill, hoverFill]);
  return {
    minWidth: 0,
    minHeight: 44,
    padding: theme.spacing(.5),
    display: "flex",
    gap: theme.spacing(.5),
    color: ink,
    backgroundColor: baseFill,
    borderColor: alpha(accent, .6),
    fontSize: ".875rem",
    lineHeight: 1.2,
    fontWeight: 700,
    textTransform: "none",
    overflowWrap: "anywhere",
    borderRadius: theme.spacing(1),
    [wideCheckout]: { minHeight: 50, fontSize: "1.125rem" },
    "& > .MuiSvgIcon-root": { flexShrink: 0, fontSize: 16 },
    [spaciousCheckout]: {
      minHeight: 56, fontSize: "1.1875rem", paddingInline: theme.spacing(.25),
      "& > .MuiSvgIcon-root": { fontSize: 18 },
    },
    "&[aria-pressed='true']": { borderColor: ink, backgroundColor: selectedFill },
    "&:hover:not(.Mui-disabled)": { borderColor: ink, backgroundColor: hoverFill },
    "&.Mui-focusVisible": { outline: `2px solid ${ink}`, outlineOffset: 2 },
  };
});
