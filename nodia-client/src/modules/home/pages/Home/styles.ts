import { styled, alpha } from "@mui/material/styles";
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

export const SettingsCard = styled(Link)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";

  return {
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(3),
    borderRadius: Number(theme.shape.borderRadius) * 2,
    backgroundColor: theme.palette.background.paper,
    boxShadow: isDark
      ? "0 2px 8px rgba(0, 0, 0, 0.4)"
      : theme.shadows[2],
    textDecoration: "none",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    height: "100%",
    border: `1px solid ${theme.palette.divider}`,
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: isDark
        ? `0 8px 24px -4px ${alpha(theme.palette.primary.main, 0.35)}`
        : `0 8px 24px -4px ${alpha(theme.palette.primary.main, 0.18)}`,
      borderColor: theme.palette.primary.main,
      "& .card-icon-wrapper": {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        transform: "scale(1.06)",
        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
      },
      "& .card-icon-wrapper svg": {
        transform: "scale(1.05)",
      },
    },
  };
});

export const CardIconWrapper = styled("div")(({ theme }) => {
  const isDark = theme.palette.mode === "dark";

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: Number(theme.shape.borderRadius) * 1.5,
    backgroundColor: isDark
      ? alpha(theme.palette.primary.main, 0.14)
      : alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(2),
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    "& svg": {
      fontSize: 24,
      transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    },
  };
});

export const CardTitle = styled("h3")(({ theme }) => ({
  ...theme.typography.h6,
  fontWeight: 600,
  color: theme.palette.primary.main,
  margin: 0,
  marginBottom: theme.spacing(1),
  "&:last-child": {
    marginBottom: 0,
  },
}));

export const CardDescription = styled("p")(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.palette.text.secondary,
  margin: 0,
  lineHeight: 1.5,
}));
