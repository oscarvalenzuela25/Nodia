import { useNavigate } from "react-router";
import useAuth from "../../../../hooks/useAuth";
import { useTranslation } from "react-i18next";

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();

  const handleRegister = () => {
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
      <h1>{t("auth:register_title")}</h1>
      <p>{t("auth:public_route_description")}</p>
      <button type="button" onClick={handleRegister}>
        {t("auth:register_button")}
      </button>
    </main>
  );
};

export default Register;
