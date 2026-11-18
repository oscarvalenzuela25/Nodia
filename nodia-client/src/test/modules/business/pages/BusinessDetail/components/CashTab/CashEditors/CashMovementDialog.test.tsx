import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CashMovementDialog,
  type ManualCashMovement,
} from "../../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/CashEditors";
import {
  getCashCategories,
  getCashCategory,
  getCashMovement,
  sendCashMutation,
} from "../../../../../../../../modules/business/infrastructure/cashServices";
import type {
  CashCategory,
  CashScope,
} from "../../../../../../../../modules/business/infrastructure/cashTypes";
import useAuthStore from "../../../../../../../../store/authStore";
import i18n from "../../../../../../../../translate";

vi.mock(
  "../../../../../../../../modules/business/infrastructure/cashServices",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../../../../../../modules/business/infrastructure/cashServices")
    >()),
    getCashCategories: vi.fn(),
    getCashCategory: vi.fn(),
    getCashMovement: vi.fn(),
    sendCashMutation: vi.fn(),
  }),
);

const scope: CashScope = {
  businessId: "176484f1-1c4b-43ca-8972-7db46bfd86c1",
  actorId: "1",
  sessionVersion: 1,
};
const historical: CashCategory = {
  id: "1",
  business_id: scope.businessId,
  version: 4,
  name: "Caja histórica",
  description: "Categoría desactivada",
  is_active: false,
};
const created: CashCategory = {
  id: "2",
  business_id: scope.businessId,
  version: 1,
  name: "Caja diaria",
  description: "Cierres de caja",
  is_active: true,
};
const record: ManualCashMovement = {
  id: "fe368b2c-ce10-4ce3-b9d1-906f2e31a893",
  business_id: scope.businessId,
  category_id: historical.id,
  category: { id: historical.id, name: historical.name, is_active: false },
  type: "income",
  source: "manual",
  invoice: null,
  amount: "20",
  occurred_on: "2026-11-17",
  description: "Ingreso histórico",
  is_active: true,
  version: 1,
};

function renderEditor(editor: Parameters<typeof CashMovementDialog>[0]["editor"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <CashMovementDialog editor={editor} scope={scope} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

describe("CashMovementDialog", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("es");
    vi.resetAllMocks();
    useAuthStore.setState({
      token: "cash-synthetic-session",
      user: { id: scope.actorId, name: "Cash tester" },
      expiresAt: Date.now() + 60_000,
      sessionStatus: "authenticated",
      sessionVersion: scope.sessionVersion,
    });
    vi.mocked(getCashCategories).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total_pages: 0, total_items: 0 },
    });
    vi.mocked(getCashCategory).mockImplementation(async (_businessId, id) =>
      id === created.id ? created : historical,
    );
  });

  it("retains the movement draft through quick-create failure and selects the committed category in one dialog", async () => {
    let createdCategory = false;
    vi.mocked(sendCashMutation).mockImplementation(async (_businessId, requestKey, command) => {
      if (command.operation === "category_create") {
        if (!createdCategory) {
          createdCategory = true;
          throw {
            isAxiosError: true,
            response: { status: 409, data: { message: "business:cash_category_name_exists" } },
          };
        }
        return {
          status: "committed",
          operation: command.operation,
          request_key: requestKey,
          result: { category: created },
        };
      }
      if (command.operation === "movement_create")
        return {
          status: "committed",
          operation: command.operation,
          request_key: requestKey,
          result: { movement: record },
        };
      throw new Error("unexpected operation");
    });

    const user = userEvent.setup();
    const onClose = renderEditor({ mode: "create", type: "income" });
    expect(screen.queryByText("Ingreso", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/descripción/i)).not.toBeRequired();
    await user.type(screen.getByLabelText(/importe clp/i), "9999999999999");
    await user.type(screen.getByLabelText(/descripción/i), "Mi borrador de ingreso");
    await user.click(screen.getByRole("button", { name: "Nueva categoría" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByLabelText(/importe clp/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/nombre/i), "Caja diaria");
    expect(screen.getByLabelText(/descripción/i)).not.toBeRequired();
    const save = screen.getByRole("button", { name: "Guardar" });
    await user.click(save);
    await waitFor(() => expect(sendCashMutation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(save).toBeEnabled());
    expect(screen.getByLabelText(/nombre/i)).toHaveValue("Caja diaria");
    expect(screen.getByLabelText(/descripción/i)).toHaveValue("");
    expect(sendCashMutation).toHaveBeenLastCalledWith(scope.businessId, expect.any(String), {
      operation: "category_create",
      fields: { name: "Caja diaria", description: "", is_active: true },
    });
    expect(onClose).not.toHaveBeenCalled();

    await user.click(save);
    const picker = await screen.findByRole("button", { name: "Categoría" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(picker).toHaveTextContent("Caja diaria");
    expect(picker).toHaveFocus();
    expect(screen.getByLabelText(/importe clp/i)).toHaveValue("9999999999999");
    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Mi borrador de ingreso");
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(sendCashMutation).toHaveBeenLastCalledWith(scope.businessId, expect.any(String), {
      operation: "movement_create",
      fields: expect.objectContaining({
        type: "income",
        category_id: "2",
        amount: "9999999999999",
        description: "Mi borrador de ingreso",
      }),
    });
  });

  it("keeps a historical inactive assignment and rebases edited fields only after accepting the current version", async () => {
    const newest = { ...record, version: 2, amount: "3" };
    vi.mocked(getCashMovement).mockResolvedValue(newest);
    vi.mocked(sendCashMutation)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 409, data: { message: "business:cash_version_conflict" } },
      })
      .mockImplementationOnce(async (_businessId, requestKey) => ({
        status: "committed",
        operation: "movement_update",
        request_key: requestKey,
        result: { movement: newest },
      }));
    const user = userEvent.setup();
    const onClose = renderEditor({ mode: "edit", movement: record });
    const picker = screen.getByRole("button", { name: "Categoría" });
    expect(picker).toHaveTextContent("Caja histórica (inactiva)");
    const description = screen.getByLabelText(/descripción/i);
    await user.clear(description);
    await user.type(description, "Cambio del usuario");
    const save = screen.getByRole("button", { name: "Guardar" });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await user.click(await screen.findByRole("button", { name: "Revisar versión actual" }));
    expect(save).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    const warning = screen.getByRole("alert");
    const accept = await within(warning).findByRole("button", {
      name: "Usar esta versión y conservar mis cambios",
    });
    await user.click(accept);
    expect(screen.getByLabelText(/importe clp/i)).toHaveValue("3");
    expect(description).toHaveValue("Cambio del usuario");
    await user.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(sendCashMutation).toHaveBeenLastCalledWith(scope.businessId, expect.any(String), {
      operation: "movement_update",
      id: record.id,
      fields: { expected_version: 2, description: "Cambio del usuario" },
    });
  });
});
