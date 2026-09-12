import type { CreateAxiosDefaults } from "axios";
import { createAxiosInstance } from "./axiosInstance";
import { createAuthSession } from "./authSession";

export const mainInstance = createAxiosInstance();

const session = createAuthSession(mainInstance);
session.installInterceptors(mainInstance);

export const { restoreSession, refreshSession, waitForRefresh } = session;

// Services use this factory so additional clients share the same auth lifecycle.
export const createApiInstance = (overrides: CreateAxiosDefaults = {}) => {
  const instance = createAxiosInstance(overrides);
  session.installInterceptors(instance);
  return instance;
};
