import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreferenceValueEditor from "../../../../../modules/nodiaAi/components/Preferences/PreferenceValueEditor";
import * as services from "../../../../../modules/nodiaAi/infrastructure/preferenceServices";
import useAuthStore from "../../../../../store/authStore";
import { preferenceProposal, preference } from "../../infrastructure/preferenceFixtures";
vi.mock("../../../../../modules/nodiaAi/infrastructure/preferenceServices", () => ({ getPreferenceOptions: vi.fn() }));
let client: QueryClient;
beforeEach(() => { vi.clearAllMocks();client = new QueryClient({ defaultOptions: { queries: { retry: false } } });useAuthStore.setState({ user: { id: "9", name: "Synthetic" }, token: "synthetic-only", expiresAt: Date.now()+600000, sessionStatus: "authenticated", sessionVersion: 1, isRefreshing: false }); });
afterEach(() => { client.clear();useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" }); });
describe("exact proposal preference reference editor", () => {
  it("suspends reference discovery while its proposal is hidden and revalidates on intentional reopening without changing the draft value", async () => {
    vi.mocked(services.getPreferenceOptions).mockResolvedValue({ items: [{ id: "28", label: "Synthetic travel" }], next_cursor: null });
    const onChange = vi.fn();
    const editor = (observed: boolean) => <QueryClientProvider client={client}><PreferenceValueEditor proposal={preferenceProposal} stepId={preferenceProposal.steps[0].step_id} value={preference.value} onChange={onChange} disabled={false} label="Valor" error={false} observed={observed} /></QueryClientProvider>;
    const view = render(editor(false));
    expect(services.getPreferenceOptions).not.toHaveBeenCalled();
    view.rerender(editor(true));
    await waitFor(() => expect(services.getPreferenceOptions).toHaveBeenCalledOnce());
    view.rerender(editor(false));
    await client.invalidateQueries({ queryKey: ["nodia-ai"] });
    expect(services.getPreferenceOptions).toHaveBeenCalledOnce();
    view.rerender(editor(true));
    await waitFor(() => expect(services.getPreferenceOptions).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Valor" })).toHaveTextContent("Synthetic food");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("offers permitted names without allowing scope or key edits", async () => {
    vi.mocked(services.getPreferenceOptions).mockResolvedValue({ items: [{ id: "28", label: "Synthetic travel" }], next_cursor: null });
    const onChange = vi.fn(),user = userEvent.setup();
    render(<QueryClientProvider client={client}><PreferenceValueEditor proposal={preferenceProposal} stepId={preferenceProposal.steps[0].step_id} value={preference.value} onChange={onChange} disabled={false} label="Valor" error={false} /></QueryClientProvider>);
    const selector = screen.getByRole("button", { name: "Valor" });await waitFor(() => expect(selector).toBeEnabled());
    expect(selector).toHaveTextContent("Synthetic food");await user.click(selector);await user.click(await screen.findByRole("option", { name: "Synthetic travel" }));
    expect(onChange).toHaveBeenCalledWith("28");expect(screen.queryByRole("textbox", { name: "Valor" })).not.toBeInTheDocument();
  });
});
