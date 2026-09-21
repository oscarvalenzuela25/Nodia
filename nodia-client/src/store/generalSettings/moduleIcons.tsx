import type { ReactNode } from "react";
import AddReactionOutlinedIcon from "@mui/icons-material/AddReactionOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

export const getModuleIcon = (key: string): ReactNode => {
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
    case "negocios":
    case "business":
    case "businesses":
      return <StorefrontOutlinedIcon />;
    default:
      return <ViewModuleOutlinedIcon />;
  }
};

export const getGroupIcon = (key: string): ReactNode => {
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
