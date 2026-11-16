// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const modernMinimal: AppThemePreset = {
  "id": "modern-minimal",
  "name": "Modern Minimal",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#326fd1",
      "light": "#4b77bc",
      "dark": "#295bab",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#4b5563",
      "light": "#6b747f",
      "dark": "#3e4651",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#1e3a8a",
      "light": "#475d9f",
      "dark": "#193071",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#ce3a3a",
      "light": "#c15454",
      "dark": "#a93030",
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
      "primary": "#333333",
      "secondary": "#6b7280",
      "inverse": "#ffffff",
      "disabled": "rgba(51, 51, 51, 0.38)"
    },
    "border": {
      "default": "#e5e7eb"
    },
    "divider": "#e5e7eb",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#6b7280",
      "hover": "rgba(51, 51, 51, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(50, 111, 209, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(51, 51, 51, 0.26)",
      "disabledBackground": "rgba(51, 51, 51, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(50, 111, 209, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#5b97f7",
      "light": "#79aaf8",
      "dark": "#4b7ccb",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#e5e5e5",
      "light": "#eaeaea",
      "dark": "#bcbcbc",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#bfdbfe",
      "light": "#cbe1fe",
      "dark": "#9db4d0",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f26d6d",
      "light": "#f48787",
      "dark": "#c65959",
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
      "default": "#171717",
      "paper": "#262626",
      "surface": "#262626"
    },
    "text": {
      "primary": "#e5e5e5",
      "secondary": "#a3a3a3",
      "inverse": "#000000",
      "disabled": "rgba(229, 229, 229, 0.5)"
    },
    "border": {
      "default": "#404040"
    },
    "divider": "#404040",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a3a3a3",
      "hover": "rgba(229, 229, 229, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(91, 151, 247, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(229, 229, 229, 0.3)",
      "disabledBackground": "rgba(229, 229, 229, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(91, 151, 247, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default modernMinimal;
