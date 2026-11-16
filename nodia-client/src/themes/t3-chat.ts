// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const t3Chat: AppThemePreset = {
  "id": "t3-chat",
  "name": "T3 Chat",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#a84370",
      "light": "#ab5e81",
      "dark": "#8a375c",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#77347c",
      "light": "#8f5994",
      "dark": "#622b66",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#77347c",
      "light": "#8f5994",
      "dark": "#622b66",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#ab4347",
      "light": "#b05f62",
      "dark": "#8c373a",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#966107",
      "light": "#976f2e",
      "dark": "#7b5006",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#157c3b",
      "light": "#398555",
      "dark": "#116630",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#faf5fa",
      "paper": "#faf5fa",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#501854",
      "secondary": "#834588",
      "inverse": "#ffffff",
      "disabled": "rgba(80, 24, 84, 0.38)"
    },
    "border": {
      "default": "#efbdeb"
    },
    "divider": "#efbdeb",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#834588",
      "hover": "rgba(80, 24, 84, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(168, 67, 112, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(80, 24, 84, 0.26)",
      "disabledBackground": "rgba(80, 24, 84, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(168, 67, 112, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#d281a6",
      "light": "#da98b6",
      "dark": "#ac6a88",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#d4c7e1",
      "light": "#dcd1e6",
      "dark": "#aea3b9",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#f8f1f5",
      "light": "#f9f4f7",
      "dark": "#cbc6c9",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#a59799",
      "light": "#b5aaab",
      "dark": "#877c7d",
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
      "main": "#8792f8",
      "light": "#9da6f9",
      "dark": "#6f78cb",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#221d27",
      "paper": "#2c2632",
      "surface": "#100a0e"
    },
    "text": {
      "primary": "#d2c4de",
      "secondary": "#c2b6cf",
      "inverse": "#000000",
      "disabled": "rgba(210, 196, 222, 0.5)"
    },
    "border": {
      "default": "#3b3237"
    },
    "divider": "#3b3237",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#c2b6cf",
      "hover": "rgba(210, 196, 222, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(210, 129, 166, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(210, 196, 222, 0.3)",
      "disabledBackground": "rgba(210, 196, 222, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(210, 129, 166, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default t3Chat;
