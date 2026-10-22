import { z } from "zod";

const id = z.uuid();
const fileName = z.string().refine(value => /\S/u.test(value) && new TextEncoder().encode(value).length <= 256);
export const attachmentKindSchema = z.enum(["image", "pdf", "audio"]);
export const attachmentPartSchema = z.object({ kind: attachmentKindSchema, attachment_id: id }).strict();
export const attachmentSchema = z.object({
  attachment_id: id, conversation_id: id, kind: attachmentKindSchema,
  state: z.enum(["uploading", "ready", "rejected", "expired"]),
  media_type: z.string().min(1).nullable(), byte_count: z.number().int().nonnegative().max(20 * 1024 * 1024).nullable(),
  file_name: fileName, page_count: z.number().int().positive().nullable(), duration_seconds: z.number().finite().nonnegative().max(300).nullable(),
  interpretation: z.object({ text: z.string().max(32768), origin: z.enum(["user_reviewed", "provider", "extracted"]), reviewed: z.boolean(), revision: z.number().int().positive() }).strict().nullable(),
}).strict();
export const attachmentIntentSchema = z.object({ attachment: attachmentSchema, upload: z.object({ method: z.literal("PUT"), path: z.string(), expires_at: z.iso.datetime({ offset: true }) }).strict() }).strict()
  .refine(value => value.upload.path === `/nodia-ai/attachments/${value.attachment.attachment_id}/content`);
export type NodiaAiAttachment = z.infer<typeof attachmentSchema>;
export type NodiaAiAttachmentPart = z.infer<typeof attachmentPartSchema>;
export type NodiaAiAttachmentKind = z.infer<typeof attachmentKindSchema>;
export const attachmentCreateSchema = z.object({ conversation_id: id, client_request_id: id, kind: attachmentKindSchema, byte_count: z.number().int().positive().max(20 * 1024 * 1024), file_name: fileName }).strict();
export type NodiaAiAttachmentCreate = z.infer<typeof attachmentCreateSchema>;
export const attachmentCapabilitiesSchema = z.object({
  limits: z.object({ file_bytes: z.number().int().positive(), files_per_message: z.number().int().positive(), message_files_bytes: z.number().int().positive(), audio_seconds: z.number().int().positive(), pdf_pages: z.number().int().positive(), image_pixels: z.number().int().positive() }).strict(),
  reviewed_text: z.literal(true), native_modalities: z.object({ image: z.literal(true).nullable(), pdf: z.literal(true).nullable(), audio: z.literal(true).nullable() }).strict(),
  native_media_types: z.array(z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf", "audio/wav", "audio/ogg", "audio/webm", "audio/mpeg", "audio/mp4"]))
    .max(9).refine(values => new Set(values).size === values.length).optional(),
}).strict();

export function attachmentKind(file: File): NodiaAiAttachmentKind | null {
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (/^audio\/(webm|ogg|mpeg|mp4|wav)(;.*)?$/.test(file.type)) return "audio";
  return null;
}
export function validateAttachmentFiles(files: readonly File[], current: readonly File[], limits = { files_per_message: 4, file_bytes: 20 * 1024 * 1024, message_files_bytes: 40 * 1024 * 1024 }): string | null {
  if (files.length + current.length > limits.files_per_message) return "file_count";
  if (files.some(file => !fileName.safeParse(file.name).success)) return "file_name_invalid";
  if (files.some(file => !attachmentKind(file))) return "file_type";
  if (files.some(file => file.size === 0 || file.size > limits.file_bytes)) return "file_too_large";
  if ([...files, ...current].reduce((total, file) => total + file.size, 0) > limits.message_files_bytes) return "message_too_large";
  return null;
}
