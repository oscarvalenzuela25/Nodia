import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";

export const Page = styled("main")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(2),
  padding: theme.spacing(4),
  textAlign: "center",
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

export const Actions = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(1),
}));

export const PrimaryAction = styled(Button)({});

export const SecondaryAction = styled(Button)({});
