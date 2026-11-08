import { Box, Button } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const Stepper = styled(Box)(({ theme }) => ({
  position: "relative", display: "grid", gap: theme.spacing(.75), minWidth: 0, width: "max-content", maxWidth: "100%",
  "--quantity-button-size": "56px",
  "@container (max-width: 359px)": { "--quantity-button-size": "44px" },
}));
export const ControlRow = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "var(--quantity-button-size, 56px) minmax(0, calc(5ch + 16px)) var(--quantity-button-size, 56px)",
  gap: theme.spacing(1), alignItems: "start", minWidth: 0,
  fontSize: "calc(1.125rem * var(--sale-font-scale, 1))", fontVariantNumeric: "tabular-nums",
}));
export const StepButton = styled(Button)(({ theme, variant }) => ({
  minWidth: "var(--quantity-button-size, 56px)", width: "var(--quantity-button-size, 56px)", height: 56, minHeight: 56, padding: 0, borderRadius: theme.spacing(1.5),
  "& svg": { width: 28, height: 28 },
  "&:hover": { backgroundColor: variant === "contained" ? theme.palette.primary.dark : alpha(theme.palette.primary.main, .16), boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, .2)}` },
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));
export const InputArea = styled(Box)({
  minWidth: 0, width: "100%",
  "& .MuiOutlinedInput-root": { height: 56 },
  "& .MuiInputBase-input": { boxSizing: "border-box", height: "100%", minHeight: 44, textAlign: "center", fontSize: "calc(1.125rem * var(--sale-font-scale, 1))", fontWeight: 600, padding: "0 8px", appearance: "textfield" },
  "& input::-webkit-inner-spin-button, & input::-webkit-outer-spin-button": { WebkitAppearance: "none", margin: 0 },
});
