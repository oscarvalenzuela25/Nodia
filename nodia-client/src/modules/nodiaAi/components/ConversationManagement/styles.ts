import { styled } from "@mui/material/styles";
export const Form = styled("form")(({ theme }) => ({ display: "flex", flexDirection: "column", gap: theme.spacing(2), minWidth: 0 }));
export const Actions = styled("div")(({ theme }) => ({ display: "flex", gap: theme.spacing(1), justifyContent: "flex-end",
  [theme.breakpoints.down("sm")]: { flexDirection: "column", "& button": { width: "100%" } } }));
