import { useNavigate } from "react-router";
import { useGoogleLogin } from "@react-oauth/google";
import useAuth from "../../../../../hooks/useAuth";

const useLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      console.log("Token response para enviar al backend:", tokenResponse);
      
      // Simula el login exitoso localmente
      login({
        token: "demo-token",
        user: {
          name: "Demo User",
        },
      });
      navigate("/", { replace: true });
    },
    onError: (error) => {
      console.error("Login Failed", error);
    },
  });

  return { handleLogin };
};

export default useLogin;
