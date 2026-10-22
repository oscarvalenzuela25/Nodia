import { afterEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../config/api";
import { createAttachment, getAttachment, uploadAttachment, reviewAttachment } from "../../../../modules/nodiaAi/infrastructure/attachmentServices";
import { attachmentCapabilitiesSchema, attachmentSchema, validateAttachmentFiles } from "../../../../modules/nodiaAi/infrastructure/attachmentSchemas";
import { nodiaAiAdmitSchema, nodiaAiMessagesSchema } from "../../../../modules/nodiaAi/infrastructure/schemas";
import { chatId, messageId, conversation } from "./fixtures";

export const attachmentId = "77777777-7777-4777-8777-777777777777";
export const attachment = { attachment_id: attachmentId, conversation_id: chatId, kind: "pdf" as const, state: "ready" as const, media_type: "application/pdf", byte_count: 10, file_name: "synthetic.pdf", page_count: null, duration_seconds: null, interpretation: null };
afterEach(() => vi.restoreAllMocks());
describe("private attachment transport and strict wire", () => {
  it("preserves unknown metadata and real zero rather than guessing", () => {
    expect(attachmentSchema.parse({ ...attachment, byte_count: null }).byte_count).toBeNull();
    expect(attachmentSchema.parse({ ...attachment, byte_count: 0 }).byte_count).toBe(0);
    expect(() => attachmentSchema.parse({ ...attachment, page_count: -1 })).toThrow();
    expect(() => attachmentSchema.parse({ ...attachment, url: "https://synthetic.invalid" })).toThrow();
  });
  it("rejects upload instructions to arbitrary endpoints and foreign metadata", async () => {
    vi.spyOn(mainInstance, "post").mockResolvedValue({ data: { attachment, upload: { method: "PUT", path: "https://synthetic.invalid/upload", expires_at: conversation.expires_at } } });
    await expect(createAttachment({ conversation_id: chatId, client_request_id: messageId, kind: "pdf", byte_count: 10, file_name: "synthetic.pdf" })).rejects.toThrow();
    vi.spyOn(mainInstance, "get").mockResolvedValue({ data: { ...attachment, conversation_id: messageId } });
    await expect(getAttachment(attachmentId, chatId)).rejects.toThrow();
  });
  it("uploads binary through authenticated local transport and sends only reviewed text separately", async () => {
    const put = vi.spyOn(mainInstance, "put").mockResolvedValue({ data: attachment });
    const patch = vi.spyOn(mainInstance, "patch").mockResolvedValue({ data: attachment });
    const file = new File(["synthetic"], "synthetic.pdf", { type: "application/pdf" });
    await uploadAttachment(attachmentId, chatId, file, vi.fn());
    expect(put.mock.calls[0]?.[0]).toBe(`/nodia-ai/attachments/${attachmentId}/content`);
    expect(put.mock.calls[0]?.[1]).toBe(file);
    await reviewAttachment(attachmentId, chatId, "Reviewed synthetic data", 0);
    expect(patch.mock.calls[0]?.[1]).toEqual({ text: "Reviewed synthetic data", expected_revision: 0 });
    const input = nodiaAiAdmitSchema.parse({ client_message_id: messageId, expected_conversation_revision: 1, parts: [{ kind: "pdf", attachment_id: attachmentId }] });
    expect(JSON.stringify(input)).not.toContain("Reviewed");
    expect(JSON.stringify(input)).not.toContain("http");
    expect(() => nodiaAiAdmitSchema.parse({ ...input, parts: [{ kind: "pdf", attachment_id: attachmentId, text: "Unverified" }] })).toThrow();
  });
  it("reads immutable reviewed snapshots without accepting raw URLs or payloads in history", () => {
    const wire = { conversation_id: chatId, items: [{ message_id: messageId, run_id: null, seq: "1", role: "user", status: "sealed", created_at: conversation.created_at, visibility: "visible", author_user_id: "9", sealed_at: null, parts: [{ kind: "pdf", attachment_id: attachmentId, text: "Reviewed snapshot" }] }], next_cursor: null };
    expect(nodiaAiMessagesSchema.parse(wire).items).toHaveLength(1);
    expect(() => nodiaAiMessagesSchema.parse({ ...wire, items: [{ ...wire.items[0], parts: [{ kind: "pdf", url: "https://synthetic.invalid", text: "Wrong" }] }] })).toThrow();
  });
  it("rejects empty, unsupported, oversized and excessive selections", () => {
    const small = new File(["a"], "a.pdf", { type: "application/pdf" });
    expect(validateAttachmentFiles([small], [])).toBeNull();
    expect(validateAttachmentFiles([new File([], "empty.pdf", { type: "application/pdf" })], [])).toBe("file_too_large");
    expect(validateAttachmentFiles([new File(["x"], "a.html", { type: "text/html" })], [])).toBe("file_type");
    expect(validateAttachmentFiles([small], [small, small, small, small])).toBe("file_count");
    const large = new File([new Uint8Array(20 * 1024 * 1024)], "large.pdf", { type: "application/pdf" });
    expect(validateAttachmentFiles([large, large, small], [])).toBe("message_too_large");
  });
  it("keeps exact native proof distinct from unknown and accepts a history reference without fabricated text", () => {
    const capabilities = { limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 50, image_pixels: 40000000 }, reviewed_text: true, native_modalities: { image: true, pdf: null, audio: null } };
    expect(attachmentCapabilitiesSchema.parse(capabilities).native_modalities.image).toBe(true);
    expect(attachmentCapabilitiesSchema.parse(capabilities).native_modalities.pdf).toBeNull();
    expect(() => attachmentCapabilitiesSchema.parse({ ...capabilities, native_modalities: { image: "verified", pdf: null, audio: null } })).toThrow();
    const wire = { conversation_id: chatId, items: [{ message_id: messageId, run_id: null, seq: "1", role: "user", status: "sealed", created_at: conversation.created_at, visibility: "visible", author_user_id: "9", sealed_at: null, parts: [{ kind: "image", attachment_id: attachmentId, text: null }] }], next_cursor: null };
    expect(nodiaAiMessagesSchema.parse(wire).items).toHaveLength(1);
  });
  it("accepts only unique known native formats while keeping an absent format list unknown", () => {
    const capabilities = { limits: { file_bytes: 20971520, files_per_message: 4, message_files_bytes: 41943040, audio_seconds: 300, pdf_pages: 50, image_pixels: 40000000 }, reviewed_text: true, native_modalities: { image: null, pdf: null, audio: true } };
    expect(attachmentCapabilitiesSchema.parse(capabilities).native_media_types).toBeUndefined();
    expect(attachmentCapabilitiesSchema.parse({ ...capabilities, native_media_types: ["audio/wav"] }).native_media_types).toEqual(["audio/wav"]);
    for (const formats of [null, ["audio/wav", "audio/wav"], ["audio/invented"], [7]])
      expect(() => attachmentCapabilitiesSchema.parse({ ...capabilities, native_media_types: formats })).toThrow();
    expect(() => attachmentCapabilitiesSchema.parse({ ...capabilities, native_media_types: [], quota: 100 })).toThrow();
  });
});
