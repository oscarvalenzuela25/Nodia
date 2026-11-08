import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConversationTitle from "../../../../../modules/nodiaAi/components/ConversationTitle";
import type { ConversationTitleProps } from "../../../../../modules/nodiaAi/components/ConversationTitle";
import { conversation } from "../../infrastructure/fixtures";

let props: ConversationTitleProps;
beforeEach(() => {
  props = {
    conversation: { conversation_id: conversation.conversation_id, title: "Título original", revision: 1 },
    disabled: false, readOnly: false, busy: false, error: null,
    onSave: vi.fn().mockResolvedValue(undefined), onRefresh: vi.fn().mockResolvedValue(null),
  };
});

describe("ConversationTitle", () => {
  it("edits inline and saves a trimmed title with the revision captured on open", async () => {
    const user = userEvent.setup();
    render(<ConversationTitle {...props} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Título original");
    await user.click(screen.getByRole("button", { name: "Renombrar" }));
    const input = screen.getByRole("textbox", { name: "Título de la conversación" });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "  Mi título  ");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith("Mi título", 1));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Renombrar" })).toHaveFocus();
  });

  it("keeps a rejected draft through refetch and adopts a new revision only after explicit review", async () => {
    const user = userEvent.setup();
    props.onSave = vi.fn().mockRejectedValueOnce(new Error("synthetic conflict")).mockResolvedValue(undefined);
    const latest = { ...props.conversation, title: "Actualizado en otra sesión", revision: 2 };
    props.onRefresh = vi.fn().mockResolvedValue(latest);
    const view = render(<ConversationTitle {...props} />);
    await user.click(screen.getByRole("button", { name: "Renombrar" }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Mi borrador");
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
    view.rerender(<ConversationTitle {...props} conversation={latest} error="Conflicto sintético" />);
    expect(screen.getByRole("textbox")).toHaveValue("Mi borrador");
    expect(screen.getByRole("alert")).toHaveTextContent("Conflicto sintético");
    expect(screen.getByRole("button", { name: "Guardar título" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("form", { name: "Renombrar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Revisar estado actual" })).toBeEnabled());
    expect(props.onSave).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Revisar estado actual" }));
    await waitFor(() => expect(screen.getByText("Título actual: Actualizado en otra sesión")).toBeInTheDocument());
    expect(screen.getByRole("textbox")).toHaveValue("Mi borrador");
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    await waitFor(() => expect(props.onSave).toHaveBeenLastCalledWith("Mi borrador", 2));
  });

  it("validates UTF-8 bytes and allows an explicitly empty title as null", async () => {
    const user = userEvent.setup();
    render(<ConversationTitle {...props} />);
    await user.click(screen.getByRole("button", { name: "Renombrar" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ñ".repeat(129) } });
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    expect(await screen.findByText("El título admite hasta 256 bytes UTF-8.")).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(null, 1));
  });

  it("cancels with Escape without blur-save and hides a previous attempt error on reopening", async () => {
    const user = userEvent.setup();
    props.onSave = vi.fn().mockRejectedValue(new Error("synthetic failure"));
    const view = render(<><ConversationTitle {...props} /><button>Fuera del editor</button></>);
    await user.click(screen.getByRole("button", { name: "Renombrar" }));
    await user.type(screen.getByRole("textbox"), " sin guardar");
    await user.click(screen.getByRole("button", { name: "Fuera del editor" }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("Título original sin guardar");
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
    view.rerender(<><ConversationTitle {...props} error="Error anterior" /><button>Fuera del editor</button></>);
    expect(screen.getByRole("alert")).toHaveTextContent("Error anterior");
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Renombrar" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Renombrar" }));
    expect(screen.getByRole("textbox")).toHaveValue("Título original");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("guards simultaneous saves and keeps the editor locked until the same request resolves", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    props.onSave = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    render(<ConversationTitle {...props} />);
    await user.click(screen.getByRole("button", { name: "Renombrar" }));
    const form = screen.getByRole("form", { name: "Renombrar" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await act(async () => { resolve(); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Renombrar" })).toHaveFocus());
  });

  it("ignores IME commits and repeated Enter, then accepts an explicit Enter", async () => {
    const user = userEvent.setup();
    render(<ConversationTitle {...props} />);
    await user.click(screen.getByRole("button", { name: "Renombrar" }));
    const input = screen.getByRole("textbox");
    const form = screen.getByRole("form", { name: "Renombrar" });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.submit(form);
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    fireEvent.submit(form);
    fireEvent.keyDown(input, { key: "Enter", repeat: true });
    expect(props.onSave).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
  });

  it("does not adopt a refresh from another conversation", async () => {
    const user = userEvent.setup();
    props.onRefresh = vi.fn().mockResolvedValue({ ...props.conversation, conversation_id: "other-conversation", title: "Ajeno", revision: 3 });
    const view = render(<ConversationTitle {...props} />);
    await user.click(screen.getByRole("button", { name: "Renombrar" }));
    view.rerender(<ConversationTitle {...props} conversation={{ ...props.conversation, revision: 2 }} />);
    await user.click(screen.getByRole("button", { name: "Revisar estado actual" }));
    await waitFor(() => expect(props.onRefresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("textbox")).toBeEnabled());
    expect(screen.getByRole("textbox")).toHaveValue("Título original");
    expect(screen.queryByText(/Título actual:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar título" })).toBeDisabled();
  });

  it("removes editing actions on read-only revocation and ignores a late save result", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    props.onSave = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    const view = render(<ConversationTitle {...props} />);
    await user.click(screen.getByRole("button", { name: "Renombrar" }));
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
    view.rerender(<ConversationTitle {...props} readOnly />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await act(async () => { resolve(); });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Título original");
    view.rerender(<ConversationTitle {...props} />);
    expect(screen.getByRole("button", { name: "Renombrar" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
