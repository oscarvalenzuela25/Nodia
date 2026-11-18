import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import StudyContinuationPanel from "../../../../../modules/teacher/components/StudyContinuation";
import { studyContinuation, type StudyContinuationContext } from "../../../../../modules/teacher/infrastructure/studyContinuation";
import { planFixture } from "../../fixtures";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function StudyContinuation(props: StudyContinuationContext & Omit<ComponentProps<typeof StudyContinuationPanel>, "view">) {
  return <StudyContinuationPanel {...props} view={studyContinuation(props)} />;
}

const props = (patch: Partial<StudyContinuationContext> = {}) => ({
  plan: planFixture,
  cursor: { revision: 0, phase: "setup" as const, plan_revision_id: planFixture.id, section_id: null,
    unit_id: null, content_version_id: null, attempt_id: null, item_id: null, block_id: null },
  selectedUnitId: null, attemptId: null, allowedActions: { prepare_unit: { enabled: true, reason_code: null } },
  paused: false, busy: false, onSelectUnit: vi.fn(), onPrepare: vi.fn(), onOpen: vi.fn(), onContinue: vi.fn(), onInspectJob: vi.fn(), ...patch,
});

describe("Teacher study continuation actions", () => {
  it("starts with the real unit and delegates selection only on explicit activation", async () => {
    const actions = props(); render(<StudyContinuation {...actions} />);
    expect(screen.getByText("DNS")).toBeVisible();
    expect(actions.onSelectUnit).not.toHaveBeenCalled(); expect(actions.onPrepare).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "teacher:continuation.actions.first" }));
    expect(actions.onSelectUnit).toHaveBeenCalledExactlyOnceWith("s1", "u1");
    expect(actions.onPrepare).not.toHaveBeenCalled();
  });
  it("preserves the control through busy revalidation and never prepares automatically", async () => {
    const actions = props({ selectedUnitId: "u1", material: { kind: "availability", state: "not_prepared", job_id: null } });
    const { rerender } = render(<StudyContinuation {...actions} />);
    const button = screen.getByRole("button", { name: "teacher:continuation.actions.prepare_first" }); button.focus();
    expect(actions.onPrepare).not.toHaveBeenCalled();
    rerender(<StudyContinuation {...actions} busy />);
    expect(screen.getByRole("button")).toBe(button); expect(button).toBeDisabled(); fireEvent.click(button);
    expect(actions.onPrepare).not.toHaveBeenCalled();
    rerender(<StudyContinuation {...actions} />);
    expect(button).toHaveFocus(); await userEvent.click(button);
    expect(actions.onPrepare).toHaveBeenCalledExactlyOnceWith("u1");
  });
  it("does not allow preparing when paused or when server authority disappears", () => {
    const actions = props({ selectedUnitId: "u1", material: { kind: "availability", state: "not_prepared", job_id: null } });
    const { rerender } = render(<StudyContinuation {...actions} paused />);
    expect(screen.getByRole("button")).toBeDisabled(); fireEvent.click(screen.getByRole("button"));
    rerender(<StudyContinuation {...actions} allowedActions={{}} />);
    expect(screen.getByRole("button")).toBeDisabled(); expect(actions.onPrepare).not.toHaveBeenCalled();
  });
  it("focuses the existing paused attempt without selecting or preparing a replacement", async () => {
    const actions = props({ attemptId: "fixture-attempt", paused: true }); render(<StudyContinuation {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: "teacher:continuation.actions.continue" }));
    expect(actions.onContinue).toHaveBeenCalledExactlyOnceWith();
    expect(actions.onSelectUnit).not.toHaveBeenCalled(); expect(actions.onPrepare).not.toHaveBeenCalled();
  });
  it("keeps a historical attempt visible as context without offering a new first lesson", () => {
    const actions = props({ attemptId: "old-attempt", attemptPlanRevisionId: "old-plan" }); render(<StudyContinuation {...actions} />);
    expect(screen.getByRole("heading", { name: "teacher:continuation.titles.historical" })).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(actions.onSelectUnit).not.toHaveBeenCalled(); expect(actions.onPrepare).not.toHaveBeenCalled(); expect(actions.onContinue).not.toHaveBeenCalled();
  });
  it("offers job recovery for an unknown result and no generation action", async () => {
    const actions = props({ selectedUnitId: "u1", material: { kind: "availability", state: "unknown", job_id: "fixture-job" } }); render(<StudyContinuation {...actions} />);
    await userEvent.click(screen.getByRole("button", { name: "teacher:continuation.actions.job" }));
    expect(actions.onInspectJob).toHaveBeenCalledExactlyOnceWith("fixture-job"); expect(actions.onPrepare).not.toHaveBeenCalled();
  });
  it("keeps progress in the lesson card during polling and offers a read retry only if the status read fails", async () => {
    const actions = props({ selectedUnitId: "u1", material: { kind: "availability", state: "preparing", job_id: "fixture-job" } });
    const onRetry = vi.fn();
    const { rerender } = render(<StudyContinuation {...actions} preparationState="queued" />);
    expect(screen.getByRole("heading", { name: "teacher:continuation.preparing_lesson" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("teacher:jobs.queued");
    expect(screen.getByText("DNS")).toBeVisible();
    const progress = screen.getByRole("progressbar", { name: "teacher:preparation_progress" });
    expect(progress).not.toHaveAttribute("aria-valuenow");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<StudyContinuation {...actions} preparationState="running" jobReadError={{ busy: false, onRetry }} />);
    expect(screen.getByRole("progressbar")).toBe(progress);
    expect(screen.getByRole("status")).toHaveTextContent("teacher:jobs.running");
    expect(screen.getByText("teacher:job_last_known_state")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "core:retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(actions.onInspectJob).not.toHaveBeenCalled();
    expect(actions.onPrepare).not.toHaveBeenCalled();

    rerender(<StudyContinuation {...actions} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "teacher:continuation.actions.job" })).toBeVisible();
  });
  it.each(["unknown", "preparing"] as const)("refreshes %s availability explicitly without generating", async state => {
    const actions = props({ selectedUnitId: "u1", material: { kind: "availability", state, job_id: null } });
    const onRefresh = vi.fn(); const { rerender } = render(<StudyContinuation {...actions} onRefresh={onRefresh} />);
    const refresh = screen.getByRole("button", { name: "teacher:refresh_status" });
    expect(refresh).toHaveClass("MuiButton-outlined"); expect(onRefresh).not.toHaveBeenCalled();
    rerender(<StudyContinuation {...actions} onRefresh={onRefresh} busy />);
    expect(refresh).toBeDisabled(); fireEvent.click(refresh); expect(onRefresh).not.toHaveBeenCalled();
    rerender(<StudyContinuation {...actions} onRefresh={onRefresh} />); await userEvent.click(refresh);
    expect(onRefresh).toHaveBeenCalledExactlyOnceWith(); expect(actions.onPrepare).not.toHaveBeenCalled();
  });
});
