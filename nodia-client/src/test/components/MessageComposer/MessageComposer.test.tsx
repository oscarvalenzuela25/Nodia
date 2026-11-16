import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessageComposer from "../../../components/MessageComposer";
import type { MessageComposerProps } from "../../../components/MessageComposer";
import type { useVoiceDictation } from "../../../hooks/useVoiceDictation";

const capture = vi.hoisted(() => ({
  state: "idle" as "idle" | "requesting" | "listening" | "stopping", supported: true, seconds: 0, stream: null,
  start: vi.fn(), stop: vi.fn(), cancel: vi.fn(), options: vi.fn(), listeners: new Set<() => void>(),
}));
vi.mock("../../../hooks/useVoiceDictation", async () => {
  const { useSyncExternalStore } = await import("react");
  return { useVoiceDictation: (options: Parameters<typeof useVoiceDictation>[0]) => {
    useSyncExternalStore(listener => { capture.listeners.add(listener); return () => capture.listeners.delete(listener); }, () => `${capture.state}:${capture.supported}`);
    capture.options(options); return capture;
  } };
});
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const setCapture = (state: typeof capture.state) => act(() => { capture.state = state; capture.listeners.forEach(listener => listener()); });
let props: MessageComposerProps;
beforeEach(() => {
  vi.clearAllMocks(); capture.state = "idle"; capture.supported = true;
  props = { scopeKey: "synthetic-actor/course", text: "A draft", onTextChange: vi.fn(), onSend: vi.fn(), maxBytes: 8192, maxLength: 4000,
    label: "Mensaje de prueba", placeholder: "Escribe", sendLabel: "Enviar prueba" };
});
function Controlled({ value }: { value: MessageComposerProps }) {
  const [text, setText] = useState(value.text);
  return <MessageComposer {...value} text={text} onTextChange={next => { setText(next); value.onTextChange(next); }} />;
}

describe("shared message composer", () => {
  it("preserves the input and a single action owner when opting into stacked controls", async () => {
    const attach = vi.fn(), stop = vi.fn();
    const toolbarStart = <button type="button" onClick={attach}>Adjuntar sintético</button>;
    const view = render(<MessageComposer {...props} toolbarStart={toolbarStart} />);
    const input = screen.getByRole("textbox", { name: props.label });
    input.focus();
    view.rerender(<MessageComposer {...props} layout="stacked" toolbarStart={toolbarStart} />);
    expect(screen.getByRole("textbox", { name: props.label })).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue(props.text);
    expect(screen.getAllByRole("button", { name: props.sendLabel })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Dictar mensaje" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Adjuntar sintético" }));
    expect(attach).toHaveBeenCalledOnce();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSend).toHaveBeenCalledOnce();
    view.rerender(<MessageComposer {...props} layout="stacked" disabled toolbarStart={toolbarStart}
      sendAction={<button type="button" onClick={stop}>Detener turno apilado</button>} />);
    expect(screen.getByRole("textbox", { name: props.label })).toBe(input);
    expect(screen.queryByRole("button", { name: props.sendLabel })).not.toBeInTheDocument();
    fireEvent.submit(input.closest("form")!);
    await userEvent.click(screen.getByRole("button", { name: "Detener turno apilado" }));
    expect(stop).toHaveBeenCalledOnce();
    expect(props.onSend).toHaveBeenCalledOnce();
  });
  it("sends Enter once, retains Shift+Enter, and does not submit IME or held-key events", async () => {
    render(<Controlled value={props} />);
    const input = screen.getByRole("textbox", { name: props.label });
    await userEvent.click(input); await userEvent.keyboard("{End}{Shift>}{Enter}{/Shift}");
    expect(input).toHaveValue("A draft\n"); expect(props.onSend).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(input, { key: "Enter", isComposing: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "Enter", keyCode: 229 })).toBe(true);
    fireEvent.keyDown(input, { key: "Enter", repeat: true }); expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" }); expect(props.onSend).toHaveBeenCalledOnce();
    expect(input).toHaveValue("A draft\n");
  });
  it("blocks sending while an owner keeps editing and private saving available", async () => {
    const save = vi.fn();
    render(<Controlled value={{ ...props, sendDisabled: true, footer: <button type="button" onClick={save}>Guardar borrador</button> }} />);
    const input = screen.getByRole("textbox", { name: props.label });
    await userEvent.type(input, " kept"); expect(input).toHaveValue("A draft kept");
    fireEvent.keyDown(input, { key: "Enter" }); fireEvent.submit(screen.getByRole("form", { name: props.label }));
    expect(screen.getByRole("button", { name: props.sendLabel })).toBeDisabled(); expect(props.onSend).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" })); expect(save).toHaveBeenCalledOnce();
  });
  it("preserves an oversized value for correction and checks bytes independently from UTF-16 length", () => {
    const { rerender } = render(<MessageComposer {...props} text="A🙂" maxLength={2} />);
    const input = screen.getByRole("textbox", { name: props.label });
    expect(input).toHaveValue("A🙂"); expect(input).toBeEnabled();
    expect(screen.getByRole("button", { name: props.sendLabel })).toBeDisabled();
    rerender(<MessageComposer {...props} text="A🙂" maxLength={3} maxBytes={4} />);
    expect(screen.getByRole("button", { name: props.sendLabel })).toBeDisabled();
    rerender(<MessageComposer {...props} text="A🙂" maxLength={3} maxBytes={5} />);
    expect(screen.getByRole("button", { name: props.sendLabel })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: props.label })).toBe(input);
    expect(props.onTextChange).not.toHaveBeenCalled();
  });
  it("replaces Send with an owner's stop control and blocks form or Enter admission without remounting the draft", async () => {
    const stop = vi.fn();
    const view = render(<MessageComposer {...props} />);
    const input = screen.getByRole("textbox", { name: props.label });
    view.rerender(<MessageComposer {...props} disabled sendAction={<button type="button" onClick={stop}>Detener turno sintético</button>} />);
    expect(screen.queryByRole("button", { name: props.sendLabel })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: props.label })).toBe(input);
    expect(input).toHaveValue(props.text);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.submit(input.closest("form")!);
    await userEvent.click(screen.getByRole("button", { name: "Detener turno sintético" }));
    expect(stop).toHaveBeenCalledOnce();
    expect(props.onSend).not.toHaveBeenCalled();
    view.rerender(<MessageComposer {...props} />);
    expect(screen.getByRole("textbox", { name: props.label })).toBe(input);
    expect(screen.getByRole("button", { name: props.sendLabel })).toBeEnabled();
  });
  it("keeps explicit receipt recovery available without letting Enter resend locked input", async () => {
    render(<MessageComposer {...props} inputDisabled voiceDisabled submitOnEnter={false} sendLabel="Comprobar envío" />);
    const input = screen.getByRole("textbox", { name: props.label }); expect(input).toBeDisabled();
    fireEvent.keyDown(input, { key: "Enter" }); expect(props.onSend).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Comprobar envío" })); expect(props.onSend).toHaveBeenCalledOnce();
    expect(input).toHaveValue(props.text);
  });
  it("cancels a permission request and keeps Finish available until native finalization starts", async () => {
    const recording = vi.fn(); setCapture("requesting");
    render(<MessageComposer {...props} onRecordingChange={recording} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar dictado" })); expect(capture.cancel).toHaveBeenCalledOnce();
    setCapture("listening");
    expect(screen.getByRole("textbox", { name: props.label })).toBeDisabled(); expect(screen.getByRole("button", { name: props.sendLabel })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Terminar dictado" })); expect(capture.stop).toHaveBeenCalledOnce();
    setCapture("stopping"); expect(screen.getByRole("button", { name: "Terminar dictado" })).toBeDisabled();
    expect(recording).toHaveBeenLastCalledWith(true); expect(props.onSend).not.toHaveBeenCalled();
  });
  it("uses owner context and limits without attachments, and preserves typed sending when voice is unavailable", async () => {
    capture.supported = false;
    const { rerender } = render(<MessageComposer {...props} beforeInput={<span>Contexto visible</span>} toolbarStart={<span>Acción propia</span>} />);
    expect(capture.options).toHaveBeenLastCalledWith(expect.objectContaining({ scopeKey: props.scopeKey, text: props.text, maxLength: 4000, maxBytes: 8192 }));
    expect(screen.getByText("Contexto visible")).toBeVisible(); expect(screen.getByText("Acción propia")).toBeVisible();
    expect(screen.getByRole("button", { name: "Dictar mensaje" })).toBeDisabled(); expect(capture.start).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: props.sendLabel })); expect(props.onSend).toHaveBeenCalledOnce();
    rerender(<MessageComposer {...props} scopeKey="synthetic-actor/other-course" />);
    expect(capture.options).toHaveBeenLastCalledWith(expect.objectContaining({ scopeKey: "synthetic-actor/other-course" }));
  });
});
