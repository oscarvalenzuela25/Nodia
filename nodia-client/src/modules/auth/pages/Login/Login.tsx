import { useNavigate } from "react-router";
import useAuth from "../../../../hooks/useAuth";
import { useTranslation } from "react-i18next";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();

  const handleLogin = () => {
    login({
      token: "demo-token",
      user: {
        name: "Demo User",
      },
    });
    navigate("/", { replace: true });
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>{t("auth:login_title")}</h1>
      <p>{t("auth:public_route_description")}</p>
      <button type="button" onClick={handleLogin}>
        {t("auth:login_button")}
      </button>
    </main>
  );
};

export default Login;
