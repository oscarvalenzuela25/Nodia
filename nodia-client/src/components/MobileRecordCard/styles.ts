import { styled } from "@mui/material/styles";
export const CardRoot = styled("article")(({ theme }) => ({
  padding: theme.spacing(2), borderRadius: theme.spacing(2), backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: `0 2px 6px ${theme.palette.action.hover}`,
}));
export const FieldGrid = styled("dl")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: theme.spacing(1.5), margin: theme.spacing(2, 0),
  "@media (max-width: 359.95px)": { gridTemplateColumns: "minmax(0, 1fr)" },
}));
