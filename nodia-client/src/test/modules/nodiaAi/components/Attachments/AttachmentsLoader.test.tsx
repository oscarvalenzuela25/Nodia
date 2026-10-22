import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttachmentsLoader from "../../../../../modules/nodiaAi/components/Attachments/AttachmentsLoader";
import { loadAttachments } from "../../../../../modules/nodiaAi/components/Attachments/loadAttachments";
import type { AttachmentPanelProps } from "../../../../../modules/nodiaAi/components/Attachments/types";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../modules/nodiaAi/components/Attachments/loadAttachments", () => ({ loadAttachments: vi.fn() }));
const props: AttachmentPanelProps = { conversationId: "11111111-1111-4111-8111-111111111111", disabled: false, onRecordingChange: vi.fn(), draft: { entries: [], parts: [], reviewedTextBytes: 0, resetReview: vi.fn(), busy: false, ready: true, add: vi.fn(), upload: vi.fn(), review: vi.fn(), remove: vi.fn(), edit: vi.fn(), clear: vi.fn() } };
beforeEach(() => vi.resetAllMocks());
describe("secondary attachment panel intent boundary", () => {
  it("loads only on intent and recovers chunk failure locally", async () => {
    vi.mocked(loadAttachments).mockRejectedValueOnce(new Error("Synthetic chunk failed"));
    render(<AttachmentsLoader {...props} />);
    expect(loadAttachments).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Adjuntar archivo o grabar voz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/borrador sigue disponible/);
    vi.mocked(loadAttachments).mockResolvedValueOnce({ default: () => <p>Synthetic recovered panel</p> });
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Synthetic recovered panel")).toBeInTheDocument();
    expect(loadAttachments).toHaveBeenCalledTimes(2);
  });
  it("discards a late chunk after context disposal", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof loadAttachments>>) => void;
    vi.mocked(loadAttachments).mockImplementation(() => new Promise(done => { resolve = done; }));
    const { unmount } = render(<AttachmentsLoader {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Adjuntar archivo o grabar voz" }));
    expect(screen.getByRole("button", { name: "Preparando adjuntos…" })).toBeDisabled();
    unmount();
    resolve({ default: () => <p>Stale panel</p> });
    await waitFor(() => expect(screen.queryByText("Stale panel")).not.toBeInTheDocument());
  });
});
