// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const perpetuity: AppThemePreset = {
  "id": "perpetuity",
  "name": "Perpetuity",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#05737a",
      "light": "#2e8288",
      "dark": "#045e64",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#0a4a55",
      "light": "#366b74",
      "dark": "#083d46",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#0a4a55",
      "light": "#366b74",
      "dark": "#083d46",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#be3333",
      "light": "#c15454",
      "dark": "#9c2a2a",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#8f5d06",
      "light": "#96702f",
      "dark": "#754c05",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#157739",
      "light": "#3a8456",
      "dark": "#11622f",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#e8f0f0",
      "paper": "#f2f7f7",
      "surface": "#f2f7f7"
    },
    "text": {
      "primary": "#0a4a55",
      "secondary": "#3e7377",
      "inverse": "#ffffff",
      "disabled": "rgba(10, 74, 85, 0.38)"
    },
    "border": {
      "default": "#cde0e2"
    },
    "divider": "#cde0e2",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#3e7377",
      "hover": "rgba(10, 74, 85, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(5, 115, 122, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(10, 74, 85, 0.26)",
      "disabledBackground": "rgba(10, 74, 85, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(5, 115, 122, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#4de8e8",
      "light": "#6decec",
      "dark": "#3fbebe",
      "contrastText": "#0a1a20"
    },
    "secondary": {
      "main": "#4de8e8",
      "light": "#6decec",
      "dark": "#3fbebe",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#4de8e8",
      "light": "#6decec",
      "dark": "#3fbebe",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#ec5c5c",
      "light": "#ef7979",
      "dark": "#c34e4e",
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
      "default": "#0a1a20",
      "paper": "#0c2025",
      "surface": "#0c2025"
    },
    "text": {
      "primary": "#4de8e8",
      "secondary": "#36a5a5",
      "inverse": "#000000",
      "disabled": "rgba(77, 232, 232, 0.5)"
    },
    "border": {
      "default": "#164955"
    },
    "divider": "#164955",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#36a5a5",
      "hover": "rgba(77, 232, 232, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(77, 232, 232, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(77, 232, 232, 0.3)",
      "disabledBackground": "rgba(77, 232, 232, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(77, 232, 232, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default perpetuity;
