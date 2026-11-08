import { Avatar, Box, ButtonBase } from "@mui/material";
import { alpha, styled, type Theme } from "@mui/material/styles";

export const catalogueScrollbars = (theme: Theme) => {
  const ink = theme.palette.mode === "dark" ? "#ffffff" : "#000000";
  return {
    scrollbarWidth: "thin" as const, scrollbarColor: `${alpha(ink, 0.2)} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": { backgroundColor: alpha(ink, 0.2), borderRadius: 9999, "&:hover": { backgroundColor: alpha(ink, 0.35) } },
  };
};
export const Catalog = styled(Box)(({ theme }) => ({ display: "flex", flexDirection: "column", flex: "1 1 auto", gap: theme.spacing(2), minWidth: 0, minHeight: 0 }));
export const CatalogScroll = styled(Box)(({ theme }) => ({
  ...catalogueScrollbars(theme), flex: "1 1 auto", minWidth: 0, minHeight: 260, maxHeight: "none", overflowY: "auto", overscrollBehavior: "contain", overflowAnchor: "none",
  border: `1px solid ${theme.palette.divider}`, borderRadius: theme.spacing(1.5),
}));
export const ProductList = styled("ul")({ listStyle: "none", margin: 0, padding: 0, minWidth: 0 });
export const ProductListItem = styled("li")(({ theme }) => ({ margin: 0, minWidth: 0, "& + &": { borderTop: `1px solid ${theme.palette.divider}` } }));
export const QuantityArea = styled(Box)(({ theme }) => ({ width: "100%", maxWidth: 360, boxSizing: "border-box", marginLeft: "auto", padding: theme.spacing(0, 1.5, 1.5) }));
export const ProductRowButton = styled(ButtonBase)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr) 24px", gap: theme.spacing(1), width: "100%", minWidth: 0,
  padding: theme.spacing(1.5), textAlign: "left", justifyItems: "stretch", minHeight: 112,
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
  "&.Mui-disabled": { opacity: 0.6 },
}));
export const ProductContent = styled(Box)(({ theme }) => ({ display: "grid", gridTemplateColumns: "80px minmax(0, 1fr)", gap: theme.spacing(1.5), alignItems: "center", minWidth: 0, width: "100%" }));
export const ProductPicture = styled(Avatar)(({ theme }) => ({ width: 80, height: 80, flexShrink: 0, borderRadius: theme.spacing(1), backgroundColor: theme.palette.action.hover, color: theme.palette.text.secondary }));
export const ProductCopy = styled(Box)(({ theme }) => ({ display: "grid", gap: theme.spacing(0.5), minWidth: 0, overflowWrap: "anywhere" }));
export const OptionItem = styled("li")(({ theme }) => ({
  minWidth: 0, width: "100%", boxSizing: "border-box", padding: `${theme.spacing(1.5)} !important`,
  "& + &": { borderTop: `1px solid ${theme.palette.divider}` },
}));
