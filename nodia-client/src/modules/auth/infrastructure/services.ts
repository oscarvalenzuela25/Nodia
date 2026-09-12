import { mainInstance, waitForRefresh } from "../../../config/api";
import { apiPath } from "../../../config/apiPath";
import type { AuthResponse } from "./types";

export async function loginWithGoogle(credential: string): Promise<AuthResponse> {
  const { data } = await mainInstance.post<AuthResponse>(apiPath("/auth/login"), {
    provider: "google", credential,
  }, { skipAuth: true });
  return data;
}

export async function logoutSession(): Promise<void> {
  // A refresh already sent may still replace the cookie. Revoke after it settles.
  await waitForRefresh();
  await mainInstance.post(apiPath("/auth/logout"), {}, { skipAuth: true });
}
