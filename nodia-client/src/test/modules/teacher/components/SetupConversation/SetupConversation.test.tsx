import { useEffect, type ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SetupConversation from "../../../../../modules/teacher/components/SetupConversation";
import { hasPreparingJob } from "../../../../../modules/teacher/infrastructure/presentation";
import type { Session } from "../../../../../modules/teacher/infrastructure/schemas";
import { SETUP_DRAFT_IDLE_MS, useSetupDraft } from "../../../../../modules/teacher/hooks/useSetupDraft";

vi.mock("../../../../../hooks/useAuth", () => ({ default: () => ({ user: { name: "Fixture Student" } }) }));
type Props = ComponentProps<typeof SetupConversation>;
type History = Props["messages"];
const save = vi.fn<Parameters<typeof useSetupDraft>[0]["onSave"]>();
const onSend = vi.fn(); const onPropose = vi.fn<Props["onPropose"]>(); const onPage = vi.fn();
let history: History;
beforeEach(() => {
  save.mockReset(); save.mockResolvedValue(null); onSend.mockClear(); onPropose.mockReset(); onPropose.mockResolvedValue(true); onPage.mockClear();
  history = { isLoading: false, isFetching: false, isError: false, refetch: vi.fn(), data: { data: [{ id: "fixture-message", role: "assistant", text: "Fixture conversation already sent" }], meta: { page: 1, limit: 50, total_items: 1, total_pages: 1 } } };
});
afterEach(() => vi.useRealTimers());
function Harness({ text = "", revision = 1, messages = history, jobs = [], scopeKey = "fixture-session", contextKey = "fixture-context", hasSelection = true, busy = false, footer, jobStatus, showConversation = true }: {
  text?: string; revision?: number; messages?: History; jobs?: Session["active_jobs"]; scopeKey?: string; contextKey?: string; hasSelection?: boolean; busy?: boolean; footer?: Props["footer"]; jobStatus?: Props["jobStatus"]; showConversation?: boolean;
}) {
  const draft = useSetupDraft({ text, revision, busy, editable: true, onSave: save });
  return <SetupConversation messages={messages} draft={draft} scopeKey={scopeKey} contextKey={contextKey} footer={footer} jobStatus={jobStatus} showConversation={showConversation} page={1} busy={busy} generating={hasPreparingJob(jobs)} hasSelection={hasSelection} canPropose onPage={onPage} onSend={onSend} onPropose={onPropose} />;
}
const input = () => screen.getByRole("textbox", { name: "Mensaje para Teacher" });
const send = () => screen.getByRole("button", { name: "Enviar a Teacher" });
const propose = () => screen.getByRole("button", { name: "Implementar plan" });
const confirmProposal = () => within(screen.getByRole("dialog")).getByRole("button", { name: "Implementar plan" });

describe("Teacher setup conversation actions", () => {
  it("loads history geometry initially and keeps the editor and cached conversation through refetch and read errors", () => {
    const { container, rerender } = render(<Harness text="Synthetic saved preferences" messages={{ ...history, data: undefined, isLoading: true, isFetching: true }} />);
    expect(container.querySelector('[data-boneyard-overlay="true"]')?.childElementCount).toBeGreaterThan(0);
    const editor = input(); expect(editor).toBeDisabled(); expect(editor).toHaveValue("Synthetic saved preferences");
    rerender(<Harness text="Synthetic saved preferences" />);
    expect(input()).toBe(editor); expect(container.querySelector('[data-boneyard-overlay="true"]')).not.toBeInTheDocument();
    const message = screen.getByText("Fixture conversation already sent");
    fireEvent.change(editor, { target: { value: "Synthetic unsaved edit" } });
    rerender(<Harness text="Synthetic saved preferences" messages={{ ...history, isFetching: true }} />);
    expect(input()).toBe(editor); expect(editor).toHaveValue("Synthetic unsaved edit");
    expect(screen.getByText("Fixture conversation already sent")).toBe(message);
    expect(container.querySelector('[data-boneyard-overlay="true"]')).not.toBeInTheDocument();
    rerender(<Harness text="Synthetic saved preferences" messages={{ ...history, isError: true }} />);
    expect(editor).toHaveValue("Synthetic unsaved edit"); expect(message).toBeVisible(); expect(screen.getByRole("alert")).toBeVisible();
    expect(onSend).not.toHaveBeenCalled(); expect(onPropose).not.toHaveBeenCalled();
  });
  it("keeps editing and automatic private saving available while a job blocks new AI intentions", async () => {
    vi.useFakeTimers(); save.mockResolvedValue({ setup_draft_text: "Keep this fixture draft", setup_draft_revision: 2 });
    const pending = { job_id: "fixture-job", purpose: "plan_outline", state: "queued" };
    const { rerender } = render(<Harness jobs={[pending]} />);
    const editor = input(); fireEvent.change(editor, { target: { value: "Keep this fixture draft" } });
    expect(editor).toBeEnabled(); expect(screen.queryByRole("button", { name: "Guardar mensaje" })).not.toBeInTheDocument();
    for (const action of [send(), propose()]) { expect(action).toBeDisabled(); fireEvent.click(action); }
    rerender(<Harness jobs={[{ ...pending, state: "running" }]} />);
    expect(input()).toBe(editor); expect(editor).toHaveValue("Keep this fixture draft");
    await act(async () => vi.advanceTimersByTimeAsync(SETUP_DRAFT_IDLE_MS));
    expect(save).toHaveBeenCalledExactlyOnceWith("Keep this fixture draft", 1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(input()).toHaveValue("Keep this fixture draft");
    expect(onSend).not.toHaveBeenCalled(); expect(onPropose).not.toHaveBeenCalled();
  });
  it("opens a reviewable confirmation after terminal refresh despite a historical unknown", async () => {
    const historical = { job_id: "old-fixture", purpose: "plan_outline", state: "unknown" };
    const pending = { job_id: "current-fixture", purpose: "plan_outline", state: "queued" };
    const { rerender } = render(<Harness jobs={[historical, pending]} />);
    expect(propose()).toBeDisabled(); rerender(<Harness jobs={[historical]} />);
    await userEvent.click(propose()); expect(onPropose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(/Podrás revisarla, seguir conversando y pedir cambios antes de aceptarla/);
    await userEvent.click(confirmProposal()); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onPropose).toHaveBeenCalledOnce(); expect(onSend).not.toHaveBeenCalled();
  });
  it("distinguishes a saved draft from a sent message and requires sending before proposing", async () => {
    render(<Harness text="Saved but unsent fixture preferences" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Mensaje guardado" })).not.toBeInTheDocument();
    expect(screen.queryByText(/El envío guarda primero el borrador/)).not.toBeInTheDocument();
    expect(propose()).toBeDisabled(); fireEvent.click(propose()); expect(onPropose).not.toHaveBeenCalled();
    await userEvent.click(send()); expect(onSend).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled();
  });
  it("retains failed autosave text without replay and offers an explicit save retry", async () => {
    vi.useFakeTimers(); render(<Harness />);
    fireEvent.change(input(), { target: { value: "New fixture preference" } });
    await act(async () => vi.advanceTimersByTimeAsync(SETUP_DRAFT_IDLE_MS));
    expect(save).toHaveBeenCalledExactlyOnceWith("New fixture preference", 1); expect(input()).toHaveValue("New fixture preference");
    expect(screen.getByRole("status")).toHaveTextContent("No se confirmó el guardado");
    await act(async () => vi.advanceTimersByTimeAsync(3000)); expect(save).toHaveBeenCalledOnce();
    save.mockResolvedValueOnce({ setup_draft_text: "New fixture preference", setup_draft_revision: 2 });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reintentar guardado del borrador" })));
    expect(save).toHaveBeenCalledTimes(2); expect(input()).toHaveValue("New fixture preference");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled(); expect(onPropose).not.toHaveBeenCalled();
  });
  it("retains the input node, text and history during revalidation while disabling actions", async () => {
    const { rerender } = render(<Harness />); const editor = input(); await userEvent.type(editor, "Retain this fixture draft");
    rerender(<Harness messages={{ ...history, isFetching: true }} />);
    expect(input()).toBe(editor); expect(editor).toHaveValue("Retain this fixture draft"); expect(editor).toBeDisabled();
    expect(screen.getByText("Fixture conversation already sent")).toBeVisible();
    for (const action of [send(), propose()]) expect(action).toBeDisabled();
    rerender(<Harness />); expect(input()).toBe(editor); expect(editor).toBeEnabled(); expect(editor).toHaveValue("Retain this fixture draft");
  });
  it("shows a history error, blocks AI intentions and retries only the read", async () => {
    history = { ...history, isError: true, data: undefined }; render(<Harness text="Unsent fixture draft" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Aclara aquí el objetivo o pide recomendaciones de organización.")).not.toBeInTheDocument();
    expect(send()).toBeDisabled(); expect(propose()).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(history.refetch).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled(); expect(onSend).not.toHaveBeenCalled();
  });
  it("retains local preferences on a remote conflict and does not propose or send", async () => {
    const { rerender } = render(<Harness text="Original fixture draft" />); await userEvent.type(input(), " local change");
    rerender(<Harness text="Another saved fixture version" revision={2} />);
    expect(input()).toHaveValue("Original fixture draft local change"); expect(screen.getByText("Another saved fixture version")).toBeInTheDocument();
    expect(send()).toBeDisabled(); expect(propose()).toBeDisabled(); expect(onPropose).not.toHaveBeenCalled(); expect(onSend).not.toHaveBeenCalled();
  });
  it("cancels proposal confirmation without generating or losing the conversation", async () => {
    render(<Harness />); await userEvent.click(propose());
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Seguir conversando" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Fixture conversation already sent")).toBeVisible(); expect(input()).toBeEnabled(); expect(onPropose).not.toHaveBeenCalled();
  });
  it("keeps failed proposal confirmation open and permits another explicit confirmation", async () => {
    onPropose.mockResolvedValueOnce(false); render(<Harness />);
    await userEvent.click(propose()); await userEvent.click(confirmProposal());
    expect(screen.getByRole("dialog")).toBeVisible(); await waitFor(() => expect(confirmProposal()).toBeEnabled()); expect(onPropose).toHaveBeenCalledOnce();
    await userEvent.click(confirmProposal()); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(onPropose).toHaveBeenCalledTimes(2);
  });
  it("prevents duplicate proposal submission and locks modal controls while confirming", async () => {
    let resolve: (accepted: boolean) => void = () => {};
    onPropose.mockReturnValueOnce(new Promise<boolean>(done => { resolve = done; }));
    render(<Harness />); await userEvent.click(propose()); const confirm = confirmProposal(); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onPropose).toHaveBeenCalledOnce(); expect(confirm).toBeDisabled(); expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Seguir conversando" })).toBeDisabled();
    await act(async () => resolve(true)); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it.each(["scope", "selection", "history"])("invalidates open proposal confirmation after %s drift", async drift => {
    const { rerender } = render(<Harness />); await userEvent.click(propose());
    const changedHistory: History = { ...history, data: { ...history.data!, data: [...history.data!.data, { id: "new-fixture-message", role: "assistant", text: "Additional fixture response" }] } };
    rerender(<Harness scopeKey={drift === "scope" ? "other-session" : "fixture-session"} contextKey={drift === "selection" ? "new-selection" : "fixture-context"} messages={drift === "history" ? changedHistory : history} />);
    expect(screen.getByRole("dialog")).toHaveTextContent(/La sesión o la conversación cambió/); expect(confirmProposal()).toBeDisabled(); fireEvent.click(confirmProposal()); expect(onPropose).not.toHaveBeenCalled();
  });
  it("accepts the footer and enables send only for a ready applied selection", async () => {
    const { rerender } = render(<Harness text="Fixture preferences" hasSelection={false} footer={<span>Fixture selection footer</span>} />);
    expect(screen.getByText("Fixture selection footer")).toBeVisible(); expect(send()).toBeDisabled(); fireEvent.click(send()); expect(onSend).not.toHaveBeenCalled();
    rerender(<Harness text="Fixture preferences" hasSelection footer={<span>Fixture selection footer</span>} />);
    expect(send()).toBeEnabled(); await userEvent.click(send()); expect(onSend).toHaveBeenCalledOnce();
  });
  it("renders authored bubbles with the teacher mortarboard, without attachments or a save button", () => {
    history = { ...history, data: { ...history.data!, data: [{ id: "fixture-user", role: "user", text: "Fixture student request" }, ...history.data!.data] } };
    const { container } = render(<Harness />); const log = screen.getByRole("log", { name: "Conversación de planificación con Teacher" });
    expect(within(log).getByRole("article", { name: "Tú" })).toHaveTextContent("Fixture student request");
    expect(within(within(log).getByRole("article", { name: "Tú" })).getByRole("img", { name: "Mensaje guardado" })).toBeInTheDocument();
    expect(within(within(log).getByRole("article", { name: "Nodia Teacher" })).queryByRole("img", { name: "Mensaje guardado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(within(log).getByRole("article", { name: "Nodia Teacher" })).toHaveTextContent("Fixture conversation already sent");
    expect(within(log).getByTestId("SchoolOutlinedIcon")).toBeInTheDocument(); expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adjuntar/ })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Guardar mensaje" })).not.toBeInTheDocument();
  });
  it("keeps the job observer mounted while the conversation is hidden for study and reopened for revision", async () => {
    const mounted = vi.fn(); const unmounted = vi.fn();
    function JobProbe() { useEffect(() => { mounted(); return unmounted; }, []); return <span>Fixture observed job</span>; }
    const { rerender } = render(<Harness jobStatus={<JobProbe />} />);
    await userEvent.type(input(), "Retained private preferences");
    rerender(<Harness showConversation={false} jobStatus={<JobProbe />} />);
    expect(screen.getByText("Fixture observed job")).toBeVisible(); expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    rerender(<Harness showConversation jobStatus={<JobProbe />} />);
    expect(input()).toHaveValue("Retained private preferences"); expect(mounted).toHaveBeenCalledOnce(); expect(unmounted).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled(); expect(onPropose).not.toHaveBeenCalled();
  });
  it("marks only confirmed user history as saved while a reply remains queued", async () => {
    history = { ...history, data: { ...history.data!, data: [{ id: "persisted-user", role: "user", text: "Already stored on the server" }, ...history.data!.data] } };
    render(<Harness text="Private unsent preferences" jobs={[{ job_id: "queued-reply", purpose: "setup_reply", state: "queued" }]} jobStatus={<span>Fixture queued response</span>} />);
    expect(screen.getAllByRole("img", { name: "Mensaje guardado" })).toHaveLength(1);
    expect(within(screen.getByRole("article", { name: "Tú" })).getByRole("img", { name: "Mensaje guardado" })).toBeInTheDocument();
    expect(input()).toHaveValue("Private unsent preferences"); expect(send()).toBeDisabled(); expect(propose()).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });

});
