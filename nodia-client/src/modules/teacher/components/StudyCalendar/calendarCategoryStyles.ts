import { IconButton } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { calendarChipColors } from "./styles";

export const CalendarCategoryChips = styled("ul")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: theme.spacing(1),
  minWidth: 0,
  padding: 0,
  margin: 0,
  listStyle: "none",
}));

export const CalendarCategoryPill = styled("li")(({ theme }) => {
  const activeOpacity = theme.palette.mode === "dark" ? 0.18 : 0.09;
  const colors = Object.entries(calendarChipColors).map(([name, color]) => [
    "&[data-color='" + name + "']",
    { backgroundColor: alpha(theme.palette[color].main, activeOpacity), borderColor: alpha(theme.palette[color].main, 0.48) },
  ]);
  return {
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "100%",
    minWidth: 0,
    border: "1px solid",
    borderRadius: 24,
    paddingInline: theme.spacing(1.5, 0.125),
    "&[data-active='false']": { borderStyle: "dashed" },
    ...Object.fromEntries(colors),
  };
});

export const CalendarCategoryPillLabel = styled("span")(({ theme }) => ({
  ...theme.typography.body2,
  flex: "1 1 auto",
  minWidth: 0,
  overflowWrap: "anywhere",
  fontWeight: 600,
}));

export const CalendarCategoryAction = styled(IconButton)(({ theme }) => ({
  width: 44,
  height: 44,
  flexShrink: 0,
  "&.Mui-focusVisible": {
    outline: "2px solid " + theme.palette.text.primary,
    outlineOffset: -3,
  },
}));
