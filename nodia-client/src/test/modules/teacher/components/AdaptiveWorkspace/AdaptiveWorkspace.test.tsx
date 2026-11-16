import { useState, type ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdaptiveWorkspace from "../../../../../modules/teacher/components/AdaptiveWorkspace/AdaptiveWorkspace";
import type { AdaptivePanelProps } from "../../../../../modules/teacher/components/AdaptiveWorkspace/types";

const { load, errorToast } = vi.hoisted(() => ({ load: vi.fn(), errorToast: vi.fn() }));
vi.mock("../../../../../modules/teacher/components/AdaptiveWorkspace/loadAdaptivePanel", () => ({
  adaptivePanelKeys: ["sources", "evidence", "review", "activities", "concepts", "clarifications"], loadAdaptivePanel: load,
}));
vi.mock("sileo", () => ({ sileo: { error: errorToast } }));
const sourceVisible = vi.fn();
function SourceEditor(props: AdaptivePanelProps) {
  sourceVisible(props.visible);
  return <textarea aria-label="Source draft" defaultValue="" />;
}
function ReviewEditor() { return <textarea aria-label="Review draft" defaultValue="" />; }
type Props = ComponentProps<typeof AdaptiveWorkspace>;
const props = (): Omit<Props, "open" | "onClose"> => ({
  session: { id: "fixture-session", state: "active" }, command: { isPending: false, uncertain: null },
  busy: false, onResult: vi.fn(), onPractice: vi.fn(),
}) as unknown as Omit<Props, "open" | "onClose">;
function Harness({ input = props(), close = vi.fn() }: { input?: Omit<Props, "open" | "onClose">; close?: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <input aria-label="Page draft" defaultValue="Unrelated page draft" />
    <button onClick={() => setOpen(true)}>Open adaptive workspace</button>
    <AdaptiveWorkspace {...input} open={open} onClose={() => { close(); setOpen(false); }} />
  </>;
}
beforeEach(() => {
  load.mockReset(); errorToast.mockReset(); sourceVisible.mockReset();
  load.mockImplementation(async key => key === "sources" ? SourceEditor : ReviewEditor);
});

describe("adaptive workspace drawer", () => {
  it("loads sources only on intent, retains its editor on close and restores draft and caret", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(load).not.toHaveBeenCalled();
    const opener = screen.getByRole("button", { name: "Open adaptive workspace" });
    await user.click(opener);
    expect(await screen.findByRole("dialog", { name: "Aprendizaje adaptativo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mis fuentes" })).toHaveAttribute("aria-expanded", "true");
    const editor = await screen.findByRole("textbox", { name: "Source draft" }) as HTMLTextAreaElement;
    await user.type(editor, "A source draft stays here");
    editor.setSelectionRange(2, 8); fireEvent.blur(editor);
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(editor.isConnected).toBe(true);
    expect(editor).toHaveValue("A source draft stays here");
    expect(sourceVisible).toHaveBeenLastCalledWith(false);
    expect(opener).toHaveFocus();
    await user.click(opener);
    await waitFor(() => expect(editor).toHaveFocus());
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 8]);
    expect(load).toHaveBeenCalledExactlyOnceWith("sources");
  });

  it("keeps only the selected category visible and starts at sources on every entry without losing other drafts", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open adaptive workspace" }));
    await screen.findByRole("textbox", { name: "Source draft" });
    await user.click(screen.getByRole("button", { name: "Repasar" }));
    const review = await screen.findByRole("textbox", { name: "Review draft" });
    await user.type(review, "Keep this review");
    expect(screen.queryByRole("textbox", { name: "Source draft" })).not.toBeInTheDocument();
    expect(sourceVisible).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Open adaptive workspace" }));
    expect(await screen.findByRole("textbox", { name: "Source draft" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Review draft" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Repasar" }));
    expect(await screen.findByRole("textbox", { name: "Review draft" })).toBe(review);
    expect(review).toHaveValue("Keep this review");
    expect(load.mock.calls.map(([key]) => key)).toEqual(["sources", "review"]);
  });

  it("recovers a failed lazy load locally and leaves the page draft intact", async () => {
    const user = userEvent.setup();
    load.mockRejectedValueOnce(new Error("Synthetic chunk unavailable"));
    render(<Harness />);
    const draft = screen.getByRole("textbox", { name: "Page draft" });
    await user.click(screen.getByRole("button", { name: "Open adaptive workspace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo abrir el panel");
    expect(errorToast).toHaveBeenCalledTimes(1);
    expect(draft).toHaveValue("Unrelated page draft");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("textbox", { name: "Source draft" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("discards late modules after another category or a close becomes the current intent", async () => {
    const user = userEvent.setup();
    let resolveReview!: (value: typeof ReviewEditor) => void;
    load.mockImplementation(key => key === "review" ? new Promise(resolve => { resolveReview = resolve; }) : Promise.resolve(SourceEditor));
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open adaptive workspace" }));
    await screen.findByRole("textbox", { name: "Source draft" });
    await user.click(screen.getByRole("button", { name: "Repasar" }));
    await user.click(screen.getByRole("button", { name: "Mis fuentes" }));
    await act(async () => resolveReview(ReviewEditor));
    expect(screen.queryByRole("textbox", { name: "Review draft", hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Source draft" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Repasar" }));
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => resolveReview(ReviewEditor));
    expect(screen.queryByRole("textbox", { name: "Review draft", hidden: true })).not.toBeInTheDocument();
  });

  it("does not import an old session's pending panel into the next session", async () => {
    let resolveOld!: (value: typeof ReviewEditor) => void;
    load.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const input = props();
    const view = render(<AdaptiveWorkspace {...input} open onClose={vi.fn()} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    view.rerender(<AdaptiveWorkspace {...input} session={{ ...input.session, id: "next-fixture-session" }} open onClose={vi.fn()} />);
    expect(await screen.findByRole("textbox", { name: "Source draft" })).toBeInTheDocument();
    await act(async () => resolveOld(ReviewEditor));
    expect(screen.queryByRole("textbox", { name: "Review draft", hidden: true })).not.toBeInTheDocument();
  });

  it.each(["pending", "uncertain"] as const)("refuses Escape and close while a command is %s", async lock => {
    const user = userEvent.setup(), onClose = vi.fn(), input = props();
    const command = { ...input.command, isPending: lock === "pending", uncertain: lock === "uncertain" ? { requestKey: "fixture-key", method: "POST", path: "sessions/fixture-session/enrichment/commands", body: { operation: "source_create" } } : null } satisfies Props["command"];
    render(<AdaptiveWorkspace {...input} command={command} open onClose={onClose} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Repasar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps reconciliation reachable inside the locked drawer without replay or losing the editor", async () => {
    const user = userEvent.setup(), input = props(), onClose = vi.fn();
    const execute = vi.fn<Props["command"]["execute"]>();
    const ack = { session_id: "fixture-session", revision: 2 };
    const reconcile = vi.fn<Props["command"]["reconcile"]>().mockResolvedValueOnce(null).mockResolvedValueOnce(ack);
    const view = render(<AdaptiveWorkspace {...input} open onClose={onClose} />);
    const editor = await screen.findByRole("textbox", { name: "Source draft" });
    await user.type(editor, "Draft before a lost response");
    const command = { ...input.command, execute, reconcile, uncertain: { requestKey: "same-fixture-request", method: "POST", path: "sessions/fixture-session/enrichment/commands", body: { operation: "source_create" } } } satisfies Props["command"];
    view.rerender(<AdaptiveWorkspace {...input} command={command} open onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Aprendizaje adaptativo" });
    const recover = within(dialog).getByRole("button", { name: "Consultar guardado" });
    expect(recover).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toBeDisabled();
    await user.click(recover);
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    expect(input.onResult).not.toHaveBeenCalled();
    expect(editor).toHaveValue("Draft before a lost response");
    expect(dialog).toBeInTheDocument();
    await user.click(recover);
    await waitFor(() => expect(input.onResult).toHaveBeenCalledExactlyOnceWith(ack));
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(execute).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
