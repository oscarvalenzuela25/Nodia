import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decodeApiChatWav } from './api-chat-wav.js';

const limits = { fileBytes: 4096, totalBytes: 8192, count: 2, seconds: 1 };
function chunk(name: string, payload: Buffer, padding = true): Buffer {
  const header = Buffer.alloc(8);
  header.write(name);
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([
    header,
    payload,
    ...(padding && payload.length % 2 ? [Buffer.alloc(1)] : []),
  ]);
}
function format(channels = 1): Buffer {
  const value = Buffer.alloc(16);
  value.writeUInt16LE(1);
  value.writeUInt16LE(channels, 2);
  value.writeUInt32LE(8000, 4);
  value.writeUInt32LE(8000 * channels * 2, 8);
  value.writeUInt16LE(channels * 2, 12);
  value.writeUInt16LE(16, 14);
  return value;
}
function riff(
  chunks = [chunk('fmt ', format()), chunk('data', Buffer.alloc(160))],
): Buffer {
  const header = Buffer.alloc(12);
  header.write('RIFF');
  header.writeUInt32LE(4 + chunks.reduce((n, item) => n + item.length, 0), 4);
  header.write('WAVE', 8);
  return Buffer.concat([header, ...chunks]);
}
function input(bytes: Buffer) {
  return {
    mediaType: 'audio/wav' as const,
    contentBase64: bytes.toString('base64'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

describe('API pure PCM16 WAV validation', () => {
  it.each([1, 2])(
    'preserves exact bytes and duration for %s channels with bounded metadata',
    (channels) => {
      const bytes = riff([
        chunk('JUNK', Buffer.from([1])),
        chunk('fmt ', format(channels)),
        chunk('LIST', Buffer.from('INFO')),
        chunk('data', Buffer.alloc(160 * channels)),
      ]);
      const result = decodeApiChatWav([input(bytes)], limits);
      expect(result).toEqual([
        {
          mediaType: 'audio/wav',
          sha256: input(bytes).sha256,
          bytes,
          durationSeconds: 0.01,
        },
      ]);
    },
  );

  it.each([
    [
      'compressed fmt',
      () => {
        const value = format();
        value.writeUInt16LE(3);
        return riff([chunk('fmt ', value), chunk('data', Buffer.alloc(160))]);
      },
    ],
    [
      'unsupported channels',
      () => riff([chunk('fmt ', format(3)), chunk('data', Buffer.alloc(480))]),
    ],
    [
      'wrong alignment',
      () => {
        const value = format();
        value.writeUInt16LE(1, 12);
        return riff([chunk('fmt ', value), chunk('data', Buffer.alloc(160))]);
      },
    ],
    [
      'wrong byte rate',
      () => {
        const value = format();
        value.writeUInt32LE(1, 8);
        return riff([chunk('fmt ', value), chunk('data', Buffer.alloc(160))]);
      },
    ],
    [
      'extended fmt',
      () =>
        riff([
          chunk('fmt ', Buffer.concat([format(), Buffer.alloc(2)])),
          chunk('data', Buffer.alloc(160)),
        ]),
    ],
    [
      'data before fmt',
      () => riff([chunk('data', Buffer.alloc(160)), chunk('fmt ', format())]),
    ],
    [
      'duplicate fmt',
      () =>
        riff([
          chunk('fmt ', format()),
          chunk('fmt ', format()),
          chunk('data', Buffer.alloc(160)),
        ]),
    ],
    [
      'duplicate data',
      () =>
        riff([
          chunk('fmt ', format()),
          chunk('data', Buffer.alloc(160)),
          chunk('data', Buffer.alloc(160)),
        ]),
    ],
    [
      'unknown chunk',
      () =>
        riff([
          chunk('fmt ', format()),
          chunk('evil', Buffer.alloc(2)),
          chunk('data', Buffer.alloc(160)),
        ]),
    ],
    [
      'missing odd padding',
      () =>
        riff([
          chunk('JUNK', Buffer.from([1]), false),
          chunk('fmt ', format()),
          chunk('data', Buffer.alloc(160)),
        ]),
    ],
    ['truncated header', () => Buffer.from('RIFF')],
    ['truncated body', () => riff().subarray(0, -1)],
    [
      'wrong RIFF length',
      () => {
        const value = riff();
        value.writeUInt32LE(value.length, 4);
        return value;
      },
    ],
    [
      'wrong WAVE signature',
      () => {
        const value = riff();
        value.write('WAVX', 8);
        return value;
      },
    ],
    [
      'misaligned samples',
      () => riff([chunk('fmt ', format()), chunk('data', Buffer.alloc(159))]),
    ],
  ] as const)('rejects %s', (_name, bytes) => {
    expect(() => decodeApiChatWav([input(bytes())], limits)).toThrow(
      'api_chat_wav_invalid',
    );
  });

  it('rejects forged hashes, noncanonical base64 and exact policy-bound excesses', () => {
    const file = input(riff());
    expect(() =>
      decodeApiChatWav([{ ...file, sha256: '0'.repeat(64) }], limits),
    ).toThrow();
    expect(() =>
      decodeApiChatWav(
        [{ ...file, contentBase64: file.contentBase64 + '\n' }],
        limits,
      ),
    ).toThrow();
    expect(() =>
      decodeApiChatWav([file], { ...limits, fileBytes: riff().length - 1 }),
    ).toThrow();
    expect(() =>
      decodeApiChatWav([file, file], {
        ...limits,
        totalBytes: 2 * riff().length - 1,
      }),
    ).toThrow();
    expect(() =>
      decodeApiChatWav([file, file], { ...limits, count: 1 }),
    ).toThrow();
    const long = riff([
      chunk('fmt ', format()),
      chunk('data', Buffer.alloc(16002)),
    ]);
    expect(() =>
      decodeApiChatWav([input(long)], {
        ...limits,
        fileBytes: 20000,
        totalBytes: 20000,
      }),
    ).toThrow();
  });
});
