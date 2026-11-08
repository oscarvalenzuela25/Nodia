import { ListItem } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const Filters = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.5), marginBottom: theme.spacing(2),
  minWidth: 0,
}));
export const ConversationRow = styled(ListItem, {
  shouldForwardProp: prop => prop !== "active",
})<{ active: boolean }>(({ theme, active }) => ({
  position: "relative",
  width: "100%",
  minWidth: 0,
  borderRadius: typeof theme.shape.borderRadius === "number" ? theme.shape.borderRadius * 2 : `calc(${theme.shape.borderRadius} * 2)`,
  marginBottom: theme.spacing(0.5),
  background: active ? alpha(theme.palette.primary.main, 0.13) : "transparent",
  "&:hover": { background: alpha(theme.palette.primary.main, active ? 0.18 : 0.06) },
  "& .MuiListItemButton-root": {
    width: "100%",
    minWidth: 0,
    minHeight: 56,
    alignItems: "flex-start",
    borderRadius: "inherit",
    paddingRight: theme.spacing(7),
    "&.Mui-selected, &.Mui-selected:hover, &:hover": { background: "transparent" },
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
  gap: theme.spacing(1), minWidth: 0, marginBottom: theme.spacing(1),
  "& button": { minWidth: 44, minHeight: 44 },
}));

export const AdditionalFilters = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.5), minWidth: 0,
}));
