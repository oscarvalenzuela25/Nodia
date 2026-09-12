import { useState } from "react";
import { useNavigate } from "react-router";
import useAuth from "../../../../hooks/useAuth";
import { useSignOut } from "../../../../modules/auth/infrastructure/useServices";

export default function useProfileMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { user, isAuthenticated, isRefreshing } = useAuth();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const closeMenu = () => setAnchorEl(null);
  const handleLogout = () => {
    closeMenu();
    signOut.mutate();
    navigate("/", { replace: true });
  };
  return { user, isAuthenticated, isBusy: isRefreshing || signOut.isPending,
    anchorEl, openMenu: setAnchorEl, closeMenu, handleLogout };
}
