import useAuthStore from "../store/authStore";

const useAuth = () => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  return {
    token,
    user,
    isAuthenticated: Boolean(token),
    login,
    logout,
  };
};

export default useAuth;
