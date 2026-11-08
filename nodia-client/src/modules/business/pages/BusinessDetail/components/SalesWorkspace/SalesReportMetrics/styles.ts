import type { ElementType } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
export const MetricsGrid = styled(Box)(({ theme }) => ({ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: theme.spacing(2), minWidth: 0,
  [theme.breakpoints.up("sm")]: { gridTemplateColumns: "repeat(2,minmax(0,1fr))" },
  [theme.breakpoints.up("lg")]: { gridTemplateColumns: "repeat(4,minmax(0,1fr))" },
}));
export const MetricCard = styled(Card)<{ component?: ElementType }>(({ theme }) => ({ minWidth: 0, height: "100%", border: `1px solid ${theme.palette.divider}`, borderRadius: theme.spacing(2), boxShadow: theme.shadows[1] }));
export const MetricContent = styled(CardContent)(({ theme }) => ({ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: theme.spacing(2), height: "100%", boxSizing: "border-box" }));
export const MetricValue = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({ ...theme.typography.h4, marginTop: theme.spacing(1), fontWeight: 700, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }));
