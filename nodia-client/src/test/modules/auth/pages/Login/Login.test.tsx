import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../../../../../modules/auth/infrastructure/services", () => ({ loginWithGoogle: vi.fn(), logoutSession: vi.fn() }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (response: { credential: string }) => void }) => (
    <button onClick={() => onSuccess({ credential: "google-id-token" })}>Google</button>
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
beforeEach(() => { vi.clearAllMocks(); useAuthStore.getState().logout(); });
afterEach(() => useAuthStore.getState().logout());

describe("Login", () => {
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
