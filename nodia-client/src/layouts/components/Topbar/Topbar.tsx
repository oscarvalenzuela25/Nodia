import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Avatar, Stack, IconButton, useTheme, Button } from "@mui/material";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import ArrowCircleLeftOutlinedIcon from "@mui/icons-material/ArrowCircleLeftOutlined";
import ThemeSelector from "../ThemeSelector";
import LanguageSelector from "../LanguageSelector";
import { TopbarRoot } from "./styles";

type Props = {
  onDrawerToggle: () => void;
  desktopCollapsed?: boolean;
  onCollapseToggle?: () => void;
};

const Topbar: FC<Props> = ({
  onDrawerToggle,
  desktopCollapsed,
  onCollapseToggle,
}) => {
  const { t } = useTranslation("layout");
  const theme = useTheme();
  const navigate = useNavigate();
  const isLogged = false;

  return (
    <TopbarRoot>
      {/* Mobile Drawer Toggle */}
      <IconButton
        onClick={onDrawerToggle}
        sx={{ display: { lg: "none" }, mr: "auto" }}
        color="inherit"
        aria-label={t("toggle_drawer")}
      >
        <MenuOutlinedIcon />
      </IconButton>

      {/* Desktop Collapse Toggle */}
      <IconButton
        onClick={onCollapseToggle}
        sx={{
          display: { xs: "none", lg: "inline-flex" },
          mr: "auto",
          transform: desktopCollapsed ? "rotate(180deg)" : "none",
          transition: theme.transitions.create("transform"),
        }}
        color="inherit"
        aria-label={t("collapse_drawer")}
      >
        <ArrowCircleLeftOutlinedIcon />
      </IconButton>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <LanguageSelector />
        <ThemeSelector />
        {isLogged ? (
          <Avatar>O</Avatar>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/login")}
          >
            {t("login")}
          </Button>
        )}
      </Stack>
    </TopbarRoot>
  );
};

export default Topbar;
