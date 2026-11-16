// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const pastelDreams: AppThemePreset = {
  "id": "pastel-dreams",
  "name": "Pastel Dreams",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#735fab",
      "light": "#7d6ea6",
      "dark": "#5e4e8c",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#4b5563",
      "light": "#6b747f",
      "dark": "#3e4651",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#374151",
      "light": "#5b6370",
      "dark": "#2d3542",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#905e5e",
      "light": "#926d6d",
      "dark": "#764d4d",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#946007",
      "light": "#96702f",
      "dark": "#794f06",
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
      "default": "#f7f3f9",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#374151",
      "secondary": "#686f7d",
      "inverse": "#ffffff",
      "disabled": "rgba(55, 65, 81, 0.38)"
    },
    "border": {
      "default": "#e9d8fd"
    },
    "divider": "#e9d8fd",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#686f7d",
      "hover": "rgba(55, 65, 81, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(115, 95, 171, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(55, 65, 81, 0.26)",
      "disabledBackground": "rgba(55, 65, 81, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(115, 95, 171, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#c0aafd",
      "light": "#cbb9fd",
      "dark": "#9d8bcf",
      "contrastText": "#1c1917"
    },
    "secondary": {
      "main": "#d1d5db",
      "light": "#d9dde1",
      "dark": "#abafb4",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#d1d5db",
      "light": "#d9dde1",
      "dark": "#abafb4",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#fca5a5",
      "light": "#fdb5b5",
      "dark": "#cf8787",
      "contrastText": "#1c1917"
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
      "main": "#8792f8",
      "light": "#9da6f9",
      "dark": "#6f78cb",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#1c1917",
      "paper": "#2d2535",
      "surface": "#2d2535"
    },
    "text": {
      "primary": "#e0e7ff",
      "secondary": "#9ca3af",
      "inverse": "#000000",
      "disabled": "rgba(224, 231, 255, 0.5)"
    },
    "border": {
      "default": "#3f324a"
    },
    "divider": "#3f324a",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#9ca3af",
      "hover": "rgba(224, 231, 255, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(192, 170, 253, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(224, 231, 255, 0.3)",
      "disabledBackground": "rgba(224, 231, 255, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(192, 170, 253, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default pastelDreams;
