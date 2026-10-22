import { styled } from "@mui/material/styles";

export const Observation = styled("section")(({ theme }) => ({
  minWidth: 0, display: "flex", flexDirection: "column", gap: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`, paddingTop: theme.spacing(2),
}));
export const ResultCard = styled("article")(({ theme }) => ({
  minWidth: 0, border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1.5), display: "flex", flexDirection: "column", gap: theme.spacing(1),
  overflowWrap: "anywhere",
  "& button, & a": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& button, & a": { width: "100%" } },
}));
