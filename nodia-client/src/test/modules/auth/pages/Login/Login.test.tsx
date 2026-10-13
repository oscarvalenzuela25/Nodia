import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import Login from "../../../../../modules/auth/pages/Login";
import PublicLayout from "../../../../../layouts/PublicLayout";
import useAuthStore from "../../../../../store/authStore";
import { loginWithGoogle } from "../../../../../modules/auth/infrastructure/services";
import { sileo } from "sileo";
import envs from "../../../../../config/.envs";
import i18n from "../../../../../translate";
import useThemeStore from "../../../../../store/configStore";

vi.mock("../../../../../modules/auth/infrastructure/services", () => ({ loginWithGoogle: vi.fn(), logoutSession: vi.fn() }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@react-oauth/google", async () => ({
  ...await vi.importActual<typeof import("@react-oauth/google")>("@react-oauth/google"),
  GoogleLogin: ({ onSuccess, theme }: { onSuccess: (response: { credential: string }) => void; theme: string }) => (
    <button data-google-theme={theme} onClick={() => onSuccess({ credential: "google-id-token" })}>Google</button>
  ),
  googleLogout: vi.fn(),
}));
const session = { token: "nodia-jwt", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Oscar", image_url: "https://example.com/avatar.png" } };
const renderLogin = () => {
  const router = createMemoryRouter([
    { path: "/login", element: <PublicLayout><Login /></PublicLayout> },
    { path: "/", element: <div data-testid="home" /> },
  ], { initialEntries: ["/login"] });
  render(<RouterProvider router={router} />);
  return router;
};
const originalClientId = envs.GOOGLE_CLIENT_ID;
const googleScript = () => document.querySelector<HTMLScriptElement>('script[src^="https://accounts.google.com/gsi/client"]');
beforeEach(() => {
  vi.clearAllMocks();
  envs.GOOGLE_CLIENT_ID = "test-client-id";
  useThemeStore.setState({ themeType: 'dark' });
  useAuthStore.getState().logout();
});
afterEach(() => {
  envs.GOOGLE_CLIENT_ID = originalClientId;
  useAuthStore.getState().logout();
});

describe("Login", () => {
  it("uses the official dark button and changes to outline without reloading the Google SDK", async () => {
    renderLogin();
    const script = googleScript();
    expect(screen.getByRole('button', { name: 'Google' })).toHaveAttribute('data-google-theme', 'filled_black');
    act(() => useThemeStore.getState().handleChangeThemeType('light'));
    expect(screen.getByRole('button', { name: 'Google' })).toHaveAttribute('data-google-theme', 'outline');
    expect(googleScript()).toBe(script);
    act(() => useThemeStore.getState().handleChangeThemeType('dark'));
    expect(screen.getByRole('button', { name: 'Google' })).toHaveAttribute('data-google-theme', 'filled_black');
    expect(loginWithGoogle).not.toHaveBeenCalled();
  });

  it("loads the real SDK provider only while Login is mounted and removes its script on return", async () => {
    renderLogin();
    expect(googleScript()?.src).toBe("https://accounts.google.com/gsi/client?hl=es");
    await userEvent.click(screen.getByRole("button", { name: /volver al inicio/i }));
    await screen.findByTestId("home");
    expect(googleScript()).toBeNull();
  });

  it("does not request the SDK when the Google client ID is missing", () => {
    envs.GOOGLE_CLIENT_ID = "";
    renderLogin();
    expect(googleScript()).toBeNull();
    expect(screen.queryByRole("button", { name: "Google" })).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t("auth:google_unavailable"))).toBeVisible();
  });

  it("recovers from a script failure with one translated toast and a fresh SDK on retry", async () => {
    renderLogin();
    const failedScript = googleScript()!;
    fireEvent.error(failedScript);
    expect(sileo.error).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("auth:google_failed"));
    expect(screen.queryByRole("button", { name: "Google" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(failedScript).not.toBeInTheDocument();
    expect(googleScript()).not.toBe(failedScript);
    expect(document.querySelectorAll('script[src^="https://accounts.google.com/gsi/client"]')).toHaveLength(1);
    fireEvent.load(googleScript()!);
    expect(screen.getByRole("button", { name: "Google" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(sileo.error).toHaveBeenCalledTimes(1);
    expect(loginWithGoogle).not.toHaveBeenCalled();
  });

  it("recreates the SDK in English without losing an in-flight credential exchange", async () => {
    let complete!: (value: typeof session) => void;
    vi.mocked(loginWithGoogle).mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    renderLogin();
    const spanishScript = googleScript()!;
    await userEvent.click(screen.getByRole("button", { name: "Google" }));
    await act(async () => { await i18n.changeLanguage("en"); });
    expect(spanishScript).not.toBeInTheDocument();
    expect(googleScript()?.src).toBe("https://accounts.google.com/gsi/client?hl=en");
    expect(screen.getByRole("button", { name: /back to home/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Google" }).closest("[inert]")).toBeTruthy();
    expect(loginWithGoogle).toHaveBeenCalledTimes(1);
    complete(session);
    await screen.findByTestId("home");
    expect(googleScript()).toBeNull();
    expect(useAuthStore.getState()).toMatchObject(session);
  });

  it("exchanges the Google credential, persists the Nodia JWT and returns home", async () => {
    vi.mocked(loginWithGoogle).mockResolvedValue(session);
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Google" }));
    expect(await screen.findByTestId("home")).toBeInTheDocument();
    expect(loginWithGoogle).toHaveBeenCalledWith("google-id-token", expect.anything());
    expect(useAuthStore.getState()).toMatchObject(session);
    expect(JSON.parse(localStorage.getItem("authStore")!).state).toEqual(session);
    expect(sileo.success).toHaveBeenCalled();
  });

  it("disables interaction while the backend is checking the credential", async () => {
    let complete!: (value: typeof session) => void;
    vi.mocked(loginWithGoogle).mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Google" }));
    expect(screen.getByRole("button", { name: "Google" }).closest("[inert]")).toBeTruthy();
    expect(screen.getByRole("button", { name: /volver al inicio/i })).toBeDisabled();
    expect(useAuthStore.getState().token).toBeNull();
    complete(session);
    await screen.findByTestId("home");
  });

  it("returns home with an error toast and no session for an unapproved account", async () => {
    const error = new AxiosError("Forbidden");
    error.response = { status: 403, data: { message: "auth:access_denied" }, headers: {}, statusText: "Forbidden", config: {} as never };
    vi.mocked(loginWithGoogle).mockRejectedValue(error);
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Google" }));
    await screen.findByTestId("home");
    expect(useAuthStore.getState().token).toBeNull();
    expect(sileo.error).toHaveBeenCalledWith(expect.objectContaining({ description: "No tienes acceso a Nodia. Contacta al administrador." }));
  });

  it("keeps the login available after a transport failure", async () => {
    vi.mocked(loginWithGoogle).mockRejectedValue(new Error("Network unavailable"));
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Google" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /volver al inicio/i })).toBeEnabled();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("keeps the logo, language selector and back navigation", async () => {
    renderLogin();
    expect(screen.getByText("Nodia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cambiar idioma/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /volver al inicio/i }));
    expect(await screen.findByTestId("home")).toBeInTheDocument();
  });
});
