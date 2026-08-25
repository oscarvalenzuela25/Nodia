import type { FC, PropsWithChildren } from "react";
import { CssBaseline } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import typography from "../theme/typography";
import spacing from "../theme/spacing";
import breakpoints from "../theme/breakpoints";
import zIndex from "../theme/zIndex";
import transitions from "../theme/transitions";
import components from "../theme/components";
import useThemeType from "../hooks/useThemeType";
import { darkPalette, lightPalette } from "../theme/palette";

type Props = PropsWithChildren;

const MUIProvider: FC<Props> = ({ children }) => {
  const { themeType } = useThemeType();
  const palette = themeType === "light" ? lightPalette : darkPalette;

  const theme = createTheme({
    palette,
    typography,
    spacing,
    breakpoints,
    zIndex,
    transitions,
    components,
    shape: {
      borderRadius: 8,
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

export default MUIProvider;
