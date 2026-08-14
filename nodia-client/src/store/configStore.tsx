import { type StateCreator, create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeType } from "../types/global";

interface ConfigState {
  themeType: ThemeType;

  handleChangeThemeType: (theme: ThemeType) => void;
  handleToggleThemeType: () => void;
}

const configStore: StateCreator<ConfigState> = (set, get) => ({
  themeType: "light",
  handleChangeThemeType: (theme) => {
    set({ themeType: theme });
  },
  handleToggleThemeType: () => {
    const currentTheme = get().themeType;
    const newTheme = currentTheme === "light" ? "dark" : "light";
    set({ themeType: newTheme });
  },
});

const useThemeStore = create<ConfigState>()(
  persist(configStore, { name: "configStore" })
);

export default useThemeStore;
