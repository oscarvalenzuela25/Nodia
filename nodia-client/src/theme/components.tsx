import type { ThemeOptions } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";

type Components = ThemeOptions["components"];

const components: Components = {
  MuiCssBaseline: {
    styleOverrides: (theme) => {
      const isDark = theme.palette.mode === "dark";
      const thumbColor = isDark
        ? alpha("#ffffff", 0.2)
        : alpha("#000000", 0.2);
      const thumbHoverColor = isDark
        ? alpha("#ffffff", 0.35)
        : alpha("#000000", 0.35);

      return {
        "*": {
          scrollbarWidth: "thin",
          scrollbarColor: `${thumbColor} transparent`,
          "&::-webkit-scrollbar": {
            width: "6px",
            height: "6px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent !important",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: thumbColor,
            borderRadius: "9999px",
            border: "none",
            "&:hover": {
              backgroundColor: thumbHoverColor,
            },
          },
          "&::-webkit-scrollbar-button": {
            display: "none !important",
            width: 0,
            height: 0,
          },
          "&::-webkit-scrollbar-corner": {
            background: "transparent !important",
          },
        },
      };
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        boxShadow: "none",
        "&:hover": {
          boxShadow: "none",
        },
      },
    },
  },
};

export default components;
