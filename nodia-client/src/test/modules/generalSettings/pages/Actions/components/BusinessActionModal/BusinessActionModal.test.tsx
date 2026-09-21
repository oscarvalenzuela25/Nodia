import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import BusinessActionModal from "../../../../../../../modules/generalSettings/pages/Actions/components/BusinessActionModal";

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

describe("BusinessActionModal", () => {
  it("renders create modal with empty fields, active switch enabled, and disabled submit button", () => {
    renderWithClient(
      <BusinessActionModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Nueva Acción de Negocio" })
    ).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Identificador")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", {
      name: /Crear Accionable/i,
    });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when key is entered and submits form properly", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <BusinessActionModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const keyInput = screen.getByLabelText(/Identificador/i);
    fireEvent.change(keyInput, { target: { value: "products.create" } });

    const nameEsInput = screen.getByLabelText(/Nombre \(Español\)/i);
    fireEvent.change(nameEsInput, { target: { value: "Crear Productos" } });

    const nameEnInput = screen.getByLabelText(/Nombre \(Inglés\)/i);
    fireEvent.change(nameEnInput, { target: { value: "Create Products" } });

    const submitBtn = screen.getByRole("button", {
      name: /Crear Accionable/i,
    });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      key: "products.create",
      is_active: true,
      has_description: false,
      translates: [
        {
          key: "key",
          es: "Crear Productos",
          en: "Create Products",
        },
      ],
    });
  });

  it("renders edit modal with prefilled data and submits updated values", async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <BusinessActionModal
        open={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
        initialData={{
          id: "ba-1",
          key: "orders.manage",
          is_active: true,
          has_description: true,
          translates: [
            { key: "key", es: "Gestionar Pedidos", en: "Manage Orders" },
            {
              key: "description",
              es: "Permite gestionar pedidos",
              en: "Allows managing orders",
            },
          ],
        }}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Actualizar Acción de Negocio" })
    ).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", {
      name: /Actualizar Accionable/i,
    });
    expect(updateBtn).toBeEnabled();

    await user.click(updateBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      id: "ba-1",
      key: "orders.manage",
      is_active: true,
      has_description: true,
      translates: [
        {
          key: "key",
          es: "Gestionar Pedidos",
          en: "Manage Orders",
        },
        {
          key: "description",
          es: "Permite gestionar pedidos",
          en: "Allows managing orders",
        },
      ],
    });
  });
});
