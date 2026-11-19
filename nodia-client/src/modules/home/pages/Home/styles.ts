import { styled, alpha } from "@mui/material/styles";
import { Link } from "react-router";

export const ContainerPage = styled("section")({
  width: "100%",
  display: "flex",
  flexGrow: 1,
  flexDirection: "column",
});

export const WelcomeMessage = styled("h1")(({ theme }) => ({
  ...theme.typography.h3,
  fontSize: "1.75rem",
  fontWeight: 700,
  letterSpacing: "-0.045em",
  color: theme.palette.text.primary,
  margin: theme.spacing(0, 0, 3),
  padding: theme.spacing(3, 2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  backgroundImage: `linear-gradient(118deg, ${alpha(theme.palette.primary.main, 0.13)}, transparent 75%)`,
  overflowWrap: "anywhere",
  textWrap: "balance",
  [theme.breakpoints.up("sm")]: {
    fontSize: "2.25rem",
    padding: theme.spacing(4),
  },
  [theme.breakpoints.up("md")]: {
    fontSize: "3rem",
    padding: theme.spacing(5, 4),
  },
}));

export const SectionTitle = styled("h2")(({ theme }) => ({
  ...theme.typography.h5,
  fontSize: "1.25rem",
  [theme.breakpoints.up("sm")]: {
    fontSize: "1.5rem",
  },
  fontWeight: 600,
  color: theme.palette.text.primary,
  margin: theme.spacing(0, 0, 2),
  paddingBlockEnd: theme.spacing(1),
  borderBlockEnd: `1px solid ${theme.palette.divider}`,
}));

export const SettingsCard = styled(Link)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(3),
  borderRadius: Number(theme.shape.borderRadius) * 2,
  backgroundColor: theme.palette.background.paper,
  boxShadow: `0 2px 6px ${theme.palette.action.hover}`,
  textDecoration: "none",
  transition: theme.transitions.create("border-color"),
  height: "100%",
  border: `1px solid ${theme.palette.divider}`,
  minWidth: 0,
  overflowWrap: "anywhere",
  "&:hover, &:focus-visible": {
    borderColor: theme.palette.primary.main,
    "& .card-icon-wrapper": {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
    },
  },
  "&:focus-visible": { outline: "2px solid CanvasText", outlineOffset: 2 },
  "&:active": { backgroundColor: theme.palette.background.default },
  [theme.breakpoints.down("sm")]: {
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr)",
    alignItems: "center",
    columnGap: theme.spacing(2),
    padding: theme.spacing(2),
    "& > .card-icon-wrapper": { gridRow: "span 2", margin: 0 },
    "& > h3, & > p": { gridColumn: 2 },
    "& > h3": { marginBottom: 0 },
    "& > h3:last-child": { gridRow: "span 2" },
  },
}));

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
    transition: theme.transitions.create(["background-color", "color"]),
    "& svg": { fontSize: 24 },
  };
});

export const CardTitle = styled("h3")(({ theme }) => ({
  ...theme.typography.h6,
  fontWeight: 600,
  color: theme.palette.text.primary,
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
