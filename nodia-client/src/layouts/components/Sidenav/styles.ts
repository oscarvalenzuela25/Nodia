import {
  Drawer,
  ListItemButton,
  ListSubheader,
  ListItemText,
} from "@mui/material";
import { styled } from "@mui/material/styles";

export const DRAWER_WIDTH = 256;
export const DRAWER_COLLAPSED_WIDTH = 88;

export const SidenavDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
  width: collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH,
  flexShrink: 0,
  "& .MuiDrawer-paper": {
    width: collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH,
    boxSizing: "border-box",
    padding: collapsed ? "16px 8px" : "16px",
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
}));

export const LogoImage = styled("img")({
  width: "100%",
  objectFit: "contain",
});

export const NavHeader = styled(ListSubheader)(({ theme }) => ({
  fontWeight: 600,
  fontSize: "16px",
  lineHeight: 1.5,
  padding: theme.spacing(0, 1.5),
  marginTop: theme.spacing(3),
  marginBottom: "12px",
  backgroundColor: "transparent",
  whiteSpace: "nowrap",
  color: theme.palette.text.secondary,
}));

export const NavItemButton = styled(ListItemButton)(({ theme }) => ({
  borderRadius: typeof theme.shape.borderRadius === "number" ? theme.shape.borderRadius * 1.5 : 8,
  padding: theme.spacing(1, 1.5),
  marginBottom: theme.spacing(0.5),
  transition: theme.transitions.create(["background-color", "color", "transform"], {
    duration: theme.transitions.duration.shorter,
  }),
  "&:hover": {
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
    transform: "translateX(2px)",
    "& .MuiListItemIcon-root, & .MuiTypography-root": {
      color: theme.palette.primary.main,
    },
  },
}));

export const NavItemText = styled(ListItemText)({
  whiteSpace: "nowrap",
  margin: 0,
  "& .MuiTypography-root": {
    fontSize: "0.9rem",
    fontWeight: 500,
    letterSpacing: "-0.01em",
  },
});
