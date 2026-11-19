import { Box, Paper } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
export const OverviewStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    "& .MuiButton-root": { minHeight: 44 },
  },
}));
export const MetricGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  },
  [theme.breakpoints.down("sm")]: { gridTemplateColumns: "minmax(0,1fr)" },
}));
export const MetricCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  boxShadow: "none",
  backgroundColor: theme.palette.background.paper,
  backgroundImage: `linear-gradient(${alpha(theme.palette.primary.main, 0.05)}, transparent 80px)`,
  overflowWrap: "anywhere",
  "& .MuiTypography-h5": {
    marginBlockStart: theme.spacing(0.5),
    fontWeight: theme.typography.fontWeightBold,
    fontVariantNumeric: "tabular-nums",
  },
}));
export { FilterRow } from "../PaymentTable/styles";
export const PeriodFilters = styled(Box)(({ theme }) => ({
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr)",
  gap: theme.spacing(2),
}));
