import { red } from "@mui/material/colors";
import { alpha, darken, type Theme } from "@mui/material/styles";

export function zeroSalePriceSx(theme: Theme) {
  const tint = theme.palette.mode === "dark"
    ? alpha(darken(red[900], 0.3), 0.12)
    : alpha(red[100], 0.08);

  return { backgroundImage: `linear-gradient(${tint}, ${tint})` };
}
