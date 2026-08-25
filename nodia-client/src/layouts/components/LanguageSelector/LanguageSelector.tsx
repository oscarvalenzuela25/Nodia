import { useState } from "react";
import type { FC, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "../../../translate";
import { Wrapper } from "./styles";

const LanguageSelector: FC = () => {
  const { t, i18n } = useTranslation(["layout", "translate"]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpenMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    handleCloseMenu();
  };

  const currentLanguage = i18n.language || DEFAULT_LANGUAGE;

  return (
    <Wrapper>
      <Tooltip title={t("layout:toggle_language")}>
        <IconButton
          onClick={handleOpenMenu}
          aria-label={t("layout:toggle_language")}
          aria-controls="language-menu"
          aria-haspopup="true"
        >
          <TranslateOutlinedIcon sx={{ fontSize: "2rem", color: "text.primary" }} />
        </IconButton>
      </Tooltip>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <MenuItem
            key={lng}
            onClick={() => handleLanguageChange(lng)}
            selected={currentLanguage.startsWith(lng)}
          >
            {t(`translate:${lng}`)}
          </MenuItem>
        ))}
      </Menu>
    </Wrapper>
  );
};

export default LanguageSelector;
