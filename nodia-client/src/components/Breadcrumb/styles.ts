import { Box, Breadcrumbs as MuiBreadcrumbs } from "@mui/material";
import { styled } from "@mui/material/styles";
import { Link } from "react-router";

export const BreadcrumbRoot = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  marginBottom: theme.spacing(2),
  gap: theme.spacing(2),
  flexWrap: "wrap",
}));

export const StyledBreadcrumbs = styled(MuiBreadcrumbs)(({ theme }) => ({
  "& .MuiBreadcrumbs-separator": {
    color: theme.palette.text.secondary,
    opacity: 0.5,
    margin: theme.spacing(0, 1),
  },
}));

export const BreadcrumbLink = styled(Link)(({ theme }) => ({
  ...theme.typography.body2,
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  color: theme.palette.text.secondary,
  textDecoration: "none",
  transition: "color 0.2s ease-in-out",
  "&:hover": {
    color: theme.palette.primary.main,
    textDecoration: "underline",
  },
}));

export const BreadcrumbCurrent = styled("span")(({ theme }) => ({
  ...theme.typography.body2,
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  fontWeight: 600,
  color: theme.palette.text.primary,
}));
