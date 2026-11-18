import { Box, Drawer, FormControlLabel, Switch } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const EditorForm = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  minWidth: 0,
}));

export const SwitchWrapper = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 1.5),
  borderRadius: typeof theme.shape.borderRadius === "number" ? theme.shape.borderRadius * 1.5 : 8,
  backgroundColor:
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.03)
      : alpha(theme.palette.common.black, 0.02),
  border: `1px solid ${theme.palette.border?.default ?? theme.palette.divider}`,
}));

export const StyledFormControlLabel = styled(FormControlLabel)(({ theme }) => ({
  margin: 0,
  width: "100%",
  justifyContent: "space-between",
  "& .MuiFormControlLabel-label": {
    fontWeight: 600,
    fontSize: "0.875rem",
    color: theme.palette.text.primary,
  },
}));

export const StyledSwitch = styled(Switch)(({ theme }) => ({
  "& .MuiSwitch-switchBase.Mui-checked": {
    color: theme.palette.success.main,
    "&:hover": { backgroundColor: alpha(theme.palette.success.main, 0.08) },
  },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
    backgroundColor: theme.palette.success.main,
  },
}));

export const CategoryPickerRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 44px",
  gap: theme.spacing(1),
  "& [aria-label] .MuiIconButton-root": {
    minHeight: 32,
    minWidth: 32,
    [theme.breakpoints.down("sm")]: { minHeight: 44, minWidth: 44, marginBlock: -6 },
  },
}));

export const CategoryDrawer = styled(Drawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    width: "min(100vw, 520px)",
    maxWidth: "100vw",
    boxSizing: "border-box",
    backgroundColor: theme.palette.background.paper,
    overflow: "hidden",
  },
}));

export const DrawerHeader = styled("header")(({ theme }) => ({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(1.5, 2) },
}));

export const DrawerBody = styled("div")(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  overflowY: "auto",
  overflowWrap: "anywhere",
  padding: theme.spacing(2, 3),
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
}));

export const CategoryRowHeader = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: theme.spacing(1),
}));

export const CategoryRowTitle = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minWidth: 0,
  gap: theme.spacing(1),
}));

export const CategoryRowActions = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  "& .MuiIconButton-root": { width: 44, height: 44 },
}));

export const DrawerFooter = styled("footer")(({ theme }) => ({
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
