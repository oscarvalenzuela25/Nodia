import { alpha, styled } from "@mui/material/styles";

export const Page = styled("section")(({ theme }) => ({
  display: "flex",
  flexGrow: 1,
  flexDirection: "column",
  placeContent: "center",
  placeItems: "center",
  gap: theme.spacing(3),
  padding: theme.spacing(4, 2.5, 3),
  color: theme.palette.text.primary,
  [theme.breakpoints.up("md")]: {
    gap: theme.spacing(3.125),
    padding: 0,
  },
}));

export const Hero = styled("div")({
  position: "relative",
});

export const BaseImage = styled("img")({
  position: "relative",
  zIndex: 0,
  width: 170,
});

export const FrameworkImage = styled("img")({
  position: "absolute",
  zIndex: 1,
  top: 34,
  insetInline: 0,
  height: 28,
  margin: "0 auto",
  transform:
    "perspective(2000px) rotateZ(300deg) rotateX(44deg) rotateY(39deg) scale(1.4)",
});

export const ViteImage = styled("img")({
  position: "absolute",
  zIndex: 0,
  top: 107,
  insetInline: 0,
  width: "auto",
  height: 26,
  margin: "0 auto",
  transform:
    "perspective(2000px) rotateZ(300deg) rotateX(40deg) rotateY(39deg) scale(0.8)",
});

export const Title = styled("h1")(({ theme }) => ({
  ...theme.typography.h2,
  margin: 0,
}));

export const CounterButton = styled("button")(({ theme }) => ({
  border: `2px solid ${alpha(theme.palette.primary.main, 0)}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.75, 1.5),
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.text.primary,
  font: "inherit",
  cursor: "pointer",
  transition: theme.transitions.create("border-color"),
  "&:hover": {
    borderColor: theme.palette.primary.main,
  },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const LanguageSection = styled("div")(({ theme }) => ({
  display: "flex",
  width: "min(420px, calc(100% - 2rem))",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

export const LanguageLabel = styled("p")(({ theme }) => ({
  margin: 0,
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(13),
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
}));

export const LanguagePanel = styled("div")(({ theme }) => ({
  display: "grid",
  width: "100%",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: theme.spacing(1),
  padding: theme.spacing(0.875),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
  borderRadius: theme.spacing(2.25),
  background: `linear-gradient(130deg, ${alpha(
    theme.palette.primary.main,
    0.12
  )}, ${alpha(theme.palette.background.paper, 0.02)})`,
  boxShadow: theme.shadows[3],
  backdropFilter: "blur(6px)",
}));

export const LanguageButton = styled("button")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(1.375, 1.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5),
  background: theme.palette.background.default,
  color: theme.palette.text.primary,
  boxShadow: theme.shadows[1],
  cursor: "pointer",
  font: "inherit",
  transition: theme.transitions.create([
    "background-color",
    "border-color",
    "box-shadow",
    "transform",
  ]),
  '&[aria-pressed="true"]': {
    borderColor: alpha(theme.palette.primary.contrastText, 0.6),
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
    color: theme.palette.primary.contrastText,
    boxShadow: theme.shadows[4],
    transform: "translateY(-1px)",
  },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const LanguageShortLabel = styled("span")(({ theme }) => ({
  fontSize: theme.typography.pxToRem(11),
  letterSpacing: "0.09em",
  opacity: 0.8,
}));

export const LanguageText = styled("span")({
  textTransform: "capitalize",
});

export const Tick = styled("div")(({ theme }) => ({
  position: "relative",
  width: "100%",
  "&::before, &::after": {
    position: "absolute",
    top: -4.5,
    border: "5px solid transparent",
    content: '""',
  },
  "&::before": {
    left: 0,
    borderLeftColor: theme.palette.divider,
  },
  "&::after": {
    right: 0,
    borderRightColor: theme.palette.divider,
  },
}));
