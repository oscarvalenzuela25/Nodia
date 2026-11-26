import { Avatar, Box, IconButton, Typography } from "@mui/material";
import type { ElementType } from "react";
import { alpha, styled } from "@mui/material/styles";
import { catalogueScrollbars } from "../PosProductCatalog/styles";

export const Lines = styled(Box)(({ theme }) => ({
  ...catalogueScrollbars(theme),
  flex: "1 1 auto", minHeight: 0, maxHeight: "clamp(224px, 40svh, 360px)", minWidth: 0,
  overflowY: "auto", overflowAnchor: "none", scrollbarGutter: "stable", containerType: "inline-size",
  display: "flex", flexDirection: "column",
  borderTop: `1px solid ${theme.palette.divider}`,
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
}));
export const EmptyState = styled(Box)(({ theme }) => ({
  flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
  gap: theme.spacing(1), padding: theme.spacing(3), minHeight: 168, minWidth: 0, textAlign: "center", overflowWrap: "anywhere",
}));
export const EmptyTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  margin: 0, fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.3, color: theme.palette.text.primary,
}));
export const EmptyHelp = styled(Typography)(({ theme }) => ({
  fontSize: "1rem", lineHeight: 1.6, color: theme.palette.text.secondary, maxWidth: "36ch",
}));
export const Line = styled("li")(({ theme }) => ({
  "--pos-line-control-size": "44px",
  "--pos-item-font-size": ".875rem",
  display: "grid",
  gridTemplateColumns: "40px minmax(0, 1fr) var(--pos-line-control-size)",
  gridTemplateAreas: '"picture copy copy" "controls controls remove"',
  alignItems: "center", gap: theme.spacing(.75, 1), padding: theme.spacing(.75, 1), minWidth: 0,
  "& + &": { borderTop: `1px solid ${theme.palette.divider}` },
  "&[data-price-editing='true']": {
    gridTemplateAreas: '"picture product product" "controls controls remove" "editor editor editor"',
    backgroundColor: alpha(theme.palette.primary.main, .035),
  },
  "@container (min-width: 34rem)": {
    "[data-enlarged='false'] &[data-price-editing='false']": {
      gridTemplateColumns: "40px minmax(0, 1fr) min(48%, 16rem) var(--pos-line-control-size)",
      gridTemplateAreas: '"picture copy controls remove"',
      "@media (hover: hover) and (pointer: fine) and (not (any-pointer: coarse))": {
        "--pos-line-control-size": "32px",
      },
    },
    "[data-enlarged='false'] &[data-price-editing='true']": {
      gridTemplateColumns: "40px minmax(0, 1fr) min(48%, 16rem) var(--pos-line-control-size)",
      gridTemplateAreas: '"picture product controls remove" ". editor editor editor"',
    },
  },
}));
export const PictureSlot = styled(Box)({ gridArea: "picture", minWidth: 0 });
export const Picture = styled(Avatar)(({ theme }) => ({
  width: "100%", height: "auto", aspectRatio: "1",
  borderRadius: theme.spacing(1), backgroundColor: theme.palette.action.hover, color: theme.palette.text.secondary,
  "& img": { objectFit: "contain" },
}));
export const LineControls = styled(Box)(({ theme }) => ({
  gridArea: "controls", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end",
  gap: theme.spacing(.5, .75), minWidth: 0,
  "[data-price-editing='true'] &": { justifyContent: "space-between" },
  "@container (min-width: 34rem)": { columnGap: theme.spacing(1.5) },
}));
export const Copy = styled(Box)(({ theme }) => ({
  gridArea: "copy", display: "grid", gap: theme.spacing(.25), minWidth: 0, overflowWrap: "anywhere",
  "[data-price-editing='true'] &": { display: "contents" },
}));
export const LineIdentity = styled(Box)(({ theme }) => ({
  display: "grid", gap: theme.spacing(.25), minWidth: 0,
  "[data-price-editing='true'] &": { display: "contents" },
  "[data-price-editing='false'] &": {
    "--pos-price-display-layout": "contents",
    gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "auto auto", gridAutoFlow: "column",
  },
  "@container (min-width: 42rem)": {
    "[data-enlarged='false'] [data-price-editing='false'] &": {
      "--pos-price-display-layout": "flex",
      display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: theme.spacing(1.5),
    },
  },
}));
export const ProductDetails = styled(Box)({
  gridArea: "product",
  minWidth: 0,
  overflowWrap: "anywhere",
  "[data-price-editing='false'] &": { gridArea: "auto" },
});
export const LineTotal = styled(Typography)({
  position: "relative", minWidth: 0, maxWidth: "100%", textAlign: "end", overflowWrap: "anywhere", fontWeight: 700,
  fontSize: "calc(.875rem * var(--sale-font-scale, 1))", fontVariantNumeric: "tabular-nums",
  "@container (min-width: 17rem)": { minWidth: "4.75rem" },
});
export const RemoveAction = styled("span")({ gridArea: "remove", justifySelf: "end", display: "inline-flex" });
export const ActionButton = styled(IconButton)(({ theme }) => ({
  width: 44, height: 44, borderRadius: theme.spacing(1.5), color: theme.palette.primary.main,
  border: `1px solid ${alpha(theme.palette.primary.main, .3)}`, backgroundColor: alpha(theme.palette.primary.main, .08),
  "&:hover": { backgroundColor: alpha(theme.palette.primary.main, .2), borderColor: theme.palette.primary.main },
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2, backgroundColor: alpha(theme.palette.primary.main, .2) },
  "&.Mui-disabled": { backgroundColor: theme.palette.action.disabledBackground, borderColor: "transparent" },
}));
export const RemoveButton = styled(IconButton)(({ theme }) => ({
  width: "var(--pos-line-control-size)", height: "var(--pos-line-control-size)",
  borderRadius: theme.spacing(1), color: theme.palette.error.main,
  "& svg": { width: 18, height: 18 },
  "&:hover": { backgroundColor: alpha(theme.palette.error.main, .16) },
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.error.main}`, outlineOffset: 2 },
}));
