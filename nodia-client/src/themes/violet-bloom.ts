// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const violetBloom: AppThemePreset = {
  "id": "violet-bloom",
  "name": "Violet Bloom",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#7033ff",
      "light": "#8655f7",
      "dark": "#5c2ad1",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#080808",
      "light": "#343434",
      "dark": "#070707",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#1e69dc",
      "light": "#4076ca",
      "dark": "#1956b4",
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
      "default": "#fdfdfd",
      "paper": "#fdfdfd",
      "surface": "#fcfcfc"
    },
    "text": {
      "primary": "#000000",
      "secondary": "#525252",
      "inverse": "#ffffff",
      "disabled": "rgba(0, 0, 0, 0.38)"
    },
    "border": {
      "default": "#e7e7ee"
    },
    "divider": "#e7e7ee",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#525252",
      "hover": "rgba(0, 0, 0, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(112, 51, 255, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(0, 0, 0, 0.26)",
      "disabledBackground": "rgba(0, 0, 0, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(112, 51, 255, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#a37cff",
      "light": "#b494ff",
      "dark": "#8666d1",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#f0f0f0",
      "light": "#f3f3f3",
      "dark": "#c5c5c5",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#79c0ff",
      "light": "#91cbff",
      "dark": "#639dd1",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f87171",
      "light": "#f98b8b",
      "dark": "#cb5d5d",
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
      "default": "#1a1b1e",
      "paper": "#222327",
      "surface": "#222327"
    },
    "text": {
      "primary": "#f0f0f0",
      "secondary": "#a0a0a0",
      "inverse": "#000000",
      "disabled": "rgba(240, 240, 240, 0.5)"
    },
    "border": {
      "default": "#33353a"
    },
    "divider": "#33353a",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a0a0a0",
      "hover": "rgba(240, 240, 240, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(163, 124, 255, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(240, 240, 240, 0.3)",
      "disabledBackground": "rgba(240, 240, 240, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(163, 124, 255, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default violetBloom;
