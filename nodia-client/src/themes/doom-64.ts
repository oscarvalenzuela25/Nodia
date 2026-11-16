// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const doom64: AppThemePreset = {
  "id": "doom-64",
  "name": "Doom 64",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#7d1313",
      "light": "#943d3d",
      "dark": "#671010",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#3e3e3e",
      "light": "#616161",
      "dark": "#333333",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#3e3e3e",
      "light": "#616161",
      "dark": "#333333",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#692e00",
      "light": "#84542e",
      "dark": "#562600",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#583804",
      "light": "#765c31",
      "dark": "#482e03",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#0d4823",
      "light": "#39694b",
      "dark": "#0b3b1d",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#342e98",
      "light": "#5954ab",
      "dark": "#2b267d",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#cccccc",
      "paper": "#b0b0b0",
      "surface": "#b0b0b0"
    },
    "text": {
      "primary": "#1f1f1f",
      "secondary": "#424242",
      "inverse": "#ffffff",
      "disabled": "rgba(31, 31, 31, 0.38)"
    },
    "border": {
      "default": "#505050"
    },
    "divider": "#505050",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#424242",
      "hover": "rgba(31, 31, 31, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(125, 19, 19, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(31, 31, 31, 0.26)",
      "disabledBackground": "rgba(31, 31, 31, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(125, 19, 19, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#ed7976",
      "light": "#f0918f",
      "dark": "#c26361",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#9c9c9c",
      "light": "#aeaeae",
      "dark": "#808080",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#9c9c9c",
      "light": "#aeaeae",
      "dark": "#808080",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#ffa000",
      "light": "#ffb12e",
      "dark": "#d18300",
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
      "main": "#8994f8",
      "light": "#9ea7f9",
      "dark": "#7079cb",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#1a1a1a",
      "paper": "#2a2a2a",
      "surface": "#2a2a2a"
    },
    "text": {
      "primary": "#e0e0e0",
      "secondary": "#a0a0a0",
      "inverse": "#000000",
      "disabled": "rgba(224, 224, 224, 0.5)"
    },
    "border": {
      "default": "#4a4a4a"
    },
    "divider": "#4a4a4a",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a0a0a0",
      "hover": "rgba(224, 224, 224, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(237, 121, 118, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(224, 224, 224, 0.3)",
      "disabledBackground": "rgba(224, 224, 224, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(237, 121, 118, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default doom64;
