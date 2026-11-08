import { Avatar, Box, IconButton, Typography } from "@mui/material";
import type { ElementType } from "react";
import { alpha, styled } from "@mui/material/styles";
import { catalogueScrollbars } from "../PosProductCatalog/styles";

export const Lines = styled(Box)(({ theme }) => ({
  ...catalogueScrollbars(theme), flex: "1 1 0", minHeight: 260, overflowY: "auto", minWidth: 0, overflowAnchor: "none", containerType: "inline-size",
  display: "flex", flexDirection: "column",
  border: `1px solid ${theme.palette.divider}`, borderRadius: theme.spacing(1.5),
  [theme.breakpoints.down("sm")]: { flex: "0 1 auto", minHeight: 200, maxHeight: "clamp(200px, 52svh, 480px)" },
  [`${theme.breakpoints.down("lg")} and (max-height: 500px)`]: { flex: "0 1 auto", minHeight: 200, maxHeight: "clamp(200px, 52svh, 480px)" },
}));
export const EmptyState = styled(Box)(({ theme }) => ({
  flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
  gap: theme.spacing(1), padding: theme.spacing(3), minWidth: 0, textAlign: "center", overflowWrap: "anywhere",
}));
export const EmptyTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  margin: 0, fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.3, color: theme.palette.text.primary,
}));
export const EmptyHelp = styled(Typography)(({ theme }) => ({
  fontSize: "1rem", lineHeight: 1.6, color: theme.palette.text.secondary, maxWidth: "36ch",
}));
export const Line = styled("li")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0,1fr) 44px", alignItems: "center", gap: theme.spacing(1.5), padding: theme.spacing(1.5), minWidth: 0,
  "& + &": { borderTop: `1px solid ${theme.palette.divider}` },
  "@container (min-width: 360px)": { gridTemplateColumns: "calc(80px * var(--sale-font-scale, 1)) minmax(0,1fr) 44px" },
  "@container (min-width: 640px)": { gridTemplateColumns: "calc(80px * var(--sale-font-scale, 1)) minmax(0,1fr) max-content 44px" },
  "[data-enlarged='true'] &": { gridTemplateColumns: "minmax(0,1fr) 44px", "@container (min-width: 360px)": { gridTemplateColumns: "calc(80px * var(--sale-font-scale, 1)) minmax(0,1fr) 44px" } },
}));
export const Picture = styled(Avatar)(({ theme }) => ({
  width: "calc(80px * var(--sale-font-scale, 1))", height: "calc(80px * var(--sale-font-scale, 1))", maxWidth: "100%",
  borderRadius: theme.spacing(1), backgroundColor: theme.palette.action.hover,
  "& img": { objectFit: "contain" },
}));
export const Quantity = styled(Box)({ gridColumn: "1 / -1", width: "max-content", maxWidth: "100%", justifySelf: "end", minWidth: 0,
  "@container (min-width: 640px)": { gridColumn: "auto" },
  "[data-enlarged='true'] &": { gridColumn: "1 / -1" },
});
export const Copy = styled(Box)(({ theme }) => ({
  gridColumn: "1 / -1", display: "grid", gap: theme.spacing(1), minWidth: 0, overflowWrap: "anywhere",
  "@container (min-width: 360px)": { gridColumn: "auto" },
}));
export const RemoveAction = styled("span")({ gridColumn: "-2 / -1", gridRow: 1, alignSelf: "start" });
export const ActionButton = styled(IconButton)(({ theme }) => ({
  width: 44, height: 44, borderRadius: theme.spacing(1.5), color: theme.palette.primary.main,
  border: `1px solid ${alpha(theme.palette.primary.main, .3)}`, backgroundColor: alpha(theme.palette.primary.main, .08),
  "&:hover": { backgroundColor: alpha(theme.palette.primary.main, .2), borderColor: theme.palette.primary.main },
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2, backgroundColor: alpha(theme.palette.primary.main, .2) },
  "&.Mui-disabled": { backgroundColor: theme.palette.action.disabledBackground, borderColor: "transparent" },
}));
export const RemoveButton = styled(IconButton)(({ theme }) => ({
  width: 44, height: 44, borderRadius: theme.spacing(1.5), color: theme.palette.error.main,
  backgroundColor: alpha(theme.palette.error.main, .08), border: `1px solid ${alpha(theme.palette.error.main, .3)}`,
  "&:hover": { backgroundColor: alpha(theme.palette.error.main, .16) },
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.error.main}`, outlineOffset: 2 },
}));
