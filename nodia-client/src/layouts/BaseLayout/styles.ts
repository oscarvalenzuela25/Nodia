import { styled } from "@mui/material/styles";
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
    [theme.breakpoints.up("lg")]: {
      width: `calc(100% - ${currentWidth}px)`,
      transition: theme.transitions.create(["width"], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
    },
  };
});

export const PageContent = styled("div")(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(4),
}));
