import { Box, Paper, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

export const OverviewStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  minWidth: 0,
}));
export const MetricGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(3, 2),
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  [theme.breakpoints.up("lg")]: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
}));
export const MetricPanel = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
  border: `1px solid ${theme.palette.divider}`,
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 2
      : theme.shape.borderRadius,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  boxShadow: "none",
  minWidth: 0,
}));
export const MetricValue = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  fontWeight: theme.typography.fontWeightBold,
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
}));
export const CountsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  "& .MuiChip-root": { maxWidth: "100%", height: "auto", minHeight: 24 },
  "& .MuiChip-label": {
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    paddingBlock: theme.spacing(0.5),
  },
}));
export const PanelHeading = styled(Typography)(({ theme }) => ({
  ...theme.typography.h6,
  fontWeight: theme.typography.fontWeightBold,
}));
