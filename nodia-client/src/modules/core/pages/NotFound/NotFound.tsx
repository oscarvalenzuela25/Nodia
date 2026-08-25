import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ContentWrapper, Description, ErrorCode, PrimaryButton, Page, Title } from "./styles";

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <Page>
      <ContentWrapper>
        <ErrorCode>404</ErrorCode>
        <Title>{t("core:not_found_page_title")}</Title>
        <Description>{t("core:not_found_page_message")}</Description>
        <PrimaryButton component={Link} to="/" variant="contained">
          {t("core:back_home")}
        </PrimaryButton>
      </ContentWrapper>
    </Page>
  );
};

export default NotFound;
