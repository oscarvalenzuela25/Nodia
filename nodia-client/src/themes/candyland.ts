// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const candyland: AppThemePreset = {
  "id": "candyland",
  "name": "Candyland",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#87656b",
      "light": "#897075",
      "dark": "#6f5358",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#000000",
      "light": "#2e2e2e",
      "dark": "#000000",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#000000",
      "light": "#2e2e2e",
      "dark": "#000000",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c73939",
      "light": "#bf5555",
      "dark": "#a32f2f",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#996207",
      "light": "#976f2e",
      "dark": "#7d5006",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#167e3c",
      "light": "#398555",
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
      "default": "#f7f9fa",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#333333",
      "secondary": "#6e6e6e",
      "inverse": "#ffffff",
      "disabled": "rgba(51, 51, 51, 0.38)"
    },
    "border": {
      "default": "#d4d4d4"
    },
    "divider": "#d4d4d4",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#6e6e6e",
      "hover": "rgba(51, 51, 51, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(135, 101, 107, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(51, 51, 51, 0.26)",
      "disabledBackground": "rgba(51, 51, 51, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(135, 101, 107, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#ff99cc",
      "light": "#ffabd5",
      "dark": "#d17da7",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#a8a8a8",
      "light": "#b8b8b8",
      "dark": "#8a8a8a",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#a8a8a8",
      "light": "#b8b8b8",
      "dark": "#8a8a8a",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f58989",
      "light": "#f79e9e",
      "dark": "#c97070",
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
      "main": "#99a2f9",
      "light": "#abb3fa",
      "dark": "#7d85cc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#1a1d23",
      "paper": "#2f3436",
      "surface": "#2f3436"
    },
    "text": {
      "primary": "#e5e5e5",
      "secondary": "#a3a3a3",
      "inverse": "#000000",
      "disabled": "rgba(229, 229, 229, 0.5)"
    },
    "border": {
      "default": "#444444"
    },
    "divider": "#444444",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a3a3a3",
      "hover": "rgba(229, 229, 229, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(255, 153, 204, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(229, 229, 229, 0.3)",
      "disabledBackground": "rgba(229, 229, 229, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(255, 153, 204, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default candyland;
