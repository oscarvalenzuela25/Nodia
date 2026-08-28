import { type StateCreator, create } from "zustand";
import { persist } from "zustand/middleware";
import { flushSync } from "react-dom";
import type { ThemeType } from "../types/global";

interface ConfigState {
  themeType: ThemeType;

  handleChangeThemeType: (theme: ThemeType) => void;
  handleToggleThemeType: () => void;
}

const applyThemeWithTransition = (updateFn: () => void) => {
  if (
    typeof document === "undefined" ||
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
  themeType: "light",
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
  persist(configStore, { name: "configStore" })
);

export default useThemeStore;
