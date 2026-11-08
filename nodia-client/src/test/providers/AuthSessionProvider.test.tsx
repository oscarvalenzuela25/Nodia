import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import AuthSessionProvider from "../../providers/AuthSessionProvider";
import useAuthStore from "../../store/authStore";
import { refreshSession, restoreSession } from "../../config/api";
import i18n from "../../translate";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
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
    expect(sileo.success).not.toHaveBeenCalled();
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
    localStorage.setItem("authStore", JSON.stringify({ version: 1, state: { token: "jwt", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Synthetic actor" } } }));
    await useAuthStore.persist.rehydrate();
    vi.mocked(restoreSession).mockReturnValue(new Promise(() => {}));
    render(<AuthSessionProvider><div>Application</div></AuthSessionProvider>);
    expect(screen.queryByText("Application")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Validando tu sesión");
    expect(restoreSession).toHaveBeenCalledOnce();
    act(() => useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Synthetic actor" } }));
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(sileo.success).not.toHaveBeenCalled();
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

  it("notifies once after the user retries and session validation succeeds", async () => {
    const session = { token: "jwt", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Oscar" } };
    useAuthStore.getState().login(session);
    useAuthStore.getState().setSessionStatus("unavailable");
    let finish!: (value: typeof session) => void;
    vi.mocked(restoreSession).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<AuthSessionProvider><div>Application</div></AuthSessionProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(restoreSession).toHaveBeenCalledOnce();
    expect(sileo.success).not.toHaveBeenCalled();
    expect(screen.queryByText("Application")).not.toBeInTheDocument();

    await act(async () => {
      useAuthStore.getState().login(session);
      finish(session);
    });

    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(sileo.success).toHaveBeenCalledExactlyOnceWith({ title: i18n.t("auth:session_restored") });
    expect(sileo.error).not.toHaveBeenCalled();
  });

  it("does not report success or mount the app when a user retry fails", async () => {
    useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000 });
    useAuthStore.getState().setSessionStatus("unavailable");
    vi.mocked(restoreSession).mockRejectedValue(new Error("Synthetic transport unavailable"));
    render(<AuthSessionProvider><div>Application</div></AuthSessionProvider>);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    });

    expect(restoreSession).toHaveBeenCalledOnce();
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos validar tu sesión");
    expect(screen.queryByText("Application")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });

  it.each(["restoring", "unavailable"] as const)("retains a validated same-actor draft inert while %s", status => {
    const session = { token: "fixture", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Synthetic actor" } };
    useAuthStore.getState().login(session);
    vi.mocked(restoreSession).mockReturnValue(new Promise(() => {}));
    render(<AuthSessionProvider><input aria-label="Retained draft" defaultValue="" /></AuthSessionProvider>);
    const input = screen.getByRole("textbox", { name: "Retained draft" });
    fireEvent.change(input, { target: { value: "Unsent synthetic text" } });
    act(() => useAuthStore.getState().setSessionStatus(status));
    expect(screen.getByRole("textbox", { name: "Retained draft", hidden: true })).toBe(input);
    expect(input).toHaveValue("Unsent synthetic text");
    expect(input.closest("[inert]")).not.toBeNull();
    act(() => useAuthStore.getState().login(session));
    expect(screen.getByRole("textbox", { name: "Retained draft" })).toBe(input);
    expect(input.closest("[inert]")).toBeNull();
  });

  it("does not carry the prior actor's mounted view into another actor or session version", () => {
    const session = { token: "fixture", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Synthetic actor" } };
    useAuthStore.getState().login(session);
    vi.mocked(restoreSession).mockReturnValue(new Promise(() => {}));
    render(<AuthSessionProvider><input aria-label="Actor draft" defaultValue="" /></AuthSessionProvider>);
    const first = screen.getByRole("textbox", { name: "Actor draft" });
    fireEvent.change(first, { target: { value: "First actor only" } });
    act(() => useAuthStore.getState().login({ ...session, user: { id: "43", name: "Another synthetic actor" } }));
    const second = screen.getByRole("textbox", { name: "Actor draft" });
    expect(second).not.toBe(first); expect(second).toHaveValue("");
    act(() => useAuthStore.setState(state => ({ sessionVersion: state.sessionVersion + 1, sessionStatus: "restoring" })));
    expect(screen.queryByRole("textbox", { name: "Actor draft" })).not.toBeInTheDocument();
    expect(second.isConnected).toBe(false);
  });

  it("does not mount an authenticated view without an identified actor", () => {
    useAuthStore.getState().login({ token: "fixture", expiresAt: Date.now() + 900_000 });
    render(<AuthSessionProvider><p>Identified view</p></AuthSessionProvider>);
    expect(screen.queryByText("Identified view")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Validando tu sesión");
  });

  it("forgets retained admission when the token is removed, even if actor metadata survives", () => {
    const session = { token: "fixture", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Synthetic actor" } };
    useAuthStore.getState().login(session);
    vi.mocked(restoreSession).mockReturnValue(new Promise(() => {}));
    render(<AuthSessionProvider><input aria-label="Protected draft" defaultValue="" /></AuthSessionProvider>);
    const original = screen.getByRole("textbox", { name: "Protected draft" });
    fireEvent.change(original, { target: { value: "Prior validated draft" } });
    act(() => useAuthStore.setState({ token: null, sessionStatus: "restoring" }));
    expect(screen.queryByRole("textbox", { name: "Protected draft" })).not.toBeInTheDocument();
    expect(original.isConnected).toBe(false);
    act(() => useAuthStore.setState({ token: "fixture-replacement", sessionStatus: "restoring" }));
    expect(screen.queryByRole("textbox", { name: "Protected draft" })).not.toBeInTheDocument();
    act(() => useAuthStore.getState().login(session));
    expect(screen.getByRole("textbox", { name: "Protected draft" })).not.toBe(original);
    expect(screen.getByRole("textbox", { name: "Protected draft" })).toHaveValue("");
  });
});
