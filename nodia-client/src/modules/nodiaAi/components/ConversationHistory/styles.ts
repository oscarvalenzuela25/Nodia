import { IconButton, ListItem } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const Filters = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.5), marginBottom: theme.spacing(2),
  minWidth: 0,
}));
export const FilterSummary = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
  gap: theme.spacing(0.5, 1), minWidth: 0,
  "& > span": { minWidth: 0, overflowWrap: "anywhere" },
  "& > button": { minHeight: 44, minWidth: 0, maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere" },
}));
export const ConversationRow = styled(ListItem, {
  shouldForwardProp: prop => prop !== "active",
})<{ active: boolean }>(({ theme, active }) => ({
  position: "relative",
  width: "100%",
  minWidth: 0,
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(0.5),
  border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.26) : "transparent"}`,
  backgroundColor: active ? alpha(theme.palette.primary.main, 0.09) : "transparent",
  boxShadow: active ? `inset 2px 0 ${theme.palette.primary.main}` : "none",
  "@media (hover: hover)": {
    "&:hover": { backgroundColor: active ? alpha(theme.palette.primary.main, 0.13) : theme.palette.action.hover },
  },
  "& .MuiListItemButton-root": {
    width: "100%",
    minWidth: 0,
    minHeight: 56,
    alignItems: "flex-start",
    borderRadius: "inherit",
    paddingRight: theme.spacing(7),
    "& .MuiListItemText-primary": { fontSize: "0.875rem", fontWeight: active ? 650 : 500, lineHeight: 1.5 },
    "& .MuiListItemText-secondary": { fontSize: "0.75rem", marginTop: theme.spacing(0.5), lineHeight: 1.5 },
    "&.Mui-selected, &.Mui-selected:hover, &:hover": { background: "transparent" },
    "&.Mui-focusVisible, &:focus-visible": {
      outline: `2px solid ${theme.palette.text.primary}`,
      outlineOffset: -2,
    },
  },
}));

export const RowActions = styled("div")(({ theme }) => ({
  position: "absolute",
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  display: "flex",
  alignItems: "center",
  "& button": {
    width: 44,
    height: 44,
    borderRadius: theme.shape.borderRadius,
    "&:hover": { background: alpha(theme.palette.primary.main, 0.12) },
    "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
  },
}));

export const Heading = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: theme.spacing(0.5), minWidth: 0, marginBottom: theme.spacing(1),
  "& button": { minWidth: 44, minHeight: 44 },
}));

export const AdditionalFilters = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.5), minWidth: 0,
}));

export const RailButton = styled(IconButton)(({ theme }) => ({
  width: 44, height: 44, borderRadius: theme.shape.borderRadius,
  "&[aria-current=page]": {
    color: theme.palette.primary.main,
    background: alpha(theme.palette.primary.main, 0.12),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
  },
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
}));
