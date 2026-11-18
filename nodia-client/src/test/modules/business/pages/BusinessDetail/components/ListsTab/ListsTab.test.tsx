import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ListsTab from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/ListsTab";
import * as transport from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/infrastructure/services";
import useAuthStore from "../../../../../../../store/authStore";

vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/infrastructure/services", async importOriginal => ({
  ...await importOriginal<typeof transport>(),
  readLists: vi.fn(),
}));

describe("shopping lists pagination", () => {
  it("keeps the search outside the table and the pagination visible for a confirmed empty result", async () => {
    useAuthStore.getState().login({
      token: "synthetic-test-token",
      expiresAt: Date.now() + 60_000,
      user: { id: "actor", name: "Actor" },
    });
    const businessId = "22e62222-2dfa-4403-8092-36d899571f1d";
    vi.mocked(transport.readLists).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ListsTab businessId={businessId} actorId="actor" sessionVersion={useAuthStore.getState().sessionVersion} />
      </QueryClientProvider>,
    );

    const table = await screen.findByRole("table", { name: "Listas" });
    const search = screen.getByRole("textbox", { name: "Buscar por nombre de la lista" });
    expect(screen.getByRole("region", { name: "Listas" })).toContainElement(search);
    expect(screen.getByRole("region", { name: "Tabla de listas" })).not.toContainElement(search);
    expect(screen.queryByRole("heading", { name: "Listas" })).not.toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Nombre de la lista" })).toBeVisible();
    expect(within(table).getByText("Todavía no hay listas de compra.")).toBeVisible();
    expect(screen.getByText("0–0 de 0")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ir a la página siguiente" })).toBeDisabled();

    await userEvent.setup().type(search, "Huerto");
    await waitFor(() => {
      expect(transport.readLists).toHaveBeenLastCalledWith(
        businessId,
        { page: 1, limit: 20, search: "Huerto" },
        expect.any(AbortSignal),
      );
    });
    expect(within(table).getByText("No se encontraron listas para esta búsqueda.")).toBeVisible();
  });

  it("puts deactivation last in the keyboard order of a list's actions", async () => {
    useAuthStore.getState().login({
      token: "synthetic-test-token",
      expiresAt: Date.now() + 60_000,
      user: { id: "actor", name: "Actor" },
    });
    vi.mocked(transport.readLists).mockResolvedValue({
      items: [{ id: "1d0acdf0-ad2b-4e3d-a04b-c4896fbd9d50", version: 1, is_active: true, name: "Compras", item_count: 1 }],
      pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ListsTab businessId="22e62222-2dfa-4403-8092-36d899571f1d" actorId="actor" sessionVersion={useAuthStore.getState().sessionVersion} />
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    (await screen.findByRole("button", { name: "Editar lista · Compras" })).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Copiar lista · Compras" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Lista de compra · Compras" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Desactivar lista · Compras" })).toHaveFocus();
  });
});
