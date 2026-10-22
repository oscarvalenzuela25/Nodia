import { styled } from "@mui/material/styles";

export const Preview = styled("section")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(2), minWidth: 0,
  overflowWrap: "anywhere",
}));
export const Step = styled("article")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.5), minWidth: 0,
  border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1.5),
}));
export const Change = styled("div")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: theme.spacing(1), minWidth: 0,
  borderTop: `1px solid ${theme.palette.divider}`, paddingTop: theme.spacing(1.5),
  [theme.breakpoints.up("sm")]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
}));
export const Fields = styled("dl")(({ theme }) => ({
  margin: 0, minWidth: 0, display: "grid", gap: theme.spacing(0.5),
  "& dd": { margin: 0, minWidth: 0 },
}));
export const ReviewActions = styled("div")(({ theme }) => ({
  display: "flex", flexWrap: "wrap", gap: theme.spacing(1),
  "& > button": { minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" } },
}));
export const SwitchWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(1.5), borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.action.hover,
}));
