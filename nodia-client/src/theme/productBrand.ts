import { styled, type CSSObject, type Theme } from "@mui/material/styles";

export const productBrandStyle = ({ theme }: { theme: Theme }): CSSObject => {
  const { mode, primary, tertiary, secondary } = theme.palette;
  const accent = tertiary ?? secondary;
  const gradientEnd = mode === "light" ? accent.dark : accent.main;

  return {
    fontFamily: '"Karmatic Arcade", monospace, sans-serif',
    fontWeight: 400,
    fontSize: "2.125rem",
    letterSpacing: 0,
    lineHeight: 1.25,
    textTransform: "none",
    margin: 0,
    display: "inline-block",
    width: "fit-content",
    maxWidth: "100%",
    color: primary.main,
    "@supports ((background-clip: text) or (-webkit-background-clip: text))": {
      backgroundImage: `linear-gradient(135deg, ${primary.main} 0%, ${gradientEnd} 100%)`,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
    "@media (forced-colors: active)": {
      color: "CanvasText",
      backgroundImage: "none",
      WebkitTextFillColor: "currentColor",
    },
    [theme.breakpoints.down("sm")]: { fontSize: "1.5rem" },
  };
};

export const ProductHeading = styled("h1")(productBrandStyle);
