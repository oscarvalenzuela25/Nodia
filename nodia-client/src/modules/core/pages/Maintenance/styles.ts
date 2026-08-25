import { styled } from "@mui/material/styles";
import { Link } from "react-router";

export const Page = styled("main")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(2),
  padding: theme.spacing(4),
  color: theme.palette.text.primary,
}));

export const Title = styled("h1")(({ theme }) => ({
  ...theme.typography.h3,
  margin: 0,
}));

export const Description = styled("p")(({ theme }) => ({
  margin: 0,
  color: theme.palette.text.secondary,
}));

export const HomeLink = styled(Link)(({ theme }) => ({
  marginTop: theme.spacing(1),
  color: theme.palette.primary.main,
  fontWeight: theme.typography.fontWeightMedium,
}));
