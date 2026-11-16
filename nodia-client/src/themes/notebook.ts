// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const notebook: AppThemePreset = {
  "id": "notebook",
  "name": "Notebook",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#606060",
      "light": "#6d6d6d",
      "dark": "#4f4f4f",
      "contrastText": "#f0f0f0"
    },
    "secondary": {
      "main": "#3a3a3a",
      "light": "#5d5d5d",
      "dark": "#303030",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#5d4037",
      "light": "#7a625b",
      "dark": "#4c342d",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#995e5e",
      "light": "#966c6c",
      "dark": "#7d4d4d",
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
      "default": "#f9f9f9",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#3a3a3a",
      "secondary": "#505050",
      "inverse": "#ffffff",
      "disabled": "rgba(58, 58, 58, 0.38)"
    },
    "border": {
      "default": "#747272"
    },
    "divider": "#747272",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#505050",
      "hover": "rgba(58, 58, 58, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(96, 96, 96, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(58, 58, 58, 0.26)",
      "disabledBackground": "rgba(58, 58, 58, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(96, 96, 96, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#b0b0b0",
      "light": "#bebebe",
      "dark": "#929292",
      "contrastText": "#2b2b2b"
    },
    "secondary": {
      "main": "#c0c0c0",
      "light": "#cbcbcb",
      "dark": "#9d9d9d",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#a8a8a8",
      "light": "#b8b8b8",
      "dark": "#8a8a8a",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#d9afaf",
      "light": "#e0bdbd",
      "dark": "#b29090",
      "contrastText": "#2b2b2b"
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
      "main": "#99a1f9",
      "light": "#abb2fa",
      "dark": "#7d84cc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#2b2b2b",
      "paper": "#333333",
      "surface": "#333333"
    },
    "text": {
      "primary": "#dcdcdc",
      "secondary": "#a0a0a0",
      "inverse": "#000000",
      "disabled": "rgba(220, 220, 220, 0.5)"
    },
    "border": {
      "default": "#4f4f4f"
    },
    "divider": "#4f4f4f",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a0a0a0",
      "hover": "rgba(220, 220, 220, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(176, 176, 176, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(220, 220, 220, 0.3)",
      "disabledBackground": "rgba(220, 220, 220, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(176, 176, 176, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default notebook;
