import useAuthStore, { hasActiveSession, hasValidatedSession } from "../store/authStore";

const useAuth = () => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const isRefreshing = useAuthStore((state) => state.isRefreshing);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const isSessionActive = useAuthStore(hasActiveSession);
  const isSessionValid = useAuthStore(hasValidatedSession);

  return {
    token,
    user,
    isAuthenticated: sessionStatus === "authenticated",
    isSessionActive,
    isSessionValid,
    isDemo: sessionStatus === "anonymous",
    sessionStatus,
    login,
    logout,
    isRefreshing,
  };
};

export default useAuth;
