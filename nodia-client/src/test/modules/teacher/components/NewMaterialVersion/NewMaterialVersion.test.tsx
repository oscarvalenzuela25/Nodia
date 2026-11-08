import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewMaterialVersion from "../../../../../modules/teacher/components/NewMaterialVersion";
import RequestRecovery from "../../../../../modules/teacher/components/RequestRecovery";
import type { useTeacherCommand } from "../../../../../modules/teacher/infrastructure/useServices";
import type { CommandResult } from "../../../../../modules/teacher/infrastructure/schemas";

type Command = ReturnType<typeof useTeacherCommand>;
const label = "Generar otra versión del material";
const queued: CommandResult = { session_id: "fixture-session", job_id: "fixture-job", revision: 8 };
const onQueued = vi.fn();
let command: Command;
beforeEach(() => {
  onQueued.mockClear();
  command = {
    execute: vi.fn<Command["execute"]>().mockResolvedValue(null),
    reconcile: vi.fn<Command["reconcile"]>().mockResolvedValue(null),
    refresh: vi.fn<Command["refresh"]>().mockResolvedValue(undefined),
    uncertain: null, isPending: false, blocked: false,
  };
});
function view(extra = {}) {
  return <NewMaterialVersion sessionId="fixture-session" planRevisionId="fixture-plan" unitId="fixture-unit" contentVersionId="fixture-content" sessionRevision={7} busy={false} command={command} onQueued={onQueued} {...extra} />;
}
const confirmButton = () => within(screen.getByRole("dialog")).getByRole("button", { name: label });

describe("explicit new Teacher material version", () => {
  it("opens and cancels without a command, then sends one fixed new-variant intent after confirmation", async () => {
    vi.mocked(command.execute).mockResolvedValue(queued);
    render(view()); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: label }));
    expect(command.execute).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("El material y los intentos anteriores se conservan");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(command.execute).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: label }));
    await user.click(confirmButton());
    await waitFor(() => expect(onQueued).toHaveBeenCalledExactlyOnceWith(queued));
    expect(command.execute).toHaveBeenCalledExactlyOnceWith("sessions/fixture-session/units/fixture-unit/material", { plan_revision_id: "fixture-plan", expected_session_revision: 7, variant: "new" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the confirmation after a known rejection and prevents duplicate confirmation while pending", async () => {
    let finish!: (result: CommandResult | null) => void;
    vi.mocked(command.execute).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(view()); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: label }));
    await user.click(confirmButton());
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(confirmButton());
    expect(command.execute).toHaveBeenCalledOnce();
    await act(async () => { finish(null); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled(); expect(onQueued).not.toHaveBeenCalled();
  });

  it("keeps the original receipt recoverable inside and after explicit dismissal without another POST", async () => {
    const recoveryView = () => <><RequestRecovery command={command} onRecovered={onQueued} />{view()}</>;
    const { rerender } = render(recoveryView()); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: label }));
    await user.click(confirmButton());
    command = { ...command, blocked: true, uncertain: { method: "POST", path: "sessions/fixture-session/units/fixture-unit/material", body: {}, requestKey: "fixture-request" } };
    rerender(recoveryView());
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    const recover = within(screen.getByRole("dialog")).getByRole("button", { name: "Consultar guardado" });
    expect(recover).toBeEnabled();
    await user.click(recover);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(command.uncertain?.requestKey).toBe("fixture-request");
    expect(command.blocked).toBe(true);
    vi.mocked(command.reconcile).mockResolvedValue(queued);
    await user.click(screen.getByRole("button", { name: "Consultar guardado" }));
    await waitFor(() => expect(onQueued).toHaveBeenCalledExactlyOnceWith(queued));
    expect(command.reconcile).toHaveBeenCalledTimes(2);
    expect(command.execute).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not rebase an open confirmation when the session revision changes", async () => {
    const { rerender } = render(view()); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: label }));
    rerender(view({ sessionRevision: 8 }));
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("La sesión cambió");
    fireEvent.click(confirmButton()); expect(command.execute).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: label }));
    await user.click(confirmButton());
    expect(command.execute).toHaveBeenCalledExactlyOnceWith("sessions/fixture-session/units/fixture-unit/material", { plan_revision_id: "fixture-plan", expected_session_revision: 8, variant: "new" });
  });

  it.each(["sessionId", "planRevisionId", "unitId", "contentVersionId"])("discards an obsolete confirmation after %s changes", async field => {
    const { rerender } = render(view());
    await userEvent.click(screen.getByRole("button", { name: label }));
    rerender(view({ [field]: "another-fixture-context" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(command.execute).not.toHaveBeenCalled();
  });

  it("discards a late acknowledgement after its material context has changed", async () => {
    let finish!: (result: CommandResult | null) => void;
    vi.mocked(command.execute).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(view()); const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: label }));
    await user.click(confirmButton());
    rerender(view({ unitId: "another-fixture-unit" }));
    await act(async () => { finish(queued); });
    expect(onQueued).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(command.execute).toHaveBeenCalledOnce();
  });
});
