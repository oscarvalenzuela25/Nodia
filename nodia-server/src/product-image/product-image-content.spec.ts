import { createCanvas } from '@napi-rs/canvas';
import { imageSize } from 'image-size';
import { describe, expect, it } from 'vitest';
import { normalizeProductImage } from './product-image-content.js';

describe('Product photo admission and optimization', () => {
  it('decodes real bytes and creates one bounded JPEG independent of source metadata', async () => {
    const canvas = createCanvas(2048, 2);
    const file = { buffer: await canvas.encode('png'), mimetype: 'image/png' };
    const result = await normalizeProductImage(file);
    expect(result).toMatchObject({
      mime_type: 'image/jpeg',
      width: 1024,
      height: 1,
    });
    expect(imageSize(result.buffer)).toMatchObject({
      type: 'jpg',
      width: 1024,
      height: 1,
    });
    expect(result.byte_size).toBe(result.buffer.length);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects invalid bytes, MIME spoofing and excessive source dimensions before upload', async () => {
    await expect(
      normalizeProductImage({
        buffer: Buffer.from('<svg/>'),
        mimetype: 'image/svg+xml',
      }),
    ).rejects.toThrow('product:image_invalid');
    const png = await createCanvas(1, 1).encode('png');
    await expect(
      normalizeProductImage({ buffer: png, mimetype: 'image/jpeg' }),
    ).rejects.toThrow('product:image_invalid');
    const oversized = Buffer.from(png);
    oversized.writeUInt32BE(9000, 16);
    await expect(
      normalizeProductImage({ buffer: oversized, mimetype: 'image/png' }),
    ).rejects.toThrow('product:image_invalid');
  });
});
