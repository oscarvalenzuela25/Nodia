import type { FC } from "react";
import { useTranslation } from "react-i18next";
import {
  List,
  ListItem,
  Box,
  ListItemIcon,
  useTheme,
  useMediaQuery,
  Divider,
} from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import AddReactionOutlinedIcon from "@mui/icons-material/AddReactionOutlined";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";

import nodiaLightLogo from "../../../assets/nodia_light_webp.webp";
import nodiaDarkLogo from "../../../assets/nodia_dark_webp.webp";

import {
  SidenavDrawer,
  LogoImage,
  NavHeader,
  NavItemButton,
  NavItemText,
} from "./styles";
import type { SidenavItem } from "./types";

const mockMenu: SidenavItem[] = [
  { id: "inicio", nameKey: "menu_home", path: "/", icon: <HomeOutlinedIcon /> },
  {
    id: "ajustes-generales",
    nameKey: "menu_general_settings",
    subModules: [
      {
        id: "usuarios",
        nameKey: "menu_users",
        path: "/usuarios",
        icon: <PeopleOutlinedIcon />,
      },
      { id: "roles", nameKey: "menu_roles", path: "/roles", icon: <AddReactionOutlinedIcon /> },
      {
        id: "modulos",
        nameKey: "menu_modules",
        path: "/modulos",
        icon: <ViewModuleOutlinedIcon />,
      },
      {
        id: "recursos",
        nameKey: "menu_resources",
        path: "/recursos",
        icon: <AppsOutlinedIcon />,
      },
    ],
  },
];

type Props = {
  mobileOpen: boolean;
  onDrawerToggle: () => void;
  desktopCollapsed?: boolean;
};

const Sidenav: FC<Props> = ({
  mobileOpen,
  onDrawerToggle,
  desktopCollapsed = false,
}) => {
  const { t } = useTranslation("layout");
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));

  const drawerVariant = isLgUp ? "permanent" : "temporary";
  const isCollapsed = desktopCollapsed;
  const logoSrc =
    theme.palette.mode === "dark" ? nodiaDarkLogo : nodiaLightLogo;

  return (
    <SidenavDrawer
      variant={drawerVariant}
      anchor="left"
      open={isLgUp ? true : mobileOpen}
      onClose={onDrawerToggle}
      collapsed={isCollapsed}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {!isCollapsed && <LogoImage src={logoSrc} alt="Nodia Logo" />}
        </Box>

        <List disablePadding>
          {mockMenu.map((moduleItem) => {
            if (moduleItem.subModules && moduleItem.subModules.length > 0) {
              return (
                <Box key={moduleItem.id}>
                  {isCollapsed ? (
                    <Divider sx={{ my: 2 }} />
                  ) : (
                    <NavHeader disableSticky>{t(moduleItem.nameKey)}</NavHeader>
                  )}
                  {moduleItem.subModules.map((subItem) => (
                    <ListItem
                      key={subItem.id}
                      disablePadding
                      sx={{ display: "block" }}
                    >
                      <NavItemButton
                        sx={{
                          justifyContent: isCollapsed ? "center" : "initial",
                        }}
                      >
                        {subItem.icon && (
                          <ListItemIcon
                            sx={{
                              minWidth: 0,
                              mr: isCollapsed ? 0 : 2,
                              justifyContent: "center",
                              color: "inherit",
                              transition:
                                "color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
                            }}
                          >
                            {subItem.icon}
                          </ListItemIcon>
                        )}
                        {!isCollapsed && <NavItemText primary={t(subItem.nameKey)} />}
                      </NavItemButton>
                    </ListItem>
                  ))}
                </Box>
              );
            }

            return (
              <ListItem
                key={moduleItem.id}
                disablePadding
                sx={{ mb: 1, display: "block" }}
              >
                <NavItemButton
                  sx={{ justifyContent: isCollapsed ? "center" : "initial" }}
                >
                  {moduleItem.icon && (
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: isCollapsed ? 0 : 2,
                        justifyContent: "center",
                        color: "inherit",
                        transition:
                          "color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
                      }}
                    >
                      {moduleItem.icon}
                    </ListItemIcon>
                  )}
                  {!isCollapsed && <NavItemText primary={t(moduleItem.nameKey)} />}
                </NavItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </SidenavDrawer>
  );
};

export default Sidenav;
