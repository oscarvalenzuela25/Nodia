import { createHash } from 'node:crypto';
import { imageSize } from 'image-size';
import { codexError, codexObject } from './codex-contract.js';
import type { CodexChatImage } from './codex-chat-images.js';

export const CODEX_GENERATED_IMAGE_MAX_BYTES = 16 * 1024 * 1024;
export const CODEX_GENERATED_IMAGE_FRAME_BYTES =
  4 * Math.ceil(CODEX_GENERATED_IMAGE_MAX_BYTES / 3) + 65536;

/** Native inline bytes only. savedPath/URLs never grant filesystem/network access. */
export function decodeCodexGeneratedImage(value: unknown): CodexChatImage {
  const item = codexObject(value);
  if (item.type !== 'imageGeneration' || item.status !== 'completed' ||
    (item.failure !== undefined && item.failure !== null) ||
    typeof item.id !== 'string' || !item.id.trim() || item.id.length > 256 ||
    typeof item.result !== 'string' || !item.result.length ||
    item.result.length > 4 * Math.ceil(CODEX_GENERATED_IMAGE_MAX_BYTES / 3) ||
    item.result.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(item.result))
    throw codexError('codex_generated_image_invalid', 502);
  const bytes = Buffer.from(item.result, 'base64');
  if (!bytes.length || bytes.length > CODEX_GENERATED_IMAGE_MAX_BYTES ||
    bytes.toString('base64') !== item.result)
    throw codexError('codex_generated_image_invalid', 502);
  let size;
  try { size = imageSize(bytes); } catch {
    throw codexError('codex_generated_image_invalid', 502);
  }
  const mediaType = size.type === 'png' ? 'image/png' :
    size.type === 'jpg' ? 'image/jpeg' : size.type === 'webp' ? 'image/webp' : null;
  if (!mediaType || !size.width || !size.height ||
    !Number.isSafeInteger(size.width * size.height))
    throw codexError('codex_generated_image_invalid', 502);
  return { mediaType, contentBase64: item.result,
    sha256: createHash('sha256').update(bytes).digest('hex') };
}
