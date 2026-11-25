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
  display: "grid", gridTemplateColumns: "min(24%, calc(var(--pos-picture-size) * var(--sale-font-scale, 1))) minmax(0, 1fr) 44px",
  gridTemplateAreas: '"picture copy remove" "controls controls controls"',
  "--pos-picture-size": "56px", "--pos-item-font-size": "1rem",
  alignItems: "center", gap: theme.spacing(1), padding: theme.spacing(1), minWidth: 0,
  "& + &": { borderTop: `1px solid ${theme.palette.divider}` },
  "&[data-price-editing='true']": { gridTemplateAreas: '"picture . remove" "copy copy copy" "controls controls controls"' },
  "@container (min-width: 600px)": {
    "--pos-picture-size": "80px", "--pos-item-font-size": "1.125rem",
    "[data-enlarged='false'] &[data-price-editing='false']": {
      gridTemplateColumns: "80px minmax(0, 1fr) minmax(0, 45%) 44px",
      gridTemplateAreas: '"picture copy controls remove"',
    },
  },
}));
export const PictureSlot = styled(Box)({ gridArea: "picture", minWidth: 0 });
export const Picture = styled(Avatar)(({ theme }) => ({
  width: "min(100%, calc(var(--pos-picture-size) * var(--sale-font-scale, 1)))", height: "auto", aspectRatio: "1",
  borderRadius: theme.spacing(1), backgroundColor: theme.palette.action.hover, color: theme.palette.text.secondary,
  "& img": { objectFit: "contain" },
}));
export const LineControls = styled(Box)(({ theme }) => ({
  gridArea: "controls", display: "flex", flexWrap: "wrap", alignItems: "center", gap: theme.spacing(1), minWidth: 0,
}));
export const Copy = styled(Box)(({ theme }) => ({
  gridArea: "copy", display: "grid", gap: theme.spacing(.5), minWidth: 0, overflowWrap: "anywhere",
}));
export const LineTotal = styled(Typography)({
  marginInlineStart: "auto", minWidth: 0, textAlign: "end", overflowWrap: "anywhere", fontWeight: 700,
  fontSize: "calc(.875rem * var(--sale-font-scale, 1))", fontVariantNumeric: "tabular-nums",
});
export const RemoveAction = styled("span")({ gridArea: "remove", justifySelf: "end", alignSelf: "start" });
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
