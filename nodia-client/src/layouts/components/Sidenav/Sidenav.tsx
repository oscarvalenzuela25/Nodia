import type { FC } from "react";
import { useState, useMemo } from "react";
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
import AddReactionOutlinedIcon from "@mui/icons-material/AddReactionOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import { useUserModules, getModulePath } from "../../../store/generalSettings";
import type {
  TranslateItem,
} from "../../../store/generalSettings/types";
import {
  SidenavDrawer,
  LogoContainer,
  LogoTitle,
  NavItemButton,
  NavItemText,
  ModuleHeaderButton,
  ModuleHeaderText,
} from "./styles";
import type { SidenavItem } from "./types";

const getModuleIcon = (key: string) => {
  const normalized = key.toLowerCase();
  switch (normalized) {
    case "usuarios":
    case "users":
      return <AddReactionOutlinedIcon />;
    case "roles":
      return <SecurityOutlinedIcon />;
    case "acciones":
    case "actions":
      return <BoltOutlinedIcon />;
    case "modulos":
    case "modules":
      return <ViewModuleOutlinedIcon />;
    default:
      return <ViewModuleOutlinedIcon />;
  }
};

const getGroupIcon = (key: string) => {
  const normalized = key.toLowerCase();
  switch (normalized) {
    case "ajustes-generales":
    case "general-settings":
    case "general_settings":
    case "settings":
      return <SettingsOutlinedIcon />;
    default:
      return <SettingsOutlinedIcon />;
  }
};

const getTranslatedLabel = (
  translates: TranslateItem[] | undefined,
  defaultKey: string,
  lang: string,
  t: (key: string) => string
): string => {
  if (translates && translates.length > 0) {
    const isEn = lang.startsWith("en");
    const preferred = isEn ? "en" : "es";
    const secondary = isEn ? "es" : "en";

    const item =
      translates.find((tr) => tr.key === "key" || tr.key === "name") ||
      translates[0];

    if (item) {
      const val = item[preferred] || item[secondary];
      if (val && val.trim()) return val;
    }
  }

  const i18nCandidate = `menu_${defaultKey.toLowerCase().replace(/[-_]/g, "_")}`;
  const translated = t(i18nCandidate);
  if (translated && translated !== i18nCandidate) {
    return translated;
  }

  return defaultKey;
};

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
  const { t, i18n } = useTranslation("layout");
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));
  const userModules = useUserModules();
  const lang = i18n.language || "es";

  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const toggleModule = (moduleId: string) => {
    setOpenModules((prev) => ({
      ...prev,
      [moduleId]: !(prev[moduleId] ?? true),
    }));
  };

  const menuItems = useMemo<SidenavItem[]>(() => {
    const homeItem: SidenavItem = {
      id: "inicio",
      nameKey: "menu_home",
      path: "/",
      icon: <HomeOutlinedIcon />,
    };

    if (!userModules || userModules.length === 0) {
      return [homeItem];
    }

    const dynamicGroups: SidenavItem[] = userModules.map((group) => {
      const groupTitle = getTranslatedLabel(
        group.translates,
        group.module_group_key,
        lang,
        t
      );

      const subModules = (group.modules ?? []).map((m) => {
        const moduleTitle = getTranslatedLabel(m.translates, m.key, lang, t);
        const path = getModulePath(m);
        const icon = getModuleIcon(m.key);

        return {
          id: m.key,
          name: moduleTitle,
          path,
          icon,
        };
      });

      return {
        id: group.module_group_key,
        name: groupTitle,
        icon: getGroupIcon(group.module_group_key),
        subModules,
      };
    });

    return [homeItem, ...dynamicGroups];
  }, [userModules, lang, t]);

  const drawerVariant = isLgUp ? "permanent" : "temporary";
  const isCollapsed = desktopCollapsed;

  return (
    <SidenavDrawer
      variant={drawerVariant}
      anchor="left"
      open={isLgUp ? true : mobileOpen}
      onClose={onDrawerToggle}
      collapsed={isCollapsed}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {!isCollapsed && (
          <LogoContainer>
            <LogoTitle>Nodia</LogoTitle>
          </LogoContainer>
        )}

        <List disablePadding>
          {menuItems.map((moduleItem) => {
            const hasSubModules =
              Boolean(moduleItem.subModules) &&
              (moduleItem.subModules?.length ?? 0) > 0;

            const displayName =
              moduleItem.name ||
              (moduleItem.nameKey ? t(moduleItem.nameKey) : moduleItem.id);

            if (hasSubModules) {
              const isModuleOpen = openModules[moduleItem.id] ?? true;

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
                        <ModuleHeaderText primary={displayName} />
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
                      {moduleItem.subModules?.map((subItem) => {
                        const subDisplayName =
                          subItem.name ||
                          (subItem.nameKey ? t(subItem.nameKey) : subItem.id);

                        return (
                          <ListItem
                            key={subItem.id}
                            disablePadding
                            sx={{ display: "block" }}
                          >
                            <NavItemButton
                              selected={location.pathname === subItem.path}
                              onClick={() =>
                                subItem.path && navigate(subItem.path)
                              }
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
                                <NavItemText primary={subDisplayName} />
                              )}
                            </NavItemButton>
                          </ListItem>
                        );
                      })}
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
                  {!isCollapsed && <NavItemText primary={displayName} />}
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
