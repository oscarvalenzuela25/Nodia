import { Drawer } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const AdaptiveDrawer = styled(Drawer)(({ theme }) => {
  const thumb = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2);
  return {
    "& .MuiDrawer-paper": {
      width: "min(100%, 760px)", maxWidth: "100vw", minWidth: 0, boxSizing: "border-box",
      padding: theme.spacing(2), paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      display: "flex", flexDirection: "column", gap: theme.spacing(2),
      backgroundImage: "none", borderLeft: `1px solid ${theme.palette.divider}`,
      overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: `${thumb} transparent`,
      "&::-webkit-scrollbar": { width: 6, height: 6 },
      "&::-webkit-scrollbar-track": { background: "transparent !important" },
      "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
      "&::-webkit-scrollbar-thumb": { background: thumb, borderRadius: 9999, border: 0,
        "&:hover": { background: alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.35) } },
      "& > *": { flexShrink: 0, minWidth: 0 },
      [theme.breakpoints.up("sm")]: { padding: theme.spacing(3), paddingBottom: "max(24px, env(safe-area-inset-bottom))" },
    },
  };
});

export const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(1), minWidth: 0,
  "& h2": { minWidth: 0, overflowWrap: "anywhere" },
  "& button": { flexShrink: 0, width: 44, height: 44 },
}));

export const PanelTabs = styled("div")(({ theme }) => ({
  display: "flex", flexWrap: "wrap", gap: theme.spacing(1), minWidth: 0,
  "& button": { minHeight: 44, minWidth: 0, overflowWrap: "anywhere", maxWidth: "100%" },
}));
