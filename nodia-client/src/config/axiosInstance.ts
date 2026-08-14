import axios, {
  type AxiosError,
  type AxiosInstance,
  type CreateAxiosDefaults,
} from "axios";
import envs from "./.envs";
import useAuthStore from "../store/authStore";

const BASE_API_CONFIG: CreateAxiosDefaults = {
  baseURL: envs.API_URL,
  timeout: 20000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
};

const buildConfig = (
  overrides: CreateAxiosDefaults = {}
): CreateAxiosDefaults => {
  const baseHeaders = (BASE_API_CONFIG.headers ?? {}) as Record<string, string>;
  const overrideHeaders = (overrides.headers ?? {}) as Record<string, string>;

  return {
    ...BASE_API_CONFIG,
    ...overrides,
    headers: {
      ...baseHeaders,
      ...overrideHeaders,
    },
  };
};

const applyDefaultInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string; error?: string }>) => {
      const normalizedMessage =
        error.response?.data?.message ??
        error.response?.data?.error ??
        error.message;

      if (normalizedMessage) {
        error.message = normalizedMessage;
      }

      if (error.response?.status === 401) {
        useAuthStore.getState().logout();
      }

      return Promise.reject(error);
    }
  );
};

export const createApiInstance = (overrides: CreateAxiosDefaults = {}) => {
  const instance = axios.create(buildConfig(overrides));
  applyDefaultInterceptors(instance);
  return instance;
};

export const mainInstance = createApiInstance();
