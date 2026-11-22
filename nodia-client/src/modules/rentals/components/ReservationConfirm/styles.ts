import { alpha, styled } from "@mui/material/styles";

export const ReviewContainer = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(2),
  overflowWrap: "anywhere",
}));

export const ReviewPanel = styled("section")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

export const ReviewHeader = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center",
  gap: theme.spacing(1),
  [theme.breakpoints.down("sm")]: {
    "& > button": { width: "100%", minHeight: 44 },
  },
}));

export const ReviewFacts = styled("dl")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(12rem, 100%), 1fr))",
  gap: theme.spacing(1, 2),
  margin: 0,
  "& dt": {
    ...theme.typography.body2,
    color: theme.palette.text.secondary,
  },
  "& dd": {
    margin: 0,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
}));

export const ReviewSkeleton = styled("div")(({ theme }) => ({
  minHeight: 40,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.text.primary, 0.08),
}));

export const ModalActions = styled("div")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1.5),
  flexWrap: "wrap",
  justifyContent: "flex-end",
  [theme.breakpoints.down("sm")]: {
    "& > button": { width: "100%", minHeight: 44 },
  },
}));
