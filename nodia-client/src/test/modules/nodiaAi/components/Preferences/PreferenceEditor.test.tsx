import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreferenceEditor from "../../../../../modules/nodiaAi/components/Preferences/PreferenceEditor";
import * as services from "../../../../../modules/nodiaAi/infrastructure/preferenceServices";
import useAuthStore from "../../../../../store/authStore";
import { catalog } from "../../infrastructure/preferenceFixtures";
import { chatId } from "../../infrastructure/fixtures";
vi.mock("../../../../../modules/nodiaAi/infrastructure/preferenceServices", () => ({ getPreferenceOptions: vi.fn() }));
let client: QueryClient;
const businessId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => { vi.clearAllMocks();client = new QueryClient({ defaultOptions: { queries: { retry: false } } });useAuthStore.setState({ user: { id: "9", name: "Synthetic" }, token: "synthetic-only", expiresAt: Date.now()+600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false }); });
afterEach(() => { client.clear();useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" }); });
describe("explicit preference reference selectors", () => {
  it("selects the supplier's named business first and never queries a supplier without its scope", async () => {
    const user = userEvent.setup(),submit = vi.fn();
    vi.mocked(services.getPreferenceOptions).mockImplementation(async query => query.key === "business_id" ? { items: [{ id: businessId, label: "Synthetic hotel" }], next_cursor: null } : { items: [{ id: "27", label: "Synthetic supplier" }], next_cursor: null });
    render(<QueryClientProvider client={client}><PreferenceEditor definitions={catalog.items} conversationId={chatId} disabled={false} active onPrepare={submit} onCancel={vi.fn()} /></QueryClientProvider>);
    await user.click(screen.getByRole("button", { name: "Qué recordar" }));await user.click(await screen.findByRole("option", { name: "Proveedor habitual del negocio" }));
    const business = screen.getByRole("button", { name: "Negocio del proveedor" });await waitFor(() => expect(business).toBeEnabled());
    expect(services.getPreferenceOptions).toHaveBeenCalledExactlyOnceWith({ scope_key: "business", key: "business_id", for_supplier_scope: true }, undefined, expect.any(AbortSignal));
    await user.click(business);await user.click(await screen.findByRole("option", { name: "Synthetic hotel" }));
    const value = screen.getByRole("button", { name: "Valor preferido" });await waitFor(() => expect(value).toBeEnabled());
    await user.click(value);await user.click(await screen.findByRole("option", { name: "Synthetic supplier" }));
    await user.click(screen.getByRole("button", { name: "Revisar propuesta" }));
    expect(submit).toHaveBeenCalledWith({ conversation_id: chatId, operation: "create", scope_key: "business", key: "supplier_id", scope: { business_id: businessId }, value: "27" });
  });
});
