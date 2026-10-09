import { useState, Suspense, type FC, type PropsWithChildren } from "react";
import { useTheme, useMediaQuery } from "@mui/material";
import Sidenav from "../components/Sidenav";
import Topbar from "../components/Topbar";
import RouteLoader from "../../components/RouteLoader";
import { LayoutWrapper, MainContainer, PageContent } from "./styles";
import MobileBottomNav from "../components/MobileBottomNav";
import useAuth from "../../hooks/useAuth";

type Props = PropsWithChildren;

const BaseLayout: FC<Props> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { isSessionValid } = useAuth();
  const hasMobileNav = isMobile && isSessionValid;

  // Sidenav is only collapsed on Desktop when toggled. On mobile, it's a full-width drawer.
  const isCollapsed = isLgUp ? desktopCollapsed : false;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleCollapseToggle = () => {
    setDesktopCollapsed(!desktopCollapsed);
  };

  return (
    <LayoutWrapper>
      <Sidenav
        mobileOpen={mobileOpen}
        onDrawerToggle={handleDrawerToggle}
        desktopCollapsed={isCollapsed}
      />
      <MainContainer collapsed={isCollapsed}>
        <Topbar
          onDrawerToggle={handleDrawerToggle}
          desktopCollapsed={desktopCollapsed}
          onCollapseToggle={handleCollapseToggle}
        />
        <PageContent mobileNavigation={hasMobileNav}>
          <Suspense fallback={<RouteLoader variant="page" />}>
            {children}
          </Suspense>
        </PageContent>
        {hasMobileNav && <MobileBottomNav />}
      </MainContainer>
    </LayoutWrapper>
  );
};

export default BaseLayout;
