import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DiagnosticEntry from "../../../../../modules/teacher/components/DiagnosticEntry";
import type { Learning } from "../../../../../modules/teacher/infrastructure/learningSchemas";
import type { Session } from "../../../../../modules/teacher/infrastructure/schemas";
import i18n from "../../../../../translate";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../../../../modules/teacher/infrastructure/useServices", () => ({ useTeacherQuery: mocks.query }));

const action = { enabled: true, reason_code: null };
const onStart = vi.fn<() => Promise<boolean>>();
const onClose = vi.fn();
let session: Session;
let learning: Learning;
let query: { data: Learning | undefined; isLoading: boolean; isFetching: boolean; isError: boolean; refetch: ReturnType<typeof vi.fn> };

beforeEach(() => {
  onStart.mockReset().mockResolvedValue(false); onClose.mockReset(); mocks.query.mockReset();
  // Synthetic session and reviewed content; no provider or production access.
  session = {
    id: "fixture-session", title: null, topic: "DNS", objective: "Explain resolution", state: "draft", revision: 1, updated_at: "2026-11-16T12:00:00Z",
    declared_base: null, context: null, explanation_language: "es", requested_organization: "topics", requested_day_count: null,
    selection: null, setup_draft_text: "", setup_draft_revision: 0, dispatch_limit: 0, dispatches_used: 0,
    current_plan: null, active_jobs: [], active_attempts: [], section_states: [],
    cursor: { revision: 1, phase: "setup", plan_revision_id: null, section_id: null, unit_id: null, content_version_id: null, attempt_id: null, item_id: null, block_id: null },
    allowed_actions: { start_diagnostic: action },
  };
  learning = {
    schema_version: 1, session_id: session.id, revision: 1, policy_version: "teacher-learning/1", objectives: [], observations: [], recommendations: [], interactions: [], mappings: [],
    diagnostic_blueprint: { id: "fixture-bank", revision: 1, title: "DNS diagnostic fixture", dimensions: [], reviewed: true, item_count: 2 },
  };
  query = { data: learning, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() };
  mocks.query.mockImplementation(() => query);
});

const view = (open = true, busy = false) => <DiagnosticEntry session={session} open={open} busy={busy} onClose={onClose} onStart={onStart} />;
const startButton = () => screen.getByRole("button", { name: i18n.t("teacher:diagnostic") });

describe("Teacher optional diagnostic entry", () => {
  it("only enables its read when open and starts solely on explicit intent; failure preserves the modal", async () => {
    const { rerender } = render(view(false));
    expect(mocks.query.mock.lastCall?.[3]).toBe(false);
    expect(onStart).not.toHaveBeenCalled();
    rerender(view());
    expect(mocks.query.mock.lastCall?.[3]).toBe(true);
    expect(screen.getByText("DNS diagnostic fixture")).toBeVisible();
    await userEvent.click(startButton());
    expect(onStart).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
    onStart.mockResolvedValueOnce(true);
    await userEvent.click(startButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("does not mistake session authority for a reviewed bank, and preserves explicit denial", () => {
    learning.diagnostic_blueprint = null;
    const { rerender } = render(view());
    expect(screen.getByText(i18n.t("teacher:adaptive.no_bank"))).toBeVisible();
    expect(startButton()).toBeDisabled();
    learning.diagnostic_blueprint = { id: "fixture-bank", revision: 2, title: "Candidate fixture", dimensions: [], reviewed: false, item_count: 2 };
    rerender(view());
    expect(screen.getByText(i18n.t("teacher:adaptive.bank_candidate"))).toBeVisible();
    expect(startButton()).toBeDisabled();
    learning.diagnostic_blueprint.reviewed = true;
    session.allowed_actions.start_diagnostic = { enabled: false, reason_code: "session_paused" };
    rerender(view());
    expect(startButton()).toBeDisabled(); expect(onStart).not.toHaveBeenCalled();
  });

  it("offers an existing active diagnostic independently of a missing bank and retains read recovery", async () => {
    query.data = undefined; query.isError = true;
    session.active_attempts = [{ attempt_id: "fixture-attempt", scope: "diagnostic", section_id: null, unit_id: null, state: "in_progress" }];
    render(view());
    await userEvent.click(screen.getByRole("button", { name: i18n.t("core:retry") }));
    expect(query.refetch).toHaveBeenCalledOnce(); expect(onStart).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: i18n.t("teacher:resume_diagnostic") }));
    expect(onStart).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
  });

  it("retains cached information on revalidation and blocks stale starts after a read error", () => {
    const { rerender } = render(view());
    query.isFetching = true;
    rerender(view());
    expect(screen.getByText("DNS diagnostic fixture")).toBeVisible();
    expect(startButton()).toBeDisabled();
    query.isFetching = false; query.isError = true;
    rerender(view());
    expect(screen.getByText("DNS diagnostic fixture")).toBeVisible();
    expect(startButton()).toBeDisabled();
  });

  it("blocks duplicate intentions and close while starting, and respects the parent busy lock", async () => {
    let finish!: (success: boolean) => void;
    onStart.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const user = userEvent.setup();
    const { rerender } = render(view());
    await user.dblClick(startButton());
    expect(onStart).toHaveBeenCalledOnce();
    await user.click(screen.getAllByRole("button", { name: i18n.t("core:close") })[0]);
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    finish(false);
    await waitFor(() => expect(startButton()).toBeEnabled());
    rerender(view(true, true));
    expect(startButton()).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});
