import { Button, Popover } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const Trigger = styled(Button)(({ theme }) => ({
  minWidth: 44,
  height: 44,
  padding: theme.spacing(1.25),
  color: theme.palette.text.primary,
  flexShrink: 0,
  gap: theme.spacing(1),
  textTransform: "none",
  [theme.breakpoints.up("md")]: {
    maxWidth: 180,
  },
}));

export const CurrentName = styled("span")(({ theme }) => ({
  display: "none",
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  [theme.breakpoints.up("md")]: { display: "block" },
}));

export const ThemePopover = styled(Popover)(({ theme }) => ({
  "& .MuiPopover-paper": {
    width: "min(340px, calc(100vw - 32px))",
    maxHeight: "calc(100dvh - 32px)",
    marginTop: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 1.5
      : theme.shape.borderRadius,
  },
}));

export const SearchLabel = styled("label")(({ theme }) => ({
  ...theme.typography.body2,
  display: "block",
  padding: theme.spacing(1.5, 1.5, 0.75),
  fontWeight: 600,
}));

export const SearchInput = styled("input")(({ theme }) => ({
  ...theme.typography.body2,
  display: "block",
  boxSizing: "border-box",
  width: `calc(100% - ${theme.spacing(3)})`,
  minHeight: 44,
  margin: theme.spacing(0, 1.5, 1),
  padding: theme.spacing(1, 1.5),
  border: `1px solid ${theme.palette.border?.default ?? theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.primary,
  "&::placeholder": { color: theme.palette.text.secondary, opacity: 1 },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const OptionsList = styled("ul")(({ theme }) => ({
  listStyle: "none",
  padding: theme.spacing(0.5),
  margin: 0,
  overflowY: "auto",
  maxHeight: "min(352px, calc(100dvh - 180px))",
}));

export const Option = styled("li")(({ theme }) => ({
  ...theme.typography.body2,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  minHeight: 44,
  padding: theme.spacing(0.75, 1),
  borderRadius: theme.shape.borderRadius,
  cursor: "pointer",
  "&[aria-selected='true']": {
    fontWeight: 600,
    backgroundColor: theme.palette.action.selected,
  },
  "&.Mui-focused, &:hover": {
    backgroundColor: theme.palette.action.hover,
  },
  "&.Mui-focusVisible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
}));

export const Swatches = styled("span")(({ theme }) => ({
  display: "inline-flex",
  overflow: "hidden",
  flexShrink: 0,
  border: `1px solid ${alpha(theme.palette.text.primary, 0.25)}`,
  borderRadius: theme.spacing(0.5),
  "& > span": { width: 12, height: 24 },
}));
