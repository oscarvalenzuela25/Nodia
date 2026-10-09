import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router";
import { sileo } from "sileo";
import Topbar from "../../../../layouts/components/Topbar/Topbar";
import useAuthStore from "../../../../store/authStore";
import useGeneralSettingsStore from "../../../../store/generalSettings/generalSettingsStore";
import { queryClient } from "../../../../config/reactQuery";
import { logoutSession } from "../../../../modules/auth/infrastructure/services";

vi.mock("../../../../modules/auth/infrastructure/services", () => ({ loginWithGoogle: vi.fn(), logoutSession: vi.fn() }));
vi.mock("@react-oauth/google", () => ({ googleLogout: vi.fn() }));
vi.mock("../../../../layouts/components/Topbar/components/AiProviderIndicators", () => ({ default: () => <div role="group" aria-label="AI indicators" /> }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const renderTopbar = () => render(<MemoryRouter><Topbar onDrawerToggle={vi.fn()} /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); useAuthStore.getState().logout(); });
afterEach(() => useAuthStore.getState().logout());
const signIn = () => useAuthStore.getState().login({ token: "jwt", user: { id: "42", name: "Oscar", email: "user@gmail.com", image_url: "https://example.com/avatar.png" } });

describe("Topbar", () => {
  it("only mounts health indicators with a validated session, AI action and module access", () => {
    signIn();
    useAuthStore.setState({ expiresAt: Date.now() + 60000 });
    const context = { roles: [], actions: [{ key: "ai:manage", description: null, translates: [] }], modules: [{ module_group_key: "settings", translates: [], modules: [{ key: "ai-providers", translates: [] }] }] };
    useGeneralSettingsStore.getState().setContext(context);
    const { rerender } = renderTopbar();
    expect(screen.getByRole("group", { name: "AI indicators" })).toBeInTheDocument();
    useGeneralSettingsStore.getState().setContext({ ...context, actions: [] });
    rerender(<MemoryRouter><Topbar onDrawerToggle={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("group", { name: "AI indicators" })).not.toBeInTheDocument();
    useGeneralSettingsStore.getState().setContext({ ...context, modules: [] });
    rerender(<MemoryRouter><Topbar onDrawerToggle={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("group", { name: "AI indicators" })).not.toBeInTheDocument();
  });
  it("shows login and theme controls for visitors", () => {
    renderTopbar();
    expect(screen.getByLabelText("Cambiar tema")).toBeInTheDocument();
    expect(screen.getByText("Ingresar")).toBeInTheDocument();
  });

  it("shows the Google avatar and clears session, permissions, persist and cache on logout", async () => {
    signIn();
    useGeneralSettingsStore.getState().setContext({ roles: ["super_admin"], actions: [], modules: [] });
    queryClient.setQueryData(["private"], { secret: "data" });
    vi.mocked(logoutSession).mockResolvedValue();
    renderTopbar();
    expect(screen.getByRole("img", { name: "Oscar" })).toHaveAttribute("src", "https://example.com/avatar.png");
    await userEvent.click(screen.getByRole("button", { name: "Abrir menú de cuenta" }));
    expect(screen.getByText("user@gmail.com")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
    await waitFor(() => expect(logoutSession).toHaveBeenCalledOnce());
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem("authStore")).toBeNull();
    expect(useGeneralSettingsStore.getState().roles).toEqual([]);
    expect(queryClient.getQueryData(["private"])).toBeUndefined();
    expect(await screen.findByText("Ingresar")).toBeInTheDocument();
  });

  it("clears local data even if server logout fails", async () => {
    signIn();
    vi.mocked(logoutSession).mockRejectedValue(new Error("offline"));
    renderTopbar();
    await userEvent.click(screen.getByRole("button", { name: "Abrir menú de cuenta" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalled());
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem("authStore")).toBeNull();
  });
});
