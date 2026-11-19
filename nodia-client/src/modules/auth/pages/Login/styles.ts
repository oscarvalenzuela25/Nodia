import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { alpha, styled } from "@mui/material/styles";

export const Page = styled("main")(({ theme }) => ({
  display: "flex",
  minHeight: "100dvh",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(3) },
  [theme.breakpoints.up('md')]: { padding: theme.spacing(4) },
  backgroundColor: theme.palette.background.default,
  backgroundImage: `radial-gradient(ellipse at 50% 0%, ${alpha(theme.palette.primary.main, 0.13)}, transparent 65%)`,
  "@media (max-height: 520px)": { paddingBlockStart: theme.spacing(10) },
  position: "relative",
}));

export const Card = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  maxWidth: 440,
  padding: theme.spacing(3),
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(5) },
  backgroundColor: theme.palette.background.paper,
  borderRadius: 16,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.32 : 0.08)}`,
}));

export const LogoContainer = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing(2),
  userSelect: "none",
}));

export const LogoTitle = styled("span")(({ theme }) => ({
  fontFamily: '"Karmatic Arcade", monospace, sans-serif',
  fontSize: "24px",
  fontWeight: 400,
  letterSpacing: "0.08em",
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.tertiary?.main ?? theme.palette.secondary.main} 100%)`,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  lineHeight: 1.2,
  userSelect: "none",
  display: "inline-block",
}));

export const Title = styled("h1")(({ theme }) => ({
  ...theme.typography.h4,
  fontWeight: 700,
  margin: 0,
  marginBottom: theme.spacing(1),
  color: theme.palette.text.primary,
}));

export const Description = styled("p")(({ theme }) => ({
  ...theme.typography.body1,
  margin: 0,
  marginBottom: theme.spacing(4),
  color: theme.palette.text.secondary,
}));

export const GoogleSignInContainer = styled(Box)({
  display: "flex",
  justifyContent: "center",
  "& iframe": {
    // GIS owns its button theme; mismatched iframe color schemes paint an opaque canvas.
    colorScheme: "light",
  },
});

export const GoogleButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.2),
  fontSize: "1rem",
  fontWeight: 500,
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  textTransform: "none",
  boxShadow: "none",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    boxShadow: "none",
  },
  "& .MuiButton-startIcon": {
    marginRight: theme.spacing(1.5),
  }
}));

export const BackButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(1.2),
  fontSize: "0.95rem",
  fontWeight: 500,
  color: theme.palette.text.secondary,
  textTransform: "none",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
  },
  "& .MuiButton-startIcon": {
    marginRight: theme.spacing(1),
  },
}));
