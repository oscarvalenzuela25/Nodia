import { Box, Paper, Typography } from "@mui/material";
import { styled, type Theme } from "@mui/material/styles";
import { catalogueScrollbars } from "./PosProductCatalog/styles";
export const Workspace = styled(Box)(({ theme }) => ({ display: "grid", gap: theme.spacing(3), minWidth: 0 }));
export const PointOfSaleGrid = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: theme.spacing(2),
  [theme.breakpoints.up("lg")]: { gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, .8fr)" },
}));
export const Panel = styled(Paper)(({ theme }) => ({ padding: theme.spacing(2), border: `1px solid ${theme.palette.divider}`, borderRadius: theme.spacing(2), minWidth: 0, boxShadow: "none" }));
const salePanel = ({ theme }: { theme: Theme }) => ({
  ...catalogueScrollbars(theme), display: "flex", flexDirection: "column", gap: theme.spacing(2),
  height: "clamp(620px, calc(100dvh - 220px), 1040px)", minHeight: 620, overflowY: "auto", overflowAnchor: "none",
  [theme.breakpoints.down("sm")]: { height: "auto", minHeight: 0, overflowY: "visible" },
  [`${theme.breakpoints.down("lg")} and (max-height: 500px)`]: { height: "auto", minHeight: 0, overflowY: "visible" },
} as const);
export const CatalogPanel = styled(Panel)(salePanel);
export const CartPanel = styled(Panel)(salePanel);
export const TotalRow = styled(Box)(({ theme }) => ({ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: theme.spacing(1), minWidth: 0 }));
export const TotalLabel = styled(Typography)(({ theme }) => ({ fontSize: "1.5rem", lineHeight: 1.2, fontWeight: 700, [theme.breakpoints.up("sm")]: { fontSize: "1.75rem" } }));
export const TotalAmount = styled(Typography)(({ theme }) => ({ fontSize: "2.25rem", lineHeight: 1.15, fontWeight: 800, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere", minWidth: 0, [theme.breakpoints.up("sm")]: { fontSize: "3rem" } }));
export const Actions = styled(Box)(({ theme }) => ({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: theme.spacing(1),
  [theme.breakpoints.down("sm")]: {
    "& > button": { flex: "1 1 100%" },
    "& > button:not(.MuiButton-sizeLarge)": { minHeight: 44 },
  },
}));
