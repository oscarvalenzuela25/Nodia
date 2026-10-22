import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfigurationDrawer from "../../../../../modules/nodiaAi/components/ConfigurationDrawer";
import type { ConfigurationDrawerProps } from "../../../../../modules/nodiaAi/components/ConfigurationDrawer";
import type { NodiaAiConnection, NodiaAiEligibility, NodiaAiSelection } from "../../../../../modules/nodiaAi/infrastructure/types";
import i18n from "../../../../../translate";

// Synthetic catalog and observations; these never describe an operational provider.
const web: NodiaAiSelection = { connection_id: "22", mode: "token_plan_web", model_id: "fixture-web", effort_id: null };
const agentic: NodiaAiSelection = { connection_id: "22", mode: "token_plan_agentic", model_id: "fixture-agent", effort_id: "deep" };
const connections: NodiaAiConnection[] = [{
  connection_id: "22", label: "Fixture connection", provider_key: "fixture-provider", is_active: true,
  modes: [
    { mode: "token_plan_web", configuration: "configured", authentication: "unknown", inference: "unknown", tools: "unsupported", observed_at: null, block_reason: null, configured_selection: web, models: [
      { model_id: "fixture-web", label: "Web configured", efforts: [] },
      { model_id: "fixture-other", label: "Other discovered model", efforts: [{ effort_id: "brief", label: "Brief observed" }] },
    ] },
    { mode: "token_plan_agentic", configuration: "configured", authentication: "unknown", inference: "unknown", tools: "unknown", observed_at: null, block_reason: null, configured_selection: agentic, models: [
      { model_id: "fixture-agent", label: "Agent configured", efforts: [{ effort_id: "deep", label: "Deep observed" }] },
    ] },
    { mode: "api_key", configuration: "incomplete", authentication: "unknown", inference: "unknown", tools: "unsupported", observed_at: null, block_reason: null, configured_selection: null, models: [] },
  ],
}];
const eligibility: NodiaAiEligibility = {
  selection: web, available: true, reason: null, observed_at: null, supports_mcp: false,
  routing_target: { selection: { ...agentic, mode: "token_plan_agentic" }, configuration_generation: "fixture-configuration", session_generation: "fixture-session" },
};
const key = (name: string) => i18n.t(`nodiaAi:configuration.${name}`);
function props(overrides: Partial<ConfigurationDrawerProps> = {}): ConfigurationDrawerProps {
  return {
    open: true, onClose: vi.fn(), connections, selection: web, routingEnabled: false,
    onSelectionChange: vi.fn(), eligibility, eligibilityBusy: false, eligibilityError: null,
    onRetryEligibility: vi.fn(), isLoading: false, isFetching: false, isSaving: false,
    readOnly: false, error: null, onRetry: vi.fn(), hasMore: false, onLoadMore: vi.fn(),
    onApply: vi.fn().mockResolvedValue(undefined), ...overrides,
  };
}
async function choose(field: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: key(field) }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("NodiaAI ConfigurationDrawer", () => {
  it("reports the exact configured selection and only applies opt-in routing after explicit confirmation", async () => {
    const user = userEvent.setup(); const settings = props();
    render(<ConfigurationDrawer {...settings} />);
    expect(screen.getByRole("dialog", { name: key("title") })).toBeInTheDocument();
    expect(settings.onSelectionChange).toHaveBeenCalledWith(web);
    const routing = screen.getByRole("switch", { name: key("automatic_agentic") });
    expect(routing).not.toBeChecked();
    await user.click(routing);
    expect(settings.onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: key("apply") }));
    await waitFor(() => expect(settings.onApply).toHaveBeenCalledExactlyOnceWith({ selection: web, routingEnabled: true }));
    expect(settings.onClose).not.toHaveBeenCalled();
  });

  it("does not treat configured models as availability or silently substitute a missing model", () => {
    const settings = props({ selection: { ...web, model_id: "old-fixture-model" }, eligibility: null });
    render(<ConfigurationDrawer {...settings} />);
    expect(settings.onSelectionChange).toHaveBeenCalledWith({ ...web, model_id: "old-fixture-model" });
    expect(screen.getByText(key("selection_missing"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent(i18n.t("nodiaAi:configuration.missing_model", { id: "old-fixture-model" }));
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
  });

  it("ignores an observation for another selection and a routing target from another connection", () => {
    const { rerender } = render(<ConfigurationDrawer {...props({ eligibility: { ...eligibility, selection: agentic } })} />);
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    rerender(<ConfigurationDrawer {...props({ eligibility: { ...eligibility, routing_target: {
      ...eligibility.routing_target!, selection: { ...agentic, connection_id: "99", mode: "token_plan_agentic" },
    } } })} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: key("check_again") })).not.toBeInTheDocument();
  });

  it("rechecks a successful unavailable observation and preserves the edited draft until explicitly applied", async () => {
    const user = userEvent.setup();
    const settings = props({ eligibility: { ...eligibility, available: false, routing_target: null, reason: "nodia_ai:runtime_busy" } });
    const { rerender } = render(<ConfigurationDrawer {...settings} />);
    await choose("model", "Other discovered model");
    const changed = { ...web, model_id: "fixture-other" };
    expect(screen.queryByRole("button", { name: key("check_again") })).not.toBeInTheDocument();
    const unavailable = { ...eligibility, selection: changed, available: false, routing_target: null, reason: "nodia_ai:runtime_busy" };
    rerender(<ConfigurationDrawer {...settings} eligibility={unavailable} />);
    const dialog = screen.getByRole("dialog");
    const model = screen.getByRole("button", { name: key("model") });
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: key("check_again") }));
    expect(settings.onRetryEligibility).toHaveBeenCalledTimes(1);
    const cancel = screen.getByRole("button", { name: key("cancel") });
    cancel.focus();
    rerender(<ConfigurationDrawer {...settings} eligibility={unavailable} eligibilityBusy />);
    expect(screen.getByRole("button", { name: key("check_again") })).toBeDisabled();
    expect(screen.getByText(key("checking"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: key("model") })).toBe(model);
    expect(model).toHaveTextContent("Other discovered model");
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(cancel).toHaveFocus();
    rerender(<ConfigurationDrawer {...settings} eligibility={{ ...unavailable, available: true, reason: null }} />);
    expect(screen.getByText(key("available"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: key("check_again") })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: key("model") })).toBe(model);
    expect(settings.onApply).not.toHaveBeenCalled();
    expect(settings.onClose).not.toHaveBeenCalled();
    expect(settings.onSelectionChange).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: key("apply") }));
    await waitFor(() => expect(settings.onApply).toHaveBeenCalledExactlyOnceWith({ selection: changed, routingEnabled: false }));
  });

  it("blocks concurrent eligibility rechecks and disables retry while the chat is read only", async () => {
    const user = userEvent.setup();
    const unavailable = { ...eligibility, available: false, routing_target: null };
    const retry = vi.fn(() => rerender(<ConfigurationDrawer {...settings} eligibilityBusy />));
    const settings = props({ eligibility: unavailable, onRetryEligibility: retry });
    const { rerender } = render(<ConfigurationDrawer {...settings} />);
    await user.dblClick(screen.getByRole("button", { name: key("check_again") }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: key("check_again") })).toBeDisabled();
    rerender(<ConfigurationDrawer {...settings} readOnly />);
    expect(screen.getByRole("button", { name: key("check_again") })).toBeDisabled();
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("Web configured");
  });

  it("uses the chosen mode's persisted model and effort without inheriting Web configuration", async () => {
    const settings = props(); render(<ConfigurationDrawer {...settings} />);
    await choose("mode", i18n.t("nodiaAi:modes.token_plan_agentic"));
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(agentic);
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("Agent configured");
    expect(screen.getByRole("button", { name: key("effort") })).toHaveTextContent("Deep observed");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
  });

  it("does not clear routing or configuration when the already selected option is clicked", async () => {
    const settings = props({ routingEnabled: true }); render(<ConfigurationDrawer {...settings} />);
    await choose("connection", "Fixture connection");
    await choose("mode", i18n.t("nodiaAi:modes.token_plan_web"));
    await choose("model", "Web configured");
    expect(screen.getByRole("switch", { name: key("automatic_agentic") })).toBeChecked();
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("Web configured");
    expect(settings.onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it("keeps an unassigned mode empty and API unavailable in v1", async () => {
    const settings = props(); render(<ConfigurationDrawer {...settings} />);
    await choose("mode", i18n.t("nodiaAi:modes.api_key"));
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent(key("unassigned_model"));
    expect(screen.getByText(key("api_deferred"))).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
  });

  it("preserves the edited model through refetch and save failure, then permits a manual retry", async () => {
    const user = userEvent.setup(); const apply = vi.fn().mockRejectedValueOnce(new Error("synthetic failure")).mockResolvedValue(undefined);
    const settings = props({ onApply: apply });
    const { rerender } = render(<ConfigurationDrawer {...settings} />);
    await choose("model", "Other discovered model");
    const changed = { ...web, model_id: "fixture-other" };
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(changed);
    rerender(<ConfigurationDrawer {...settings} isFetching />);
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("Other discovered model");
    expect(screen.getByRole("button", { name: key("model") })).toHaveAttribute("aria-disabled", "true");
    rerender(<ConfigurationDrawer {...settings} eligibility={{ ...eligibility, selection: changed }} />);
    await user.click(screen.getByRole("button", { name: key("apply") }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("Other discovered model");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(settings.onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: key("apply") }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(2));
    expect(apply).toHaveBeenLastCalledWith({ selection: changed, routingEnabled: false });
  });

  it("locks repeated submissions and Escape while a save is unresolved", async () => {
    let finish: (() => void) | undefined;
    const settings = props({ onApply: vi.fn(() => new Promise<void>(resolve => { finish = resolve; })) });
    const user = userEvent.setup(); render(<ConfigurationDrawer {...settings} />);
    await user.dblClick(screen.getByRole("button", { name: key("apply") }));
    expect(settings.onApply).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(settings.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: key("cancel") })).toBeDisabled();
    await act(async () => { finish?.(); });
    await waitFor(() => expect(screen.getByRole("button", { name: key("cancel") })).toBeEnabled());
  });

  it("preserves lost routing consent for explicit disabling instead of silently changing it", async () => {
    const user = userEvent.setup(); const settings = props({ routingEnabled: true, eligibility: { ...eligibility, routing_target: null } });
    render(<ConfigurationDrawer {...settings} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: key("disable_routing") }));
    await user.click(screen.getByRole("button", { name: key("apply") }));
    await waitFor(() => expect(settings.onApply).toHaveBeenCalledWith({ selection: web, routingEnabled: false }));
  });

  it("distinguishes an empty catalog from an error and exposes retry without resetting the draft", async () => {
    const user = userEvent.setup(); const settings = props({ connections: [], selection: null, eligibility: null });
    const { rerender } = render(<ConfigurationDrawer {...settings} />);
    expect(screen.getByText(key("no_connections"))).toBeInTheDocument();
    rerender(<ConfigurationDrawer {...settings} error="Synthetic server error" />);
    expect(screen.queryByText(key("no_connections"))).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Synthetic server error");
    await user.click(screen.getByRole("button", { name: key("retry") }));
    expect(settings.onRetry).toHaveBeenCalledTimes(1);
  });

  it("blocks edits for read-only conversations without losing the current selection", () => {
    render(<ConfigurationDrawer {...props({ readOnly: true })} />);
    expect(screen.getByRole("button", { name: key("connection") })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: key("apply") })).toBeDisabled();
    expect(screen.getByRole("button", { name: key("model") })).toHaveTextContent("Web configured");
  });
});
