import { act, render, screen, waitFor } from "@testing-library/react";
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
  await user.click(screen.getByRole("button", { name: key(field) }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("ComposerSelection", () => {
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
});
