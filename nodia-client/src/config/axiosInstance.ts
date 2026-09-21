import axios, { type AxiosError, type AxiosInstance, type CreateAxiosDefaults } from "axios";
import envs from "./.envs";
import i18n from "../translate";

const BASE_API_CONFIG: CreateAxiosDefaults = {
  baseURL: envs.API_URL,
  timeout: 20000,
  withCredentials: true,
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
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.headers) {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string; error?: string }>) => {
      const data = error.response?.data;
      if (error.response?.status === 429 && data?.error === "RATE_LIMIT_EXCEEDED") {
        const retryAfter = Number(error.response.headers["retry-after"]);
        data.message = Number.isFinite(retryAfter) && retryAfter > 0
          ? i18n.t("core:rate_limit_exceeded_retry", { seconds: Math.ceil(retryAfter) })
          : i18n.t("core:rate_limit_exceeded");
      } else if (
        error.response?.status === 503 && data?.error === "RATE_LIMIT_UNAVAILABLE"
      ) {
        data.message = i18n.t("core:rate_limit_unavailable");
      }

      if (typeof data?.message === "string" && i18n.exists(data.message)) {
        data.message = i18n.t(data.message);
      }

      const normalizedMessage =
        error.response?.data?.message ??
        error.response?.data?.error ??
        error.message;

      if (normalizedMessage) {
        error.message = normalizedMessage;
      }

      throw error;
    }
  );
};

export const createAxiosInstance = (overrides: CreateAxiosDefaults = {}) => {
  const instance = axios.create(buildConfig(overrides));
  applyDefaultInterceptors(instance);
  return instance;
};
