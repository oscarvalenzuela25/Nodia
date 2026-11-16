// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const twitter: AppThemePreset = {
  "id": "twitter",
  "name": "Twitter",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#1672b0",
      "light": "#397caa",
      "dark": "#125d90",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#6d6d6d",
      "light": "#767676",
      "dark": "#595959",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#1672b0",
      "light": "#397caa",
      "dark": "#125d90",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#d41d28",
      "light": "#d2434c",
      "dark": "#ae1821",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#976207",
      "light": "#96702e",
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
      "default": "#ffffff",
      "paper": "#f7f8f8",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#0f1419",
      "secondary": "#0f1419",
      "inverse": "#ffffff",
      "disabled": "rgba(15, 20, 25, 0.38)"
    },
    "border": {
      "default": "#e1eaef"
    },
    "divider": "#e1eaef",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#0f1419",
      "hover": "rgba(15, 20, 25, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(22, 114, 176, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(15, 20, 25, 0.26)",
      "disabledBackground": "rgba(15, 20, 25, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(22, 114, 176, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#1c9cf0",
      "light": "#45aef3",
      "dark": "#1780c5",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#878a8c",
      "light": "#9d9fa1",
      "dark": "#737576",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#1c9cf0",
      "light": "#45aef3",
      "dark": "#1780c5",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f64650",
      "light": "#f86770",
      "dark": "#cd434b",
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
      "paper": "#17181c",
      "surface": "#000000"
    },
    "text": {
      "primary": "#e7e9ea",
      "secondary": "#7f8386",
      "inverse": "#000000",
      "disabled": "rgba(231, 233, 234, 0.5)"
    },
    "border": {
      "default": "#242628"
    },
    "divider": "#242628",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#7f8386",
      "hover": "rgba(231, 233, 234, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(28, 156, 240, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(231, 233, 234, 0.3)",
      "disabledBackground": "rgba(231, 233, 234, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(28, 156, 240, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default twitter;
