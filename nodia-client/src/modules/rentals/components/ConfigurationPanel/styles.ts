import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const Content = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  minWidth: 0,
}));
export const PanelGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  columnGap: theme.spacing(2),
  rowGap: theme.spacing(3),
  [theme.breakpoints.up("md")]: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
}));
export const Panel = styled(Box)(({ theme }) => ({
  minWidth: 0,
  padding: theme.spacing(2),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  border: "1px solid " + theme.palette.divider,
  borderRadius: theme.spacing(2),
  background: theme.palette.background.paper,
  overflowWrap: "anywhere",
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(3) },
}));
export const PanelHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  "& button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: {
    alignItems: "stretch",
    flexDirection: "column",
    "& button": { width: "100%" },
  },
}));
export const ArchivePanel = styled(Panel)(({ theme }) => ({
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  "& button": { flexShrink: 0, minHeight: 44 },
}));
export const FormContainer = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));
export const ModalActions = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "100%",
  gap: theme.spacing(2),
  justifyContent: "flex-end",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    "& button": { width: "100%" },
  },
}));
