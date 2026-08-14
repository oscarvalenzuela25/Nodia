import { Link } from "react-router";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <main style={{ padding: "2rem" }}>
      <h1>{t("core:not_found_page_title")}</h1>
      <p>{t("core:not_found_page_message")}</p>
      <Link to="/">{t("core:back_home")}</Link>
    </main>
  );
};

export default NotFound;
