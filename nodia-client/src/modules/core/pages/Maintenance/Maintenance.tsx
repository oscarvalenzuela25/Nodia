import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ContentWrapper, Description, PrimaryButton, IconWrapper, Page, Title } from "./styles";

const Maintenance = () => {
  const { t } = useTranslation();

  return (
    <Page>
      <ContentWrapper>
        <IconWrapper>
          <EngineeringOutlinedIcon fontSize="inherit" />
        </IconWrapper>
        <Title>{t("core:maintenance_title")}</Title>
        <Description>{t("core:maintenance_message")}</Description>
        <PrimaryButton component={Link} to="/" variant="contained">
          {t("core:go_home")}
        </PrimaryButton>
      </ContentWrapper>
    </Page>
  );
};

export default Maintenance;
