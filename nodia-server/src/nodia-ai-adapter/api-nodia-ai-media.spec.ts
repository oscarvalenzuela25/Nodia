import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import asset from '../nodia-ai-runtime/config/runtime-policy.json' with { type: 'json' };
import type { NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaAiAdapterRequest } from './types/nodia-ai-adapter.types.js';
import {
  validateApiMedia,
  initialApiHistory,
  parseApiGeneratedImage,
} from './api-nodia-ai-media.js';
const policy = asset.policy as unknown as NodiaAiRuntimePolicy;
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4a8AAAAASUVORK5CYII=';
function request(
  kind: 'image' | 'pdf' | 'audio',
  mime: string,
  bytes: Buffer,
): NodiaAiAdapterRequest {
  return {
    selection: {
      connection_id: '4',
      mode: 'api_key',
      model_id: 'fixture-model',
      effort_id: null,
    },
    attemptId: 'a87b3197-5968-473f-8e5e-c6b4935b6771',
    deadlineAt: new Date(),
    resourceKey: 'api-connection:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
    configurationGeneration: 'c'.repeat(64),
    canonicalPrompt: 'Synthetic prompt',
    attachments: [
      {
        kind,
        media_type: mime,
        content_base64: bytes.toString('base64'),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
    ],
  };
}
describe('API inline originals and explicit image output', () => {
  it('projects PNG and PDF bytes in native REST input shape without provider file uploads or URLs', () => {
    const image = request('image', 'image/png', Buffer.from(png, 'base64'));
    const pdf = request(
      'pdf',
      'application/pdf',
      Buffer.from('%PDF-1.4\n% synthetic attachment envelope\n%%EOF\n'),
    );
    for (const ref of [image, pdf]) {
      expect(() => validateApiMedia('openai', ref, policy)).not.toThrow();
      expect(() => validateApiMedia('gemini', ref, policy)).not.toThrow();
      const first = initialApiHistory('openai', ref)[0];
      expect(first.content).toEqual([
        { type: 'input_text', text: 'Synthetic prompt' },
        ref.attachments![0].kind === 'pdf'
          ? {
              type: 'input_file',
              filename: 'attachment.pdf',
              file_data: `data:application/pdf;base64,${ref.attachments![0].content_base64}`,
            }
          : { type: 'input_image', image_url: `data:image/png;base64,${png}` },
      ]);
      expect(initialApiHistory('gemini', ref)).toEqual([
        {
          role: 'user',
          parts: [
            { text: 'Synthetic prompt' },
            {
              inlineData: {
                mimeType: ref.attachments![0].media_type,
                data: ref.attachments![0].content_base64,
              },
            },
          ],
        },
      ]);
    }
  });
  it.each(['hash', 'mime', 'base64', 'size'] as const)(
    'rejects mismatched %s before transport',
    (change) => {
      const req = request('image', 'image/png', Buffer.from(png, 'base64'));
      if (change === 'hash') req.attachments![0].sha256 = 'a'.repeat(64);
      if (change === 'mime') req.attachments![0].media_type = 'image/jpeg';
      if (change === 'base64') req.attachments![0].content_base64 += '!';
      const limits =
        change === 'size'
          ? { ...policy, admission: { ...policy.admission, file_bytes: 1 } }
          : policy;
      expect(() => validateApiMedia('openai', req, limits)).toThrow();
    },
  );
  it('rejects OpenAI audio in Responses rather than relabelling it as supported input', () => {
    expect(() =>
      validateApiMedia(
        'openai',
        request('audio', 'audio/wav', Buffer.from('RIFF')),
        policy,
      ),
    ).toThrow('adapter_attachments_unverified');
  });
  it('accepts a bounded PCM16 WAV for Gemini while refusing malformed compressed layouts', () => {
    const wav = Buffer.alloc(48);
    wav.write('RIFF');
    wav.writeUInt32LE(40, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(4, 40);
    expect(() =>
      validateApiMedia('gemini', request('audio', 'audio/wav', wav), policy),
    ).not.toThrow();
    wav.writeUInt16LE(3, 20);
    expect(() =>
      validateApiMedia('gemini', request('audio', 'audio/wav', wav), policy),
    ).toThrow('adapter_invalid_request');
  });
  it('accepts generated inline bytes only and derives media/hash from actual image bytes', () => {
    const result = parseApiGeneratedImage('openai', {
      data: [{ b64_json: png }],
    });
    expect(result.generatedImage.mediaType).toBe('image/png');
    expect(result.generatedImage.sha256).toBe(
      createHash('sha256').update(Buffer.from(png, 'base64')).digest('hex'),
    );
    expect(() =>
      parseApiGeneratedImage('openai', {
        data: [{ url: 'https://example.invalid/image.png' }],
      }),
    ).toThrow('api_image_invalid');
    expect(() =>
      parseApiGeneratedImage('gemini', {
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              role: 'model',
              parts: [{ inlineData: { mimeType: 'image/jpeg', data: png } }],
            },
          },
        ],
      }),
    ).toThrow('api_image_invalid');
  });
});
