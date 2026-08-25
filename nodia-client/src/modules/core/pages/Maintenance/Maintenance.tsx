import { useTranslation } from "react-i18next";
import { Description, HomeLink, Page, Title } from "./styles";

const Maintenance = () => {
  const { t } = useTranslation();

  return (
    <Page>
      <Title>{t("core:maintenance_title")}</Title>
      <Description>{t("core:maintenance_message")}</Description>
      <HomeLink to="/">{t("core:go_home")}</HomeLink>
    </Page>
  );
};

export default Maintenance;
