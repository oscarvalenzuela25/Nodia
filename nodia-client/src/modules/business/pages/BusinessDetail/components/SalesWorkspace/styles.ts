import { Box, Button, Paper, Typography } from "@mui/material";
import { alpha, getContrastRatio, styled } from "@mui/material/styles";

export const Workspace = styled(Box)(({ theme }) => ({ display: "grid", gap: theme.spacing(3), minWidth: 0 }));
export const PointOfSaleGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  columnGap: theme.spacing(2),
  rowGap: theme.spacing(3),
  alignItems: "start",
  [theme.breakpoints.up("lg")]: { gridTemplateColumns: "clamp(144px, 10.5vw, 184px) minmax(0, 1fr)" },
}));
export const SalePanels = styled(PointOfSaleGrid)(({ theme }) => ({
  minWidth: 0,
  [theme.breakpoints.up("lg")]: { gridTemplateColumns: "minmax(0, 1fr) minmax(224px, 264px)" },
}));
export const CheckoutColumn = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(1),
}));
const Panel = styled(Paper)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(2),
  minWidth: 0,
  boxShadow: "none",
}));
export const CatalogPanel = styled(Panel)(({ theme }) => ({
  gap: theme.spacing(2),
  containerType: "inline-size",
  containerName: "pos-catalog",
  backgroundImage: `linear-gradient(${alpha(theme.palette.text.primary, 0.035)}, ${alpha(theme.palette.text.primary, 0.035)})`,
}));
export const ScannerFields = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(1),
  "@container pos-catalog (min-width: 26rem)": {
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "end",
  },
}));
export const CartPanel = styled(Panel)(({ theme }) => ({
  gap: theme.spacing(1.25),
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));
export const CompleteSaleButton = styled(Button)(({ theme }) => {
  const fill = theme.palette.success.main;
  return {
    minHeight: 44,
    color: getContrastRatio(theme.palette.common.black, fill) >= 4.5
      ? theme.palette.common.black
      : theme.palette.common.white,
  };
});
export const TotalRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: theme.spacing(.5, 1),
  minWidth: 0,
}));
export const TotalLabel = styled(Typography)({ fontSize: "1rem", lineHeight: 1.25, fontWeight: 700 });
export const TotalAmount = styled(Typography)({
  fontSize: "1.5rem", lineHeight: 1.2, fontWeight: 800, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere", minWidth: 0,
});
export const Actions = styled(Box)(({ theme }) => ({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: theme.spacing(1),
  [theme.breakpoints.down("sm")]: {
    "& > button": { flex: "1 1 100%" },
    "& > button:not(.MuiButton-sizeLarge)": { minHeight: 44 },
  },
}));
