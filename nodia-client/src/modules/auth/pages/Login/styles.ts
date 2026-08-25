import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";

export const Page = styled("main")(({ theme }) => ({
  display: "flex",
  minHeight: "100vh",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(4),
  backgroundColor: theme.palette.background.default,
}));

export const Card = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  maxWidth: 440,
  padding: theme.spacing(5),
  backgroundColor: theme.palette.background.paper,
  borderRadius: 16,
  boxShadow: theme.shadows[3],
}));

export const LogoContainer = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing(2),
  color: theme.palette.primary.main,
  "& svg": {
    fontSize: 40,
  }
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
