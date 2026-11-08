import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CODEX_GENERATED_IMAGE_MAX_BYTES, decodeCodexGeneratedImage } from './codex-generated-image.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=';
const item = () => ({ type: 'imageGeneration', id: 'fixture-output', status: 'completed', result: png });
describe('native generated image inline boundary', () => {
  it('uses actual bytes to derive MIME/hash and omits private paths/prompts', () => {
    expect(decodeCodexGeneratedImage({ ...item(), savedPath: '/private/not-read', revisedPrompt: 'private' }))
      .toEqual({ mediaType: 'image/png', contentBase64: png,
        sha256: createHash('sha256').update(Buffer.from(png, 'base64')).digest('hex') });
  });
  it.each(['https://fixture.invalid/image.png', '/private/file.png', 'data:image/png;base64,' + png,
    png + '\n', '////', 'a===', '', png.slice(1)])('rejects URLs/paths/noncanonical or nonimage data: %s', (result) => {
    expect(() => decodeCodexGeneratedImage({ ...item(), result })).toThrow();
  });
  it.each([{ status: 'in_progress' }, { status: 'failed' }, { failure: { type: 'usageLimitExceeded' } },
    { type: 'imageView' }, { id: '' }])('never converts a noncompleted/failed item into an image', (patch) => {
    expect(() => decodeCodexGeneratedImage({ ...item(), ...patch })).toThrow();
  });
  it('rejects oversized input before base64 decode', () => {
    expect(() => decodeCodexGeneratedImage({ ...item(), result: 'A'.repeat(4 * Math.ceil(CODEX_GENERATED_IMAGE_MAX_BYTES / 3) + 4) })).toThrow();
  });
});
