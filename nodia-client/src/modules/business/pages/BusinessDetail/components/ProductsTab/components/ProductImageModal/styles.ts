import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
export const ProductName = styled(Typography)({ minWidth: 0, overflowWrap: "anywhere", fontWeight: 600 });
export const Actions = styled(Box)(({ theme }) => ({
  display: "flex", justifyContent: "flex-end", gap: theme.spacing(1.5), width: "100%",
  minWidth: 0,
  [theme.breakpoints.down("sm")]: { flexDirection: "column-reverse", "& button": { width: "100%", minHeight: 44, whiteSpace: "normal", overflowWrap: "anywhere" } },
}));
export const ReviewImages = styled(Box)(({ theme }) => ({
  display: "grid", gap: theme.spacing(2), gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  minWidth: 0, "& > *": { minWidth: 0 },
  [theme.breakpoints.down("sm")]: { gridTemplateColumns: "minmax(0, 1fr)" },
}));
export const ReviewImage = styled(Box)(({ theme }) => ({
  position: "relative", height: 280, minWidth: 0, border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius,
  display: "grid", placeItems: "center",
  [theme.breakpoints.down("sm")]: { height: "min(220px, 45dvh)", minHeight: 140 },
  "& img": { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" },
}));
