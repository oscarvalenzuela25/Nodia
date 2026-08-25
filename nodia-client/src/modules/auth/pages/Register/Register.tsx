import { useTranslation } from "react-i18next";
import useRegister from "./hooks/useRegister";
import { ActionButton, Description, Page, Title } from "./styles";

const Register = () => {
  const { t } = useTranslation();
  const { handleRegister } = useRegister();

  return (
    <Page>
      <Title>{t("auth:register_title")}</Title>
      <Description>{t("auth:public_route_description")}</Description>
      <ActionButton type="button" variant="contained" onClick={handleRegister}>
        {t("auth:register_button")}
      </ActionButton>
    </Page>
  );
};

export default Register;
