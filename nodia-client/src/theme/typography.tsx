import type { ThemeOptions } from "@mui/material/styles";

type Typography = ThemeOptions["typography"];

const font = '"DM Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const typography: Typography = {
  fontFamily: font,
  fontSize: 14,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  h1: {
    fontFamily: font,
    fontWeight: 300,
    fontSize: "6rem",
    lineHeight: 1.167,
    letterSpacing: "-0.01562em",
  },
  h2: {
    fontFamily: font,
    fontWeight: 300,
    fontSize: "3.75rem",
    lineHeight: 1.2,
    letterSpacing: "-0.00833em",
  },
  h3: {
    fontFamily: font,
    fontWeight: 400,
    fontSize: "3rem",
    lineHeight: 1.167,
    letterSpacing: "0em",
  },
  h4: {
    fontFamily: font,
    fontWeight: 400,
    fontSize: "2.125rem",
    lineHeight: 1.235,
    letterSpacing: "0.00735em",
  },
  h5: {
    fontFamily: font,
    fontWeight: 400,
    fontSize: "1.5rem",
    lineHeight: 1.334,
    letterSpacing: "0em",
  },
  h6: {
    fontFamily: font,
    fontWeight: 500,
    fontSize: "1.25rem",
    lineHeight: 1.6,
    letterSpacing: "0.0075em",
  },
  subtitle1: {
    fontFamily: font,
    fontWeight: 400,
    fontSize: "1rem",
    lineHeight: 1.75,
    letterSpacing: "0.00938em",
  },
  subtitle2: {
    fontFamily: font,
    fontWeight: 500,
    fontSize: "0.875rem",
    lineHeight: 1.57,
    letterSpacing: "0.00714em",
  },
  body1: {
    fontFamily: font,
    fontWeight: 400,
    fontSize: "1rem",
    lineHeight: 1.5,
    letterSpacing: "0.00938em",
  },
  body2: {
    fontFamily: font,
    fontWeight: 400,
    fontSize: "0.875rem",
    lineHeight: 1.43,
    letterSpacing: "0.01071em",
  },
  button: {
    fontFamily: font,
    fontWeight: 500,
    fontSize: "0.875rem",
    lineHeight: 1.75,
    letterSpacing: "0.02857em",
    textTransform: "none",
  },
  caption: {
    fontFamily: font,
    fontWeight: 400,
    fontSize: "0.75rem",
    lineHeight: 1.66,
    letterSpacing: "0.03333em",
  },
  overline: {
    fontFamily: font,
    fontWeight: 400,
    fontSize: "0.75rem",
    lineHeight: 2.66,
    letterSpacing: "0.08333em",
    textTransform: "uppercase",
  },
};

export default typography;
