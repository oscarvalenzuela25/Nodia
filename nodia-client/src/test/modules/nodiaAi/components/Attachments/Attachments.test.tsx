import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Attachments from "../../../../../modules/nodiaAi/components/Attachments/Attachments";
import type { AttachmentPanelProps } from "../../../../../modules/nodiaAi/components/Attachments/types";
import * as services from "../../../../../modules/nodiaAi/infrastructure/attachmentServices";
import { chatId } from "../../infrastructure/fixtures";
import { useAttachmentCapabilities } from "../../../../../modules/nodiaAi/components/Attachments/hooks/useAttachmentDrafts";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/attachmentServices", () => ({ getAttachmentCapabilities: vi.fn() }));
const capabilities = { limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 50, image_pixels: 40000000 }, reviewed_text: true as const, native_modalities: { image: null, pdf: null, audio: null } };
let client: QueryClient;
let draft: AttachmentPanelProps["draft"];
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  draft = { entries: [], busy: false, parts: [], reviewedTextBytes: 0, resetReview: vi.fn(), ready: true, add: vi.fn(), upload: vi.fn(), review: vi.fn(), remove: vi.fn(), edit: vi.fn(), clear: vi.fn(), capabilities: { data: undefined, isFetching: false, isError: false }, enableCapabilities: vi.fn(), refreshCapabilities: vi.fn(), admission: undefined, admissionInFlight: false, reserveAdmission: vi.fn(), settleAdmission: vi.fn(), dismissRejectedAdmission: vi.fn() };
  vi.mocked(services.getAttachmentCapabilities).mockResolvedValue(capabilities);
});
afterEach(() => { client.clear(); vi.clearAllMocks(); });
function PanelWithPolicy(props: Partial<AttachmentPanelProps>) {
  const policy = useAttachmentCapabilities(chatId);
  return <Attachments conversationId={chatId} disabled={false} onRecordingChange={vi.fn()} {...props}
    draft={{ ...draft, capabilities: { data: policy.data, isFetching: policy.isFetching, isError: policy.isError },
      refreshCapabilities: async () => { await policy.refetch(); } }} />;
}
const open = (props: Partial<AttachmentPanelProps> = {}) => render(<QueryClientProvider client={client}><PanelWithPolicy {...props} /></QueryClientProvider>);
describe("attachment review panel", () => {
  it("plays a local audio draft while upload is busy without downloading or changing review gates", () => {
    const file = new File(["synthetic recorded audio"], "voice.webm", { type: "audio/webm" });
    draft.busy = true;
    draft.entries = [{ localId: "local-audio", clientRequestId: "synthetic-audio-key", file,
      attachment: null, text: "", progress: 20, busy: true, uncertain: false, error: null }];
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const create = vi.fn(() => "blob:synthetic-local-audio"), revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    const view = open({ reviewOnly: true });
    try {
      const audio = screen.getByLabelText("Reproductor de audio: voice.webm");
      expect(audio).toHaveAttribute("controls");
      expect(audio).not.toHaveAttribute("autoplay");
      expect(create).toHaveBeenCalledExactlyOnceWith(file);
      expect(screen.getByRole("button", { name: "Quitar adjunto" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Revisar contenido" })).not.toBeInTheDocument();
      expect(draft.upload).not.toHaveBeenCalled();
      expect(draft.review).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      pause.mockRestore(); load.mockRestore();
      if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:synthetic-local-audio");
  });
  it("uses one accessible trash action and no manual upload action for a newly chosen file", async () => {
    draft.entries = [{ localId: "local-new", clientRequestId: "synthetic-key", file: new File(["pdf"], "chosen.pdf", { type: "application/pdf" }),
      attachment: null, text: "", progress: null, busy: false, uncertain: false, error: null }];
    open({ reviewOnly: true });
    const remove = screen.getByRole("button", { name: "Quitar adjunto" });
    await waitFor(() => expect(remove).toBeEnabled());
    expect(remove).toHaveTextContent("");
    expect(screen.queryByRole("button", { name: "Subir archivo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    await userEvent.click(remove);
    expect(draft.remove).toHaveBeenCalledExactlyOnceWith("local-new");
    expect(draft.upload).not.toHaveBeenCalled();
  });
  it("offers a manual retry only after a failed upload, preserving its local identity", async () => {
    draft.entries = [{ localId: "local-failed", clientRequestId: "same-synthetic-key", file: new File(["pdf"], "failed.pdf", { type: "application/pdf" }),
      attachment: null, text: "", progress: null, busy: false, uncertain: false, error: "upload_error" }];
    open({ reviewOnly: true });
    const retry = screen.getByRole("button", { name: "Reintentar" });
    await waitFor(() => expect(retry).toBeEnabled());
    await userEvent.click(retry);
    expect(draft.upload).toHaveBeenCalledExactlyOnceWith("local-failed");
    expect(screen.getByText("failed.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Subir archivo" })).not.toBeInTheDocument();
  });
  it("keeps uncertain uploads on explicit state recovery and does not auto-replay them", async () => {
    draft.entries = [{ localId: "local-uncertain", clientRequestId: "same-synthetic-key", file: new File(["pdf"], "uncertain.pdf", { type: "application/pdf" }),
      attachment: { attachment_id: "77777777-7777-4777-8777-777777777777", conversation_id: chatId, kind: "pdf", state: "uploading", byte_count: 3,
        media_type: "application/pdf", file_name: "uncertain.pdf", page_count: null, duration_seconds: null, interpretation: null },
      text: "", progress: null, busy: false, uncertain: true, error: "upload_uncertain" }];
    open({ reviewOnly: true });
    const recover = screen.getByRole("button", { name: "Consultar estado de la subida" });
    await waitFor(() => expect(recover).toBeEnabled());
    expect(draft.upload).not.toHaveBeenCalled();
    await userEvent.click(recover);
    expect(draft.upload).toHaveBeenCalledExactlyOnceWith("local-uncertain");
  });
  it("labels invoice OCR references separately from verified native formats", async () => {
    draft.invoiceOcr = { media_types: ["application/pdf"], file_bytes: 10485760 };
    draft.entries = [{ localId: "local-synthetic-ocr", clientRequestId: "synthetic-key", file: new File(["x"], "invoice.pdf", { type: "application/pdf" }),
      attachment: { attachment_id: "77777777-7777-4777-8777-777777777777", conversation_id: chatId, kind: "pdf", state: "ready", byte_count: 1, media_type: "application/pdf", file_name: "invoice.pdf", page_count: 1, duration_seconds: null, interpretation: null },
      text: "", progress: 100, busy: false, uncertain: false, error: null }];
    open();
    expect(await screen.findByText("Archivo disponible para solicitar extracción de factura")).toBeInTheDocument();
    expect(screen.queryByText(/Este formato está verificado para la selección actual/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Revisar contenido" }));
    expect(screen.getByRole("button", { name: "Aceptar este texto" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /OCR|Analizar factura/ })).not.toBeInTheDocument();
  });
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
    const disclosure = screen.getByRole("button", { name: "Revisar contenido" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: "Contenido del archivo revisado por ti" })).not.toBeInTheDocument();
    await waitFor(() => expect(disclosure).toBeEnabled());
    await user.click(disclosure);
    const editor = screen.getByRole("textbox", { name: "Contenido del archivo revisado por ti" });
    expect(editor).toHaveValue("Reviewed amount zero: 0");
    await waitFor(() => expect(screen.getByRole("button", { name: "Aceptar este texto" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Aceptar este texto" }));
    expect(draft.review).toHaveBeenCalledWith("local-synthetic");
    expect(editor).toHaveValue("Reviewed amount zero: 0");
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(/El texto revisado por ti/);
    await user.click(disclosure);
    expect(screen.queryByRole("textbox", { name: "Contenido del archivo revisado por ti" })).not.toBeInTheDocument();
    await user.click(disclosure);
    expect(screen.getByRole("textbox", { name: "Contenido del archivo revisado por ti" })).toHaveValue("Reviewed amount zero: 0");
  });
  it("keeps an edited review visible after failure and prevents collapsing its unfinished draft", async () => {
    draft.entries = [{ localId: "local-dirty", clientRequestId: "synthetic-key", file: new File(["x"], "edited.pdf", { type: "application/pdf" }),
      attachment: { attachment_id: "77777777-7777-4777-8777-777777777777", conversation_id: chatId, kind: "pdf", state: "ready", byte_count: 1,
        media_type: "application/pdf", file_name: "edited.pdf", page_count: 1, duration_seconds: null, interpretation: { text: "Original", origin: "extracted", reviewed: false, revision: 1 } },
      text: "Edited zero: 0", textDirty: true, progress: 100, busy: false, uncertain: false, error: "action_error" }];
    open({ reviewOnly: true });
    expect(screen.getByRole("textbox", { name: "Contenido del archivo revisado por ti" })).toHaveValue("Edited zero: 0");
    const disclosure = screen.getByRole("button", { name: "Revisar contenido" });
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(disclosure).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Descartar edición del texto" })).toBeEnabled());
    expect(draft.review).not.toHaveBeenCalled();
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
    await userEvent.click(screen.getByRole("button", { name: "Revisar contenido" }));
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
