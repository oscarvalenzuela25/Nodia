import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { useTranslation } from "react-i18next";
import useRouteErrorState from "./hooks/useRouteErrorState";
import {
  Actions,
  ContentWrapper,
  Description,
  PrimaryButton,
  SecondaryButton,
  IconWrapper,
  Page,
  Title,
} from "./styles";

const RouteError = () => {
  const { t } = useTranslation();
  const { handleGoHome, handleRetry, message, title } = useRouteErrorState();

  return (
    <Page>
      <ContentWrapper>
        <IconWrapper>
          <WarningAmberOutlinedIcon fontSize="inherit" />
        </IconWrapper>
        <Title>{title}</Title>
        <Description>{message}</Description>
        <Actions>
          <PrimaryButton type="button" variant="contained" onClick={handleRetry}>
            {t("core:retry")}
          </PrimaryButton>
          <SecondaryButton type="button" variant="outlined" onClick={handleGoHome}>
            {t("core:go_home")}
          </SecondaryButton>
        </Actions>
      </ContentWrapper>
    </Page>
  );
};

export default RouteError;
