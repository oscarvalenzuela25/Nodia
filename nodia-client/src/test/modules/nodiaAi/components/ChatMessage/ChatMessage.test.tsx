import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import i18n from "../../../../../translate";
import ChatMessage from "../../../../../modules/nodiaAi/components/ChatMessage";
import type { NodiaAiMessage } from "../../../../../modules/nodiaAi/infrastructure/types";
import useAuthStore from "../../../../../store/authStore";
import { chatId, messageId, runId } from "../../infrastructure/fixtures";

const views = vi.hoisted(() => ({ attachment: vi.fn(), historical: vi.fn() }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../modules/nodiaAi/components/Attachments/AttachmentMessage", () => ({
  default: (props: { id: string; kind: string; conversationId: string }) => {
    views.attachment(props);
    return <span>{`attachment:${props.id}`}</span>;
  },
}));
vi.mock("../../../../../modules/nodiaAi/components/ExecutionObservation", () => ({
  HistoricalObservation: (props: { runId: string; conversationId: string }) => {
    views.historical(props);
    return <span>{`historical:${props.runId}`}</span>;
  },
}));

// Synthetic message and attachment identifiers; no provider calls or private files.
const attachmentId = "44444444-4444-4444-8444-444444444444";
const message: NodiaAiMessage = {
  message_id: messageId,
  run_id: runId,
  seq: "1",
  role: "user",
  status: "sealed",
  created_at: "2026-10-28T14:15:00.000Z",
  visibility: "visible",
  author_user_id: "9",
  sealed_at: "2026-10-28T14:15:00.000Z",
  parts: [{ kind: "text", text: "Consulta sintética" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null });
});

describe("ChatMessage", () => {
  it("copies only the displayed answer after keyboard activation and confirms a fulfilled clipboard write", async () => {
    const user = userEvent.setup();
    let complete!: () => void;
    const writeText = vi.fn().mockReturnValue(new Promise<void>(resolve => { complete = resolve; }));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<ChatMessage message={{ ...message, role: "assistant", status: "partial", parts: [
      { kind: "text", text: "**Resumen sintético**" },
    ] }} conversationId={chatId} />);
    const button = screen.getByRole("button", { name: "Copiar respuesta" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(writeText).toHaveBeenCalledWith("Resumen sintético");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(sileo.success).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Respuesta parcial");
    await act(async () => complete());
    expect(button).toBeEnabled();
    expect(sileo.success).toHaveBeenCalledWith({ title: "Respuesta copiada" });
    expect(views.historical).toHaveBeenCalledWith({ conversationId: chatId, runId });
  });

  it.each(["unavailable", "denied"])("preserves selectable answer text and gives manual guidance when clipboard is %s", async scenario => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: scenario === "denied" ? { writeText } : undefined });
    render(<ChatMessage message={{ ...message, role: "assistant" }} conversationId={chatId} currentRunId={runId} />);
    await user.click(screen.getByRole("button", { name: "Copiar respuesta" }));
    await waitFor(() => expect(sileo.error).toHaveBeenCalledWith({
      title: "No pudimos copiar la respuesta", description: "Selecciona el texto de la respuesta y cópialo manualmente.",
    }));
    expect(screen.getByText("Consulta sintética")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar respuesta" })).toBeEnabled();
    expect(sileo.success).not.toHaveBeenCalled();
  });

  it("offers no copy action for restricted, user, unknown-role or attachment-only messages", () => {
    const view = render(<ChatMessage message={message} conversationId={chatId} />);
    expect(screen.queryByRole("button", { name: "Copiar respuesta" })).not.toBeInTheDocument();
    view.rerender(<ChatMessage message={{ ...message, role: "tool" }} conversationId={chatId} currentRunId={runId} />);
    expect(screen.queryByRole("button", { name: "Copiar respuesta" })).not.toBeInTheDocument();
    view.rerender(<ChatMessage message={{ message_id: messageId, run_id: runId, seq: "1", role: "assistant", status: "sealed",
      created_at: message.created_at, visibility: "restricted" }} conversationId={chatId} />);
    expect(screen.queryByRole("button", { name: "Copiar respuesta" })).not.toBeInTheDocument();
    view.rerender(<ChatMessage message={{ ...message, role: "assistant", parts: [{ kind: "image", attachment_id: attachmentId, text: null }] }} conversationId={chatId} currentRunId={runId} />);
    expect(screen.queryByRole("button", { name: "Copiar respuesta" })).not.toBeInTheDocument();
    expect(views.attachment).toHaveBeenCalledWith({ id: attachmentId, kind: "image", conversationId: chatId });
  });

  it("translates the copy control and feedback in English", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await i18n.changeLanguage("en");
    render(<ChatMessage message={{ ...message, role: "assistant" }} conversationId={chatId} currentRunId={runId} />);
    await user.click(screen.getByRole("button", { name: "Copy response" }));
    expect(sileo.success).toHaveBeenCalledWith({ title: "Response copied" });
  });

  it("uses the authenticated profile image only for the user's messages", () => {
    useAuthStore.setState({ user: { id: "9", name: "Óscar", email: "synthetic@example.invalid", image_url: "https://example.invalid/profile.png" } });
    const view = render(<ChatMessage message={message} conversationId={chatId} />);
    expect(view.container.querySelector("img")).toHaveAttribute("src", "https://example.invalid/profile.png");
    expect(view.container.querySelector("img")).toHaveAttribute("alt", "Óscar");
    view.rerender(<ChatMessage message={{ ...message, role: "assistant" }} conversationId={chatId} currentRunId={runId} />);
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.getByRole("article", { name: "NodiaAI" })).toHaveTextContent("N");
  });

  it.each([
    { name: "óscar", email: "synthetic@example.invalid", image_url: null, initial: "Ó" },
    { name: "", email: "synthetic@example.invalid", image_url: undefined, initial: "S" },
    { name: "", email: "", image_url: "", initial: "?" },
  ])("uses the Topbar initial fallback when the profile image is absent: $initial", ({ initial, ...user }) => {
    useAuthStore.setState({ user });
    const view = render(<ChatMessage message={message} conversationId={chatId} />);
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.getByText(initial)).toBeInTheDocument();
  });

  it("recovers the same initial when the profile image fails to load", () => {
    const OriginalImage = globalThis.Image;
    const imageLoads: HTMLImageElement[] = [];
    vi.stubGlobal("Image", class extends OriginalImage {
      constructor() { super(); imageLoads.push(this); }
    });
    useAuthStore.setState({ user: { name: "Óscar", image_url: "https://example.invalid/unavailable.png" } });
    const view = render(<ChatMessage message={message} conversationId={chatId} />);
    expect(view.container.querySelector("img")).not.toBeNull();
    fireEvent.error(imageLoads[0]);
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.getByText("Ó")).toBeInTheDocument();
  });

  it("identifies each author and displays the recorded timestamp without inventing execution metrics", () => {
    const view = render(<ChatMessage message={message} conversationId={chatId} />);
    expect(screen.getByRole("article", { name: "Tú" })).toHaveTextContent("Consulta sintética");
    expect(view.container.querySelector("time")).toHaveAttribute("dateTime", message.created_at);
    expect(views.historical).not.toHaveBeenCalled();
    view.rerender(<ChatMessage message={{ ...message, role: "assistant" }} conversationId={chatId} currentRunId={runId} />);
    expect(screen.getByRole("article", { name: "NodiaAI" })).toHaveTextContent("Consulta sintética");
    expect(views.historical).not.toHaveBeenCalled();
  });

  it("hides restricted text, attachment access and historical results", () => {
    const restricted: NodiaAiMessage = {
      message_id: messageId, run_id: runId, seq: "1", role: "assistant", status: "sealed",
      created_at: message.created_at, visibility: "restricted",
    };
    render(<ChatMessage message={restricted} conversationId={chatId} />);
    expect(screen.getByText("Este mensaje contiene información que tus permisos actuales no permiten consultar.")).toBeInTheDocument();
    expect(screen.queryByText("Consulta sintética")).not.toBeInTheDocument();
    expect(views.attachment).not.toHaveBeenCalled();
    expect(views.historical).not.toHaveBeenCalled();
  });

  it("keeps reviewed attachment text and scopes historical observations to the original conversation and run", () => {
    render(<ChatMessage message={{ ...message, role: "assistant", parts: [
      { kind: "text", text: "Resumen sintético" },
      { kind: "audio", attachment_id: attachmentId, text: "Transcripción revisada" },
    ] }} conversationId={chatId} />);
    expect(screen.getByText("Resumen sintético")).toBeInTheDocument();
    expect(screen.getByText("Transcripción revisada")).toBeInTheDocument();
    expect(views.attachment).toHaveBeenCalledWith({ id: attachmentId, kind: "audio", conversationId: chatId });
    expect(views.historical).toHaveBeenCalledWith({ conversationId: chatId, runId });
  });

  it("preserves the partial-response warning and keeps raw provider HTML inert as text", () => {
    const view = render(<ChatMessage message={{ ...message, role: "assistant", status: "partial", parts: [
      { kind: "text", text: '<img src="private" onerror="alert(1)">\nTexto preservado' },
    ] }} conversationId={chatId} currentRunId={runId} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Respuesta parcial: este mensaje no se completó.");
    expect(screen.getByRole("article", { name: "NodiaAI" })).toHaveTextContent("Texto preservado");
    expect(screen.getByText(/<img src=/)).toBeInTheDocument();
    expect(view.container.querySelector("img")).toBeNull();
  });

  it("formats only assistant text parts, preserves consecutive Markdown, and keeps user/reviewed text literal", () => {
    const view = render(<ChatMessage message={{ ...message, role: "assistant", parts: [
      { kind: "text", text: "| Producto | Cantidad |\n| --- | --- |" },
      { kind: "text", text: "| Sintético | 0 |" },
      { kind: "audio", attachment_id: attachmentId, text: "# Transcripción literal **sin formato**" },
      { kind: "text", text: "## Conclusión" },
    ] }} conversationId={chatId} currentRunId={runId} />);
    expect(screen.getByRole("cell", { name: "Sintético" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Conclusión" })).toBeInTheDocument();
    expect(screen.getByText("# Transcripción literal **sin formato**")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Transcripción/ })).not.toBeInTheDocument();
    view.rerender(<ChatMessage message={{ ...message, parts: [{ kind: "text", text: "# Título propio\n**Texto literal**" }] }} conversationId={chatId} />);
    expect(screen.getByText(/# Título propio/)).toHaveTextContent("**Texto literal**");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("keeps a null-text attachment as a Markdown boundary without losing its scoped preview", () => {
    render(<ChatMessage message={{ ...message, role: "assistant", parts: [
      { kind: "text", text: "```md\nCódigo antes de la imagen" },
      { kind: "image", attachment_id: attachmentId, text: null },
      { kind: "text", text: "# Encabezado después de la imagen" },
    ] }} conversationId={chatId} currentRunId={runId} />);
    expect(screen.getByRole("region", { name: "Bloque de código del mensaje" })).toHaveTextContent("Código antes de la imagen");
    expect(screen.getByRole("region", { name: "Bloque de código del mensaje" })).not.toHaveTextContent("Encabezado después");
    expect(screen.getByRole("heading", { level: 3, name: "Encabezado después de la imagen" })).toBeInTheDocument();
    expect(views.attachment).toHaveBeenCalledWith({ id: attachmentId, kind: "image", conversationId: chatId });
  });
});
