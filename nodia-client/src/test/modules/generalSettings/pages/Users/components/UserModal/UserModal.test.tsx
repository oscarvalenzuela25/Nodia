import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type {
  PaginatedResponse,
  Role,
} from "../../../../../../../modules/generalSettings/pages/Roles/types";
import UserModal from "../../../../../../../modules/generalSettings/pages/Users/components/UserModal";
import * as rolesServices from "../../../../../../../modules/generalSettings/pages/Roles/infrastructure/services";

vi.mock(
  "../../../../../../../modules/generalSettings/pages/Roles/infrastructure/services",
  () => ({
    getRoles: vi.fn(),
  })
);

const mockRolesResponse: PaginatedResponse<Role> = {
  data: [
    { id: "r1", key: "Admin", is_active: true },
    { id: "r2", key: "User", is_active: true },
  ],
  meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const renderWithClient = (ui: ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe("UserModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rolesServices.getRoles).mockResolvedValue(mockRolesResponse);
  });
  it("renders create modal with empty fields and default active switch", () => {
    renderWithClient(
      <UserModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Nuevo Usuario")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Correo Electrónico")).toBeInTheDocument();
    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByText("URL de imagen")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Crear Usuario" });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when email is provided and submits form", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <UserModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const emailInput = screen.getByPlaceholderText("correo@ejemplo.com");
    await user.type(emailInput, "nuevo@ejemplo.com");

    const nameInput = screen.getByPlaceholderText("Ingresa el nombre");
    await user.type(nameInput, "Carlos Lopez");

    const submitBtn = screen.getByRole("button", { name: "Crear Usuario" });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "nuevo@ejemplo.com",
        name: "Carlos Lopez",
        isActive: true,
      })
    );
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <UserModal
        open={true}
        onClose={handleClose}
        onSubmit={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders update modal when initialData is provided", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <UserModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialData={{
          id: "123",
          name: "Existing User",
          email: "existing@example.com",
          roles: ["Admin"],
          isActive: false,
          imageUrl: "https://example.com/pic.jpg",
        }}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Actualizar Usuario" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing User")).toBeInTheDocument();
    expect(screen.getByDisplayValue("existing@example.com")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", { name: "Actualizar Usuario" });
    expect(updateBtn).toBeEnabled();

    await user.click(updateBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      id: "123",
      name: "Existing User",
      email: "existing@example.com",
      roles: ["Admin"],
      isActive: false,
      imageUrl: "https://example.com/pic.jpg",
    });
  });

  it("fetches roles with all=true and includes=false when modal is opened", async () => {
    renderWithClient(
      <UserModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(rolesServices.getRoles).toHaveBeenCalledWith({
        all: true,
        includes: false,
      });
    });
  });
});
