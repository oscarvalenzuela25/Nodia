import { z } from "zod";
import { mainInstance } from "../../../config/api";
import { attachmentCapabilitiesSchema, attachmentCreateSchema, attachmentIntentSchema, attachmentSchema, type NodiaAiAttachment, type NodiaAiAttachmentCreate } from "./attachmentSchemas";

const path = (id: string) => `/nodia-ai/attachments/${encodeURIComponent(z.uuid().parse(id))}`;
export async function getAttachmentCapabilities(conversationId: string, signal?: AbortSignal) {
  const { data } = await mainInstance.get<unknown>("/nodia-ai/attachments/capabilities", { params: { conversation_id: z.uuid().parse(conversationId) }, signal });
  return attachmentCapabilitiesSchema.parse(data);
}
function bound(value: unknown, id: string, conversation: string): NodiaAiAttachment {
  const attachment = attachmentSchema.parse(value);
  if (attachment.attachment_id !== id || attachment.conversation_id !== conversation) throw new Error("nodia_ai:invalid_response");
  return attachment;
}
export async function createAttachment(input: NodiaAiAttachmentCreate) {
  const body = attachmentCreateSchema.parse(input);
  const { data } = await mainInstance.post<unknown>("/nodia-ai/attachments", body);
  const result = attachmentIntentSchema.parse(data);
  if (result.attachment.conversation_id !== body.conversation_id || result.attachment.kind !== body.kind) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function getAttachment(id: string, conversation: string, signal?: AbortSignal) {
  const { data } = await mainInstance.get<unknown>(path(id), { signal });
  return bound(data, id, conversation);
}
export async function uploadAttachment(id: string, conversation: string, file: File, onProgress: (value: number | null) => void) {
  const { data } = await mainInstance.put<unknown>(`${path(id)}/content`, file, {
    headers: { "Content-Type": "application/octet-stream" },
    onUploadProgress: event => onProgress(event.total && event.total > 0 ? Math.min(100, Math.floor(100 * event.loaded / event.total)) : null),
  });
  return bound(data, id, conversation);
}
export async function reviewAttachment(id: string, conversation: string, text: string, revision: number) {
  const body = z.object({ text: z.string().min(1).max(32768), expected_revision: z.number().int().nonnegative() }).strict().parse({ text, expected_revision: revision });
  const { data } = await mainInstance.patch<unknown>(`${path(id)}/interpretation`, body);
  return bound(data, id, conversation);
}
export async function deleteAttachment(id: string) {
  const { data } = await mainInstance.delete<unknown>(path(id));
  return z.object({ deleted: z.literal(true) }).strict().parse(data);
}
export async function downloadAttachment(id: string, signal?: AbortSignal): Promise<Blob> {
  const { data } = await mainInstance.get<Blob>(`${path(id)}/content`, { responseType: "blob", signal });
  if (!(data instanceof Blob)) throw new Error("nodia_ai:invalid_response");
  return data;
}
