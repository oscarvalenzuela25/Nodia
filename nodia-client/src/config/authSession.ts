import axios, { type AxiosError, CanceledError, type AxiosInstance } from "axios";
import useAuthStore, { hasActiveSession, type AuthUser } from "../store/authStore";
import i18n from "../translate";
import { sileo } from "sileo";
import { apiPath } from "./apiPath";
import { notifyAuthError } from "../services/authFeedback";
import type { AuthResponse } from "../modules/auth/infrastructure/types";

declare module "axios" {
  interface AxiosRequestConfig {
    skipAuth?: boolean;
    validateSession?: boolean;
    authRetried?: boolean;
    authSessionVersion?: number;
    authToken?: string | null;
  }
}

// One manager is shared by all Nodia API clients to coordinate session renewal.
export function createAuthSession(client: AxiosInstance) {
  let restoration: { token: string; version: number; promise: Promise<AuthResponse> } | null = null;

  async function validateStoredToken(token: string, expiresAt: number, version: number): Promise<AuthResponse> {
    const { data: user } = await client.get<AuthUser>(apiPath("/auth/me"), { validateSession: true });
    const current = useAuthStore.getState();
    if (current.sessionVersion !== version || current.token !== token) throw new CanceledError("Session changed");
    const session = { token, expiresAt, user };
    current.login(session);
    sileo.success({ title: i18n.t("auth:session_restored") });
    return session;
  }

  function restoreSession(): Promise<AuthResponse> {
    const { token, expiresAt, sessionVersion } = useAuthStore.getState();
    if (!token) return Promise.reject(new CanceledError("No session"));
    if (restoration?.token === token && restoration.version === sessionVersion) return restoration.promise;
    useAuthStore.getState().setSessionStatus("restoring");
    const run = async () => {
      if ((expiresAt ?? 0) <= Date.now()) return refreshSession();
      try {
        return await validateStoredToken(token, expiresAt!, sessionVersion);
      } catch (error) {
        if (error instanceof CanceledError) throw error;
        const current = useAuthStore.getState();
        if (current.sessionVersion !== sessionVersion || current.token !== token) throw new CanceledError("Session changed");
        if (axios.isAxiosError(error) && error.response?.status === 401) return refreshSession();
        current.setSessionStatus("unavailable");
        notifyAuthError(error, "auth:session_unavailable");
        throw error;
      }
    };
    const operation = { token, version: sessionVersion, promise: run().finally(() => {
      if (restoration === operation) restoration = null;
    }) };
    restoration = operation;
    return operation.promise;
  }


  let refreshPromise: Promise<AuthResponse> | null = null;

  function refreshSession(): Promise<AuthResponse> {
    if (refreshPromise) return refreshPromise;
    const { token: originalToken, sessionVersion } = useAuthStore.getState();
    if (!originalToken) return Promise.reject(new CanceledError("No session"));
    useAuthStore.getState().setRefreshing(true);
    let tokenBeingRenewed = originalToken;

    const renew = async (): Promise<AuthResponse> => {
      // Web Locks serializes refreshes across tabs sharing the rotating cookie.
      if (typeof navigator !== "undefined" && navigator.locks) await useAuthStore.persist.rehydrate();
      const current = useAuthStore.getState();
      if (!current.token || current.sessionVersion !== sessionVersion) throw new CanceledError("Session changed");
      tokenBeingRenewed = current.token;
      if (current.token !== originalToken && (current.expiresAt ?? 0) > Date.now() + 30_000 && current.user) {
        // Another tab rotated the cookie. Verify its stored access token without rotating again.
        return validateStoredToken(current.token, current.expiresAt!, sessionVersion);
      }
      const { data } = await client.post<AuthResponse>(apiPath("/auth/refresh"), {}, { skipAuth: true });
      if (useAuthStore.getState().sessionVersion !== sessionVersion || useAuthStore.getState().token !== tokenBeingRenewed) {
        throw new CanceledError("Session changed");
      }
      useAuthStore.getState().login(data);
      sileo.success({ title: i18n.t("auth:refresh_success") });
      return data;
    };
    const operation = typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("nodia-auth-refresh", renew)
      : renew();
    refreshPromise = operation.catch((error: unknown) => {
      if (useAuthStore.getState().sessionVersion === sessionVersion && useAuthStore.getState().token === tokenBeingRenewed && !(error instanceof CanceledError)) {
        if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
          useAuthStore.getState().logout();
        } else if (useAuthStore.getState().sessionStatus !== "authenticated" || (useAuthStore.getState().expiresAt ?? 0) <= Date.now()) {
          useAuthStore.getState().setSessionStatus("unavailable");
        }
        notifyAuthError(error, "auth:session_expired");
      }
      throw error;
    }).finally(() => {
      refreshPromise = null;
      if (useAuthStore.getState().token) useAuthStore.getState().setRefreshing(false);
    });
    return refreshPromise;
  }

  async function waitForRefresh(): Promise<void> {
    await refreshPromise?.catch(() => undefined);
  }

  const installInterceptors = (instance: AxiosInstance) => {
    instance.interceptors.request.use(async (config) => {
      const initial = useAuthStore.getState();
      if (!config.skipAuth && !config.validateSession) {
        if (!initial.token || initial.sessionStatus !== "authenticated") {
          throw new CanceledError(i18n.t("auth:session_expired"));
        }
        // Timers can be delayed in background tabs; check expiry again at transport.
        if (initial.isRefreshing || (initial.expiresAt ?? 0) <= Date.now()) await refreshSession();
        if (!hasActiveSession(useAuthStore.getState()) || initial.sessionVersion !== useAuthStore.getState().sessionVersion) {
          throw new CanceledError(i18n.t("auth:session_expired"));
        }
      }
      const { token, sessionVersion } = useAuthStore.getState();
      config.authSessionVersion = sessionVersion;
      config.authToken = token;
      if (!config.skipAuth && token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    instance.interceptors.response.use(
      (response) => {
        if (!response.config.skipAuth && response.config.authSessionVersion !== useAuthStore.getState().sessionVersion) {
          throw new CanceledError("Session changed");
        }
        return response;
      },
      async (error: AxiosError<{ message?: string; error?: string }>) => {
        const config = error.config;
        const state = useAuthStore.getState();
        if (config && !config.skipAuth && config.authSessionVersion !== state.sessionVersion) {
          throw new CanceledError("Session changed");
        }
        if (error.response?.status === 401 && config && !config.skipAuth && !config.validateSession && state.token) {
          if (!config.authRetried) {
            config.authRetried = true;
            // A concurrent request may already have renewed the token.
            if (config.authToken === state.token) {
              state.setSessionStatus("restoring");
              await refreshSession();
            }
            if (!useAuthStore.getState().token) throw error;
            return instance.request(config);
          }
          useAuthStore.getState().logout();
        }
        throw error;
      }
    );
  };

  return { installInterceptors, restoreSession, refreshSession, waitForRefresh };
}
