import { Box, IconButton, Paper } from "@mui/material";
import { styled } from "@mui/material/styles";
import { TABLE_PANEL_RADIUS } from "../../../../../../theme/tablePanel";

export const ListPanel = styled(Paper)(({ theme }) => ({
  width: "100%",
  minWidth: 0,
  borderRadius: TABLE_PANEL_RADIUS,
  border: `1px solid ${theme.palette.divider}`,
  overflow: "hidden",
}));

export const ListHeading = styled("header")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  [theme.breakpoints.down("sm")]: {
    alignItems: "stretch",
    flexDirection: "column",
    "& .MuiButton-root": { width: "100%", minHeight: 44 },
  },
}));

export const ListToolbar = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  "& > *": { maxWidth: 340 },
  [theme.breakpoints.down("sm")]: {
    "& > *": { maxWidth: "none" },
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
  borderRadius: theme.spacing(1.5),
  display: "grid",
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  minWidth: 0,
  overflowWrap: "anywhere",
}));

export const EditorFields = styled("form")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  minWidth: 0,
}));

export const EditorProductRow = styled("li")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(88px, 145px) auto",
  alignItems: "start",
  gap: theme.spacing(1),
  paddingBlock: theme.spacing(1),
  minWidth: 0,
  borderTop: `1px solid ${theme.palette.divider}`,
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

export const DrawerTitle = styled("header")(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2, 2, 1),
  overflowWrap: "anywhere",
}));

export const DrawerContent = styled("div")(({ theme }) => ({
  padding: theme.spacing(1, 2, 2),
  minHeight: 0,
  flex: "1 1 auto",
  overflowY: "auto",
}));

export const DrawerFooter = styled("footer")(({ theme }) => ({
  color: theme.palette.text.secondary,
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1.5, 2),
  paddingBottom: `max(${theme.spacing(1.5)}, env(safe-area-inset-bottom))`,
}));

export const CheckRow = styled("li")(({ theme }) => ({
  display: "grid",
  alignItems: "center",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  columnGap: theme.spacing(1),
  rowGap: theme.spacing(0.5),
  paddingBlock: theme.spacing(0.75),
  minWidth: 0,
  overflowWrap: "anywhere",
  borderBottom: `1px solid ${theme.palette.divider}`,
}));
