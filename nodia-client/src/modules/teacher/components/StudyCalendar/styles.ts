import { Box, Button, Card, Drawer, Stack } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const calendarChipColors = {
  violet: "primary", green: "success", blue: "info", amber: "warning",
} as const;

export const CalendarWorkspace = styled("div")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(3, 2),
  minWidth: 0,
  alignItems: "start",
  gridTemplateColumns: "minmax(0, 1fr)",
  [theme.breakpoints.up("md")]: { gridTemplateColumns: "minmax(208px, 282px) minmax(0, 1fr)" },
}));

export const CalendarPanel = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(2),
  minWidth: 0,
  overflowWrap: "anywhere",
  backgroundImage: "none",
}));

export const CalendarActions = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  minWidth: 0,
  "& > .MuiButton-root": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { width: "100%", "& > .MuiButton-root": { width: "100%" } },
}));

export const CalendarDayGrid = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: theme.spacing(0.5),
  minWidth: 0,
}));

export const CalendarDayButton = styled(Button)(({ theme }) => ({
  minWidth: 0,
  minHeight: 44,
  padding: theme.spacing(0.5),
  fontVariantNumeric: "tabular-nums",
  justifyContent: "center",
  "&[data-done='true']:not(.Mui-disabled)": {
    backgroundColor: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.22 : 0.1),
    color: theme.palette.mode === "dark" ? theme.palette.success.light : theme.palette.success.dark,
    borderColor: alpha(theme.palette.success.main, 0.45),
  },
  "&[data-next='true']:not(.Mui-disabled)": {
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.09),
  },
}));

export const CalendarDayListButton = styled(CalendarDayButton)(({ theme }) => ({
  width: "100%",
  justifyContent: "space-between",
  padding: theme.spacing(0.75, 1),
  gap: theme.spacing(1),
  textAlign: "start",
  textTransform: "none",
  "& .MuiTypography-root": { overflowWrap: "anywhere" },
}));

export const StudyCalendarDrawer = styled(Drawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    width: "min(100%, 520px)",
    maxWidth: "100%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundImage: "none",
    borderInlineStart: "1px solid " + theme.palette.divider,
  },
}));

export const CalendarDrawerBody = styled(Box)(({ theme }) => {
  const thumb = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2);
  const thumbHover = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.35);
  return {
    minHeight: 0,
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(2),
    overflowWrap: "anywhere",
    scrollbarWidth: "thin",
    scrollbarColor: thumb + " transparent",
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-thumb": { background: thumb, borderRadius: 9999, border: 0 },
    "&::-webkit-scrollbar-thumb:hover": { background: thumbHover },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
  };
});

export const CalendarDrawerHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderBottom: "1px solid " + theme.palette.divider,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: theme.spacing(1),
  overflowWrap: "anywhere",
}));

export const CalendarActivityCard = styled(Box)(({ theme }) => ({
  minWidth: 0,
  border: "1px solid " + theme.palette.divider,
  borderRadius: theme.spacing(1.25),
  padding: theme.spacing(1),
  "&[data-done='true']": {
    backgroundColor: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.11 : 0.055),
  },
}));
