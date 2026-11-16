// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const neoBrutalism: AppThemePreset = {
  "id": "neo-brutalism",
  "name": "Neo Brutalism",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#d82b2b",
      "light": "#cc4a4a",
      "dark": "#b12323",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#000000",
      "light": "#2e2e2e",
      "dark": "#000000",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#717171",
      "light": "#767676",
      "dark": "#5d5d5d",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#000000",
      "light": "#2e2e2e",
      "dark": "#000000",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#9d6607",
      "light": "#96702d",
      "dark": "#815406",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#17823e",
      "light": "#398555",
      "dark": "#136b33",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#ffffff",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#000000",
      "secondary": "#333333",
      "inverse": "#ffffff",
      "disabled": "rgba(0, 0, 0, 0.38)"
    },
    "border": {
      "default": "#000000"
    },
    "divider": "#000000",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#333333",
      "hover": "rgba(0, 0, 0, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(216, 43, 43, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(0, 0, 0, 0.26)",
      "disabledBackground": "rgba(0, 0, 0, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(216, 43, 43, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#ff8181",
      "light": "#ff9898",
      "dark": "#d16a6a",
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
      "main": "#ffffff",
      "light": "#ffffff",
      "dark": "#d1d1d1",
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
      "main": "#99a1f9",
      "light": "#abb2fa",
      "dark": "#7d84cc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#000000",
      "paper": "#333333",
      "surface": "#333333"
    },
    "text": {
      "primary": "#ffffff",
      "secondary": "#cccccc",
      "inverse": "#000000",
      "disabled": "rgba(255, 255, 255, 0.5)"
    },
    "border": {
      "default": "#ffffff"
    },
    "divider": "#ffffff",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#cccccc",
      "hover": "rgba(255, 255, 255, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(255, 129, 129, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(255, 255, 255, 0.3)",
      "disabledBackground": "rgba(255, 255, 255, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(255, 129, 129, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default neoBrutalism;
