// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const bubblegum: AppThemePreset = {
  "id": "bubblegum",
  "name": "Bubblegum",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#a53f7a",
      "light": "#ab5d8a",
      "dark": "#873464",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#333333",
      "light": "#585858",
      "dark": "#2a2a2a",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#333333",
      "light": "#585858",
      "dark": "#2a2a2a",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#a3494a",
      "light": "#a96364",
      "dark": "#863c3d",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#8c5a06",
      "light": "#967030",
      "dark": "#734a05",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#147438",
      "light": "#3a8456",
      "dark": "#105f2e",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#f6e6ee",
      "paper": "#fdedc9",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#5b5b5b",
      "secondary": "#686868",
      "inverse": "#ffffff",
      "disabled": "rgba(91, 91, 91, 0.38)"
    },
    "border": {
      "default": "#d04f99"
    },
    "divider": "#d04f99",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#686868",
      "hover": "rgba(91, 91, 91, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(165, 63, 122, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(91, 91, 91, 0.26)",
      "disabledBackground": "rgba(91, 91, 91, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(165, 63, 122, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#fbe2a7",
      "light": "#fce7b7",
      "dark": "#ceb989",
      "contrastText": "#12242e"
    },
    "secondary": {
      "main": "#98a0a4",
      "light": "#abb1b4",
      "dark": "#7d8386",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#f3e3ea",
      "light": "#f5e8ee",
      "dark": "#c7bac0",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#e778b2",
      "light": "#eb90c0",
      "dark": "#c26d99",
      "contrastText": "#12242e"
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
      "main": "#8b96f9",
      "light": "#a0a9fa",
      "dark": "#727bcc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#12242e",
      "paper": "#1c2e38",
      "surface": "#1c2e38"
    },
    "text": {
      "primary": "#f3e3ea",
      "secondary": "#e4a2b1",
      "inverse": "#000000",
      "disabled": "rgba(243, 227, 234, 0.5)"
    },
    "border": {
      "default": "#324859"
    },
    "divider": "#324859",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#e4a2b1",
      "hover": "rgba(243, 227, 234, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(251, 226, 167, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(243, 227, 234, 0.3)",
      "disabledBackground": "rgba(243, 227, 234, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(251, 226, 167, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default bubblegum;
