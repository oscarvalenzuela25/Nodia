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
  // Conversation pages consume the available viewport; other pages keep document scrolling.
  "&:has([data-page-layout='conversation'])": {
    height: "calc(100dvh - var(--nodia-keyboard-inset, 0px))",
    minHeight: 0,
  },
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
    "&:has([data-page-layout='conversation'])": {
      minHeight: 0,
      "& > header": { flexShrink: 0 },
    },
    [theme.breakpoints.up("lg")]: {
      width: `calc(100% - ${currentWidth}px)`,
      "@media (prefers-reduced-motion: no-preference)": {
        transition: theme.transitions.create("width", {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    },
  };
});

export const PageContent = styled("div", { shouldForwardProp: prop => prop !== "mobileNavigation" })<{ mobileNavigation?: boolean }>(({ theme, mobileNavigation }) => ({
  flexGrow: 1,
  padding: theme.spacing(2),
  ...(mobileNavigation ? {
    paddingBottom: `calc(${theme.spacing(2)} + var(--nodia-dock-reserve, ${MOBILE_NAV_RESERVED_HEIGHT}))`,
  } : {}),
  "&:has([data-page-layout='conversation'])": {
    display: "flex", flexDirection: "column", minHeight: 0,
    [theme.breakpoints.down("md")]: {
      overflowY: "auto",
      scrollPaddingBottom: mobileNavigation ? `var(--nodia-dock-reserve, ${MOBILE_NAV_RESERVED_HEIGHT})` : undefined,
    },
    "& [data-route-guard], & [data-route-view]": {
      display: "flex", flexDirection: "column", minHeight: 0, flex: 1,
      [theme.breakpoints.down("md")]: { minHeight: "min-content" },
    },
    "& [data-route-guard] > :not([data-route-view])": { flexShrink: 0 },
  },
  [theme.breakpoints.up("sm")]: {
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
  },
  [theme.breakpoints.up("md")]: {
    paddingLeft: theme.spacing(4),
    paddingRight: theme.spacing(4),
  },
}));
