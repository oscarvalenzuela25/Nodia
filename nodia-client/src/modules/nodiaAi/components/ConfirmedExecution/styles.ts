import { styled } from "@mui/material/styles";
export const Panel = styled("section")(({ theme }) => ({ display: "flex", flexDirection: "column", gap: theme.spacing(1.5), minWidth: 0, overflowWrap: "anywhere" }));
export const Actions = styled("div")(({ theme }) => ({ display: "flex", flexWrap: "wrap", gap: theme.spacing(1), "& > *": { minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" } } }));
