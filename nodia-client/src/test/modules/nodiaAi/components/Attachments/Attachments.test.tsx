import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Attachments from "../../../../../modules/nodiaAi/components/Attachments/Attachments";
import type { AttachmentPanelProps } from "../../../../../modules/nodiaAi/components/Attachments/types";
import * as services from "../../../../../modules/nodiaAi/infrastructure/attachmentServices";
import { chatId } from "../../infrastructure/fixtures";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/attachmentServices", () => ({ getAttachmentCapabilities: vi.fn() }));
const capabilities = { limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 50, image_pixels: 40000000 }, reviewed_text: true as const, native_modalities: { image: null, pdf: null, audio: null } };
let client: QueryClient;
let draft: AttachmentPanelProps["draft"];
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  draft = { entries: [], busy: false, parts: [], reviewedTextBytes: 0, resetReview: vi.fn(), ready: true, add: vi.fn(), upload: vi.fn(), review: vi.fn(), remove: vi.fn(), edit: vi.fn(), clear: vi.fn() };
  vi.mocked(services.getAttachmentCapabilities).mockResolvedValue(capabilities);
});
afterEach(() => { client.clear(); vi.clearAllMocks(); });
const open = (props: Partial<AttachmentPanelProps> = {}) => render(<QueryClientProvider client={client}><Attachments conversationId={chatId} draft={draft} disabled={false} onRecordingChange={vi.fn()} {...props} /></QueryClientProvider>);
describe("attachment review panel", () => {
  it("shows real limits, explains unknown native processing and never fabricates a transcript", async () => {
    open();
    expect(await screen.findByText(/Hasta 4 archivos, 20 MiB/)).toBeInTheDocument();
    expect(screen.getByText(/El texto revisado por ti/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grabar nota de voz" })).toBeDisabled();
  });
  it("preserves typed review and routes exact attachment ID on accept", async () => {
    const user = userEvent.setup();
    draft.entries = [{ localId: "local-synthetic", clientRequestId: "synthetic-key", file: new File(["x"], "synthetic.pdf", { type: "application/pdf" }), attachment: { attachment_id: "77777777-7777-4777-8777-777777777777", conversation_id: chatId, kind: "pdf", state: "ready", byte_count: 1, media_type: "application/pdf", file_name: "synthetic.pdf", page_count: 1, duration_seconds: null, interpretation: null }, text: "Reviewed amount zero: 0", progress: 100, busy: false, uncertain: false, error: "action_error" }];
    open();
    const editor = screen.getByRole("textbox", { name: "Contenido del archivo revisado por ti" });
    expect(editor).toHaveValue("Reviewed amount zero: 0");
    await waitFor(() => expect(screen.getByRole("button", { name: "Aceptar este texto" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Aceptar este texto" }));
    expect(draft.review).toHaveBeenCalledWith("local-synthetic");
    expect(editor).toHaveValue("Reviewed amount zero: 0");
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(/El texto revisado por ti/);
  });
  it("blocks mutations if capabilities cannot be read and offers local retry", async () => {
    vi.mocked(services.getAttachmentCapabilities).mockRejectedValueOnce(new Error("Synthetic unavailable"));
    open();
    expect(await screen.findByText(/No pudimos consultar las condiciones/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir archivos" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Elegir archivos" })).toBeEnabled());
  });
  it("hides a prior native-ready badge during revalidation and after a failed refresh without discarding the file", async () => {
    const native = { ...capabilities, native_modalities: { image: null, pdf: true as const, audio: null }, native_media_types: ["application/pdf" as const] };
    vi.mocked(services.getAttachmentCapabilities).mockResolvedValue(native);
    draft.entries = [{ localId: "local-synthetic", clientRequestId: "synthetic-key", file: new File(["x"], "synthetic.pdf", { type: "application/pdf" }), attachment: { attachment_id: "77777777-7777-4777-8777-777777777777", conversation_id: chatId, kind: "pdf", state: "ready", byte_count: 1, media_type: "application/pdf", file_name: "synthetic.pdf", page_count: 1, duration_seconds: null, interpretation: null }, text: "Unaccepted synthetic review", progress: 100, busy: false, uncertain: false, error: null }];
    open();
    const nativeText = /Este formato está verificado para la selección actual/i;
    expect(await screen.findByText(nativeText)).toBeInTheDocument();
    let rejectRefresh!: (error: Error) => void;
    vi.mocked(services.getAttachmentCapabilities).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRefresh = reject; }));
    act(() => { void client.invalidateQueries({ queryKey: ["nodia-ai"] }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Elegir archivos" })).toBeDisabled());
    expect(screen.queryByText(nativeText)).not.toBeInTheDocument();
    await act(async () => { rejectRefresh(new Error("Synthetic unavailable")); });
    expect(await screen.findByText(/No pudimos consultar las condiciones/)).toBeInTheDocument();
    expect(screen.queryByText(nativeText)).not.toBeInTheDocument();
    expect(screen.getByText("synthetic.pdf")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Contenido del archivo revisado por ti" })).toHaveValue("Unaccepted synthetic review");
  });
});
