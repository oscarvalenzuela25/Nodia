// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const oceanBreeze: AppThemePreset = {
  "id": "ocean-breeze",
  "name": "Ocean Breeze",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#167d3c",
      "light": "#3a8555",
      "dark": "#126731",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#4b5563",
      "light": "#6b747f",
      "dark": "#3e4651",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#374151",
      "light": "#5b6370",
      "dark": "#2d3542",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c53838",
      "light": "#bf5555",
      "dark": "#a22e2e",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#976107",
      "light": "#986f2e",
      "dark": "#7c5006",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#167d3c",
      "light": "#3a8555",
      "dark": "#126731",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#f0f8ff",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#374151",
      "secondary": "#6a707e",
      "inverse": "#ffffff",
      "disabled": "rgba(55, 65, 81, 0.38)"
    },
    "border": {
      "default": "#e5e7eb"
    },
    "divider": "#e5e7eb",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#6a707e",
      "hover": "rgba(55, 65, 81, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(22, 125, 60, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(55, 65, 81, 0.26)",
      "disabledBackground": "rgba(55, 65, 81, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(22, 125, 60, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#34d399",
      "light": "#59dbab",
      "dark": "#2bad7d",
      "contrastText": "#0f172a"
    },
    "secondary": {
      "main": "#a1a1aa",
      "light": "#b2b2b9",
      "dark": "#84848b",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#a1a1aa",
      "light": "#b2b2b9",
      "dark": "#84848b",
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
      "primary": "#d1d5db",
      "secondary": "#8b919b",
      "inverse": "#000000",
      "disabled": "rgba(209, 213, 219, 0.5)"
    },
    "border": {
      "default": "#4b5563"
    },
    "divider": "#4b5563",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#8b919b",
      "hover": "rgba(209, 213, 219, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(52, 211, 153, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(209, 213, 219, 0.3)",
      "disabledBackground": "rgba(209, 213, 219, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(52, 211, 153, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default oceanBreeze;
