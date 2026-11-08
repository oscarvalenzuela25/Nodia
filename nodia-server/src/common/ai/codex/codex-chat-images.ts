import { createHash } from 'node:crypto';
import { imageSize } from 'image-size';
import { codexError } from './codex-contract.js';
import type { CodexChatJournal } from './codex-chat-journal.js';
import {
  stageCodexChatMedia,
  cleanupCodexChatMedia,
  CODEX_CHAT_MEDIA_PATH_BYTES,
} from './codex-chat-media-storage.js';
import type { CodexChatIdentity } from './codex-chat-contract.js';

export const CODEX_CHAT_IMAGE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;
export type CodexChatImageMime = (typeof CODEX_CHAT_IMAGE_MIMES)[number];
export interface CodexChatImage {
  mediaType: CodexChatImageMime;
  sha256: string;
  contentBase64: string;
}
export interface CodexChatImageLimits {
  fileBytes: number;
  totalBytes: number;
  count: number;
  pixels: number;
}
export const CODEX_CHAT_IMAGE_PATH_BYTES = CODEX_CHAT_MEDIA_PATH_BYTES;
export const CODEX_CHAT_IMAGE_PATH_PLACEHOLDER = '\\'.repeat(
  CODEX_CHAT_IMAGE_PATH_BYTES,
);
export function isCodexChatImageMime(
  value: unknown,
): value is CodexChatImageMime {
  return CODEX_CHAT_IMAGE_MIMES.some((mime) => mime === value);
}
export function decodeCodexChatImages(
  images: readonly CodexChatImage[],
  limits: CodexChatImageLimits,
): readonly { mediaType: CodexChatImageMime; sha256: string; bytes: Buffer }[] {
  if (
    !limits ||
    Object.keys(limits).sort().join(',') !==
      'count,fileBytes,pixels,totalBytes' ||
    Object.values(limits).some((v) => !Number.isSafeInteger(v) || v < 1) ||
    !Array.isArray(images) ||
    images.length > limits.count
  )
    throw codexError('codex_image_invalid', 400);
  let total = 0;
  return images.map((image) => {
    if (
      !image ||
      Object.keys(image).sort().join(',') !==
        'contentBase64,mediaType,sha256' ||
      !isCodexChatImageMime(image.mediaType) ||
      !/^[a-f0-9]{64}$/.test(image.sha256) ||
      typeof image.contentBase64 !== 'string' ||
      !image.contentBase64.length ||
      image.contentBase64.length > 4 * Math.ceil(limits.fileBytes / 3)
    )
      throw codexError('codex_image_invalid', 400);
    const bytes = Buffer.from(image.contentBase64, 'base64');
    total += bytes.length;
    if (
      !bytes.length ||
      bytes.length > limits.fileBytes ||
      total > limits.totalBytes ||
      bytes.toString('base64') !== image.contentBase64 ||
      createHash('sha256').update(bytes).digest('hex') !== image.sha256
    )
      throw codexError('codex_image_invalid', 400);
    let size;
    try {
      size = imageSize(bytes);
    } catch {
      throw codexError('codex_image_invalid', 400);
    }
    const expected = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    }[image.mediaType as CodexChatImageMime];
    if (
      size.type !== expected ||
      !size.width ||
      !size.height ||
      size.width * size.height > limits.pixels
    )
      throw codexError('codex_image_invalid', 400);
    return { mediaType: image.mediaType, sha256: image.sha256, bytes };
  });
}
export function stageCodexChatImages(
  journal: CodexChatJournal,
  identity: CodexChatIdentity,
  images: ReturnType<typeof decodeCodexChatImages>,
  signal: AbortSignal,
): Promise<readonly string[]> {
  return stageCodexChatMedia(journal, identity, 'image', images, signal);
}
/** Caller must first prove the exact attempt's native process group is closed. */
export function cleanupCodexChatImages(
  journal: CodexChatJournal,
  identity: CodexChatIdentity,
): Promise<void> {
  return cleanupCodexChatMedia(journal, identity, 'image');
}
