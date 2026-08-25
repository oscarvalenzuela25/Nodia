import { useState, type FC, type PropsWithChildren } from "react";
import { useTheme, useMediaQuery } from "@mui/material";
import Sidenav from "../components/Sidenav";
import Topbar from "../components/Topbar";
import { LayoutWrapper, MainContainer, PageContent } from "./styles";

type Props = PropsWithChildren;

const BaseLayout: FC<Props> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));

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
        <PageContent>{children}</PageContent>
      </MainContainer>
    </LayoutWrapper>
  );
};

export default BaseLayout;
