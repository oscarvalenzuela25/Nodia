import { act, cleanup, renderHook } from "@testing-library/react";
import { AxiosError } from "axios";
import { googleLogout } from "@react-oauth/google";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import { queryClient } from "../../../../config/reactQuery";
import i18n from "../../../../translate";
import useAuthStore from "../../../../store/authStore";
import { loginWithGoogle, logoutSession } from "../../../../modules/auth/infrastructure/services";
import { useGoogleSignIn, useSignOut } from "../../../../modules/auth/infrastructure/useServices";
import type { AuthResponse } from "../../../../modules/auth/infrastructure/types";

vi.mock("../../../../modules/auth/infrastructure/services", () => ({
  loginWithGoogle: vi.fn(),
  logoutSession: vi.fn(),
}));
vi.mock("@react-oauth/google", () => ({ googleLogout: vi.fn() }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const session = (): AuthResponse => ({
  token: "synthetic-access-token",
  expiresAt: Date.now() + 900_000,
  user: { id: "42", name: "Auth fixture" },
});

beforeEach(() => {
  useAuthStore.getState().logout();
  queryClient.clear();
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
  useAuthStore.getState().logout();
  queryClient.clear();
});

describe("explicit authentication feedback", () => {
  it("keeps one sign-in success and authenticates the returned user", async () => {
    const returned = session();
    vi.mocked(loginWithGoogle).mockResolvedValue(returned);
    const { result } = renderHook(() => useGoogleSignIn());

    await act(() => result.current.mutateAsync("synthetic-google-credential"));

    expect(useAuthStore.getState()).toMatchObject({
      token: returned.token,
      user: returned.user,
      sessionStatus: "authenticated",
    });
    expect(sileo.success).toHaveBeenCalledExactlyOnceWith({
      title: i18n.t("auth:login_success"),
    });
    expect(sileo.error).not.toHaveBeenCalled();
  });

  it("keeps the server sign-in error without announcing success or authenticating", async () => {
    const error = new AxiosError("request failed");
    Object.assign(error, { response: { data: { message: "Access rejected by server" } } });
    vi.mocked(loginWithGoogle).mockRejectedValue(error);
    const { result } = renderHook(() => useGoogleSignIn());

    await act(async () => {
      await expect(result.current.mutateAsync("synthetic-google-credential")).rejects.toBe(error);
    });

    expect(useAuthStore.getState().sessionStatus).toBe("anonymous");
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).toHaveBeenCalledExactlyOnceWith({
      title: i18n.t("auth:error_title"),
      description: "Access rejected by server",
    });
  });

  it("keeps one sign-out success after local credentials and Google state are cleared", async () => {
    useAuthStore.getState().login(session());
    vi.mocked(logoutSession).mockImplementation(async () => {
      expect(useAuthStore.getState().token).toBeNull();
      expect(googleLogout).toHaveBeenCalledTimes(1);
    });
    const { result } = renderHook(() => useSignOut());

    await act(() => result.current.mutateAsync());

    expect(useAuthStore.getState().sessionStatus).toBe("anonymous");
    expect(sileo.success).toHaveBeenCalledExactlyOnceWith({
      title: i18n.t("auth:logout_success"),
    });
    expect(sileo.error).not.toHaveBeenCalled();
  });

  it("keeps the logout failure warning while local credentials stay cleared", async () => {
    useAuthStore.getState().login(session());
    const error = new Error("synthetic network failure");
    vi.mocked(logoutSession).mockRejectedValue(error);
    const { result } = renderHook(() => useSignOut());

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(error);
    });

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().sessionStatus).toBe("anonymous");
    expect(googleLogout).toHaveBeenCalledTimes(1);
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).toHaveBeenCalledExactlyOnceWith({
      title: i18n.t("auth:error_title"),
      description: i18n.t("auth:logout_failed"),
    });
  });
});
