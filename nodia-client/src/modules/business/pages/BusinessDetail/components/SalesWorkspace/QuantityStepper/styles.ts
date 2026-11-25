import { Box, Button } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const Stepper = styled(Box)({
  position: "relative", minWidth: 0, width: "max-content", maxWidth: "100%",
});
export const ControlRow = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "44px minmax(0, calc(5ch + 12px)) 44px",
  gap: theme.spacing(.5), alignItems: "center", minWidth: 0,
  fontSize: "calc(1.125rem * var(--sale-font-scale, 1))", fontVariantNumeric: "tabular-nums",
}));
export const StepButton = styled(Button)(({ theme, variant }) => ({
  minWidth: 44, width: 44, height: 44, minHeight: 44, padding: 0, borderRadius: theme.spacing(1.5),
  "& svg": { width: 20, height: 20 },
  "&:hover": { backgroundColor: variant === "contained" ? theme.palette.primary.dark : alpha(theme.palette.primary.main, .16), boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, .2)}` },
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));
export const InputArea = styled(Box)({
  minWidth: 0, width: "100%",
  "& .MuiOutlinedInput-root": { height: 44 },
  "& .MuiInputBase-input": { boxSizing: "border-box", height: "100%", minHeight: 44, textAlign: "center", fontSize: "calc(1.125rem * var(--sale-font-scale, 1))", fontWeight: 600, padding: "0 6px", appearance: "textfield" },
  "& input::-webkit-inner-spin-button, & input::-webkit-outer-spin-button": { WebkitAppearance: "none", margin: 0 },
});
