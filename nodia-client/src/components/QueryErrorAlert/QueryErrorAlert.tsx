import type { FC } from "react";
import { Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ErrorAlert } from "./styles";

interface Props {
  isError: boolean;
  isFetching: boolean;
  onRetry: () => unknown;
}

const QueryErrorAlert: FC<Props> = ({ isError, isFetching, onRetry }) => {
  const { t } = useTranslation("core");
  if (!isError) return null;
  return (
    <ErrorAlert severity="error" action={
      <Button color="inherit" size="small" disabled={isFetching} onClick={() => { void onRetry(); }}>
        {t("core:retry")}
      </Button>
    }>
      {t("core:server_error_alert")}
    </ErrorAlert>
  );
};

export default QueryErrorAlert;
