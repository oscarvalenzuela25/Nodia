// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const amethystHaze: AppThemePreset = {
  "id": "amethyst-haze",
  "name": "Amethyst Haze",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#756691",
      "light": "#786d8b",
      "dark": "#605477",
      "contrastText": "#f8f7fa"
    },
    "secondary": {
      "main": "#3d3c4f",
      "light": "#605f6f",
      "dark": "#323141",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#4b2e36",
      "light": "#6b545a",
      "dark": "#3e262c",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#b24c4c",
      "light": "#a65d5d",
      "dark": "#923e3e",
      "contrastText": "#f8f7fa"
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
      "default": "#f8f7fa",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#3d3c4f",
      "secondary": "#6b6880",
      "inverse": "#ffffff",
      "disabled": "rgba(61, 60, 79, 0.38)"
    },
    "border": {
      "default": "#cec9d9"
    },
    "divider": "#cec9d9",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#6b6880",
      "hover": "rgba(61, 60, 79, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(117, 102, 145, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(61, 60, 79, 0.26)",
      "disabledBackground": "rgba(61, 60, 79, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(117, 102, 145, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#a995c9",
      "light": "#b8a8d3",
      "dark": "#8b7aa5",
      "contrastText": "#1a1823"
    },
    "secondary": {
      "main": "#e0ddef",
      "light": "#e6e3f2",
      "dark": "#b8b5c4",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#f2b8c6",
      "light": "#f4c5d0",
      "dark": "#c697a2",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#e57373",
      "light": "#ea8c8c",
      "dark": "#c06868",
      "contrastText": "#1a1823"
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
      "default": "#1a1823",
      "paper": "#232030",
      "surface": "#232030"
    },
    "text": {
      "primary": "#e0ddef",
      "secondary": "#a09aad",
      "inverse": "#000000",
      "disabled": "rgba(224, 221, 239, 0.5)"
    },
    "border": {
      "default": "#302c40"
    },
    "divider": "#302c40",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a09aad",
      "hover": "rgba(224, 221, 239, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(169, 149, 201, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(224, 221, 239, 0.3)",
      "disabledBackground": "rgba(224, 221, 239, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(169, 149, 201, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default amethystHaze;
