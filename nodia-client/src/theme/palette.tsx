import type { ThemeOptions } from "@mui/material/styles";

type Palette = ThemeOptions["palette"];

export const lightPalette: Palette = {
  mode: "light",
  primary: {
    main: "#19398d",
    contrastText: "#f3f5f9",
  },
  secondary: {
    main: "#0a0a0a",
    contrastText: "#f5f7fb",
  },
  error: {
    main: "#9b0033",
    contrastText: "#ffffff",
  },
  background: {
    default: "#f3f5fb",
    paper: "#ffffff",
  },
  text: {
    primary: "#010101",
    secondary: "#454545",
  },
  divider: "#e3e3e3",
};

export const darkPalette: Palette = {
  mode: "dark",
  primary: {
    main: "#6a8dd8",
    contrastText: "#0a0a0a",
  },
  secondary: {
    main: "#171717",
    contrastText: "#fafafa",
  },
  error: {
    main: "#cd6e7b",
    contrastText: "#fafafa",
  },
  background: {
    default: "#050505",
    paper: "#0a0a0a",
  },
  text: {
    primary: "#fafafa",
    secondary: "#a1a1a1",
  },
  divider: "#282828",
};
