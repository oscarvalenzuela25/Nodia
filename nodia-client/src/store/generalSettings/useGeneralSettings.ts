import { useCallback } from "react";
import useGeneralSettingsStore from "./generalSettingsStore";
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
    state.actions.some((a) => a.key === actionKey)
  );
};

/**
 * Hook to check if the user has a specific role.
 */
export const useHasRole = (roleKey: string): boolean => {
  return useGeneralSettingsStore((state) =>
    state.roles.includes(roleKey)
  );
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
    [setContext]
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
