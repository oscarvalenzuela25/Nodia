import { Box, Button } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const Stepper = styled(Box)({
  "--step-size": "var(--pos-line-control-size, 44px)",
  "--step-font-size": "calc(.9375rem * var(--sale-font-scale, 1))",
  position: "relative", minWidth: 0, width: "max-content", maxWidth: "100%",
});
export const ControlRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "var(--step-size) minmax(0, calc(var(--pos-quantity-chars) * 1ch + 8px)) var(--step-size)",
  gap: theme.spacing(.25), alignItems: "center", minWidth: 0,
  fontSize: "var(--step-font-size)", fontVariantNumeric: "tabular-nums",
}));
export const StepButton = styled(Button)(({ theme, variant }) => {
  const increment = variant === "contained";
  return {
    minWidth: "var(--step-size)", width: "var(--step-size)", height: "var(--step-size)", minHeight: 0,
    padding: 0, borderRadius: theme.spacing(1), boxShadow: "none",
    color: increment ? theme.palette.primary.main : theme.palette.text.secondary,
    backgroundColor: increment ? alpha(theme.palette.primary.main, .16) : alpha(theme.palette.text.primary, .04),
    border: `1px solid ${increment ? alpha(theme.palette.primary.main, .55) : alpha(theme.palette.text.secondary, .45)}`,
    "& svg": { width: 18, height: 18 },
    "&:hover": { backgroundColor: alpha(theme.palette.primary.main, increment ? .24 : .08), boxShadow: "none" },
    "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
    "&.Mui-disabled": { borderColor: theme.palette.divider },
  };
});
export const InputArea = styled(Box)({
  minWidth: 0, width: "100%",
  "& .MuiOutlinedInput-root": {
    height: "var(--step-size)", backgroundColor: "transparent",
    "&:not(:hover):not(.Mui-focused):not(.Mui-error) fieldset": { borderColor: "transparent" },
  },
  "& .MuiOutlinedInput-input": {
    boxSizing: "border-box", width: "100%", height: "100%", textAlign: "center",
    fontSize: "var(--step-font-size)", fontVariantNumeric: "tabular-nums", fontWeight: 700, padding: "0 4px",
  },
});
