// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const solarDusk: AppThemePreset = {
  "id": "solar-dusk",
  "name": "Solar Dusk",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#ad5009",
      "light": "#aa6630",
      "dark": "#8e4207",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#57534e",
      "light": "#75726e",
      "dark": "#474440",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#57534e",
      "light": "#75726e",
      "dark": "#474440",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#991b1b",
      "light": "#ab4444",
      "dark": "#7d1616",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#956007",
      "light": "#96702f",
      "dark": "#7a4f06",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#157b3b",
      "light": "#398555",
      "dark": "#116530",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#fdfbf7",
      "paper": "#f8f4ee",
      "surface": "#f8f4ee"
    },
    "text": {
      "primary": "#4a3b33",
      "secondary": "#746d69",
      "inverse": "#ffffff",
      "disabled": "rgba(74, 59, 51, 0.38)"
    },
    "border": {
      "default": "#e4d9bc"
    },
    "divider": "#e4d9bc",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#746d69",
      "hover": "rgba(74, 59, 51, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(173, 80, 9, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(74, 59, 51, 0.26)",
      "disabledBackground": "rgba(74, 59, 51, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(173, 80, 9, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#f97316",
      "light": "#fa8c40",
      "dark": "#cc5e12",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#e7e5e4",
      "light": "#ebeae9",
      "dark": "#bdbcbb",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#e7e5e4",
      "light": "#ebeae9",
      "dark": "#bdbcbb",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#e87373",
      "light": "#ec8c8c",
      "dark": "#be5e5e",
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
      "main": "#838ef8",
      "light": "#99a2f9",
      "dark": "#6b74cb",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#1c1917",
      "paper": "#292524",
      "surface": "#292524"
    },
    "text": {
      "primary": "#f5f5f4",
      "secondary": "#a8a29e",
      "inverse": "#000000",
      "disabled": "rgba(245, 245, 244, 0.5)"
    },
    "border": {
      "default": "#44403c"
    },
    "divider": "#44403c",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a8a29e",
      "hover": "rgba(245, 245, 244, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(249, 115, 22, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(245, 245, 244, 0.3)",
      "disabledBackground": "rgba(245, 245, 244, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(249, 115, 22, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default solarDusk;
