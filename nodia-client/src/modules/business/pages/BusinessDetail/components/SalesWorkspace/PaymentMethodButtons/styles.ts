import { Box, Button, Typography } from "@mui/material";
import { decomposeColor, recomposeColor, rgbToHex, styled } from "@mui/material/styles";
import { mixColor, readableColor, readableForeground } from "../../../../../../../themes/contrast";
import { spaciousCheckout, wideCheckout } from "../styles";

export const MethodLabel = styled(Typography)(({ theme }) => ({
  fontSize: "1.25rem", fontWeight: 700, marginBottom: theme.spacing(1.25),
  [spaciousCheckout]: { fontSize: "1.5rem" },
}));

export const MethodGrid = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: theme.spacing(1.25),
  [wideCheckout]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  [spaciousCheckout]: { gap: theme.spacing(1.5) },
}));

export const MethodName = styled("span")({ gridArea: "name", minWidth: 0, maxWidth: "100%" });

export const MethodSelectionMark = styled("span")(({ theme }) => ({
  gridArea: "selection", minWidth: 0, maxWidth: "100%", display: "flex", flexWrap: "wrap",
  alignItems: "center", justifyContent: "inherit", gap: theme.spacing(.5), fontSize: "1rem", lineHeight: 1.25,
  "& svg": { flexShrink: 0, fontSize: "1.125rem" },
}));

type PaymentTone = "success" | "primary" | "warning" | "info";
const toOpaqueHex = (value: string) => rgbToHex(recomposeColor(decomposeColor(value))).slice(0, 7);

export const MethodButton = styled(Button, { shouldForwardProp: (prop) => prop !== "tone" })<{ tone: PaymentTone }>(({ theme, tone }) => {
  const palette = theme.palette;
  const color = tone === "info" && palette.info.main === palette.primary.main ? palette.secondary : palette[tone];
  const surface = toOpaqueHex(palette.background.paper);
  const accent = toOpaqueHex(color.main);
  const baseFill = mixColor(surface, accent, .09);
  const hoverFill = mixColor(surface, accent, .18);
  const accentInk = readableColor(accent, [surface, baseFill, hoverFill]);
  const ink = readableColor(toOpaqueHex(palette.text.primary), [baseFill, hoverFill]);
  const selectedInk = readableForeground(accent);
  const selectedFill = readableColor(accent, [selectedInk], 7.1);
  return {
    minWidth: 0,
    minHeight: 68,
    padding: theme.spacing(1, 1.5),
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gridTemplateAreas: '"icon name" "icon selection"',
    justifyContent: "start",
    alignContent: "center",
    gap: theme.spacing(0, 1),
    textAlign: "start",
    color: ink,
    backgroundColor: baseFill,
    border: `2px solid ${accentInk}`,
    fontSize: "1.125rem",
    lineHeight: 1.25,
    fontWeight: 700,
    textTransform: "none",
    overflowWrap: "anywhere",
    borderRadius: theme.spacing(1),
    // Keep the foreground, fill, and border in sync when the selection changes.
    transition: theme.transitions.create("box-shadow"),
    "& > .payment-method-icon": { gridArea: "icon", alignSelf: "center", color: accentInk, fontSize: "1.75rem" },
    [wideCheckout]: {
      minHeight: 104, padding: theme.spacing(1, .75), gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateAreas: '"icon" "name" "selection"', gridTemplateRows: "auto auto minmax(1.25rem, auto)",
      justifyItems: "center", justifyContent: "center", textAlign: "center", rowGap: theme.spacing(.5),
    },
    [spaciousCheckout]: {
      minHeight: 112, fontSize: "1.25rem",
      "& > .payment-method-icon": { fontSize: "2rem" },
    },
    "&.Mui-disabled": { opacity: .65 },
    "&:hover:not(.Mui-disabled)": { borderColor: ink, backgroundColor: hoverFill },
    "&[aria-pressed='true']": {
      color: selectedInk, borderColor: selectedInk, backgroundColor: selectedFill,
      "& > .payment-method-icon": { color: "inherit" },
      "&:hover:not(.Mui-disabled)": {
        backgroundColor: selectedFill, borderColor: selectedInk, boxShadow: `inset 0 0 0 1px ${selectedInk}`,
      },
    },
    "&.Mui-focusVisible": { outline: `3px solid ${palette.text.primary}`, outlineOffset: 2, zIndex: 1 },
  };
});
