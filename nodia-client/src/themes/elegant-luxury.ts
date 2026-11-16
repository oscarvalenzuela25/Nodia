// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const elegantLuxury: AppThemePreset = {
  "id": "elegant-luxury",
  "name": "Elegant Luxury",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#9b2c2c",
      "light": "#ad5252",
      "dark": "#7f2424",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#805500",
      "light": "#94712d",
      "dark": "#694600",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#7f1d1d",
      "light": "#964646",
      "dark": "#681818",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#991b1b",
      "light": "#ab4444",
      "dark": "#7d1616",
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
      "default": "#faf7f5",
      "paper": "#faf7f5",
      "surface": "#faf7f5"
    },
    "text": {
      "primary": "#1a1a1a",
      "secondary": "#57534e",
      "inverse": "#ffffff",
      "disabled": "rgba(26, 26, 26, 0.38)"
    },
    "border": {
      "default": "#f5e8d2"
    },
    "divider": "#f5e8d2",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#57534e",
      "hover": "rgba(26, 26, 26, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(155, 44, 44, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(26, 26, 26, 0.26)",
      "disabledBackground": "rgba(26, 26, 26, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(155, 44, 44, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#d77e7e",
      "light": "#de9595",
      "dark": "#b06767",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#fef3c7",
      "light": "#fef5d1",
      "dark": "#d0c7a3",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#fef3c7",
      "light": "#fef5d1",
      "dark": "#d0c7a3",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f26d6d",
      "light": "#f48787",
      "dark": "#c65959",
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
      "secondary": "#d6d3d1",
      "inverse": "#000000",
      "disabled": "rgba(245, 245, 244, 0.5)"
    },
    "border": {
      "default": "#44403c"
    },
    "divider": "#44403c",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#d6d3d1",
      "hover": "rgba(245, 245, 244, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(215, 126, 126, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(245, 245, 244, 0.3)",
      "disabledBackground": "rgba(245, 245, 244, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(215, 126, 126, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default elegantLuxury;
