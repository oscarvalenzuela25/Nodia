import { useTranslation } from "react-i18next";
import useRouteErrorState from "./hooks/useRouteErrorState";
import {
  Actions,
  Description,
  Page,
  PrimaryAction,
  SecondaryAction,
  Title,
} from "./styles";

const RouteError = () => {
  const { t } = useTranslation();
  const { handleGoHome, handleRetry, message, title } = useRouteErrorState();

  return (
    <Page>
      <Title>{title}</Title>
      <Description>{message}</Description>
      <Actions>
        <PrimaryAction type="button" variant="contained" onClick={handleRetry}>
          {t("core:retry")}
        </PrimaryAction>
        <SecondaryAction type="button" variant="outlined" onClick={handleGoHome}>
          {t("core:go_home")}
        </SecondaryAction>
      </Actions>
    </Page>
  );
};

export default RouteError;
