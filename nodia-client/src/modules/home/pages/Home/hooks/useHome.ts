import { useTranslation } from "react-i18next";

const useHome = () => {
  const { t } = useTranslation();

  return {
    t,
  };
};

export default useHome;
