// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const sunsetHorizon: AppThemePreset = {
  "id": "sunset-horizon",
  "name": "Sunset Horizon",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#ac5540",
      "light": "#a56657",
      "dark": "#8d4634",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#b0523f",
      "light": "#a96457",
      "dark": "#904334",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#3d3436",
      "light": "#60595a",
      "dark": "#322b2c",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#cc333e",
      "light": "#c35159",
      "dark": "#a72a33",
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
      "default": "#fff9f5",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#3d3436",
      "secondary": "#77716c",
      "inverse": "#ffffff",
      "disabled": "rgba(61, 52, 54, 0.38)"
    },
    "border": {
      "default": "#ffe0d6"
    },
    "divider": "#ffe0d6",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#77716c",
      "hover": "rgba(61, 52, 54, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(172, 85, 64, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(61, 52, 54, 0.26)",
      "disabledBackground": "rgba(61, 52, 54, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(172, 85, 64, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#ff8263",
      "light": "#ff997f",
      "dark": "#d16b51",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#f2e9e4",
      "light": "#f4ede9",
      "dark": "#c6bfbb",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#a9a5a6",
      "light": "#b8b5b6",
      "dark": "#8b8788",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f0888f",
      "light": "#f39da3",
      "dark": "#c57075",
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
      "main": "#959ff9",
      "light": "#a8b0fa",
      "dark": "#7a82cc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#2a2024",
      "paper": "#392f35",
      "surface": "#392f35"
    },
    "text": {
      "primary": "#f2e9e4",
      "secondary": "#d7c6bc",
      "inverse": "#000000",
      "disabled": "rgba(242, 233, 228, 0.5)"
    },
    "border": {
      "default": "#463a41"
    },
    "divider": "#463a41",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#d7c6bc",
      "hover": "rgba(242, 233, 228, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(255, 130, 99, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(242, 233, 228, 0.3)",
      "disabledBackground": "rgba(242, 233, 228, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(255, 130, 99, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default sunsetHorizon;
