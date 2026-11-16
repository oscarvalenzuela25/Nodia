// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const tweakcnDefault: AppThemePreset = {
  "id": "tweakcn-default",
  "name": "Tweakcn Default",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#171717",
      "light": "#414141",
      "dark": "#131313",
      "contrastText": "#fafafa"
    },
    "secondary": {
      "main": "#171717",
      "light": "#414141",
      "dark": "#131313",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#171717",
      "light": "#414141",
      "dark": "#131313",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#e2000b",
      "light": "#e22d36",
      "dark": "#b90009",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#9d6607",
      "light": "#96702d",
      "dark": "#815406",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#17823e",
      "light": "#398555",
      "dark": "#136b33",
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
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#0a0a0a",
      "secondary": "#737373",
      "inverse": "#ffffff",
      "disabled": "rgba(10, 10, 10, 0.38)"
    },
    "border": {
      "default": "#e5e5e5"
    },
    "divider": "#e5e5e5",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#737373",
      "hover": "rgba(10, 10, 10, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(23, 23, 23, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(10, 10, 10, 0.26)",
      "disabledBackground": "rgba(10, 10, 10, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(23, 23, 23, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#e5e5e5",
      "light": "#eaeaea",
      "dark": "#bcbcbc",
      "contrastText": "#171717"
    },
    "secondary": {
      "main": "#fafafa",
      "light": "#fbfbfb",
      "dark": "#cdcdcd",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#fafafa",
      "light": "#fbfbfb",
      "dark": "#cdcdcd",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#ff6467",
      "light": "#ff8082",
      "dark": "#d15254",
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
      "default": "#0a0a0a",
      "paper": "#171717",
      "surface": "#262626"
    },
    "text": {
      "primary": "#fafafa",
      "secondary": "#a1a1a1",
      "inverse": "#000000",
      "disabled": "rgba(250, 250, 250, 0.5)"
    },
    "border": {
      "default": "#282828"
    },
    "divider": "#282828",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a1a1a1",
      "hover": "rgba(250, 250, 250, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(229, 229, 229, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(250, 250, 250, 0.3)",
      "disabledBackground": "rgba(250, 250, 250, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(229, 229, 229, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default tweakcnDefault;
