import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

const useRouteErrorState = () => {
  const error = useRouteError();
  const navigate = useNavigate();
  const { t } = useTranslation();

  let title = t("core:route_error_title");
  let message = t("core:route_error_message");

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = t("core:route_not_found_title");
      message = t("core:route_not_found_message");
    } else {
      title = t("core:route_status_title", { status: error.status });
    }
  }

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.error(error);
    }
  }, [error]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate("/");
  };

  return {
    title,
    message,
    handleRetry,
    handleGoHome,
  };
};

export default useRouteErrorState;
