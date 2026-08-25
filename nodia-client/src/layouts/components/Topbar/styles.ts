import { styled } from "@mui/material/styles";

export const TopbarRoot = styled("header")(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  padding: "16px 32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
}));
