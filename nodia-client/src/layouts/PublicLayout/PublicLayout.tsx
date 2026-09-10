import type { FC } from "react";
import Stack from "@mui/material/Stack";
import LanguageSelector from "../../components/LanguageSelector";
import ThemeSelector from "../../components/ThemeSelector";
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
      <PublicLayoutContent>{children}</PublicLayoutContent>
    </PublicLayoutRoot>
  );
};

export default PublicLayout;
