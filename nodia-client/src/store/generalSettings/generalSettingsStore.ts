import { create, type StateCreator } from "zustand";
import type { GeneralSettingsState } from "./types";

const generalSettingsStore: StateCreator<GeneralSettingsState> = (set) => ({
  roles: [],
  actions: [],
  modules: [],
  isLoaded: false,
  can_analyze_invoice: false,
  can_use_gemini: false,
  can_use_mistral: false,

  setContext: (data) =>
    set({
      roles: data.roles ?? [],
      actions: data.actions ?? [],
      modules: data.modules ?? [],
      isLoaded: true,
      can_analyze_invoice: Boolean(data.can_analyze_invoice),
      can_use_gemini: Boolean(data.can_use_gemini),
      can_use_mistral: Boolean(data.can_use_mistral),
    }),

  clearContext: () =>
    set({
      roles: [],
      actions: [],
      modules: [],
      isLoaded: false,
      can_analyze_invoice: false,
      can_use_gemini: false,
      can_use_mistral: false,
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
