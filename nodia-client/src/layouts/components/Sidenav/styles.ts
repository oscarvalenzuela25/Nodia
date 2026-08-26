import {
  Drawer,
  ListItemButton,
  ListSubheader,
  ListItemText,
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";

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
  "&.Mui-selected": {
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    boxShadow: `0 8px 16px -4px ${alpha(theme.palette.primary.main, 0.5)}, 0 4px 8px -4px ${alpha(theme.palette.primary.main, 0.3)}`,
    transform: "scale(1.02) translateX(4px)",
    position: "relative",
    overflow: "hidden",
    border: `1px solid ${alpha(theme.palette.primary.light, 0.2)}`,
    "&::before": {
      content: '""',
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "linear-gradient(to right, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)",
      pointerEvents: "none",
    },
    "& .MuiListItemIcon-root, & .MuiTypography-root": {
      color: theme.palette.primary.contrastText,
      fontWeight: 700,
      textShadow: "0 2px 4px rgba(0,0,0,0.2)",
    },
    "&:hover": {
      background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
      transform: "scale(1.04) translateX(6px)",
      boxShadow: `0 12px 20px -4px ${alpha(theme.palette.primary.main, 0.6)}`,
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
