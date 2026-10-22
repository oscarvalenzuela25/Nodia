import { styled } from "@mui/material/styles";
export const Content = styled("div")(({ theme }) => ({ display: "flex", flexDirection: "column", gap: theme.spacing(2), minWidth: 0, overflowWrap: "anywhere" }));
export const Actions = styled("div")(({ theme }) => ({ display: "flex", flexWrap: "wrap", gap: theme.spacing(1), width: "100%", justifyContent: "flex-end", "& > *": { minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" } } }));
export const Form = styled("form")(({ theme }) => ({ display: "flex", flexDirection: "column", gap: theme.spacing(2), minWidth: 0 }));
