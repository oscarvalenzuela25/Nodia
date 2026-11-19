import Button from "@mui/material/Button";
import { alpha, styled } from "@mui/material/styles";

export const Page = styled("main")(({ theme }) => ({
  display: "grid",
  placeItems: "center",
  minHeight: "100dvh",
  padding: theme.spacing(9, 2, 3),
  textAlign: "center",
  backgroundColor: theme.palette.background.default,
  backgroundImage: `radial-gradient(ellipse at 50% 0%, ${alpha(theme.palette.primary.main, 0.13)}, transparent 65%)`,
  color: theme.palette.text.primary,
  [theme.breakpoints.up("sm")]: { paddingInline: theme.spacing(3) },
  [theme.breakpoints.up("md")]: { paddingInline: theme.spacing(4) },
}));

export const ContentWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(2),
  width: "100%",
  maxWidth: 520,
  minWidth: 0,
  padding: theme.spacing(3, 2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  overflowWrap: "anywhere",
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(4) },
}));

export const Title = styled("h1")(({ theme }) => ({
  ...theme.typography.h5,
  fontWeight: 700,
  margin: 0,
  [theme.breakpoints.up("sm")]: { fontSize: theme.typography.h4.fontSize },
}));

export const Description = styled("p")(({ theme }) => ({
  ...theme.typography.body1,
  margin: 0,
  color: theme.palette.text.secondary,
  lineHeight: 1.6,
}));

export const PrimaryButton = styled(Button)(({ theme }) => ({
  minHeight: 44,
  paddingInline: theme.spacing(3),
  [theme.breakpoints.down("sm")]: { width: "100%" },
})) as typeof Button;
