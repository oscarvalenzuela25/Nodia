// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const vintagePaper: AppThemePreset = {
  "id": "vintage-paper",
  "name": "Vintage Paper",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#846241",
      "light": "#8b725a",
      "dark": "#6c5035",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#5c4d3f",
      "light": "#796d62",
      "dark": "#4b3f34",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#4a3f35",
      "light": "#6b6259",
      "dark": "#3d342b",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#b04834",
      "light": "#af6152",
      "dark": "#903b2b",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#925e07",
      "light": "#96702f",
      "dark": "#784d06",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#15793a",
      "light": "#3a8555",
      "dark": "#116330",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#f5f1e6",
      "paper": "#fffcf5",
      "surface": "#fffcf5"
    },
    "text": {
      "primary": "#4a3f35",
      "secondary": "#7b6a55",
      "inverse": "#ffffff",
      "disabled": "rgba(74, 63, 53, 0.38)"
    },
    "border": {
      "default": "#dbd0ba"
    },
    "divider": "#dbd0ba",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#7b6a55",
      "hover": "rgba(74, 63, 53, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(132, 98, 65, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(74, 63, 53, 0.26)",
      "disabledBackground": "rgba(74, 63, 53, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(132, 98, 65, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#c2a384",
      "light": "#cdb49a",
      "dark": "#a28a70",
      "contrastText": "#2d2621"
    },
    "secondary": {
      "main": "#ece5d8",
      "light": "#efeadf",
      "dark": "#c2bcb1",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#ece5d8",
      "light": "#efeadf",
      "dark": "#c2bcb1",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#d69a8e",
      "light": "#ddaca2",
      "dark": "#af7e74",
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
      "main": "#99a2f9",
      "light": "#abb3fa",
      "dark": "#7d85cc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#2d2621",
      "paper": "#3a322c",
      "surface": "#3a322c"
    },
    "text": {
      "primary": "#ece5d8",
      "secondary": "#c5bcac",
      "inverse": "#000000",
      "disabled": "rgba(236, 229, 216, 0.5)"
    },
    "border": {
      "default": "#4a4039"
    },
    "divider": "#4a4039",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#c5bcac",
      "hover": "rgba(236, 229, 216, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(194, 163, 132, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(236, 229, 216, 0.3)",
      "disabledBackground": "rgba(236, 229, 216, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(194, 163, 132, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default vintagePaper;
