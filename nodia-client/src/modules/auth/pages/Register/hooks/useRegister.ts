import { useNavigate } from "react-router";
import useAuth from "../../../../../hooks/useAuth";

const useRegister = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleRegister = () => {
    login({
      token: "demo-token",
      user: {
        name: "Demo User",
      },
    });
    navigate("/", { replace: true });
  };

  return { handleRegister };
};

export default useRegister;
