import { styled } from "@mui/material/styles";
import { Link } from "react-router";

export const ContainerPage = styled("section")(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexGrow: 1,
  flexDirection: "column",
  padding: theme.spacing(4),
  backgroundColor: theme.palette.background.default,
}));

export const WelcomeMessage = styled("h1")(({ theme }) => ({
  ...theme.typography.h3,
  fontWeight: 700,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(6),
  textAlign: "center",
  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.tertiary.main})`,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
}));

export const SectionTitle = styled("h2")(({ theme }) => ({
  ...theme.typography.h5,
  fontWeight: 600,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(3),
}));

export const SettingsCard = styled(Link)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(3),
  borderRadius: Number(theme.shape.borderRadius) * 2,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  textDecoration: "none",
  transition: "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
  height: "100%",
  border: `1px solid ${theme.palette.divider}`,
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: theme.shadows[8],
    borderColor: theme.palette.primary.main,
  },
}));

export const CardTitle = styled("h3")(({ theme }) => ({
  ...theme.typography.h6,
  fontWeight: 600,
  color: theme.palette.primary.main,
  margin: 0,
  marginBottom: theme.spacing(1),
}));

export const CardDescription = styled("p")(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.palette.text.secondary,
  margin: 0,
  lineHeight: 1.5,
}));
