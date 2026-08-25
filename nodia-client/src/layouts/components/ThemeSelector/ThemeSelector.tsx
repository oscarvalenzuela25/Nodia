import type { FC } from "react";
import { useTranslation } from "react-i18next";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import useThemeStore from "../../../store/configStore";
import { SwapLabel, HiddenInput } from "./styles";

const ThemeSelector: FC = () => {
  const { themeType, handleToggleThemeType } = useThemeStore();
  const { t } = useTranslation("layout");
  const isDarkMode = themeType === "dark";

  return (
    <SwapLabel aria-label={t("toggle_theme")}>
      <HiddenInput
        type="checkbox"
        onChange={handleToggleThemeType}
        checked={!isDarkMode}
      />
      <LightModeOutlinedIcon
        sx={{
          color: "text.primary",
          fontSize: "2rem",
          display: !isDarkMode ? "block" : "none",
        }}
      />
      <DarkModeOutlinedIcon
        sx={{
          color: "text.primary",
          fontSize: "2rem",
          display: !isDarkMode ? "none" : "block",
        }}
      />
    </SwapLabel>
  );
};

export default ThemeSelector;
