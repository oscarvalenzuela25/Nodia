// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const softPop: AppThemePreset = {
  "id": "soft-pop",
  "name": "Soft Pop",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#6d6d6d",
      "light": "#767676",
      "dark": "#595959",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#000000",
      "light": "#2e2e2e",
      "dark": "#000000",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c73838",
      "light": "#c05454",
      "dark": "#a32e2e",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#986207",
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
      "default": "#f7f9f3",
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
      "selected": "rgba(79, 70, 229, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(0, 0, 0, 0.26)",
      "disabledBackground": "rgba(0, 0, 0, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(79, 70, 229, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#818cf8",
      "light": "#98a1f9",
      "dark": "#6a73cb",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#929292",
      "light": "#a6a6a6",
      "dark": "#787878",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#929292",
      "light": "#a6a6a6",
      "dark": "#787878",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f87171",
      "light": "#f98b8b",
      "dark": "#cb5d5d",
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
      "default": "#000000",
      "paper": "#1a212b",
      "surface": "#1a212b"
    },
    "text": {
      "primary": "#ffffff",
      "secondary": "#cccccc",
      "inverse": "#000000",
      "disabled": "rgba(255, 255, 255, 0.5)"
    },
    "border": {
      "default": "#545454"
    },
    "divider": "#545454",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#cccccc",
      "hover": "rgba(255, 255, 255, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(129, 140, 248, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(255, 255, 255, 0.3)",
      "disabledBackground": "rgba(255, 255, 255, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(129, 140, 248, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default softPop;
