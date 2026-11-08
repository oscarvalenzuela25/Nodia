import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { imageSize } from 'image-size';

/** Application admission limits, not provider capabilities. Originals are never uploaded. */
export const PRODUCT_IMAGE_LIMITS = Object.freeze({
  sourceBytes: 8 * 1024 * 1024,
  maxPixels: 16_000_000,
  maxEdge: 8192,
  outputEdge: 1024,
  outputBytes: 2 * 1024 * 1024,
});
let activeDecoders = 0;

export async function normalizeProductImage(
  file: Pick<Express.Multer.File, 'buffer' | 'mimetype'>,
) {
  if (
    !file?.buffer ||
    !Buffer.isBuffer(file.buffer) ||
    !file.buffer.length ||
    file.buffer.length > PRODUCT_IMAGE_LIMITS.sourceBytes
  )
    throw new BadRequestException('product:image_invalid');
  let dimensions: ReturnType<typeof imageSize>;
  try {
    dimensions = imageSize(file.buffer);
  } catch {
    throw new BadRequestException('product:image_invalid');
  }
  const mime: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp',
  };
  if (
    !dimensions.type ||
    !Object.hasOwn(mime, dimensions.type) ||
    mime[dimensions.type] !== file.mimetype ||
    !dimensions.width ||
    !dimensions.height ||
    dimensions.width > PRODUCT_IMAGE_LIMITS.maxEdge ||
    dimensions.height > PRODUCT_IMAGE_LIMITS.maxEdge ||
    dimensions.width * dimensions.height > PRODUCT_IMAGE_LIMITS.maxPixels
  )
    throw new BadRequestException('product:image_invalid');
  if (activeDecoders >= 2)
    throw new ServiceUnavailableException('product:image_busy');
  activeDecoders++;
  try {
    const decoded = await loadImage(file.buffer);
    // Decoders may apply EXIF orientation; validate decoded bounds instead of
    // requiring source header width/height to retain their original order.
    if (
      !decoded.width ||
      !decoded.height ||
      decoded.width > PRODUCT_IMAGE_LIMITS.maxEdge ||
      decoded.height > PRODUCT_IMAGE_LIMITS.maxEdge ||
      decoded.width * decoded.height > PRODUCT_IMAGE_LIMITS.maxPixels
    )
      throw new BadRequestException('product:image_invalid');
    const scale = Math.min(
      1,
      PRODUCT_IMAGE_LIMITS.outputEdge / Math.max(decoded.width, decoded.height),
    );
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded, 0, 0, width, height);
    const buffer = await canvas.encode('jpeg', 85);
    if (buffer.length < 1 || buffer.length > PRODUCT_IMAGE_LIMITS.outputBytes)
      throw new BadRequestException('product:image_invalid');
    return {
      buffer,
      mime_type: 'image/jpeg',
      byte_size: buffer.length,
      width,
      height,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('product:image_invalid');
  } finally {
    activeDecoders--;
  }
}
