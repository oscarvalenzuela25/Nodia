import { type StateCreator, create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id?: string;
  name: string;
  email?: string;
};

type LoginPayload = {
  token: string;
  user?: AuthUser;
};

interface AuthState {
  token: string | null;
  user: AuthUser | null;

  login: (payload: LoginPayload) => void;
  logout: () => void;
}

const authStore: StateCreator<AuthState> = (set) => ({
  token: null,
  user: null,
  login: ({ token, user }) => {
    set({
      token,
      user: user ?? null,
    });
  },
  logout: () => {
    set({
      token: null,
      user: null,
    });
  },
});

const useAuthStore = create<AuthState>()(
  persist(authStore, {
    name: "authStore",
    partialize: (state) => ({
      token: state.token,
      user: state.user,
    }),
  })
);

export default useAuthStore;
