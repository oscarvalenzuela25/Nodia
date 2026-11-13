import { useCallback, useMemo } from "react";
import useAuth from "../../hooks/useAuth";
import useGeneralSettingsStore from "./generalSettingsStore";
import { canAccessModule, getModulePath, normalizeModulePath } from "./helpers";
import { useAuthorizationContext } from "../../services/authorizationService";
import { NODIA_AI_ROUTE } from "../../modules/nodiaAi/constants/routes";
import type {
  ActionContext,
  AuthorizationContextResponse,
  ModuleGroupContext,
} from "./types";

/**
 * Hook to access the full general settings state and actions.
 */
export const useGeneralSettings = () => {
  const roles = useGeneralSettingsStore((state) => state.roles);
  const actions = useGeneralSettingsStore((state) => state.actions);
  const modules = useGeneralSettingsStore((state) => state.modules);
  const isLoaded = useGeneralSettingsStore((state) => state.isLoaded);
  const setContext = useGeneralSettingsStore((state) => state.setContext);
  const clearContext = useGeneralSettingsStore((state) => state.clearContext);

  return {
    roles,
    actions,
    modules,
    isLoaded,
    setContext,
    clearContext,
  };
};

/**
 * Hook to access the user's authorized module groups and submodules.
 */
export const useUserModules = (): ModuleGroupContext[] => {
  return useGeneralSettingsStore((state) => state.modules);
};

/** Navigation only exposes assignments belonging to a validated session. */
export const useVisibleModules = (): ModuleGroupContext[] => {
  const { isSessionValid, user } = useAuth();
  const { data: context } = useAuthorizationContext({ enabled: isSessionValid && Boolean(user?.id) });
  return useMemo(
    () => {
      if (!isSessionValid || !user?.id || !context) return [];
      const canOpenNodiaAi = canAccessModule(context, NODIA_AI_ROUTE);
      return context.modules.map(group => ({ ...group,
        modules: group.modules.filter(module => normalizeModulePath(getModulePath(module)) !== NODIA_AI_ROUTE || canOpenNodiaAi),
      })).filter(group => group.modules.length > 0);
    },
    [isSessionValid, user?.id, context],
  );
};

/** Module access never depends on action assignments; require validated context. */
export const useCanAccessModule = (path: string): boolean => {
  const { isSessionValid } = useAuth();
  const allowed = useGeneralSettingsStore(
    (state) => state.isLoaded && canAccessModule(state, path),
  );
  return isSessionValid && allowed;
};

/**
 * Hook to access the user's assigned roles.
 */
export const useUserRoles = (): string[] => {
  return useGeneralSettingsStore((state) => state.roles);
};

/**
 * Hook to access the user's permitted actions.
 */
export const useUserActions = (): ActionContext[] => {
  return useGeneralSettingsStore((state) => state.actions);
};

/**
 * Hook to check if the user has a specific action permission.
 */
export const useHasAction = (actionKey: string): boolean => {
  return useGeneralSettingsStore((state) =>
    state.actions.some((a) => a.key === actionKey),
  );
};

/**
 * Hook to check if the user has a specific role.
 */
export const useHasRole = (roleKey: string): boolean => {
  return useGeneralSettingsStore((state) => state.roles.includes(roleKey));
};

/**
 * Hook to access only the store handlers/mutators.
 */
export const useGeneralSettingsHandlers = () => {
  const setContext = useGeneralSettingsStore((state) => state.setContext);
  const clearContext = useGeneralSettingsStore((state) => state.clearContext);

  const handleSetContext = useCallback(
    (data: AuthorizationContextResponse) => {
      setContext(data);
    },
    [setContext],
  );

  const handleClearContext = useCallback(() => {
    clearContext();
  }, [clearContext]);

  return {
    setContext: handleSetContext,
    clearContext: handleClearContext,
  };
};

export default useGeneralSettings;
