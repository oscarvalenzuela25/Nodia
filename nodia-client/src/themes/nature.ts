// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const nature: AppThemePreset = {
  "id": "nature",
  "name": "Nature",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#2d7a31",
      "light": "#4b834d",
      "dark": "#256428",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#1b5e20",
      "light": "#447b48",
      "dark": "#164d1a",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#1b5e20",
      "light": "#447b48",
      "dark": "#164d1a",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c62828",
      "light": "#c94d4d",
      "dark": "#a22121",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#966007",
      "light": "#976f2e",
      "dark": "#7b4f06",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#157c3b",
      "light": "#398555",
      "dark": "#116630",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#f8f5f0",
      "paper": "#f8f5f0",
      "surface": "#f8f5f0"
    },
    "text": {
      "primary": "#3e2723",
      "secondary": "#6d4c41",
      "inverse": "#ffffff",
      "disabled": "rgba(62, 39, 35, 0.38)"
    },
    "border": {
      "default": "#e0d6c9"
    },
    "divider": "#e0d6c9",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#6d4c41",
      "hover": "rgba(62, 39, 35, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(45, 122, 49, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(62, 39, 35, 0.26)",
      "disabledBackground": "rgba(62, 39, 35, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(45, 122, 49, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#6fbf72",
      "light": "#89cb8b",
      "dark": "#5b9d5d",
      "contrastText": "#0a1f0c"
    },
    "secondary": {
      "main": "#d7e0d6",
      "light": "#dee6dd",
      "dark": "#b0b8af",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#f0ebe5",
      "light": "#f3efea",
      "dark": "#c5c1bc",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#e49a9a",
      "light": "#e9acac",
      "dark": "#bb7e7e",
      "contrastText": "#000000"
    },
    "warning": {
      "main": "#fcd34d",
      "light": "#fddb6d",
      "dark": "#cfad3f",
      "contrastText": "#000000"
    },
    "success": {
      "main": "#4ade80",
      "light": "#6be497",
      "dark": "#3db669",
      "contrastText": "#000000"
    },
    "info": {
      "main": "#9ea7fa",
      "light": "#afb7fb",
      "dark": "#8289cd",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#1c2a1f",
      "paper": "#2d3a2e",
      "surface": "#2d3a2e"
    },
    "text": {
      "primary": "#f0ebe5",
      "secondary": "#d7cfc4",
      "inverse": "#000000",
      "disabled": "rgba(240, 235, 229, 0.5)"
    },
    "border": {
      "default": "#3e4a3d"
    },
    "divider": "#3e4a3d",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#d7cfc4",
      "hover": "rgba(240, 235, 229, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(111, 191, 114, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(240, 235, 229, 0.3)",
      "disabledBackground": "rgba(240, 235, 229, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(111, 191, 114, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default nature;
