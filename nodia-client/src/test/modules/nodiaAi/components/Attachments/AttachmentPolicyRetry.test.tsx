import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { sileo } from "sileo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Attachments from "../../../../../modules/nodiaAi/components/Attachments/Attachments";
import { useAttachmentDrafts } from "../../../../../modules/nodiaAi/components/Attachments/hooks/useAttachmentDrafts";
import useAuthStore from "../../../../../store/authStore";
import * as services from "../../../../../modules/nodiaAi/infrastructure/attachmentServices";
import { chatId, messageId, conversation } from "../../infrastructure/fixtures";
import type { NodiaAiAttachment } from "../../../../../modules/nodiaAi/infrastructure/attachmentSchemas";

vi.mock("sileo", () => ({ sileo: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/attachmentServices", () => ({ createAttachment: vi.fn(), getAttachment: vi.fn(), getAttachmentCapabilities: vi.fn(), uploadAttachment: vi.fn(), reviewAttachment: vi.fn(), deleteAttachment: vi.fn() }));
const negative = { limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 50, image_pixels: 40000000 }, reviewed_text: true as const, native_modalities: { image: null, pdf: null, audio: null }, native_media_types: [] };
const positive = { ...negative, native_media_types: ["application/pdf" as const], native_modalities: { image: null, pdf: true as const, audio: null } };
const ready: NodiaAiAttachment = { attachment_id: "77777777-7777-4777-8777-777777777777", conversation_id: chatId, kind: "pdf", state: "ready", media_type: "application/pdf", byte_count: 9, file_name: "synthetic.pdf", page_count: 1, duration_seconds: null, interpretation: null };
let client: QueryClient;
let latest: ReturnType<typeof useAttachmentDrafts>;
const file = new File(["synthetic"], "synthetic.pdf", { type: "application/pdf" });
function Harness({ id = chatId, disabled = false, revision = 1 }: { id?: string; disabled?: boolean; revision?: number }) {
  const draft = useAttachmentDrafts(id, revision);
  useEffect(() => { latest = draft; }, [draft]);
  return <Attachments conversationId={id} conversationRevision={revision} draft={draft} disabled={disabled} onRecordingChange={() => undefined} />;
}
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useAuthStore.setState({ user: { id: "9", name: "Synthetic owner" }, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: 1 });
  vi.mocked(services.getAttachmentCapabilities).mockResolvedValue(negative);
  vi.mocked(services.createAttachment).mockResolvedValue({ attachment: { ...ready, state: "uploading" }, upload: { method: "PUT", path: `/nodia-ai/attachments/${ready.attachment_id}/content`, expires_at: conversation.expires_at } });
  vi.mocked(services.uploadAttachment).mockResolvedValue(ready);
});
afterEach(() => { client.clear(); useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" }); });
const open = () => render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
async function uploadReady() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Elegir archivos" })).toBeEnabled());
  act(() => latest.add([file]));
  await act(() => latest.upload(latest.entries[0]!.localId));
  await screen.findByRole("button", { name: "Volver a comprobar formatos" });
}

describe("explicit attachment policy recheck", () => {
  it("rechecks a successful empty policy once, blocks during the GET and preserves the original without accepting text", async () => {
    open(); await uploadReady();
    expect(services.getAttachmentCapabilities).toHaveBeenCalledTimes(1);
    expect(latest.ready).toBe(false); expect(latest.parts).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Revisar contenido" }));
    const editor = screen.getByRole("textbox", { name: "Contenido del archivo revisado por ti" });
    const button = screen.getByRole("button", { name: "Volver a comprobar formatos" });
    let resolve!: (value: typeof positive) => void;
    vi.mocked(services.getAttachmentCapabilities).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await userEvent.click(button);
    expect(button).toBeDisabled(); expect(editor).toBeDisabled();
    expect(latest.busy).toBe(true);
    expect(latest.parts).toEqual([]); expect(latest.entries[0]?.file).toBe(file);
    await act(() => latest.refreshCapabilities());
    expect(services.getAttachmentCapabilities).toHaveBeenCalledTimes(2);
    await act(async () => { resolve(positive); });
    await waitFor(() => expect(latest.ready).toBe(true));
    expect(latest.parts).toEqual([{ kind: "pdf", attachment_id: ready.attachment_id }]);
    expect(screen.getByRole("textbox", { name: "Contenido del archivo revisado por ti" })).toBe(editor);
    expect(editor).toHaveValue(""); expect(latest.entries[0]?.file).toBe(file);
    expect(button).toBeEnabled(); expect(services.uploadAttachment).toHaveBeenCalledOnce();
    expect(services.reviewAttachment).not.toHaveBeenCalled();
    expect(sileo.success).toHaveBeenLastCalledWith({ title: "Compatibilidad de adjuntos actualizada" });
  });
  it("preserves an edited interpretation after a failed recheck and permits another explicit attempt", async () => {
    open(); await uploadReady();
    act(() => latest.edit(latest.entries[0]!.localId, "Unaccepted synthetic draft: 0"));
    const editor = screen.getByRole("textbox", { name: "Contenido del archivo revisado por ti" });
    vi.mocked(services.getAttachmentCapabilities).mockRejectedValueOnce(new Error("Synthetic unavailable"));
    await userEvent.click(screen.getByRole("button", { name: "Volver a comprobar formatos" }));
    expect(await screen.findByText(/No pudimos consultar las condiciones/)).toBeInTheDocument();
    expect(editor).toHaveValue("Unaccepted synthetic draft: 0"); expect(latest.entries[0]?.file).toBe(file);
    expect(latest.parts).toEqual([]); expect(sileo.error).toHaveBeenCalledOnce();
    vi.mocked(services.getAttachmentCapabilities).mockResolvedValueOnce(positive);
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText(/Este formato está verificado/);
    expect(latest.parts).toEqual([]); expect(latest.entries[0]?.textDirty).toBe(true);
    expect(editor).toHaveValue("Unaccepted synthetic draft: 0");
    expect(services.reviewAttachment).not.toHaveBeenCalled();
  });
  it("retains the per-chat draft while changing chats and disables the recheck with its parent", async () => {
    const view = open(); await uploadReady();
    view.rerender(<QueryClientProvider client={client}><Harness id={messageId} /></QueryClientProvider>);
    expect(latest.entries).toEqual([]);
    view.rerender(<QueryClientProvider client={client}><Harness disabled /></QueryClientProvider>);
    expect(latest.entries[0]?.file).toBe(file);
    expect(screen.getByRole("button", { name: "Volver a comprobar formatos" })).toBeDisabled();
  });
  it("does not report a cancelled old policy read as success when the same chat changes revision", async () => {
    const view = open(); await uploadReady();
    let resolveOld!: (value: typeof positive) => void;
    let resolveNew!: (value: typeof positive) => void;
    vi.mocked(services.getAttachmentCapabilities)
      .mockImplementationOnce(() => new Promise(done => { resolveOld = done; }))
      .mockImplementationOnce(() => new Promise(done => { resolveNew = done; }));
    vi.mocked(sileo.success).mockClear();
    let pending!: Promise<void>;
    act(() => { pending = latest.refreshCapabilities(); });
    await waitFor(() => expect(services.getAttachmentCapabilities).toHaveBeenCalledTimes(2));
    view.rerender(<QueryClientProvider client={client}><Harness revision={2} /></QueryClientProvider>);
    await waitFor(() => expect(services.getAttachmentCapabilities).toHaveBeenCalledTimes(3));
    await act(async () => { resolveOld(positive); await pending; });
    expect(latest.busy).toBe(true); expect(latest.parts).toEqual([]);
    expect(sileo.success).not.toHaveBeenCalled();
    expect(latest.entries[0]?.file).toBe(file);
    await act(async () => { resolveNew(positive); });
    await waitFor(() => expect(latest.ready).toBe(true));
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });
});
