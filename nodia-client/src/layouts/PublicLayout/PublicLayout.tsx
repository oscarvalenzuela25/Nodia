import { Suspense, type FC } from "react";
import Stack from "@mui/material/Stack";
import LanguageSelector from "../../components/LanguageSelector";
import ThemeSelector from "../../components/ThemeSelector";
import RouteLoader from "../../components/RouteLoader";
import { PublicLayoutRoot, ControlsWrapper, PublicLayoutContent } from "./styles";
import type { PublicLayoutProps } from "./types";

const PublicLayout: FC<PublicLayoutProps> = ({ children }) => {
  return (
    <PublicLayoutRoot>
      <ControlsWrapper>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <LanguageSelector />
          <ThemeSelector />
        </Stack>
      </ControlsWrapper>
      <PublicLayoutContent>
        <Suspense fallback={<RouteLoader variant="fullscreen" />}>
          {children}
        </Suspense>
      </PublicLayoutContent>
    </PublicLayoutRoot>
  );
};

export default PublicLayout;
