// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const caffeine: AppThemePreset = {
  "id": "caffeine",
  "name": "Caffeine",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#644a40",
      "light": "#806b62",
      "dark": "#523d34",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#582d1d",
      "light": "#765346",
      "dark": "#482518",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#202020",
      "light": "#484848",
      "dark": "#1a1a1a",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c34127",
      "light": "#bb5a47",
      "dark": "#a03520",
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
      "paper": "#fcfcfc",
      "surface": "#fcfcfc"
    },
    "text": {
      "primary": "#202020",
      "secondary": "#646464",
      "inverse": "#ffffff",
      "disabled": "rgba(32, 32, 32, 0.38)"
    },
    "border": {
      "default": "#d8d8d8"
    },
    "divider": "#d8d8d8",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#646464",
      "hover": "rgba(32, 32, 32, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(100, 74, 64, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(32, 32, 32, 0.26)",
      "disabledBackground": "rgba(32, 32, 32, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(100, 74, 64, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#ffe0c2",
      "light": "#ffe6cd",
      "dark": "#d1b89f",
      "contrastText": "#081a1b"
    },
    "secondary": {
      "main": "#ffe0c2",
      "light": "#ffe6cd",
      "dark": "#d1b89f",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#eeeeee",
      "light": "#f1f1f1",
      "dark": "#c3c3c3",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#e75b3f",
      "light": "#eb7962",
      "dark": "#c0523c",
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
      "default": "#111111",
      "paper": "#191919",
      "surface": "#191919"
    },
    "text": {
      "primary": "#eeeeee",
      "secondary": "#b4b4b4",
      "inverse": "#000000",
      "disabled": "rgba(238, 238, 238, 0.5)"
    },
    "border": {
      "default": "#201e18"
    },
    "divider": "#201e18",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#b4b4b4",
      "hover": "rgba(238, 238, 238, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(255, 224, 194, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(238, 238, 238, 0.3)",
      "disabledBackground": "rgba(238, 238, 238, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(255, 224, 194, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default caffeine;
