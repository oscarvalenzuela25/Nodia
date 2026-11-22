import { alpha, styled } from "@mui/material/styles";

export const DetailList = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(3),
  overflowWrap: "anywhere",
}));

export const DetailPanel = styled("section")(({ theme }) => ({
  display: "grid",
  alignContent: "start",
  minWidth: 0,
  gap: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
}));

export const DetailPanels = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(2),
  [theme.breakpoints.up("md")]: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
}));

export const SummaryTags = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
}));

export const DetailGrid = styled("dl")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(12rem, 100%), 1fr))",
  gap: theme.spacing(1, 2),
  margin: 0,
  "& dt": {
    ...theme.typography.body2,
    color: theme.palette.text.secondary,
  },
  "& dd": {
    ...theme.typography.body2,
    margin: 0,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "pre-wrap",
  },
}));

export const DetailActions = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  [theme.breakpoints.down("sm")]: {
    "& > button": { width: "100%", minHeight: 44 },
  },
}));

export const DetailSkeleton = styled("div")(({ theme }) => ({
  minHeight: 132,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.text.primary, 0.08),
}));
