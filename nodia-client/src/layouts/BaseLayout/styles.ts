import { styled } from "@mui/material/styles";
import { MOBILE_NAV_RESERVED_HEIGHT } from "../components/MobileBottomNav/styles";
import {
  DRAWER_WIDTH,
  DRAWER_COLLAPSED_WIDTH,
} from "../components/Sidenav/styles";

export const LayoutWrapper = styled("div")({
  display: "flex",
  minHeight: "100vh",
  width: "100%",
});

export const MainContainer = styled("main", {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<{ collapsed?: boolean }>(({ theme, collapsed }) => {
  const currentWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  return {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    minWidth: 0,
    [theme.breakpoints.up("lg")]: {
      width: `calc(100% - ${currentWidth}px)`,
      transition: theme.transitions.create(["width"], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
    },
  };
});

export const PageContent = styled("div", { shouldForwardProp: prop => prop !== "mobileNavigation" })<{ mobileNavigation?: boolean }>(({ theme, mobileNavigation }) => ({
  flexGrow: 1,
  padding: theme.spacing(2),
  ...(mobileNavigation ? { paddingBottom: `calc(${theme.spacing(2)} + ${MOBILE_NAV_RESERVED_HEIGHT})` } : {}),
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(3),
  },
  [theme.breakpoints.up("md")]: {
    padding: theme.spacing(4),
  },
}));
