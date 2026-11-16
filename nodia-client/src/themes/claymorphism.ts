// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const claymorphism: AppThemePreset = {
  "id": "claymorphism",
  "name": "Claymorphism",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#5254c6",
      "light": "#6c6dc6",
      "dark": "#4345a2",
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
      "main": "#b33333",
      "light": "#be5656",
      "dark": "#932a2a",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#885706",
      "light": "#967031",
      "dark": "#704705",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#137136",
      "light": "#3a8456",
      "dark": "#105d2c",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#e7e5e4",
      "paper": "#f5f5f4",
      "surface": "#f5f5f4"
    },
    "text": {
      "primary": "#1e293b",
      "secondary": "#5f6672",
      "inverse": "#ffffff",
      "disabled": "rgba(30, 41, 59, 0.38)"
    },
    "border": {
      "default": "#d6d3d1"
    },
    "divider": "#d6d3d1",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#5f6672",
      "hover": "rgba(30, 41, 59, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(82, 84, 198, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(30, 41, 59, 0.26)",
      "disabledBackground": "rgba(30, 41, 59, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(82, 84, 198, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#8792f8",
      "light": "#9da6f9",
      "dark": "#747dcd",
      "contrastText": "#1e1b18"
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
      "main": "#f37272",
      "light": "#f58b8b",
      "dark": "#ca6464",
      "contrastText": "#1e1b18"
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
      "default": "#1e1b18",
      "paper": "#2c2825",
      "surface": "#2c2825"
    },
    "text": {
      "primary": "#e2e8f0",
      "secondary": "#9ca3af",
      "inverse": "#000000",
      "disabled": "rgba(226, 232, 240, 0.5)"
    },
    "border": {
      "default": "#3a3633"
    },
    "divider": "#3a3633",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#9ca3af",
      "hover": "rgba(226, 232, 240, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(135, 146, 248, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(226, 232, 240, 0.3)",
      "disabledBackground": "rgba(226, 232, 240, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(135, 146, 248, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default claymorphism;
