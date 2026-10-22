import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AttachmentMessage from "../../../../../modules/nodiaAi/components/Attachments/AttachmentMessage";
import * as services from "../../../../../modules/nodiaAi/infrastructure/attachmentServices";
import { chatId } from "../../infrastructure/fixtures";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../modules/nodiaAi/infrastructure/attachmentServices", () => ({ getAttachment: vi.fn(), downloadAttachment: vi.fn() }));
const id = "77777777-7777-4777-8777-777777777777";
const attachment = { attachment_id: id, conversation_id: chatId, kind: "pdf" as const, state: "ready" as const, file_name: "synthetic.pdf", byte_count: null, media_type: "application/pdf", page_count: null, duration_seconds: null, interpretation: null };
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(services.getAttachment).mockResolvedValue(attachment);
  vi.mocked(services.downloadAttachment).mockResolvedValue(new Blob(["synthetic"]));
});
afterEach(() => { client.clear(); vi.clearAllMocks(); });
describe("private historical attachment", () => {
  it("does not download metadata or bytes before intent and keeps unknown values unknown", async () => {
    render(<QueryClientProvider client={client}><AttachmentMessage id={id} kind="pdf" conversationId={chatId} /></QueryClientProvider>);
    expect(services.getAttachment).not.toHaveBeenCalled();
    expect(services.downloadAttachment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /PDF · Ver archivo/ }));
    expect(await screen.findByText("synthetic.pdf")).toBeInTheDocument();
    expect(screen.getByText("Tamaño desconocido")).toBeInTheDocument();
    expect(services.downloadAttachment).not.toHaveBeenCalled();
  });
  it("hides stale metadata on revocation and keeps download disabled", async () => {
    render(<QueryClientProvider client={client}><AttachmentMessage id={id} kind="pdf" conversationId={chatId} /></QueryClientProvider>);
    await userEvent.click(screen.getByRole("button", { name: /Ver archivo/ }));
    expect(await screen.findByText("synthetic.pdf")).toBeInTheDocument();
    vi.mocked(services.getAttachment).mockRejectedValueOnce(new Error("Synthetic permission revoked"));
    await client.invalidateQueries({ queryKey: ["nodia-ai"] });
    expect(await screen.findByText(/No pudimos recuperar este archivo/)).toBeInTheDocument();
    expect(screen.queryByText("synthetic.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar archivo privado" })).toBeDisabled();
    expect(services.downloadAttachment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByText("synthetic.pdf")).toBeInTheDocument());
  });
});
