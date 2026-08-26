import { useState } from "react";
import type { FC, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Menu, MenuItem, Tooltip } from "@mui/material";
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
        <Button
          onClick={handleOpenMenu}
          aria-label={t("layout:toggle_language")}
          aria-controls="language-menu"
          aria-haspopup="true"
          startIcon={<TranslateOutlinedIcon sx={{ fontSize: "1.75rem", color: "text.primary" }} />}
          sx={{ 
            color: "text.primary", 
            textTransform: "uppercase", 
            fontWeight: "bold",
            minWidth: 0,
            px: 1 
          }}
        >
          {currentLanguage.substring(0, 2)}
        </Button>
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
