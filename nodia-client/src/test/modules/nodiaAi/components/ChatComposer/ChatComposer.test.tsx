import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatComposer from "../../../../../modules/nodiaAi/components/ChatComposer";
import type { ChatComposerProps } from "../../../../../modules/nodiaAi/components/ChatComposer/types";
import type { AttachmentPanelProps } from "../../../../../modules/nodiaAi/components/Attachments/types";
import { chatId } from "../../infrastructure/fixtures";
import type { useVoiceDictation } from "../../../../../modules/nodiaAi/components/ChatComposer/hooks/useVoiceDictation";

const voice = vi.hoisted(() => ({
  state: "idle" as "idle" | "requesting" | "listening" | "stopping",
  supported: true,
  seconds: 61,
  stream: null,
  listeners: new Set<() => void>(),
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
}));
const review = vi.hoisted(() => vi.fn());
const dictation = vi.hoisted(() => vi.fn());
vi.mock("../../../../../hooks/useVoiceDictation", async () => {
  const { useSyncExternalStore } = await import("react");
  return { useVoiceDictation: (options: Parameters<typeof useVoiceDictation>[0]) => {
    useSyncExternalStore(listener => { voice.listeners.add(listener); return () => voice.listeners.delete(listener); }, () => `${voice.state}:${voice.supported}:${voice.seconds}`);
    dictation(options); return voice;
  } };
});
const setVoiceState = (state: typeof voice.state) => act(() => { voice.state = state; voice.listeners.forEach(listener => listener()); });
vi.mock("../../../../../modules/nodiaAi/components/Attachments", () => ({
  default: (props: AttachmentPanelProps) => {
    review(props);
    return <div>{props.draft.entries.map(entry => entry.file.name).join(", ")}</div>;
  },
}));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

// Synthetic policy and files; media devices, upload transport and inference never run.
const policy = {
  limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 50, image_pixels: 40000000 },
  reviewed_text: true as const,
  native_modalities: { image: null, pdf: null, audio: null },
};
let draft: AttachmentPanelProps["draft"];
let props: ChatComposerProps;
beforeEach(() => {
  vi.clearAllMocks();
  voice.state = "idle";
  voice.supported = true;
  draft = {
    entries: [], busy: false, parts: [], reviewedTextBytes: 0, ready: true,
    add: vi.fn(), upload: vi.fn(), review: vi.fn(), remove: vi.fn(), edit: vi.fn(), clear: vi.fn(), resetReview: vi.fn(),
    capabilities: { data: policy, isFetching: false, isError: false },
    enableCapabilities: vi.fn(), refreshCapabilities: vi.fn(),
    admission: undefined, admissionInFlight: false, reserveAdmission: vi.fn(), settleAdmission: vi.fn(), dismissRejectedAdmission: vi.fn(),
  };
  props = {
    conversationId: chatId, conversationRevision: 4, text: "Borrador preservado",
    onTextChange: vi.fn(), draft, disabled: false, sendDisabled: false, recovering: false, textTooLarge: false,
    onSend: vi.fn(), onRecordingChange: vi.fn(), footer: <span>Selección sintética</span>,
  };
});

function ControlledComposer({ value }: { value: ChatComposerProps }) {
  const [text, setText] = useState(value.text);
  return <ChatComposer {...value} text={text} onTextChange={next => { setText(next); value.onTextChange(next); }} />;
}

describe("ChatComposer", () => {
  it("routes pasted files through the existing attachment draft without submitting or replacing text", () => {
    render(<ChatComposer {...props} />);
    const file = new File(["synthetic image"], "pegada.png", { type: "image/png" });
    const normalPaste = fireEvent.paste(screen.getByRole("textbox", { name: "Mensaje" }), {
      clipboardData: { files: [file], getData: () => "Texto del portapapeles" },
    });
    expect(normalPaste).toBe(false);
    expect(draft.add).toHaveBeenCalledWith([file]);
    expect(props.onSend).not.toHaveBeenCalled();
    expect(props.onTextChange).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue(props.text);
    expect(draft.enableCapabilities).toHaveBeenCalledTimes(1);
  });

  it("keeps ordinary text paste editable and unchanged by the file handler", async () => {
    const user = userEvent.setup();
    render(<ControlledComposer value={{ ...props, text: "" }} />);
    const editor = screen.getByRole("textbox", { name: "Mensaje" });
    await user.click(editor);
    await user.paste("Texto pegado\ncon 0 y acentos: envío");
    expect(editor).toHaveValue("Texto pegado\ncon 0 y acentos: envío");
    expect(draft.add).not.toHaveBeenCalled();
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("opens the attachment menu before the file picker and passes chosen files through validation", async () => {
    const user = userEvent.setup();
    render(<ChatComposer {...props} />);
    const input = screen.getByLabelText("Elegir archivos", { selector: "input" });
    const click = vi.spyOn(input, "click");
    const trigger = screen.getByRole("button", { name: "Añadir al mensaje" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Añadir al mensaje" })).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
    await user.click(screen.getByRole("menuitem", { name: "Adjuntar archivo" }));
    expect(click).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const file = new File(["synthetic PDF"], "documento.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(draft.add).toHaveBeenCalledWith([file]);
    expect(props.onSend).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it("opens the add menu by keyboard and restores focus on Escape without changing the draft", async () => {
    const user = userEvent.setup();
    render(<ChatComposer {...props} />);
    const trigger = screen.getByRole("button", { name: "Añadir al mensaje" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitem", { name: "Adjuntar archivo" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue(props.text);
    expect(draft.add).not.toHaveBeenCalled();
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("keeps Finish available during dictation while disabling text, files and send", async () => {
    const user = userEvent.setup();
    const view = render(<ChatComposer {...props} />);
    await user.click(screen.getByRole("button", { name: "Dictar mensaje" }));
    expect(voice.start).toHaveBeenCalledTimes(1);
    setVoiceState("listening");
    view.rerender(<ChatComposer {...props} sendDisabled />);
    expect(screen.getByRole("button", { name: "Terminar dictado" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Añadir al mensaje" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBeDisabled();
    expect(screen.getByText("Escuchando · 1:01")).toHaveAttribute("role", "status");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensaje" }), { key: "Enter" });
    await user.click(screen.getByRole("button", { name: "Terminar dictado" }));
    expect(voice.stop).toHaveBeenCalledTimes(1);
    expect(props.onRecordingChange).toHaveBeenLastCalledWith(true);
    expect(props.onSend).not.toHaveBeenCalled();
    expect(draft.add).not.toHaveBeenCalled();
  });

  it("lets a pending permission request be canceled and keeps finalization locked", async () => {
    const user = userEvent.setup();
    setVoiceState("requesting");
    const view = render(<ChatComposer {...props} />);
    await user.click(screen.getByRole("button", { name: "Cancelar dictado" }));
    expect(voice.cancel).toHaveBeenCalledOnce();
    setVoiceState("stopping");
    view.rerender(<ChatComposer {...props} />);
    expect(screen.getByRole("button", { name: "Terminar dictado" })).toBeDisabled();
    expect(screen.getByText("Terminando dictado…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
  });

  it("treats recognized words as editable text without adding a file or submitting", () => {
    render(<ControlledComposer value={props} />);
    const options = dictation.mock.lastCall?.[0] as Parameters<typeof useVoiceDictation>[0];
    expect(options).toMatchObject({ enabled: true, scopeKey: chatId, text: props.text, maxBytes: 32768 });
    act(() => options.onTextChange(`${props.text} palabras dictadas`));
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue(`${props.text} palabras dictadas`);
    fireEvent.change(screen.getByRole("textbox", { name: "Mensaje" }), { target: { value: "Texto revisado" } });
    expect(props.onTextChange).toHaveBeenLastCalledWith("Texto revisado");
    expect(draft.add).not.toHaveBeenCalled();
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("preserves text and a failed attachment when an unsuccessful send is reflected back", async () => {
    const user = userEvent.setup();
    draft.entries = [{
      localId: "synthetic-local-file", clientRequestId: "synthetic-upload-key",
      file: new File(["synthetic PDF"], "conservar.pdf", { type: "application/pdf" }), attachment: null,
      text: "Texto de revisión conservado", progress: 0, busy: false, uncertain: false, error: "upload_error",
    }];
    const view = render(<ChatComposer {...props} />);
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(props.onSend).toHaveBeenCalledTimes(1);
    view.rerender(<ChatComposer {...props} sendDisabled />);
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue(props.text);
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /1 archivo/ }));
    expect(screen.getByText("conservar.pdf")).toBeInTheDocument();
    expect(review).toHaveBeenLastCalledWith(expect.objectContaining({ draft, reviewOnly: true, conversationId: chatId, conversationRevision: 4 }));
    expect(draft.clear).not.toHaveBeenCalled();
  });

  it("blocks click, native submit, file paste and keyboard sends while configuration is disabled or dirty", () => {
    render(<ChatComposer {...props} disabled />);
    const editor = screen.getByRole("textbox", { name: "Mensaje" });
    expect(editor).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dictar mensaje" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Añadir al mensaje" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    fireEvent.keyDown(editor, { key: "Enter" });
    fireEvent.submit(screen.getByRole("form", { name: "Escribir un mensaje" }));
    fireEvent.paste(editor, { clipboardData: { files: [new File(["image"], "blocked.png", { type: "image/png" })] } });
    expect(props.onSend).not.toHaveBeenCalled();
    expect(draft.add).not.toHaveBeenCalled();
  });

  it("allows explicit recovery of an uncertain admission while keeping the original text locked", async () => {
    const user = userEvent.setup();
    render(<ChatComposer {...props} disabled recovering />);
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue(props.text);
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensaje" }), { key: "Enter" });
    expect(props.onSend).not.toHaveBeenCalled();
    const recover = screen.getByRole("button", { name: "Comprobar el mismo envío" });
    expect(recover).toBeEnabled();
    await user.click(recover);
    expect(props.onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue(props.text);
    expect(draft.clear).not.toHaveBeenCalled();
  });

  it("sends with Enter once and preserves Shift+Enter as a newline", async () => {
    const user = userEvent.setup();
    render(<ControlledComposer value={props} />);
    const editor = screen.getByRole("textbox", { name: "Mensaje" });
    await user.click(editor);
    await user.keyboard("{End}{Shift>}{Enter}{/Shift}");
    expect(editor).toHaveValue(`${props.text}\n`);
    expect(props.onSend).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(props.onSend).toHaveBeenCalledTimes(1);
    expect(editor).toHaveValue(`${props.text}\n`);
  });

  it("does not send an IME commit or a held Enter key", () => {
    render(<ChatComposer {...props} />);
    const editor = screen.getByRole("textbox", { name: "Mensaje" });
    expect(fireEvent.keyDown(editor, { key: "Enter", isComposing: true })).toBe(true);
    expect(fireEvent.keyDown(editor, { key: "Enter", keyCode: 229 })).toBe(true);
    expect(fireEvent.keyDown(editor, { key: "Enter", repeat: true })).toBe(false);
    expect(props.onSend).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(editor, { key: "Enter" })).toBe(false);
    expect(props.onSend).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(editor, { key: "Enter", repeat: true });
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it.each(["validation", "attachments", "capabilities", "text_limit"] as const)("retains send guards for keyboard and submit during %s blocking", reason => {
    if (reason === "attachments") draft.busy = true;
    if (reason === "capabilities") draft.capabilities.isFetching = true;
    render(<ChatComposer {...props} sendDisabled={reason === "validation"} textTooLarge={reason === "text_limit"} />);
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensaje" }), { key: "Enter" });
    fireEvent.submit(screen.getByRole("form", { name: "Escribir un mensaje" }));
    expect(props.onSend).not.toHaveBeenCalled();
    expect(draft.clear).not.toHaveBeenCalled();
  });
});
