import { createCanvas, loadImage } from '@napi-rs/canvas';
import { imageSize } from 'image-size';
import type { NodiaAiGeneratedImage } from '../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { decodeNodiaAiGeneratedImage } from '../nodia-ai-attachment/use-case/store-nodia-ai-generated-image.use-case.js';
import {
  FLASHCARD_IMAGE_MAX_BYTES,
  readFlashcardImage,
} from '../teacher/policies/teacher-flashcards.js';
import { teacherError } from '../teacher/policies/teacher-validation.js';

const maxSourceEdge = 4096;
const maxSourcePixels = 12_000_000;
const mimeByType = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['webp', 'image/webp'],
]);
let activeDecoders = 0;

function allowedSourceSize(
  width: number | undefined,
  height: number | undefined,
) {
  return Boolean(
    width &&
    height &&
    width <= maxSourceEdge &&
    height <= maxSourceEdge &&
    width * height <= maxSourcePixels,
  );
}

/** Fully decode bounded inline bytes and persist a still, metadata-free thumbnail. */
export async function normalizeFlashcardLibraryImage(
  image: NodiaAiGeneratedImage,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (activeDecoders >= 2) teacherError('flashcard_image_processing_busy', 503);
  activeDecoders++;
  try {
    const bytes = decodeNodiaAiGeneratedImage(image);
    const dimensions = imageSize(bytes);
    if (
      !dimensions.type ||
      mimeByType.get(dimensions.type) !== image.mediaType ||
      !allowedSourceSize(dimensions.width, dimensions.height)
    )
      teacherError('flashcard_image_output_invalid', 422);

    const decoded = await loadImage(bytes);
    signal.throwIfAborted();
    if (!allowedSourceSize(decoded.width, decoded.height))
      teacherError('flashcard_image_output_invalid', 422);

    for (const edge of [960, 720, 480, 320]) {
      const scale = Math.min(1, edge / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = createCanvas(width, height);
      canvas.getContext('2d').drawImage(decoded, 0, 0, width, height);
      const thumbnail = await canvas.encode('webp', 82);
      signal.throwIfAborted();
      if (thumbnail.length > FLASHCARD_IMAGE_MAX_BYTES) continue;
      const checked = readFlashcardImage({
        data: thumbnail.toString('base64'),
        side: 'answer',
      });
      if (checked) return { bytes: checked.bytes, mime: 'image/webp' as const };
    }
  } catch {
    signal.throwIfAborted();
    teacherError('flashcard_image_output_invalid', 422);
  } finally {
    activeDecoders--;
  }
  return teacherError('flashcard_image_output_invalid', 422);
}
