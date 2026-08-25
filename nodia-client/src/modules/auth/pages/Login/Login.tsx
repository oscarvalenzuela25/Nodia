import { useTranslation } from "react-i18next";
import useLogin from "./hooks/useLogin";
import { ActionButton, Description, Page, Title } from "./styles";

const Login = () => {
  const { t } = useTranslation();
  const { handleLogin } = useLogin();

  return (
    <Page>
      <Title>{t("auth:login_title")}</Title>
      <Description>{t("auth:public_route_description")}</Description>
      <ActionButton type="button" variant="contained" onClick={handleLogin}>
        {t("auth:login_button")}
      </ActionButton>
    </Page>
  );
};

export default Login;
