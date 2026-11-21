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
vi.mock("../../../../layouts/components/Topbar/components/AiProviderIndicators", () => ({
  default: ({ canManageAi }: { canManageAi: boolean }) => <div role="group" aria-label="AI indicators" data-can-manage-ai={canManageAi} />,
}));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const renderTopbar = () => render(<MemoryRouter><Topbar onDrawerToggle={vi.fn()} /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); useAuthStore.getState().logout(); });
afterEach(() => useAuthStore.getState().logout());
const signIn = () => useAuthStore.getState().login({ token: "jwt", user: { id: "42", name: "Oscar", email: "user@gmail.com", image_url: "https://example.com/avatar.png" } });

describe("Topbar", () => {
  it("mounts health indicators by module without requiring an AI action and removes them on module revocation", () => {
    signIn();
    useAuthStore.setState({ expiresAt: Date.now() + 60000 });
    const context = { roles: [], actions: [{ key: "ai:manage", description: null, translates: [] }], modules: [{ module_group_key: "settings", translates: [], modules: [{ key: "ai-providers", translates: [] }] }] };
    useGeneralSettingsStore.getState().setContext(context);
    const { rerender } = renderTopbar();
    expect(screen.getByRole("group", { name: "AI indicators" })).toBeInTheDocument();
    useGeneralSettingsStore.getState().setContext({ ...context, actions: [] });
    rerender(<MemoryRouter><Topbar onDrawerToggle={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("group", { name: "AI indicators" })).toBeInTheDocument();
    useGeneralSettingsStore.getState().setContext({ ...context, modules: [] });
    rerender(<MemoryRouter><Topbar onDrawerToggle={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("group", { name: "AI indicators" })).not.toBeInTheDocument();
  });
  it("shows login and theme controls for visitors", () => {
    renderTopbar();
    expect(screen.getByLabelText("Cambiar tema")).toBeInTheDocument();
    expect(screen.getByText("Ingresar")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "AI indicators" })).not.toBeInTheDocument();
  });

  it("mounts read-only AI status for the canonical Commerce module in any menu group", () => {
    signIn();
    useAuthStore.setState({ expiresAt: Date.now() + 60_000 });
    const context = { roles: [], actions: [], modules: [{ module_group_key: "custom", translates: [], modules: [{ key: "commerce", link: "/business", translates: [] }] }] };
    useGeneralSettingsStore.getState().setContext(context);
    const { rerender } = renderTopbar();
    expect(screen.getByRole("group", { name: "AI indicators" })).toHaveAttribute("data-can-manage-ai", "false");

    useGeneralSettingsStore.getState().setContext({ ...context, modules: [] });
    rerender(<MemoryRouter><Topbar onDrawerToggle={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("group", { name: "AI indicators" })).not.toBeInTheDocument();
  });

  it("honors super_admin bypass without an action or module assignment", () => {
    signIn();
    useAuthStore.setState({ expiresAt: Date.now() + 60000 });
    const context = { roles: ["super_admin"], actions: [], modules: [{ module_group_key: "settings", translates: [], modules: [{ key: "ai-providers", link: "/ai-providers", translates: [] }] }] };
    useGeneralSettingsStore.getState().setContext(context);
    const { rerender } = renderTopbar();
    expect(screen.getByRole("group", { name: "AI indicators" })).toBeInTheDocument();
    useGeneralSettingsStore.getState().setContext({ ...context, modules: [] });
    rerender(<MemoryRouter><Topbar onDrawerToggle={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("group", { name: "AI indicators" })).toBeInTheDocument();
    useGeneralSettingsStore.getState().setContext({ ...context, roles: ["admin"], modules: [] });
    rerender(<MemoryRouter><Topbar onDrawerToggle={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("group", { name: "AI indicators" })).not.toBeInTheDocument();
  });

  it("offers refreshing the current page just before sign-out in the account menu", async () => {
    signIn();
    renderTopbar();

    await userEvent.click(screen.getByRole("button", { name: "Abrir menú de cuenta" }));

    const notifications = screen.getByRole("menuitem", { name: "Notificaciones" });
    expect(notifications).toHaveAttribute("href", "/notifications");
    expect(notifications).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Actualizar información" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Cerrar sesión" })).toHaveFocus();
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
