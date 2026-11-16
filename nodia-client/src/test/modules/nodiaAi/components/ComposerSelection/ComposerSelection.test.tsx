import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ComposerSelection from "../../../../../modules/nodiaAi/components/ComposerSelection";
import type { ComposerSelectionProps } from "../../../../../modules/nodiaAi/components/ComposerSelection";
import type { NodiaAiConnection, NodiaAiEligibility, NodiaAiSelection } from "../../../../../modules/nodiaAi/infrastructure/types";
import i18n from "../../../../../translate";

// All options and availability observations are synthetic, with no provider requests.
const api: NodiaAiSelection = { connection_id: "22", mode: "api_key", model_id: "fixture-api", effort_id: null };
const agent: NodiaAiSelection = { connection_id: "9007199254740993", mode: "agentic", model_id: "fixture-agent", effort_id: "extended" };
const mode = (selection: NodiaAiSelection): NodiaAiConnection["modes"][number] => ({
  mode: selection.mode, configuration: "configured", authentication: "unknown", inference: "unknown",
  tools: "unknown", observed_at: null, block_reason: null, configured_selection: selection,
  models: [{ model_id: selection.model_id, label: `Configured ${selection.mode}`, efforts: [{ effort_id: "extended", label: "Extended discovered" }] },
    { model_id: "fixture-new", label: "New discovered", efforts: [{ effort_id: "future-intensity", label: "Future intensity" }] }],
});
const connections: NodiaAiConnection[] = [
  { connection_id: api.connection_id, label: "First connection", provider_key: "synthetic", is_active: true, modes: [mode(api)] },
  { connection_id: agent.connection_id, label: "Independent connection", provider_key: "synthetic", is_active: true, default_mode: "agentic", modes: [mode(agent)] },
];
const observed = (selection: NodiaAiSelection, available = true): NodiaAiEligibility => ({
  selection, available, reason: available ? null : "nodia_ai:runtime_busy", supports_mcp: false, routing_target: null, observed_at: null,
});
const key = (field: string) => i18n.t(`nodiaAi:configuration.${field}`);
const props = (overrides: Partial<ComposerSelectionProps> = {}): ComposerSelectionProps => ({
  connections, selection: api, onSelectionChange: vi.fn(), onDirtyChange: vi.fn(),
  eligibility: observed(api), eligibilityBusy: false, eligibilityError: null, onRetryEligibility: vi.fn(),
  isLoading: false, isFetching: false, isSaving: false, readOnly: false, error: null, onRetry: vi.fn(),
  hasMore: false, onLoadMore: vi.fn(), onApply: vi.fn().mockResolvedValue(undefined), ...overrides,
});
async function choose(field: string, option: string) {
  const user = userEvent.setup();
  if (!screen.queryByRole("button", { name: key(field) })) await openSelection();
  await user.click(screen.getByRole("button", { name: key(field) }));
  await user.click(await screen.findByRole("option", { name: option }));
}
async function openSelection() {
  await userEvent.setup().click(screen.getByRole("button", { name: key("selection_panel.title") }));
}
async function closeSelection() {
  await userEvent.setup().click(within(screen.getByRole("dialog", { name: key("title") })).getByRole("button", { name: i18n.t("nodiaAi:close") }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: key("title") })).not.toBeInTheDocument());
}

describe("ComposerSelection", () => {
  it("recovers configured GPT effort options after a catalog refresh without changing the saved tuple or assuming availability", async () => {
    const selected = { ...agent, model_id: "fixture-gpt-agentic", effort_id: "medium" };
    const configured = { ...mode(selected), models: [{ model_id: selected.model_id, label: "Configured GPT fixture", efforts: [] }] };
    const connection = { ...connections[1], provider_key: "openai", modes: [configured] };
    const settings = props({ connections: [connection], selection: selected, eligibility: observed(selected, false) });
    const { rerender } = render(<ComposerSelection {...settings} />);
    expect(screen.getByText(key("selection_missing"))).toBeInTheDocument();
    await openSelection();
    expect(screen.getByRole("button", { name: key("effort") })).toHaveTextContent("medium");

    const refreshed = { ...connection, modes: [{ ...configured, models: [{ ...configured.models[0],
      efforts: ["low", "medium", "high"].map(effort_id => ({ effort_id, label: effort_id })),
    }] }] };
    rerender(<ComposerSelection {...settings} connections={[refreshed]} />);
    expect(screen.queryByText(key("selection_missing"))).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: key("effort") })).toHaveTextContent(i18n.t("nodiaAi:effort_levels.medium"));
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(selected);
    expect(settings.onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(settings.onApply).not.toHaveBeenCalled();

    await choose("effort", i18n.t("nodiaAi:effort_levels.high"));
    const changed = { ...selected, effort_id: "high" };
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(changed);
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    rerender(<ComposerSelection {...settings} connections={[refreshed]} eligibility={observed(changed)} />);
    await userEvent.setup().click(screen.getByRole("button", { name: key("apply") }));
    expect(settings.onApply).toHaveBeenCalledExactlyOnceWith({ selection: changed, routingEnabled: false });
  });

  it("groups Gemini Agentic variants and requires eligibility for the explicitly chosen executable effort", async () => {
    const models = ["high", "medium", "low"].map(effort_id => ({
      model_id: `fixture-family-${effort_id}`, label: `Fixture Family (${effort_id.toUpperCase()})`,
      efforts: [{ effort_id, label: effort_id }],
    }));
    const selected = { ...agent, model_id: models[2].model_id, effort_id: "low" };
    const settings = props({ connections: [{ ...connections[1], provider_key: "gemini", modes: [{ ...mode(selected), models }] }],
      selection: selected, eligibility: observed(selected) });
    const { rerender } = render(<ComposerSelection {...settings} />);
    await openSelection();
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("Fixture Family");
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(selected);
    await choose("model", "Fixture Family");
    expect(settings.onSelectionChange).toHaveBeenCalledTimes(1);
    await choose("effort", i18n.t("nodiaAi:effort_levels.high"));
    const changed = { ...selected, model_id: models[0].model_id, effort_id: "high" };
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(changed);
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    rerender(<ComposerSelection {...settings} eligibility={observed(changed)} />);
    await userEvent.setup().click(screen.getByRole("button", { name: key("apply") }));
    expect(settings.onApply).toHaveBeenCalledExactlyOnceWith({ selection: changed, routingEnabled: false });
  });

  it.each(["api_key", "agentic"] as const)("keeps non-Gemini-Agentic variants separate (%s)", async channel => {
    const models = ["high", "low"].map(effort_id => ({ model_id: `fixture-family-${effort_id}`,
      label: `Fixture Family (${effort_id.toUpperCase()})`, efforts: [{ effort_id, label: effort_id }] }));
    const selected = { ...agent, mode: channel, model_id: models[0].model_id, effort_id: "high" };
    render(<ComposerSelection {...props({ connections: [{ ...connections[1], provider_key: channel === "api_key" ? "gemini" : "openai",
      modes: [{ ...mode(selected), models }] }], selection: selected, eligibility: observed(selected) })} />);
    await openSelection();
    await userEvent.setup().click(screen.getByRole("button", { name: key("model") }));
    expect(screen.getByRole("option", { name: models[0].label })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: models[1].label })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Fixture Family" })).not.toBeInTheDocument();
  });

  it("loads the chosen connection's persisted default exactly without applying or changing global preferences", async () => {
    const settings = props();
    const { rerender } = render(<ComposerSelection {...settings} />);
    await choose("connection", "Independent connection");
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(agent);
    expect(settings.onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("Configured agentic");
    expect(screen.getByRole("button", { name: key("effort") })).toHaveTextContent("Extended discovered");
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    expect(settings.onApply).not.toHaveBeenCalled();
    rerender(<ComposerSelection {...settings} eligibility={observed(agent)} />);
    await userEvent.setup().click(screen.getByRole("button", { name: key("apply") }));
    expect(settings.onApply).toHaveBeenCalledExactlyOnceWith({ selection: agent, routingEnabled: false });
  });

  it("keeps partial changes dirty and reveals fields progressively without inventing a model", async () => {
    const settings = props({ selection: null, eligibility: null });
    render(<ComposerSelection {...settings} />);
    expect(screen.queryByRole("button", { name: key("mode") })).not.toBeInTheDocument();
    await choose("connection", "First connection");
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(settings.onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("button", { name: key("model") })).not.toBeInTheDocument();
    await choose("mode", i18n.t("nodiaAi:modes.api_key"));
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(api);
    await choose("model", "New discovered");
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith({ ...api, model_id: "fixture-new" });
    await choose("effort", "Future intensity");
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith({ ...api, model_id: "fixture-new", effort_id: "future-intensity" });
    expect(settings.onApply).not.toHaveBeenCalled();
  });

  it("does not borrow the model from a configured selection for another account", async () => {
    const invalid = { ...connections[0], default_mode: "api_key" as const,
      modes: [{ ...mode(api), configured_selection: { ...api, connection_id: agent.connection_id, effort_id: "extended" } }] };
    const settings = props({ connections: [invalid], selection: null, eligibility: null });
    render(<ComposerSelection {...settings} />);
    await choose("connection", invalid.label);
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent(key("unassigned_model"));
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    await choose("model", "Configured api_key");
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(api);
  });

  it("preserves missing historical IDs and blocks unavailable choices through refetch failure", async () => {
    const settings = props({ selection: { ...api, model_id: "fixture-removed" }, eligibility: null });
    const { rerender } = render(<ComposerSelection {...settings} />);
    expect(screen.getByText(key("selection_missing"))).toBeInTheDocument();
    await openSelection();
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("fixture-removed");
    await choose("model", "New discovered");
    const changed = { ...api, model_id: "fixture-new" };
    rerender(<ComposerSelection {...settings} eligibility={observed(changed, false)} error="Synthetic catalog failure" />);
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("New discovered");
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    expect(screen.getByText("Synthetic catalog failure")).toBeInTheDocument();
    expect(settings.onApply).not.toHaveBeenCalled();
  });

  it("preserves the failed selection, prevents overlapping apply, and resets only after server confirmation", async () => {
    let reject: (error: Error) => void = () => {};
    const onApply = vi.fn(() => new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; }));
    const settings = props({ onApply });
    const { rerender } = render(<ComposerSelection {...settings} />);
    await choose("model", "New discovered");
    const changed = { ...api, model_id: "fixture-new" };
    rerender(<ComposerSelection {...settings} eligibility={observed(changed)} />);
    await userEvent.setup().dblClick(screen.getByRole("button", { name: key("apply") }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: key("selection_panel.title"), hidden: true })).toBeDisabled();
    await userEvent.setup().keyboard("{Escape}");
    expect(screen.getByRole("button", { name: key("selection_panel.title"), hidden: true })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: key("model") })).toHaveAttribute("aria-disabled", "true");
    await act(async () => reject(new Error("Synthetic save failure")));
    await waitFor(() => expect(screen.getByRole("button", { name: key("apply") })).toBeEnabled());
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("New discovered");
    rerender(<ComposerSelection {...settings} selection={changed} eligibility={observed(changed)} />);
    expect(settings.onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("button", { name: key("apply") })).not.toBeInTheDocument();
  });

  it.each(["es", "en"])("cancels drafts and keeps revalidation controls disabled (%s)", async language => {
    await i18n.changeLanguage(language);
    const settings = props();
    const { rerender } = render(<ComposerSelection {...settings} />);
    await choose("model", "New discovered");
    await userEvent.setup().click(screen.getByRole("button", { name: key("cancel") }));
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(api);
    expect(settings.onDirtyChange).toHaveBeenLastCalledWith(false);
    rerender(<ComposerSelection {...settings} isFetching />);
    expect(screen.getByRole("button", { name: key("connection") })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("Configured api_key");
    expect(settings.onApply).not.toHaveBeenCalled();
  });

  it("shows only the applied identity until the editor is requested, keeping it distinct from a folded draft", async () => {
    const settings = props();
    render(<ComposerSelection {...settings} />);
    const trigger = screen.getByRole("button", { name: key("selection_panel.title") });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("Configured api_key");
    expect(trigger).toHaveTextContent("First connection");
    expect(screen.queryByRole("button", { name: key("connection") })).not.toBeInTheDocument();
    await choose("connection", "Independent connection");
    const modelNode = screen.getByRole("button", { name: key("model") });
    await closeSelection();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("Configured api_key");
    expect(trigger).not.toHaveTextContent("Independent connection");
    expect(screen.getByRole("status")).toHaveTextContent(key("selection_panel.unsaved"));
    expect(settings.onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(agent);
    await openSelection();
    expect(screen.getByRole("button", { name: key("model") })).toBe(modelNode);
    expect(modelNode).toHaveTextContent("Configured agentic");
    expect(settings.onApply).not.toHaveBeenCalled();
  });

  it("closes by Escape with focus returned and keeps the failed draft and error visible on retry", async () => {
    const settings = props({ onApply: vi.fn().mockRejectedValue(new Error("Synthetic rejection")) });
    const { rerender } = render(<ComposerSelection {...settings} />);
    await choose("model", "New discovered");
    const changed = { ...api, model_id: "fixture-new" };
    rerender(<ComposerSelection {...settings} eligibility={observed(changed)} />);
    await userEvent.setup().click(screen.getByRole("button", { name: key("apply") }));
    expect(screen.getByRole("button", { name: key("selection_panel.title"), hidden: true })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("New discovered");
    rerender(<ComposerSelection {...settings} eligibility={observed(changed)} error="Synthetic save error" />);
    screen.getByRole("button", { name: key("model") }).focus();
    await userEvent.setup().keyboard("{Escape}");
    const trigger = await screen.findByRole("button", { name: key("selection_panel.title") });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("alert")).toHaveTextContent("Synthetic save error");
    await userEvent.setup().click(within(screen.getByRole("alert")).getByRole("button", { name: i18n.t("nodiaAi:retry") }));
    expect(settings.onRetry).toHaveBeenCalledOnce();
    await openSelection();
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("New discovered");
  });

  it("keeps missing configuration explicit when collapsed and prevents writes after permission changes", async () => {
    const settings = props({ selection: null, eligibility: null });
    const { rerender } = render(<ComposerSelection {...settings} />);
    expect(screen.getByRole("button", { name: key("selection_panel.title") })).toHaveTextContent(key("unassigned_model"));
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(null);
    await choose("connection", "Independent connection");
    rerender(<ComposerSelection {...settings} readOnly eligibility={observed(agent)} />);
    expect(screen.getByRole("button", { name: key("connection") })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    expect(settings.onApply).not.toHaveBeenCalled();
    rerender(<ComposerSelection {...settings} isFetching />);
    expect(screen.getByRole("button", { name: key("selection_panel.title"), hidden: true })).toBeDisabled();
  });

  it("lets the field popup consume Escape before closing the preserved editor", async () => {
    render(<ComposerSelection {...props()} />);
    await openSelection();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: key("model") }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: key("selection_panel.title"), hidden: true })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: key("model") })).toHaveFocus();
  });

  it("focuses the new summary only after a successful apply and its matching server selection", async () => {
    let complete!: () => void;
    const settings = props({ onApply: vi.fn(() => new Promise<void>(resolve => { complete = resolve; })) });
    const { rerender } = render(<ComposerSelection {...settings} />);
    await choose("model", "New discovered");
    const changed = { ...api, model_id: "fixture-new" };
    rerender(<ComposerSelection {...settings} eligibility={observed(changed)} />);
    await userEvent.setup().click(screen.getByRole("button", { name: key("apply") }));
    rerender(<ComposerSelection {...settings} selection={changed} eligibility={observed(changed)} isFetching />);
    const nextSummary = screen.getByRole("button", { name: key("selection_panel.title") });
    expect(nextSummary).not.toHaveFocus();
    await act(async () => complete());
    expect(nextSummary).not.toHaveFocus();
    rerender(<ComposerSelection {...settings} selection={changed} eligibility={observed(changed)} />);
    await waitFor(() => expect(nextSummary).toHaveFocus());
    expect(nextSummary).toHaveAttribute("aria-expanded", "false");
    expect(nextSummary).toHaveTextContent("New discovered");
    nextSummary.blur();
    rerender(<ComposerSelection {...settings} selection={changed} eligibility={observed(changed)} isFetching />);
    rerender(<ComposerSelection {...settings} selection={changed} eligibility={observed(changed)} />);
    expect(nextSummary).not.toHaveFocus();
  });
});
