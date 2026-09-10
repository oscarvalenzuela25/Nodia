import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import Home from "../../../../../modules/home/pages/Home";
import MUIProvider from "../../../../../providers/MUIProvider";
import useGeneralSettingsStore from "../../../../../store/generalSettings/generalSettingsStore";
import * as authService from "../../../../../services/authorizationService";

vi.mock("../../../../../services/authorizationService", () => ({
  useAuthorizationContext: vi.fn(),
}));

describe("Home", () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useGeneralSettingsStore.getState().clearContext();
    });
    vi.mocked(authService.useAuthorizationContext).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof authService.useAuthorizationContext>);
  });

  it("renders the welcome message and dynamic module groups from generalSettingsStore", () => {
    act(() => {
      useGeneralSettingsStore.getState().setContext({
        roles: ["admin"],
        actions: [],
        modules: [
          {
            module_group_key: "ajustes-generales",
            translates: [
              { key: "key", es: "Ajustes Generales", en: "General Settings" },
            ],
            modules: [
              {
                key: "users",
                link: "/settings/users",
                translates: [{ key: "key", es: "Usuarios", en: "Users" }],
              },
              {
                key: "roles",
                link: "/settings/roles",
                translates: [{ key: "key", es: "Roles", en: "Roles" }],
              },
            ],
          },
        ],
      });
    });

    render(
      <MemoryRouter>
        <MUIProvider>
          <Home />
        </MUIProvider>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /bienvenido a nodia|welcome to nodia|home:welcome/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /ajustes generales|general settings/i })
    ).toBeInTheDocument();

    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Roles")).toBeInTheDocument();
  });

  it("renders error alert with retry button when isError is true", async () => {
    const user = userEvent.setup();

    vi.mocked(authService.useAuthorizationContext).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error("Failed to fetch"),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof authService.useAuthorizationContext>);

    render(
      <MemoryRouter>
        <MUIProvider>
          <Home />
        </MUIProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId("home-auth-error")).toBeInTheDocument();
    expect(screen.getByText(/error al cargar información/i)).toBeInTheDocument();
    expect(
      screen.getByText(/hubo un error al obtener la información de su usuario/i)
    ).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /reintentar/i });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("renders empty state when user has no modules assigned and no error", () => {
    render(
      <MemoryRouter>
        <MUIProvider>
          <Home />
        </MUIProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/sin módulos disponibles/i)).toBeInTheDocument();
    expect(
      screen.getByText(/actualmente no tienes módulos asignados/i)
    ).toBeInTheDocument();
  });
});
