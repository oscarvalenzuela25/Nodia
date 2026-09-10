import { create, type StateCreator } from "zustand";
import type { GeneralSettingsState } from "./types";

const generalSettingsStore: StateCreator<GeneralSettingsState> = (set) => ({
  roles: [],
  actions: [],
  modules: [],
  isLoaded: false,

  setContext: (data) =>
    set({
      roles: data.roles ?? [],
      actions: data.actions ?? [],
      modules: data.modules ?? [],
      isLoaded: true,
    }),

  clearContext: () =>
    set({
      roles: [],
      actions: [],
      modules: [],
      isLoaded: false,
    }),
});

/**
 * Non-persistent Zustand store for authorization context and general settings.
 * Refetched on page refresh so permissions and module assignments remain up-to-date.
 */
export const useGeneralSettingsStore = create<GeneralSettingsState>()(
  generalSettingsStore
);

export default useGeneralSettingsStore;
