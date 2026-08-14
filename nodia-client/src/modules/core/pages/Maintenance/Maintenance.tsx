import { Link } from "react-router";
import { useTranslation } from "react-i18next";

const Maintenance = () => {
  const { t } = useTranslation();

  return (
    <main style={{ padding: "2rem" }}>
      <h1>{t("core:maintenance_title")}</h1>
      <p>{t("core:maintenance_message")}</p>
      <Link to="/">{t("core:go_home")}</Link>
    </main>
  );
};

export default Maintenance;
