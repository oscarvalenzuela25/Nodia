import { Box, Drawer } from "@mui/material";
import { styled } from "@mui/material/styles";
import { ScrollArea } from "../../pages/NodiaAI/styles";

export const PreferencesDrawer = styled(Drawer)(({ theme }) => ({
  "& .MuiDrawer-paper": { width: "min(100vw, 560px)", maxWidth: "100vw", boxSizing: "border-box", background: theme.palette.background.paper },
}));
export const Header = styled(Box)(({ theme }) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(2), padding: theme.spacing(2, 3), borderBottom: `1px solid ${theme.palette.divider}`,
  "& button": { minWidth: 44, minHeight: 44 },
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
}));
export const Content = styled(ScrollArea)(({ theme }) => ({
  flex: 1, display: "flex", flexDirection: "column", gap: theme.spacing(3), padding: theme.spacing(3),
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
}));
export const Card = styled("article")(({ theme }) => ({
  minWidth: 0, overflowWrap: "anywhere", display: "flex", flexDirection: "column", gap: theme.spacing(1), padding: theme.spacing(2), border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius,
}));
export const Actions = styled(Box)(({ theme }) => ({
  display: "flex", flexWrap: "wrap", gap: theme.spacing(1), "& button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { flexDirection: "column", "& button": { width: "100%" } },
}));
