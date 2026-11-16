// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const starryNight: AppThemePreset = {
  "id": "starry-night",
  "name": "Starry Night",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#3a5ba0",
      "light": "#5973a9",
      "dark": "#304b83",
      "contrastText": "#fffbe6"
    },
    "secondary": {
      "main": "#1a2238",
      "light": "#434a5c",
      "dark": "#151c2e",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#66655c",
      "light": "#77776f",
      "dark": "#54534b",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#2d1e2f",
      "light": "#534754",
      "dark": "#251927",
      "contrastText": "#fffbe6"
    },
    "warning": {
      "main": "#8b5a06",
      "light": "#967030",
      "dark": "#724a05",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#147337",
      "light": "#3b8456",
      "dark": "#105e2d",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#f5f7fa",
      "paper": "#e3eaf2",
      "surface": "#fffbe6"
    },
    "text": {
      "primary": "#1a2238",
      "secondary": "#3a5ba0",
      "inverse": "#ffffff",
      "disabled": "rgba(26, 34, 56, 0.38)"
    },
    "border": {
      "default": "#b0b8c1"
    },
    "divider": "#b0b8c1",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#3a5ba0",
      "hover": "rgba(26, 34, 56, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(58, 91, 160, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(26, 34, 56, 0.26)",
      "disabledBackground": "rgba(26, 34, 56, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(58, 91, 160, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#8398c3",
      "light": "#99abce",
      "dark": "#6b7da0",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#9697a1",
      "light": "#a9aab2",
      "dark": "#7b7c84",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#96979b",
      "light": "#a9aaad",
      "dark": "#7b7c7f",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#c0879e",
      "light": "#cb9daf",
      "dark": "#9d6f82",
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
      "default": "#181a24",
      "paper": "#23243a",
      "surface": "#23243a"
    },
    "text": {
      "primary": "#e6eaf3",
      "secondary": "#818fa6",
      "inverse": "#000000",
      "disabled": "rgba(230, 234, 243, 0.5)"
    },
    "border": {
      "default": "#2d2e3e"
    },
    "divider": "#2d2e3e",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#818fa6",
      "hover": "rgba(230, 234, 243, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(131, 152, 195, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(230, 234, 243, 0.3)",
      "disabledBackground": "rgba(230, 234, 243, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(131, 152, 195, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default starryNight;
