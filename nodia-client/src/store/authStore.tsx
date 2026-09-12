import { type StateCreator, create } from "zustand";
import { persist } from "zustand/middleware";
import { queryClient } from "../config/reactQuery";
import useGeneralSettingsStore from "./generalSettings/generalSettingsStore";

export type AuthUser = {
  id?: string;
  name: string;
  email?: string;
  image_url?: string | null;
};

type LoginPayload = {
  token: string;
  user?: AuthUser;
  expiresAt?: number;
};

type SessionStatus = "anonymous" | "restoring" | "authenticated" | "unavailable";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  expiresAt: number | null;
  sessionVersion: number;
  isRefreshing: boolean;
  sessionStatus: SessionStatus;

  login: (payload: LoginPayload) => void;
  logout: () => void;
  setRefreshing: (value: boolean) => void;
  setSessionStatus: (value: SessionStatus) => void;
}

export const hasValidatedSession = (state: AuthState) =>
  state.sessionStatus === "authenticated" && Boolean(state.token) &&
  (state.expiresAt ?? 0) > Date.now();

export const hasActiveSession = (state: AuthState) =>
  hasValidatedSession(state) && !state.isRefreshing;

const authStore: StateCreator<AuthState> = (set, get) => ({
  token: null,
  user: null,
  expiresAt: null,
  sessionVersion: 0,
  isRefreshing: false,
  sessionStatus: "anonymous",
  login: ({ token, user, expiresAt }) => {
    if (get().user?.id !== user?.id) {
      void queryClient.cancelQueries();
      queryClient.clear();
      useGeneralSettingsStore.getState().clearContext();
    }
    set({
      token,
      user: user ?? null,
      expiresAt: expiresAt ?? null,
      sessionStatus: "authenticated",
      sessionVersion: get().user?.id !== user?.id ? get().sessionVersion + 1 : get().sessionVersion,
    });
  },
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  setSessionStatus: (sessionStatus) => set({ sessionStatus }),
  logout: () => {
    void queryClient.cancelQueries();
    queryClient.clear();
    useGeneralSettingsStore.getState().clearContext();
    set({
      token: null,
      user: null,
      expiresAt: null,
      isRefreshing: false,
      sessionStatus: "anonymous",
      sessionVersion: get().sessionVersion + 1,
    });
    void useAuthStore.persist.clearStorage();
  },
});

const useAuthStore = create<AuthState>()(
  persist(authStore, {
    name: "authStore",
    version: 1,
    merge: (persisted, current) => {
      if (!persisted || typeof persisted !== "object") return current;
      const saved = persisted as Partial<Pick<AuthState, "token" | "user" | "expiresAt">>;
      const token = typeof saved.token === "string" && saved.token ? saved.token : null;
      const expiresAt = typeof saved.expiresAt === "number" && Number.isFinite(saved.expiresAt) ? saved.expiresAt : null;
      const user = saved.user && typeof saved.user.name === "string" ? saved.user : null;
      const changedUser = saved.user?.id !== current.user?.id || Boolean(saved.token) !== Boolean(current.token);
      const unchangedCredentials = !changedUser && token === current.token && expiresAt === current.expiresAt;
      if (changedUser) {
        void queryClient.cancelQueries();
        queryClient.clear();
        useGeneralSettingsStore.getState().clearContext();
      }
      return { ...current, token, user: unchangedCredentials ? current.user : user, expiresAt,
        // Stored credentials are a recovery hint, never proof of an active session.
        sessionStatus: !token ? "anonymous" : unchangedCredentials
          ? current.sessionStatus : "restoring",
        sessionVersion: current.sessionVersion + (changedUser ? 1 : 0) };
    },
    // Old demo sessions cannot become authenticated API sessions.
    migrate: () => ({ token: null, user: null, expiresAt: null }),
    partialize: (state) => ({
      token: state.token,
      user: state.user,
      expiresAt: state.expiresAt,
    }),
  })
);

export default useAuthStore;
