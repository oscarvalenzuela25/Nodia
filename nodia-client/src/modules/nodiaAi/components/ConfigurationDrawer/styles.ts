import { Box, Drawer, FormControlLabel, Switch } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const SettingsDrawer = styled(Drawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    width: "min(100vw, 440px)",
    maxWidth: "100vw",
    boxSizing: "border-box",
    backgroundColor: theme.palette.background.paper,
  },
}));

export const DrawerForm = styled("form")({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
  minWidth: 0,
});

export const Header = styled(Box)(({ theme }) => ({
  flexShrink: 0,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  borderBottom: `1px solid ${theme.palette.divider}`,
  "& .MuiIconButton-root": { minWidth: 44, minHeight: 44 },
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
}));

export const Fields = styled(Box)(({ theme }) => {
  const thumb = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2);
  const hover = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.35);
  return {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    overflowY: "auto",
    overflowWrap: "anywhere",
    padding: theme.spacing(3),
    scrollbarWidth: "thin",
    scrollbarColor: `${thumb} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: thumb,
      border: "none",
      borderRadius: 9999,
      "&:hover": { backgroundColor: hover },
    },
    "& [aria-haspopup='listbox']": { minHeight: 44 },
    [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
  };
});

export const Footer = styled(Box)(({ theme }) => ({
  flexShrink: 0,
  display: "flex",
  justifyContent: "flex-end",
  gap: theme.spacing(1),
  padding: theme.spacing(2, 3),
  paddingBottom: `max(${theme.spacing(2)}, env(safe-area-inset-bottom))`,
  borderTop: `1px solid ${theme.palette.divider}`,
  "& .MuiButton-root": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column-reverse",
    paddingInline: theme.spacing(2),
    "& .MuiButton-root": { width: "100%" },
  },
}));

export const SwitchWrapper = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1.5, 2),
  backgroundColor: alpha(theme.palette.background.default, 0.5),
  minWidth: 0,
}));

export const RoutingLabel = styled(FormControlLabel)(({ theme }) => ({
  margin: 0,
  width: "100%",
  minWidth: 0,
  justifyContent: "space-between",
  gap: theme.spacing(1),
  "& .MuiFormControlLabel-label": {
    fontWeight: 600,
    minWidth: 0,
  },
  "& .MuiSwitch-root": { flexShrink: 0 },
}));

export const RoutingSwitch = styled(Switch)(({ theme }) => ({
  "& .MuiSwitch-switchBase.Mui-checked": { color: theme.palette.success.main },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
    backgroundColor: theme.palette.success.main,
  },
}));
