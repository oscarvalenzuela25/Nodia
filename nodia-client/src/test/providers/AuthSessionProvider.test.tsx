import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthSessionProvider from "../../providers/AuthSessionProvider";
import useAuthStore from "../../store/authStore";
import { refreshSession, restoreSession } from "../../config/api";

vi.mock("../../config/api", () => ({ refreshSession: vi.fn(), restoreSession: vi.fn() }));
vi.mock("../../modules/auth/infrastructure/useServices", () => ({ useSignOut: () => ({ mutate: vi.fn(), isPending: false }) }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useAuthStore.getState().logout();
});
afterEach(() => { vi.useRealTimers(); useAuthStore.getState().logout(); });

describe("AuthSessionProvider", () => {
  it("renews a validated session thirty seconds before expiry", async () => {
    useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 60_000 });
    vi.mocked(refreshSession).mockResolvedValue({ token: "renewed", expiresAt: Date.now() + 900_000, user: { name: "Oscar" } });
    render(<AuthSessionProvider><div /></AuthSessionProvider>);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("does not renew for a visitor", async () => {
    render(<AuthSessionProvider><div /></AuthSessionProvider>);
    await act(() => vi.advanceTimersByTimeAsync(900_000));
    expect(refreshSession).not.toHaveBeenCalled();
    expect(restoreSession).not.toHaveBeenCalled();
  });

  it("does not loop when renewal cannot extend the absolute session deadline", async () => {
    const expiresAt = Date.now() + 20_000;
    useAuthStore.getState().login({ token: "jwt", expiresAt, user: { id: "42", name: "Oscar" } });
    vi.mocked(refreshSession).mockImplementation(async () => {
      const renewed = { token: "renewed", expiresAt, user: { id: "42", name: "Oscar" } };
      useAuthStore.getState().login(renewed);
      return renewed;
    });
    render(<AuthSessionProvider><div /></AuthSessionProvider>);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(refreshSession).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(refreshSession).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  it("applies logout from another tab", () => {
    useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000 });
    render(<AuthSessionProvider><div /></AuthSessionProvider>);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "authStore", newValue: null })));
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("keeps the app unmounted until the persisted session is validated", async () => {
    localStorage.setItem("authStore", JSON.stringify({ version: 1, state: { token: "jwt", expiresAt: Date.now() + 900_000 } }));
    await useAuthStore.persist.rehydrate();
    vi.mocked(restoreSession).mockReturnValue(new Promise(() => {}));
    render(<AuthSessionProvider><div>Application</div></AuthSessionProvider>);
    expect(screen.queryByText("Application")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Validando tu sesión");
    expect(restoreSession).toHaveBeenCalledOnce();
    act(() => useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000 }));
    expect(screen.getByText("Application")).toBeInTheDocument();
  });

  it("offers retry after a validation transport error without mounting the app", () => {
    useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000 });
    useAuthStore.getState().setSessionStatus("unavailable");
    vi.mocked(restoreSession).mockReturnValue(new Promise(() => {}));
    render(<AuthSessionProvider><div>Application</div></AuthSessionProvider>);
    expect(screen.queryByText("Application")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos validar tu sesión");
    expect(restoreSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(restoreSession).toHaveBeenCalledOnce();
  });
});
