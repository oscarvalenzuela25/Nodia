import type { ThemeOptions } from "@mui/material/styles";

type Breakpoints = ThemeOptions["breakpoints"];

const breakpoints: Breakpoints = {
  values: {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
  },
  unit: "px",
  step: 5,
};

export default breakpoints;
