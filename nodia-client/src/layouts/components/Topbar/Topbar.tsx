import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Avatar, Stack, IconButton, useTheme, Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography } from "@mui/material";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import ArrowCircleLeftOutlinedIcon from "@mui/icons-material/ArrowCircleLeftOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import useProfileMenu from "./hooks/useProfileMenu";
import ThemeSelector from "../ThemeSelector";
import LanguageSelector from "../../../components/LanguageSelector";
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
  const { user, isAuthenticated, isBusy, anchorEl, openMenu, closeMenu, handleLogout } = useProfileMenu();

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
        {isAuthenticated ? (
          <>
            <IconButton
              id="profile-menu-button"
              aria-label={t("auth:account_menu")}
              aria-controls={anchorEl ? "profile-menu" : undefined}
              aria-haspopup="menu"
              aria-expanded={Boolean(anchorEl)}
              disabled={isBusy}
              onClick={(event) => openMenu(event.currentTarget)}
            >
              <Avatar src={user?.image_url ?? undefined} alt={user?.name ?? ""}>
                {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu id="profile-menu" anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}
              slotProps={{ list: { "aria-labelledby": "profile-menu-button" } }}>
              <Typography sx={{ px: 2, pt: 1, fontWeight: 600 }}>{user?.name}</Typography>
              <Typography variant="body2" sx={{ px: 2, pb: 1, color: "text.secondary" }}>{user?.email}</Typography>
              <Divider />
              <MenuItem onClick={handleLogout} disabled={isBusy}>
                <ListItemIcon><LogoutOutlinedIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t("auth:logout")}</ListItemText>
              </MenuItem>
            </Menu>
          </>
        ) : (
          <Button
            disabled={isBusy}
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
