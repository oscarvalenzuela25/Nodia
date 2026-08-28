import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router";
import {
  List,
  ListItem,
  Box,
  ListItemIcon,
  useTheme,
  useMediaQuery,
  Divider,
  Collapse,
} from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import AddReactionOutlinedIcon from "@mui/icons-material/AddReactionOutlined";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import nodiaLightLogo from "../../../assets/nodia_light_webp.webp";
import nodiaDarkLogo from "../../../assets/nodia_dark_webp.webp";

import {
  SidenavDrawer,
  LogoImage,
  NavItemButton,
  NavItemText,
  ModuleHeaderButton,
  ModuleHeaderText,
} from "./styles";
import type { SidenavItem } from "./types";

const mockMenu: SidenavItem[] = [
  { id: "inicio", nameKey: "menu_home", path: "/", icon: <HomeOutlinedIcon /> },
  {
    id: "ajustes-generales",
    nameKey: "menu_general_settings",
    icon: <SettingsOutlinedIcon />,
    subModules: [
      {
        id: "usuarios",
        nameKey: "menu_users",
        path: "/settings/users",
        icon: <PeopleOutlinedIcon />,
      },
      {
        id: "roles",
        nameKey: "menu_roles",
        path: "/settings/roles",
        icon: <AddReactionOutlinedIcon />,
      },
      {
        id: "modulos",
        nameKey: "menu_modules",
        path: "/settings/modules",
        icon: <ViewModuleOutlinedIcon />,
      },
      {
        id: "recursos",
        nameKey: "menu_resources",
        path: "/settings/resources",
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
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));

  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    "ajustes-generales": true,
  });

  const toggleModule = (moduleId: string) => {
    setOpenModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

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
            const hasSubModules =
              Boolean(moduleItem.subModules) &&
              (moduleItem.subModules?.length ?? 0) > 0;

            if (hasSubModules) {
              const isModuleOpen = Boolean(openModules[moduleItem.id]);

              return (
                <Box key={moduleItem.id}>
                  {isCollapsed ? (
                    <Divider sx={{ my: 2 }} />
                  ) : (
                    <ModuleHeaderButton
                      onClick={() => toggleModule(moduleItem.id)}
                      aria-expanded={isModuleOpen}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                        {moduleItem.icon && (
                          <ListItemIcon
                            sx={{
                              minWidth: 0,
                              mr: 1.5,
                              justifyContent: "center",
                              color: "inherit",
                            }}
                          >
                            {moduleItem.icon}
                          </ListItemIcon>
                        )}
                        <ModuleHeaderText primary={t(moduleItem.nameKey)} />
                      </Box>
                      <KeyboardArrowDownIcon
                        fontSize="small"
                        sx={{
                          transform: isModuleOpen
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: theme.transitions.create("transform", {
                            duration: theme.transitions.duration.shorter,
                          }),
                          color: "inherit",
                        }}
                      />
                    </ModuleHeaderButton>
                  )}

                  <Collapse
                    in={isCollapsed ? true : isModuleOpen}
                    timeout="auto"
                    unmountOnExit
                  >
                    <List disablePadding>
                      {moduleItem.subModules?.map((subItem) => (
                        <ListItem
                          key={subItem.id}
                          disablePadding
                          sx={{ display: "block" }}
                        >
                          <NavItemButton
                            selected={location.pathname === subItem.path}
                            onClick={() => subItem.path && navigate(subItem.path)}
                            sx={{
                              justifyContent: isCollapsed
                                ? "center"
                                : "initial",
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
                            {!isCollapsed && (
                              <NavItemText primary={t(subItem.nameKey)} />
                            )}
                          </NavItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
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
                  selected={location.pathname === moduleItem.path}
                  onClick={() => moduleItem.path && navigate(moduleItem.path)}
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
                  {!isCollapsed && (
                    <NavItemText primary={t(moduleItem.nameKey)} />
                  )}
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
