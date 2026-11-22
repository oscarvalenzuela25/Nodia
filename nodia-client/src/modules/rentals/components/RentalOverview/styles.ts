import { Box, Paper } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
export const OverviewStack = styled(Box)(({ theme }) => ({
  containerName: "rental-cash",
  containerType: "inline-size",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  gap: theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    "& .MuiButton-root": { minHeight: 44 },
  },
}));

export const DashboardGrid = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr)",
  gap: theme.spacing(3, 2),
  alignItems: "start",
  "@container rental-cash (min-width: 48rem)": {
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  },
}));

export const DashboardPanel = styled("section")(({ theme }) => ({
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
}));

export const MetricGrid = styled("dl")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: theme.spacing(1.5, 2),
  margin: 0,
}));

export const MetricItem = styled("div")(({ theme }) => ({
  minWidth: 0,
  borderBlockStart: `1px solid ${theme.palette.divider}`,
  paddingBlockStart: theme.spacing(1.5),
  overflowWrap: "anywhere",
  "& > dd": {
    margin: 0,
    fontWeight: theme.typography.fontWeightBold,
    fontVariantNumeric: "tabular-nums",
  },
  "&[data-emphasized]": {
    gridColumn: "1 / -1",
    border: 0,
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    "& > dd": {
      ...theme.typography.h4,
      fontWeight: theme.typography.fontWeightBold,
    },
  },
}));

export const MetricActions = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  [theme.breakpoints.down("sm")]: {
    "& > button": { width: "100%" },
  },
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
export const PeriodFilters = styled("form")(({ theme }) => ({
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr)",
  gap: theme.spacing(2),
  paddingBlock: theme.spacing(1),
  justifyItems: "start",
  [theme.breakpoints.down("sm")]: {
    "& > button": { width: "100%" },
  },
}));
