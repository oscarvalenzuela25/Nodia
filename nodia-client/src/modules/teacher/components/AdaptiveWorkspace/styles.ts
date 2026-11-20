import { Drawer } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const AdaptiveDrawer = styled(Drawer)(({ theme }) => {
  const thumb = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2);
  return {
    "& .MuiDrawer-paper": {
      width: "min(100%, 760px)", maxWidth: "100vw", minWidth: 0, boxSizing: "border-box",
      padding: theme.spacing(2), paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      display: "flex", flexDirection: "column", gap: theme.spacing(2.5),
      backgroundImage: "none", borderLeft: `1px solid ${theme.palette.divider}`,
      overflowY: "auto", overscrollBehaviorY: "contain", scrollPaddingBlockStart: theme.spacing(9),
      scrollbarWidth: "thin", scrollbarColor: `${thumb} transparent`,
      "&::-webkit-scrollbar": { width: 6, height: 6 },
      "&::-webkit-scrollbar-track": { background: "transparent !important" },
      "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
      "&::-webkit-scrollbar-thumb": { background: thumb, borderRadius: 9999, border: 0,
        "&:hover": { background: alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.35) } },
      "& > *": { flexShrink: 0, minWidth: 0 },
      [theme.breakpoints.up("sm")]: { padding: theme.spacing(3), paddingBottom: "max(24px, env(safe-area-inset-bottom))", scrollPaddingBlockStart: theme.spacing(10) },
    },
  };
});

export const DrawerHeader = styled("div")(({ theme }) => ({
  position: "sticky", top: 0, zIndex: 1,
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(1.5), minWidth: 0,
  margin: theme.spacing(-2, -2, 0), padding: theme.spacing(1.5, 2),
  backgroundColor: theme.palette.background.paper, borderBottom: `1px solid ${theme.palette.divider}`,
  "& h2": { fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" },
  "& button": { flexShrink: 0, width: 44, height: 44 },
  [theme.breakpoints.up("sm")]: { margin: theme.spacing(-3, -3, 0), padding: theme.spacing(2, 3) },
}));

export const PanelTabs = styled("nav")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: theme.spacing(1), minWidth: 0,
  padding: theme.spacing(1), border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5), backgroundColor: theme.palette.action.hover,
  "& button": { minHeight: 44, minWidth: 0, justifyContent: "flex-start", textAlign: "start", overflowWrap: "anywhere" },
  "& .MuiButton-startIcon": { flexShrink: 0 },
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    padding: theme.spacing(1.5),
  },
}));
