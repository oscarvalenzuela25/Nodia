import { Box, Drawer, FormControlLabel, IconButton, Paper } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { TABLE_PANEL_RADIUS } from "../../../../../../theme/tablePanel";

export const ListPanel = styled(Paper)(({ theme }) => ({
  width: "100%",
  minWidth: 0,
  borderRadius: TABLE_PANEL_RADIUS,
  border: `1px solid ${theme.palette.divider}`,
  overflow: "hidden",
  boxShadow: "none",
  [theme.breakpoints.down("sm")]: {
    border: 0,
    backgroundColor: "transparent",
  },
}));

export const ListToolbar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  [theme.breakpoints.down("sm")]: {
    alignItems: "stretch",
    flexDirection: "column",
    "& .MuiButton-root": { width: "100%", minHeight: 44 },
  },
}));

export const TouchIconButton = styled(IconButton)({
  width: 44,
  height: 44,
  flexShrink: 0,
});

export const ListMobileCard = styled("li")(({ theme }) => ({
  listStyle: "none",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  display: "grid",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  minWidth: 0,
  overflowWrap: "anywhere",
}));

export const EditorFields = styled("form")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  minWidth: 0,
}));

export const EditorProductList = styled("ul")(({ theme }) => ({
  maxHeight: "clamp(9rem, 40dvh, 19rem)",
  overflowY: "auto",
  overscrollBehaviorY: "contain",
  scrollPaddingBlockStart: theme.spacing(5),
  listStyle: "none",
  margin: 0,
  padding: 0,
  paddingInline: theme.spacing(0.25),
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 1,
  },
}));

export const EditorProductRow = styled("li")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(88px, 145px) auto",
  alignItems: "center",
  gap: theme.spacing(1),
  paddingBlock: theme.spacing(1),
  minWidth: 0,
  borderTop: `1px solid ${theme.palette.divider}`,
  "& .MuiBox-root:has(> label)": { position: "absolute" },
  "& label": {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "minmax(0, 1fr) minmax(74px, 96px) auto",
  },
}));

export const EditorProductHeader = styled(EditorProductRow)(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: 1,
  borderTop: 0,
  backgroundColor: theme.palette.background.paper,
}));

export const ChecklistDrawer = styled(Drawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    backgroundImage: "none",
    [theme.breakpoints.up("sm")]: {
      width: 480,
    },
  },
}));

export const DrawerHeader = styled("header")(({ theme }) => ({
  flexShrink: 0,
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(3),
  },
}));

export const DrawerTitle = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  overflowWrap: "anywhere",
  [theme.breakpoints.up("sm")]: {
    gap: theme.spacing(1.5),
  },
}));

export const ChecklistTitleIcon = styled("span")(({ theme }) => ({
  display: "none",
  placeItems: "center",
  width: 44,
  height: 44,
  flexShrink: 0,
  borderRadius: theme.spacing(1.5),
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
  color: theme.palette.primary.main,
  [theme.breakpoints.up("sm")]: {
    display: "grid",
  },
}));

export const ChecklistProgress = styled("div")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
  padding: theme.spacing(1.5),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.spacing(1.5),
}));

export const DrawerContent = styled("div")(({ theme }) => ({
  padding: theme.spacing(2),
  minHeight: 0,
  flex: "1 1 auto",
  overflowY: "auto",
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(2, 3),
  },
}));

export const DrawerFooter = styled("footer")(({ theme }) => ({
  flexShrink: 0,
  color: theme.palette.text.secondary,
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1.5, 2),
  paddingBottom: `max(${theme.spacing(1.5)}, env(safe-area-inset-bottom))`,
  [theme.breakpoints.up("sm")]: {
    paddingInline: theme.spacing(3),
  },
}));

export const CheckRow = styled("li")({
  minWidth: 0,
  overflowWrap: "anywhere",
});

export const CheckControl = styled(FormControlLabel)(({ theme }) => ({
  width: "100%",
  minWidth: 0,
  minHeight: 58,
  margin: 0,
  padding: theme.spacing(0.75, 1.25, 0.75, 0.5),
  gap: theme.spacing(0.75),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5),
  "&:has(.Mui-checked)": {
    backgroundColor: alpha(theme.palette.success.main, 0.08),
    borderColor: alpha(theme.palette.success.main, 0.32),
  },
  "&:hover:not(.Mui-disabled)": {
    borderColor: theme.palette.text.secondary,
  },
  "&:has(:focus-visible)": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 1,
  },
}));
