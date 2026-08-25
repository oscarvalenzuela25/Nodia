import { useNavigate } from "react-router";
import useAuth from "../../../../../hooks/useAuth";

const useLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = () => {
    login({
      token: "demo-token",
      user: {
        name: "Demo User",
      },
    });
    navigate("/", { replace: true });
  };

  return { handleLogin };
};

export default useLogin;
