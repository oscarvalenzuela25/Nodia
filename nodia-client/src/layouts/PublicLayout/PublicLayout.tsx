import { Suspense, type FC } from "react";
import Stack from "@mui/material/Stack";
import LanguageSelector from "../../components/LanguageSelector";
import ThemeSelector from "../../components/ThemeSelector";
import RouteLoader from "../../components/RouteLoader";
import useAuth from "../../hooks/useAuth";
import ConnectionNotice from "../../pwa/ConnectionNotice";
import { PublicLayoutRoot, ControlsWrapper, PublicLayoutContent } from "./styles";
import type { PublicLayoutProps } from "./types";

const PublicLayout: FC<PublicLayoutProps> = ({ children, standalone = false }) => {
  const { isDemo, isSessionActive } = useAuth();
  return (
    <PublicLayoutRoot>
      {!standalone && (
        <ControlsWrapper>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <LanguageSelector />
            <ThemeSelector />
          </Stack>
        </ControlsWrapper>
      )}
      <ConnectionNotice allowRetry={standalone || isDemo || isSessionActive} />
      <PublicLayoutContent data-public-content>
        <Suspense fallback={<RouteLoader variant="fullscreen" />}>
          {children}
        </Suspense>
      </PublicLayoutContent>
    </PublicLayoutRoot>
  );
};

export default PublicLayout;
