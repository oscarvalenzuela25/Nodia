import { Box, Paper } from "@mui/material";
import { styled } from "@mui/material/styles";
export const OverviewStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
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
  overflowWrap: "anywhere",
}));
export { FilterRow } from "../PaymentTable/styles";
