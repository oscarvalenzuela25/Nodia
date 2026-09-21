import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { AxiosError } from "axios";
import {
  useVisibleModules,
  getModulePath,
  getTranslatedName,
  getModuleIcon,
} from "../../../../../store/generalSettings";
import type {
  ModuleContext,
  ModuleGroupContext,
} from "../../../../../store/generalSettings/types";
import { useAuthorizationContext } from "../../../../../services/authorizationService";

const useHome = () => {
  const { t, i18n } = useTranslation(["home", "core"]);
  const userModules = useVisibleModules();
  const { isError, error, refetch, isLoading } = useAuthorizationContext();
  const currentLang = i18n.language || "es";

  const errorMessage = useMemo(() => {
    if (!error) return null;
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    return null;
  }, [error]);

  const getGroupTitle = useCallback(
    (group: ModuleGroupContext): string => {
      const translated = getTranslatedName(
        group.translates,
        group.module_group_key,
        currentLang
      );
      if (translated !== group.module_group_key) {
        return translated;
      }
      const candidate = `home:${group.module_group_key.toLowerCase().replace(/[-_]/g, "_")}`;
      const i18nVal = t(candidate);
      if (i18nVal && i18nVal !== candidate) {
        return i18nVal;
      }
      return group.module_group_key;
    },
    [currentLang, t]
  );

  const getModuleTitle = useCallback(
    (module: ModuleContext): string => {
      const translated = getTranslatedName(
        module.translates,
        module.key,
        currentLang
      );
      if (translated !== module.key) {
        return translated;
      }
      const candidate = `home:${module.key.toLowerCase().replace(/[-_]/g, "_")}_title`;
      const i18nVal = t(candidate);
      if (i18nVal && i18nVal !== candidate) {
        return i18nVal;
      }
      return module.key;
    },
    [currentLang, t]
  );

  const getModuleDesc = useCallback(
    (module: ModuleContext): string | null => {
      // 1. Check if module has a translated description in module.translates
      const descItem = module.translates?.find(
        (tr) => tr.key === "description" || tr.key === "comment"
      );
      if (descItem) {
        const isEn = currentLang.startsWith("en");
        const val = isEn
          ? descItem.en?.trim() || descItem.es?.trim()
          : descItem.es?.trim() || descItem.en?.trim();
        if (val) return val;
      }

      // 2. Check i18n candidate key in home namespace
      const candidateKey = `${module.key.toLowerCase().replace(/[-_]/g, "_")}_desc`;
      if (i18n.exists(`home:${candidateKey}`)) {
        const i18nVal = t(`home:${candidateKey}`);
        if (
          i18nVal &&
          i18nVal !== candidateKey &&
          i18nVal !== `home:${candidateKey}`
        ) {
          return i18nVal;
        }
      }

      return null;
    },
    [currentLang, i18n, t]
  );

  return {
    t,
    userModules,
    isError,
    errorMessage,
    isLoading,
    refetchAuthContext: refetch,
    getGroupTitle,
    getModuleTitle,
    getModuleDesc,
    getModulePath,
    getModuleIcon,
  };
};

export default useHome;
