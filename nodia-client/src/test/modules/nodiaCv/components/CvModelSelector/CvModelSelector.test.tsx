import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CvModelSelector, { type CvModelConnection, type CvModelSelectorProps } from "../../../../../modules/nodiaCv/components/CvModelSelector";
import type { NodiaAiSelection } from "../../../../../modules/nodiaAi/infrastructure/types";
import i18n from "../../../../../translate";

const applied: NodiaAiSelection = { connection_id: "42", mode: "api_key", model_id: "fixture-current", effort_id: null };
const mode = {
  configuration: "configured", authentication: "unknown", inference: "unknown", tools: "unknown",
  observed_at: null, block_reason: null,
} as const;
const connections: CvModelConnection[] = [{
  connection_id: applied.connection_id, label: "Fixture connection", provider_key: "synthetic", is_active: true,
  modes: [
    { ...mode, mode: "api_key", cv_transport: "available", configured_selection: applied,
      models: [{ model_id: applied.model_id, label: "Fixture current", efforts: [] }, { model_id: "fixture-next", label: "Fixture next", efforts: [] }] },
    { ...mode, mode: "agentic", cv_transport: "unsupported", configured_selection: null, models: [] },
  ],
}];
const props = (): CvModelSelectorProps => ({
  connections, selection: applied, onSelectionChange: vi.fn(), onDirtyChange: vi.fn(), onApply: vi.fn(),
  eligibility: { selection: applied, eligible: true, reason_code: "qualified" },
  eligibilityBusy: false, eligibilityError: null, onRetryEligibility: vi.fn(),
  isLoading: false, isFetching: false, isSaving: false, readOnly: false, error: null, onRetry: vi.fn(),
  hasMore: false, onLoadMore: vi.fn(),
});
const cv = (name: string) => i18n.t(`nodiaCv:model_selector.${name}`);
const action = (name: string) => i18n.t(`nodiaAi:configuration.${name}`);

describe("CvModelSelector", () => {
  it("uses the CV empty-state wording for a catalog without connections", () => {
    render(<CvModelSelector {...props()} connections={[]} selection={null} eligibility={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(cv("no_connections"));
    expect(screen.queryByText(action("no_connections"))).not.toBeInTheDocument();
  });

  it("exposes the unsupported mode, blocks applying it and restores the applied API tuple on cancel", async () => {
    const user = userEvent.setup();
    const settings = props();
    render(<CvModelSelector {...settings} />);
    await user.click(screen.getByRole("button", { name: cv("title") }));
    await user.click(screen.getByRole("button", { name: action("mode") }));
    await user.click(screen.getByRole("option", { name: `${i18n.t("nodiaAi:modes.agentic")} · ${cv("unsupported")}` }));
    expect(screen.getByText(cv("agentic_transport_unavailable"))).toBeVisible();
    expect(screen.getByRole("button", { name: action("model") })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: action("apply") })).toBeDisabled();
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(settings.onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: action("cancel") }));
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(applied);
    expect(settings.onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText(cv("agentic_transport_unavailable"))).not.toBeInTheDocument();
  });

  it("requires eligibility of the exact new tuple and applies the CV selection alone", async () => {
    const user = userEvent.setup();
    const settings = props();
    const { rerender } = render(<CvModelSelector {...settings} />);
    await user.click(screen.getByRole("button", { name: cv("title") }));
    await user.click(screen.getByRole("button", { name: action("model") }));
    await user.click(screen.getByRole("option", { name: "Fixture next" }));
    const next = { ...applied, model_id: "fixture-next" };
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(next);
    expect(settings.onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: action("apply") })).toBeDisabled();

    rerender(<CvModelSelector {...settings} eligibility={{ selection: next, eligible: false, reason_code: "qualification_required" }} />);
    expect(screen.getByText(cv("qualification_required"))).toBeVisible();
    expect(screen.getByRole("button", { name: action("apply") })).toBeDisabled();
    rerender(<CvModelSelector {...settings} eligibility={{ selection: next, eligible: true, reason_code: "qualified" }} />);
    await user.click(screen.getByRole("button", { name: action("apply") }));
    expect(settings.onApply).toHaveBeenCalledExactlyOnceWith(next);
  });

  it("offers the configured Gemini model and effort and applies it on first availability", async () => {
    const user = userEvent.setup();
    const exact: NodiaAiSelection = { ...applied, mode: "agentic", model_id: "gemini-fixture-high", effort_id: "high" };
    const settings = props();
    const view: CvModelSelectorProps = {
      ...settings,
      connections: [{
        ...connections[0],
        provider_key: "gemini",
        modes: [connections[0].modes[0], {
          ...mode, mode: "agentic", cv_transport: "available", configured_selection: null,
          models: [{ model_id: exact.model_id, label: "Gemini Fixture (High)", efforts: [{ effort_id: "high", label: "high" }] }],
        }],
      }],
    };
    const { rerender } = render(<CvModelSelector {...view} />);
    await user.click(screen.getByRole("button", { name: cv("title") }));
    await user.click(screen.getByRole("button", { name: action("mode") }));
    await user.click(screen.getByRole("option", { name: i18n.t("nodiaAi:modes.agentic") }));
    await user.click(screen.getByRole("button", { name: action("model") }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.click(screen.getByRole("option", { name: "Gemini Fixture (High)" }));
    await user.click(screen.getByRole("button", { name: action("effort") }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.click(screen.getByRole("option", { name: i18n.t("nodiaAi:effort_levels.high") }));

    rerender(<CvModelSelector {...view} eligibility={{ selection: exact, eligible: false, reason_code: "gemini_profile_busy" }} />);
    expect(screen.getByText(cv("gemini_profile_busy"))).toBeVisible();
    expect(screen.getByRole("button", { name: action("apply") })).toBeDisabled();
    rerender(<CvModelSelector {...view} eligibility={{ selection: exact, eligible: true, reason_code: "available" }} />);
    await user.click(screen.getByRole("button", { name: action("apply") }));
    expect(settings.onApply).toHaveBeenCalledExactlyOnceWith(exact);
  });

  it("shows each Agentic gate and accepts the exact available model and reasoning tuple", async () => {
    const user = userEvent.setup();
    const exact: NodiaAiSelection = { ...applied, mode: "agentic", model_id: "fixture-codex", effort_id: "high" };
    const settings = props();
    const agenticConnections: CvModelConnection[] = [{
      ...connections[0],
      provider_key: "openai",
      modes: [
        connections[0].modes[0],
        {
          ...mode,
          mode: "agentic",
          cv_transport: "available",
          configured_selection: null,
          models: [{ model_id: exact.model_id, label: "Fixture Codex", efforts: [
            { effort_id: "medium", label: "Medium" },
            { effort_id: "high", label: "High" },
          ] }],
        },
      ],
    }];
    const view = { ...settings, connections: agenticConnections };
    const { rerender } = render(<CvModelSelector {...view} />);
    await user.click(screen.getByRole("button", { name: cv("title") }));
    await user.click(screen.getByRole("button", { name: action("mode") }));
    await user.click(screen.getByRole("option", { name: i18n.t("nodiaAi:modes.agentic") }));
    await user.click(screen.getByRole("button", { name: action("model") }));
    await user.click(screen.getByRole("option", { name: "Fixture Codex" }));
    await user.click(screen.getByRole("button", { name: action("effort") }));
    await user.click(screen.getByRole("option", { name: i18n.t("nodiaAi:effort_levels.high") }));
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(exact);

    const staleSelection = { ...exact, effort_id: "medium" };
    rerender(<CvModelSelector {...view} eligibility={{ selection: staleSelection, eligible: true, reason_code: "qualified" }} />);
    expect(screen.getByRole("button", { name: action("apply") })).toBeDisabled();

    for (const [reason_code, label] of [
      ["codex_runtime_unavailable", "codex_runtime_unavailable"],
      ["agentic_transport_unavailable", "agentic_host_unavailable"],
      ["codex_session_required", "codex_session_required"],
      ["codex_session_unverified", "codex_session_unverified"],
      ["codex_model_unavailable", "codex_model_unavailable"],
      ["codex_effort_unavailable", "codex_effort_unavailable"],
      ["codex_profile_busy", "codex_profile_busy"],
      ["codex_usage_unavailable", "codex_usage_unavailable"],
      ["qualification_required", "qualification_required"],
    ] as const) {
      rerender(<CvModelSelector {...view} eligibility={{ selection: exact, eligible: false, reason_code }} />);
      expect(screen.getByText(cv(label))).toBeVisible();
      expect(screen.getByRole("button", { name: action("apply") })).toBeDisabled();
    }
    await user.click(screen.getByRole("button", { name: action("check_again") }));
    expect(settings.onRetryEligibility).toHaveBeenCalledTimes(1);
    expect(settings.onSelectionChange).toHaveBeenLastCalledWith(exact);

    const eligibility = { selection: exact, eligible: true, reason_code: "available" as const };
    rerender(<CvModelSelector {...view} eligibility={eligibility} eligibilityBusy />);
    expect(screen.getByRole("button", { name: action("apply") })).toBeDisabled();
    rerender(<CvModelSelector {...view} eligibility={eligibility} />);
    await user.click(screen.getByRole("button", { name: action("apply") }));
    expect(settings.onApply).toHaveBeenCalledExactlyOnceWith(exact);

    rerender(<CvModelSelector {...view} selection={exact} eligibility={eligibility} />);
    const trigger = screen.getByRole("button", { name: cv("title") });
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: cv("title") })).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: cv("title") })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});
