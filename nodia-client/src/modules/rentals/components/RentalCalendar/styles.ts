import { Box, Button, Paper } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
export const Wrapper = styled("section")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(3),
  minWidth: 0,
}));
export const CalendarLayout = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  gridTemplateColumns: "minmax(0,1fr)",
  alignItems: "start",
  [theme.breakpoints.up("lg")]: { gridTemplateColumns: "minmax(0,1fr) 300px" },
}));
export const CalendarPanel = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  display: "grid",
  gap: theme.spacing(2),
  minWidth: 0,
  borderRadius: 20,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "none",
  ".rental-reservation": {
    minHeight: 28,
    borderRadius: 6,
    borderLeft: `3px solid ${theme.palette.success.main}`,
  },
  ".rental-status-draft, .rental-status-cancelled": {
    borderLeftColor: theme.palette.warning.main,
  },
  ".rental-status-in_progress": { borderLeftColor: theme.palette.primary.main },
  ".rental-event-muted": { opacity: 0.75, borderStyle: "dashed" },
  ".fc": { fontFamily: theme.typography.fontFamily },
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(3) },
}));
export const ContextPanel = styled(CalendarPanel)(({ theme }) => ({
  background: alpha(
    theme.palette.primary.main,
    theme.palette.mode === "dark" ? 0.08 : 0.025,
  ),
  [theme.breakpoints.up("lg")]: { position: "sticky", top: theme.spacing(2) },
}));
export const Toolbar = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  [theme.breakpoints.down("sm")]: { "& > button": { width: "100%" } },
}));
export const Agenda = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
}));
export const AgendaCard = styled(Button)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  textAlign: "left",
  padding: theme.spacing(2),
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
  textTransform: "none",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  flexWrap: "wrap",
  background: theme.palette.background.paper,
}));
export const Legend = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
}));
