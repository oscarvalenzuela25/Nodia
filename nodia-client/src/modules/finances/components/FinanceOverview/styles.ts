import { Box, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const OverviewStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  minWidth: 0,
}));

export const OverviewContent = styled(OverviewStack)({
  containerName: "finance-overview",
  containerType: "inline-size",
});

export const MetricGrid = styled("div")(({ theme }) => ({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  rowGap: theme.spacing(3),
  columnGap: theme.spacing(2),
  "@container finance-overview (min-width: 46rem)": {
    gridTemplateColumns: "minmax(0, 5fr) minmax(0, 4fr)",
  },
}));

export const MetricPanel = styled("section")(({ theme }) => ({
  containerName: "finance-metrics",
  containerType: "inline-size",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.25),
  minWidth: 0,
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  backgroundColor: theme.palette.background.paper,
  "&:first-of-type": {
    backgroundImage: `linear-gradient(${alpha(theme.palette.primary.main, 0.07)}, transparent 160px)`,
  },
  "@container finance-overview (min-width: 46rem)": {
    padding: theme.spacing(2.5),
  },
}));

export const PanelHeading = styled(Typography)(({ theme }) => ({
  ...theme.typography.h6,
  fontWeight: theme.typography.fontWeightBold,
}));

export const MetricList = styled("dl")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(1.5, 2),
  margin: theme.spacing(0.5, 0),
  "@container finance-metrics (min-width: 24rem)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
}));

export const MetricPair = styled("div")(({ theme }) => ({
  minWidth: 0,
  borderBlockStart: `1px solid ${theme.palette.divider}`,
  paddingBlockStart: theme.spacing(1.5),
}));

export const MetricLabel = styled("dt")(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.palette.text.secondary,
}));

export const MetricValue = styled("dd")(({ theme }) => ({
  ...theme.typography.h6,
  margin: 0,
  fontWeight: theme.typography.fontWeightBold,
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
}));

export const MetricHighlight = styled("div")(({ theme }) => ({
  gridColumn: "1 / -1",
  "& > dd": {
    ...theme.typography.h4,
    fontWeight: theme.typography.fontWeightBold,
  },
  "@container finance-overview (max-width: 28rem)": {
    "& > dd": { fontSize: "1.5rem" },
  },
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
