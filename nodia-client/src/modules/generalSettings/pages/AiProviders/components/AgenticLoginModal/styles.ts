import { styled } from "@mui/material/styles";
import { Box } from "@mui/material";

export const LoginContent = styled("form")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(2),
}));

export const LoginActions = styled(Box)(({ theme }) => ({
  display: "flex", gap: theme.spacing(1.5), justifyContent: "flex-end", width: "100%",
  [theme.breakpoints.down("sm")]: { flexDirection: "column", "& > button": { width: "100%" } },
}));
