// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const mochaMousse: AppThemePreset = {
  "id": "mocha-mousse",
  "name": "Mocha Mousse",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#846051",
      "light": "#8c7165",
      "dark": "#6c4f42",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#686868",
      "light": "#767676",
      "dark": "#555555",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#56453f",
      "light": "#746662",
      "dark": "#473934",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#1f1a17",
      "light": "#474341",
      "dark": "#191513",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#915d07",
      "light": "#976f30",
      "dark": "#774c06",
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
      "default": "#f1f0e5",
      "paper": "#f1f0e5",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#56453f",
      "secondary": "#886359",
      "inverse": "#ffffff",
      "disabled": "rgba(86, 69, 63, 0.38)"
    },
    "border": {
      "default": "#baab92"
    },
    "divider": "#baab92",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#886359",
      "hover": "rgba(86, 69, 63, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(132, 96, 81, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(86, 69, 63, 0.26)",
      "disabledBackground": "rgba(86, 69, 63, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(132, 96, 81, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#c6a48f",
      "light": "#d0b4a3",
      "dark": "#a38877",
      "contrastText": "#2d2521"
    },
    "secondary": {
      "main": "#f1f0e5",
      "light": "#f4f3ea",
      "dark": "#c6c5bc",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#adaaa9",
      "light": "#bcb9b8",
      "dark": "#8e8b8b",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#eb9393",
      "light": "#efa6a6",
      "dark": "#c17a7a",
      "contrastText": "#2d2521"
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
      "main": "#9ba4f9",
      "light": "#adb4fa",
      "dark": "#7f86cc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#2d2521",
      "paper": "#3c332e",
      "surface": "#3c332e"
    },
    "text": {
      "primary": "#f1f0e5",
      "secondary": "#c5aa9b",
      "inverse": "#000000",
      "disabled": "rgba(241, 240, 229, 0.5)"
    },
    "border": {
      "default": "#56453f"
    },
    "divider": "#56453f",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#c5aa9b",
      "hover": "rgba(241, 240, 229, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(198, 164, 143, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(241, 240, 229, 0.3)",
      "disabledBackground": "rgba(241, 240, 229, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(198, 164, 143, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default mochaMousse;
