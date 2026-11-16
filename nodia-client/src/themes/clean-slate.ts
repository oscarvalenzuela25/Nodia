// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const cleanSlate: AppThemePreset = {
  "id": "clean-slate",
  "name": "Clean Slate",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#5c5edf",
      "light": "#6b6dca",
      "dark": "#4b4db7",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#374151",
      "light": "#5b6370",
      "dark": "#2d3542",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#374151",
      "light": "#5b6370",
      "dark": "#2d3542",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c83939",
      "light": "#bf5555",
      "dark": "#a42f2f",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#996307",
      "light": "#96702e",
      "dark": "#7d5106",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#167f3d",
      "light": "#398555",
      "dark": "#126832",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#f8fafc",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#1e293b",
      "secondary": "#6b7280",
      "inverse": "#ffffff",
      "disabled": "rgba(30, 41, 59, 0.38)"
    },
    "border": {
      "default": "#d1d5db"
    },
    "divider": "#d1d5db",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#6b7280",
      "hover": "rgba(30, 41, 59, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(92, 94, 223, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(30, 41, 59, 0.26)",
      "disabledBackground": "rgba(30, 41, 59, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(92, 94, 223, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#8792f8",
      "light": "#9da6f9",
      "dark": "#7079cc",
      "contrastText": "#0f172a"
    },
    "secondary": {
      "main": "#d1d5db",
      "light": "#d9dde1",
      "dark": "#abafb4",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#d1d5db",
      "light": "#d9dde1",
      "dark": "#abafb4",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f37070",
      "light": "#f58a8a",
      "dark": "#c86060",
      "contrastText": "#0f172a"
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
      "main": "#8792f8",
      "light": "#9da6f9",
      "dark": "#6f78cb",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#0f172a",
      "paper": "#1e293b",
      "surface": "#1e293b"
    },
    "text": {
      "primary": "#e2e8f0",
      "secondary": "#9ca3af",
      "inverse": "#000000",
      "disabled": "rgba(226, 232, 240, 0.5)"
    },
    "border": {
      "default": "#4b5563"
    },
    "divider": "#4b5563",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#9ca3af",
      "hover": "rgba(226, 232, 240, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(135, 146, 248, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(226, 232, 240, 0.3)",
      "disabledBackground": "rgba(226, 232, 240, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(135, 146, 248, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default cleanSlate;
