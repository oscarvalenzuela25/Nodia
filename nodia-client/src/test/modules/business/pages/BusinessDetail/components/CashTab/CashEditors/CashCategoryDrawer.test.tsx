import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashCategoryDrawer } from "../../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/CashEditors";
import {
  getCashCategories,
  getCashReceipt,
  sendCashMutation,
} from "../../../../../../../../modules/business/infrastructure/cashServices";
import type { CashScope } from "../../../../../../../../modules/business/infrastructure/cashTypes";
import useAuthStore from "../../../../../../../../store/authStore";
import i18n from "../../../../../../../../translate";

vi.mock(
  "../../../../../../../../modules/business/infrastructure/cashServices",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../../../../../../modules/business/infrastructure/cashServices")
    >()),
    getCashCategories: vi.fn(),
    getCashReceipt: vi.fn(),
    sendCashMutation: vi.fn(),
  }),
);

const scope: CashScope = {
  businessId: "176484f1-1c4b-43ca-8972-7db46bfd86c1",
  actorId: "1",
  sessionVersion: 1,
};
const category = {
  id: "1",
  business_id: scope.businessId,
  name: "Reparaciones",
  description: "Mantenimiento del negocio",
  is_active: true,
  version: 3,
};

describe("CashCategoryDrawer", () => {
  it.each(["Todos", "Activo"])("preserves the %s filter and confirmation intent", async (filter) => {
    vi.clearAllMocks();
    await i18n.changeLanguage("es");
    useAuthStore.setState({
      token: "cash-synthetic-session",
      user: { id: scope.actorId, name: "Cash tester" },
      expiresAt: Date.now() + 60_000,
      sessionStatus: "authenticated",
      sessionVersion: scope.sessionVersion,
    });
    let current = category;
    let finishSearch = () => {};
    const searchResponse = new Promise<void>((resolve) => {
      finishSearch = resolve;
    });
    vi.mocked(getCashCategories).mockImplementation(
      async (_businessId, { page, limit, active, search }) => {
        if (search === category.name) await searchResponse;
        const rows = active === undefined || active === current.is_active ? [current] : [];
        return {
          data: rows,
          meta: { page, limit, total_pages: rows.length, total_items: rows.length },
        };
      },
    );
    vi.mocked(sendCashMutation)
      .mockImplementationOnce(async (_businessId, requestKey) => ({
        status: "processing",
        request_key: requestKey,
        operation: "category_update",
      }))
      .mockImplementationOnce(async (_businessId, requestKey) => {
        current = { ...category, is_active: false, version: 4 };
        return {
          status: "committed",
          request_key: requestKey,
          operation: "category_update",
          result: { category: current },
        };
      });
    vi.mocked(getCashReceipt).mockImplementation(async (_businessId, requestKey) => ({
      status: "retryable",
      request_key: requestKey,
      operation: "category_update",
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <CashCategoryDrawer scope={scope} open onClose={onClose} />
      </QueryClientProvider>,
    );

    const status = screen.getByRole("button", { name: "Estado de actividad" });
    await waitFor(() => expect(status).toHaveAttribute("aria-disabled", "false"));
    expect(status).toHaveTextContent("Activo");
    if (filter === "Todos") {
      await user.click(status);
      await user.click(screen.getByRole("option", { name: filter }));
    }
    const record = await screen.findByRole("group", { name: category.name });
    const drawer = screen.getByRole("dialog", { name: "Categorías" });
    const search = within(drawer).getByRole("textbox", { name: "Buscar categorías" });
    const start = within(record).getByRole("button", { name: "Desactivar" });
    await waitFor(() => expect(start).toBeEnabled());
    if (filter === "Todos") {
      fireEvent.change(search, { target: { value: category.name } });
      fireEvent.click(start);
    } else await user.click(start);
    let confirmation = screen.getByRole("dialog", { name: "Desactivar" });
    expect(drawer).toBeInTheDocument();
    expect(drawer).toContainElement(status);
    expect(drawer).toContainElement(record);
    expect(confirmation).toHaveTextContent("¿Desactivar Reparaciones?");
    expect(sendCashMutation).not.toHaveBeenCalled();
    if (filter === "Todos") await waitFor(() => expect(start).not.toBeInTheDocument());
    await user.click(within(confirmation).getByRole("button", { name: "Cancelar" }));
    finishSearch();
    const rowAfterSearch = await screen.findByRole("group", { name: category.name });
    const restored = within(rowAfterSearch).getByRole("button", { name: "Desactivar" });
    await waitFor(() => expect(restored).toHaveFocus());
    if (filter === "Todos") {
      expect(restored).not.toBe(start);
      expect(search).toHaveValue(category.name);
    }
    expect(status).toHaveTextContent(filter);
    expect(sendCashMutation).not.toHaveBeenCalled();

    await user.click(restored);
    confirmation = screen.getByRole("dialog", { name: "Desactivar" });
    const confirm = within(confirmation).getByRole("button", { name: "Desactivar" });
    await user.click(confirm);
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(getCashReceipt).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Consultar recibo" })).not.toBeInTheDocument();
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    const filtered = await screen.findByRole("button", { name: "Estado de actividad" });
    expect(filtered).toHaveTextContent(filter);
    if (filter === "Todos") {
      const activate = await within(await screen.findByRole("group", { name: category.name })).findByRole("button", {
        name: "Activar",
      });
      await waitFor(() => expect(activate).toHaveFocus());
    } else {
      await waitFor(() => expect(record).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole("button", { name: "Nueva categoría" })).toHaveFocus());
    }
    const [first, second] = vi.mocked(sendCashMutation).mock.calls;
    expect(first).toEqual(second);
    expect(first[2]).toEqual({
      operation: "category_update",
      id: category.id,
      fields: { expected_version: 3, is_active: false },
    });
  });
});
