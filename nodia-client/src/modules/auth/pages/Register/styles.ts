import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";

export const Page = styled("main")(({ theme }) => ({
  display: "flex",
  minHeight: "100%",
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
  maxWidth: theme.spacing(70),
  margin: 0,
  color: theme.palette.text.secondary,
}));

export const ActionButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));
