import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { useTranslation } from "react-i18next";

const RouteError = () => {
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
      title = t("core:route_status_title", {
        status: error.status,
        statusText: error.statusText,
      });
      message = typeof error.data === "string" ? error.data : message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  if (import.meta.env.DEV) {
    console.error(error);
  }

  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      <h1>{title}</h1>
      <p>{message}</p>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          justifyContent: "center",
          marginTop: "1rem",
        }}
      >
        <button type="button" onClick={() => window.location.reload()}>
          {t("core:retry")}
        </button>
        <button type="button" onClick={() => navigate("/")}>
          {t("core:go_home")}
        </button>
      </div>
    </main>
  );
};

export default RouteError;
