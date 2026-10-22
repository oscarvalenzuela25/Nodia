import { styled } from "@mui/material/styles";

export const Filters = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.5), marginBottom: theme.spacing(2),
  minWidth: 0,
}));
export const RowActions = styled("div")({ display: "flex", flexShrink: 0, alignItems: "center" });
