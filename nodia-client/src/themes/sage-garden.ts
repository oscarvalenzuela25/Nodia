// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const sageGarden: AppThemePreset = {
  "id": "sage-garden",
  "name": "Sage Garden",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#617166",
      "light": "#6d7972",
      "dark": "#505d54",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#1a1f2e",
      "light": "#434754",
      "dark": "#151926",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#1a1f2e",
      "light": "#434754",
      "dark": "#151926",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c23d39",
      "light": "#bc5855",
      "dark": "#9f322f",
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
      "default": "#f8f7f4",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#1a1f2e",
      "secondary": "#6a707e",
      "inverse": "#ffffff",
      "disabled": "rgba(26, 31, 46, 0.38)"
    },
    "border": {
      "default": "#e8e6e1"
    },
    "divider": "#e8e6e1",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#6a707e",
      "hover": "rgba(26, 31, 46, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(97, 113, 102, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(26, 31, 46, 0.26)",
      "disabledBackground": "rgba(26, 31, 46, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(97, 113, 102, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#7c9082",
      "light": "#94a499",
      "dark": "#69786d",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#f5f5f5",
      "light": "#f7f7f7",
      "dark": "#c9c9c9",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#f5f5f5",
      "light": "#f7f7f7",
      "dark": "#c9c9c9",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#ef4444",
      "light": "#f26666",
      "dark": "#c94848",
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
      "default": "#0a0a0a",
      "paper": "#121212",
      "surface": "#121212"
    },
    "text": {
      "primary": "#f5f5f5",
      "secondary": "#a0a0a0",
      "inverse": "#000000",
      "disabled": "rgba(245, 245, 245, 0.5)"
    },
    "border": {
      "default": "#2a2a2a"
    },
    "divider": "#2a2a2a",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a0a0a0",
      "hover": "rgba(245, 245, 245, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(124, 144, 130, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(245, 245, 245, 0.3)",
      "disabledBackground": "rgba(245, 245, 245, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(124, 144, 130, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default sageGarden;
