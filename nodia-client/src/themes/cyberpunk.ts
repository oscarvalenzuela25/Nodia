// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const cyberpunk: AppThemePreset = {
  "id": "cyberpunk",
  "name": "Cyberpunk",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#cb009f",
      "light": "#d02dad",
      "dark": "#a60082",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#0c0c1d",
      "light": "#383846",
      "dark": "#0a0a18",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#0c0c1d",
      "light": "#383846",
      "dark": "#0a0a18",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#ce3100",
      "light": "#c9502b",
      "dark": "#a92800",
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
      "default": "#f8f9fa",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#0c0c1d",
      "secondary": "#0c0c1d",
      "inverse": "#ffffff",
      "disabled": "rgba(12, 12, 29, 0.38)"
    },
    "border": {
      "default": "#dfe6e9"
    },
    "divider": "#dfe6e9",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#0c0c1d",
      "hover": "rgba(12, 12, 29, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(203, 0, 159, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(12, 12, 29, 0.26)",
      "disabledBackground": "rgba(12, 12, 29, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(203, 0, 159, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#ff2dd2",
      "light": "#ff53da",
      "dark": "#d125ac",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#eceff4",
      "light": "#eff2f6",
      "dark": "#c2c4c8",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#929299",
      "light": "#a6a6ab",
      "dark": "#78787d",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#ff541e",
      "light": "#ff7347",
      "dark": "#d14519",
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
      "main": "#818cf8",
      "light": "#98a1f9",
      "dark": "#6a73cb",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#0c0c1d",
      "paper": "#1e1e3f",
      "surface": "#1e1e3f"
    },
    "text": {
      "primary": "#eceff4",
      "secondary": "#8388a8",
      "inverse": "#000000",
      "disabled": "rgba(236, 239, 244, 0.5)"
    },
    "border": {
      "default": "#2e2e5e"
    },
    "divider": "#2e2e5e",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#8388a8",
      "hover": "rgba(236, 239, 244, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(255, 45, 210, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(236, 239, 244, 0.3)",
      "disabledBackground": "rgba(236, 239, 244, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(255, 45, 210, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default cyberpunk;
