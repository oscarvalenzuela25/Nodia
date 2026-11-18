import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ListChecklist from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/ListChecklist";
import * as transport from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/infrastructure/services";
import useAuthStore from "../../../../../../../store/authStore";

vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/infrastructure/services", async importOriginal => ({
  ...await importOriginal<typeof transport>(),
  readList: vi.fn(),
  updateListCheck: vi.fn(),
}));
vi.mock("sileo", () => ({ sileo: { error: vi.fn(), success: vi.fn() } }));

const initial: transport.ShoppingListDetail = {
  id: "1d0acdf0-ad2b-4e3d-a04b-c4896fbd9d50", version: 1, is_active: true, name: "Compras", item_count: 1,
  items: [{
    id: "d71bb278-b837-4419-beaf-6bfba8d06b6f", product_id: "20", available: true,
    name: "Arroz", position: 0, checked: false, check_version: 1, quantity: "1",
  }],
};

describe("shopping checklist focus recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.getState().login({ token: "synthetic-test-token", expiresAt: Date.now() + 60_000, user: { id: "actor", name: "Actor" } });
  });

  it("reconciles a failed check and returns keyboard focus after explicit retry", async () => {
    vi.mocked(transport.readList).mockResolvedValue(initial);
    vi.mocked(transport.updateListCheck).mockRejectedValueOnce(new Error("Response lost")).mockResolvedValueOnce({
      id: initial.items[0].id, checked: true, check_version: 2,
    });
    const close = vi.fn();
    const scope = {
      businessId: "22e62222-2dfa-4403-8092-36d899571f1d",
      actorId: "actor",
      sessionVersion: useAuthStore.getState().sessionVersion,
    };
    render(<QueryClientProvider client={new QueryClient()}>
      <ListChecklist scope={scope} selected={initial} onClose={close} />
    </QueryClientProvider>);
    const user = userEvent.setup();
    const checkbox = await screen.findByRole("checkbox", { name: "Arroz" });
    await user.click(checkbox);
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    expect(checkbox).not.toBeChecked();
    expect(transport.readList).toHaveBeenCalledTimes(2);
    expect(transport.updateListCheck).toHaveBeenCalledOnce();

    await user.click(retry);
    await waitFor(() => {
      expect(checkbox).toBeChecked();
      expect(checkbox).toHaveFocus();
    });
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledOnce();
  });
});
