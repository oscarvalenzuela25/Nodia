// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const retroArcade: AppThemePreset = {
  "id": "retro-arcade",
  "name": "Retro Arcade",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#b32e6e",
      "light": "#bb5284",
      "dark": "#93265a",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#646464",
      "light": "#767676",
      "dark": "#525252",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#646464",
      "light": "#767676",
      "dark": "#525252",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#bb2b28",
      "light": "#c6504f",
      "dark": "#992321",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#8b5906",
      "light": "#967030",
      "dark": "#724905",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#147237",
      "light": "#3b8457",
      "dark": "#105d2d",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#fdf6e3",
      "paper": "#eee8d5",
      "surface": "#eee8d5"
    },
    "text": {
      "primary": "#073642",
      "secondary": "#073642",
      "inverse": "#ffffff",
      "disabled": "rgba(7, 54, 66, 0.38)"
    },
    "border": {
      "default": "#839496"
    },
    "divider": "#839496",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#073642",
      "hover": "rgba(7, 54, 66, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(179, 46, 110, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(7, 54, 66, 0.26)",
      "disabledBackground": "rgba(7, 54, 66, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(179, 46, 110, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#e484b2",
      "light": "#e99ac0",
      "dark": "#bb6c92",
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
      "main": "#ea8584",
      "light": "#ee9b9a",
      "dark": "#c06d6c",
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
      "main": "#949df9",
      "light": "#a7affa",
      "dark": "#7981cc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#002b36",
      "paper": "#073642",
      "surface": "#073642"
    },
    "text": {
      "primary": "#93a1a1",
      "secondary": "#93a1a1",
      "inverse": "#000000",
      "disabled": "rgba(147, 161, 161, 0.5)"
    },
    "border": {
      "default": "#586e75"
    },
    "divider": "#586e75",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#93a1a1",
      "hover": "rgba(147, 161, 161, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(228, 132, 178, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(147, 161, 161, 0.3)",
      "disabledBackground": "rgba(147, 161, 161, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(228, 132, 178, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default retroArcade;
