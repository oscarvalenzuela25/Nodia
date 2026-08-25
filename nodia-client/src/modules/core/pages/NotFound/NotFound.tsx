import { useTranslation } from "react-i18next";
import { Description, HomeLink, Page, Title } from "./styles";

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <Page>
      <Title>{t("core:not_found_page_title")}</Title>
      <Description>{t("core:not_found_page_message")}</Description>
      <HomeLink to="/">{t("core:back_home")}</HomeLink>
    </Page>
  );
};

export default NotFound;
