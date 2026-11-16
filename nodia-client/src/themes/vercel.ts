// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const vercel: AppThemePreset = {
  "id": "vercel",
  "name": "Vercel",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#000000",
      "light": "#2e2e2e",
      "dark": "#000000",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#000000",
      "light": "#2e2e2e",
      "dark": "#000000",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#000000",
      "light": "#2e2e2e",
      "dark": "#000000",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c54144",
      "light": "#b9595b",
      "dark": "#a23538",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#9b6407",
      "light": "#976f2d",
      "dark": "#7f5206",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#16803d",
      "light": "#398555",
      "dark": "#126932",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#fcfcfc",
      "paper": "#ffffff",
      "surface": "#fcfcfc"
    },
    "text": {
      "primary": "#000000",
      "secondary": "#525252",
      "inverse": "#ffffff",
      "disabled": "rgba(0, 0, 0, 0.38)"
    },
    "border": {
      "default": "#e4e4e4"
    },
    "divider": "#e4e4e4",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#525252",
      "hover": "rgba(0, 0, 0, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(0, 0, 0, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(0, 0, 0, 0.26)",
      "disabledBackground": "rgba(0, 0, 0, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(0, 0, 0, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#ffffff",
      "light": "#ffffff",
      "dark": "#d1d1d1",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#ffffff",
      "light": "#ffffff",
      "dark": "#d1d1d1",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#ffffff",
      "light": "#ffffff",
      "dark": "#d1d1d1",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#ff5b5b",
      "light": "#ff7979",
      "dark": "#d14b4b",
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
      "paper": "#090909",
      "surface": "#121212"
    },
    "text": {
      "primary": "#ffffff",
      "secondary": "#a4a4a4",
      "inverse": "#000000",
      "disabled": "rgba(255, 255, 255, 0.5)"
    },
    "border": {
      "default": "#242424"
    },
    "divider": "#242424",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a4a4a4",
      "hover": "rgba(255, 255, 255, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(255, 255, 255, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(255, 255, 255, 0.3)",
      "disabledBackground": "rgba(255, 255, 255, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(255, 255, 255, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default vercel;
