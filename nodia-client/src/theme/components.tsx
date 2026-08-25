import type { ThemeOptions } from "@mui/material/styles";

type Components = ThemeOptions["components"];

const components: Components = {
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
