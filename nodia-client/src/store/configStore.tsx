import { type StateCreator, create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { flushSync } from "react-dom";
import type { ThemeType } from "../types/global";
import { DEFAULT_THEME_ID, resolveThemePreset } from "../themes";

interface ConfigState {
  themeType: ThemeType;
  themeId: string;

  handleChangeThemeId: (themeId: string) => void;
  handleChangeThemeType: (theme: ThemeType) => void;
  handleToggleThemeType: () => void;
}

const applyThemeWithTransition = (updateFn: () => void) => {
  if (
    typeof document === "undefined" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    !("startViewTransition" in document) ||
    typeof document.startViewTransition !== "function"
  ) {
    updateFn();
    return;
  }

  document.startViewTransition(() => {
    flushSync(() => {
      updateFn();
    });
  });
};

const configStore: StateCreator<ConfigState> = (set, get) => ({
  themeType: "dark",
  themeId: DEFAULT_THEME_ID,
  handleChangeThemeId: (themeId) => {
    const preset = resolveThemePreset(themeId);
    if (preset.id !== themeId || get().themeId === themeId) return;
    const previousId = get().themeId;
    try {
      set({ themeId });
    } catch (error) {
      // Persist writes after updating memory. Restore the visible choice even
      // when storage still rejects the rollback write, then let the UI retry.
      try {
        set({ themeId: previousId });
      } catch {
        // The in-memory rollback has already completed.
      }
      throw error;
    }
  },
  handleChangeThemeType: (theme) => {
    applyThemeWithTransition(() => {
      set({ themeType: theme });
    });
  },
  handleToggleThemeType: () => {
    const currentTheme = get().themeType;
    const newTheme = currentTheme === "light" ? "dark" : "light";
    applyThemeWithTransition(() => {
      set({ themeType: newTheme });
    });
  },
});

const useThemeStore = create<ConfigState>()(
  persist(configStore, {
    name: "configStore",
    storage: createJSONStorage(() => ({
      getItem: (name) => {
        try {
          return localStorage.getItem(name);
        } catch {
          return null;
        }
      },
      setItem: (name, value) => localStorage.setItem(name, value),
      removeItem: (name) => localStorage.removeItem(name),
    })),
    partialize: ({ themeType, themeId }) => ({ themeType, themeId }),
    merge: (persisted, current) => {
      const saved = persisted && typeof persisted === "object"
        ? persisted as Record<string, unknown>
        : {};
      return {
        ...current,
        themeType: saved.themeType === "light" ? "light" : "dark",
        themeId: resolveThemePreset(saved.themeId).id,
      };
    },
  })
);

export default useThemeStore;
