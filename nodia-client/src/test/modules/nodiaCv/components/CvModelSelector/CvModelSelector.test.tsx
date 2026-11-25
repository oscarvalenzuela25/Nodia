import { render, screen } from "@testing-library/react";
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
});
