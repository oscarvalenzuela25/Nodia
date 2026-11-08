import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  decodeCodexChatImages,
  type CodexChatImage,
} from './codex-chat-images.js';
import { CodexChatRuntime } from './codex-chat-runtime.js';
import type { CodexRuntimeService } from './codex-runtime.service.js';
import { CodexChatImageAcceptanceStore } from './codex-chat-image-acceptance.js';

// Synthetic one-pixel PNG; no account, private object, or provider request.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  'base64',
);
const image = (bytes = png): CodexChatImage => ({
  mediaType: 'image/png',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  contentBase64: bytes.toString('base64'),
});
const limits = {
  fileBytes: 20 * 1024 * 1024,
  totalBytes: 40 * 1024 * 1024,
  count: 4,
  pixels: 12_000_000,
};
describe('Codex image byte contract', () => {
  it('decodes a bounded matching image and snapshots caller-owned bytes', () => {
    const input = image(),
      result = decodeCodexChatImages([input], limits);
    input.contentBase64 = 'changed';
    expect(result[0].bytes).toEqual(png);
    expect(result[0].sha256).toBe(
      createHash('sha256').update(png).digest('hex'),
    );
  });
  it.each([
    { sha256: '0'.repeat(64) },
    { mediaType: 'image/jpeg' },
    { mediaType: 'application/pdf' },
    { contentBase64: png.toString('base64') + '\n' },
    { contentBase64: '%%%invalid' },
    {
      contentBase64: Buffer.from('not an image').toString('base64'),
      sha256: createHash('sha256').update('not an image').digest('hex'),
    },
  ])('rejects invalid image bytes or claims before staging: %j', (change) => {
    expect(() =>
      decodeCodexChatImages(
        [{ ...image(), ...change } as CodexChatImage],
        limits,
      ),
    ).toThrow(expect.objectContaining({ code: 'codex_image_invalid' }));
  });
  it('enforces exact per-file/message/cardinality boundaries and the 12MP policy', () => {
    expect(
      decodeCodexChatImages([image()], {
        ...limits,
        fileBytes: png.length,
        totalBytes: png.length,
      }),
    ).toHaveLength(1);
    expect(() =>
      decodeCodexChatImages([image()], {
        ...limits,
        fileBytes: png.length - 1,
      }),
    ).toThrow();
    expect(() =>
      decodeCodexChatImages([image(), image()], {
        ...limits,
        totalBytes: 2 * png.length - 1,
      }),
    ).toThrow();
    expect(() =>
      decodeCodexChatImages(
        Array.from({ length: 5 }, () => image()),
        limits,
      ),
    ).toThrow();
    const oversized = Buffer.from(png);
    oversized.writeUInt32BE(4000, 16);
    oversized.writeUInt32BE(4000, 20);
    expect(() => decodeCodexChatImages([image(oversized)], limits)).toThrow();
  });
  it('accounts for bounded localImage references without base64 or increasing the native frame/context ceiling', () => {
    const runtime = new CodexChatRuntime({} as CodexRuntimeService);
    const input = {
      modelId: 'synthetic-discovered-model',
      prompt: 'A',
      tools: [],
    };
    const plain = runtime.measure(input),
      withImages = runtime.measure({
        ...input,
        images: Array.from({ length: 4 }, () => ({
          mediaType: 'image/png' as const,
        })),
      });
    expect(withImages.maxUtf8Bytes).toBe(262144);
    expect(withImages.totalUtf8Bytes).toBeGreaterThan(
      plain.totalUtf8Bytes + 4 * 4096,
    );
    expect(withImages.totalUtf8Bytes).toBeLessThan(withImages.maxUtf8Bytes);
    expect(withImages.canonicalUtf8Bytes).toBe(plain.canonicalUtf8Bytes);
  });
  it('cannot decode a transport/MCP proof as an image proof or reuse a different MIME', () => {
    const proof = {
      version: 1,
      verifiedAt: new Date().toISOString(),
      terminalProofId: '11111111-1111-4111-8111-111111111111',
      nonceSha256: 'a'.repeat(64),
      scope: {
        connectionId: '1',
        resourceKey: 'codex-profile:' + 'b'.repeat(64),
        sessionGeneration: 'c'.repeat(32),
        configurationGeneration: 'd'.repeat(64),
        modelId: 'synthetic-model',
        effortId: null,
        runtimeFingerprint: 'e'.repeat(64),
      },
    };
    const store = new CodexChatImageAcceptanceStore('image/png');
    expect(() => store.decode(proof)).toThrow();
    expect(() => store.decode({ ...proof, mediaType: 'image/jpeg' })).toThrow();
    expect(store.decode({ ...proof, mediaType: 'image/png' }).scope).toEqual(
      proof.scope,
    );
  });
});
