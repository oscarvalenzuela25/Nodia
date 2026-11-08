import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  decodeCodexChatAudio,
  normalizeCodexChatAudioTranscript,
  type CodexChatAudio,
} from './codex-chat-audio.js';

/** Synthetic PCM only; no speech, account or provider call. */
function wav(seconds = 1, channels = 1, rate = 8000) {
  const data = seconds * channels * rate * 2;
  const bytes = Buffer.alloc(44 + data);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * channels * 2, 28);
  bytes.writeUInt16LE(channels * 2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(data, 40);
  return bytes;
}
const audio = (bytes = wav()): CodexChatAudio => ({
  mediaType: 'audio/wav',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  contentBase64: bytes.toString('base64'),
});
const limits = {
  fileBytes: 20 * 1024 * 1024,
  totalBytes: 40 * 1024 * 1024,
  count: 4,
  seconds: 300,
};

describe('Codex original WAV PCM byte contract', () => {
  it('normalizes only case, unicode compatibility, defined punctuation and whitespace', () => {
    expect(
      normalizeCodexChatAudioTranscript(
        '  ¡EL faro, VERDE!\nIlumina: "la montaña". ',
      ),
    ).toBe('el faro verde ilumina la montaña');
    expect(normalizeCodexChatAudioTranscript('ｈｏｌａ\t¿QUÉ?')).toBe(
      'hola qué',
    );
    for (const different of [
      'el faro rojo',
      'el faro verde 2',
      'el faro verde dos',
      'el faro verde extra',
      '```el faro verde```',
      '**el faro verde**',
    ])
      expect(normalizeCodexChatAudioTranscript(different)).not.toBe(
        'el faro verde',
      );
    expect(normalizeCodexChatAudioTranscript('2')).not.toBe(
      normalizeCodexChatAudioTranscript('dos'),
    );
    expect(normalizeCodexChatAudioTranscript('montana')).not.toBe(
      normalizeCodexChatAudioTranscript('montaña'),
    );
  });
  it.each([1, 2])(
    'decodes real PCM16 samples and duration for %i channels',
    (channels) => {
      const bytes = wav(2, channels);
      const input = audio(bytes);
      const [result] = decodeCodexChatAudio([input], limits);
      input.contentBase64 = '';
      bytes.fill(0);
      expect(result.durationSeconds).toBe(2);
      expect(result.bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(result.sha256).toBe(
        createHash('sha256').update(result.bytes).digest('hex'),
      );
    },
  );
  it('accepts bounded LIST INFO/JUNK metadata without counting it as samples', () => {
    const original = wav();
    const metadata = Buffer.concat([
      Buffer.from('LIST'),
      Buffer.from([4, 0, 0, 0]),
      Buffer.from('INFO'),
      Buffer.from('JUNK'),
      Buffer.from([1, 0, 0, 0, 7, 0]),
    ]);
    const bytes = Buffer.concat([
      original.subarray(0, 36),
      metadata,
      original.subarray(36),
    ]);
    bytes.writeUInt32LE(bytes.length - 8, 4);
    expect(
      decodeCodexChatAudio([audio(bytes)], limits)[0].durationSeconds,
    ).toBe(1);
  });
  it('rejects missing padding, ambiguous LIST waveform data, duplicate fmt and excessive chunk counts', () => {
    const original = wav();
    const wrap = (chunk: Buffer) => {
      const bytes = Buffer.concat([
        original.subarray(0, 36),
        chunk,
        original.subarray(36),
      ]);
      bytes.writeUInt32LE(bytes.length - 8, 4);
      return bytes;
    };
    const absentPadding = wrap(Buffer.from('JUNK\x01\0\0\0x'));
    const ambiguousList = wrap(Buffer.from('LIST\x04\0\0\0wavl'));
    const repeatedFmt = wrap(original.subarray(12, 36));
    const tooMany = wrap(
      Buffer.concat(
        Array.from({ length: 64 }, () => Buffer.from('JUNK\0\0\0\0')),
      ),
    );
    for (const bytes of [absentPadding, ambiguousList, repeatedFmt, tooMany])
      expect(() => decodeCodexChatAudio([audio(bytes)], limits)).toThrow();
  });
  it('enforces inclusive duration, file, total and count limits', () => {
    const bytes = wav(300);
    expect(
      decodeCodexChatAudio([audio(bytes)], {
        ...limits,
        fileBytes: bytes.length,
        totalBytes: bytes.length,
      })[0].durationSeconds,
    ).toBe(300);
    expect(() => decodeCodexChatAudio([audio(wav(301))], limits)).toThrow();
    expect(() =>
      decodeCodexChatAudio([audio(bytes)], {
        ...limits,
        fileBytes: bytes.length - 1,
      }),
    ).toThrow();
    expect(() =>
      decodeCodexChatAudio([audio(), audio()], {
        ...limits,
        totalBytes: wav().length * 2 - 1,
      }),
    ).toThrow();
    expect(() =>
      decodeCodexChatAudio(
        Array.from({ length: 5 }, () => audio()),
        limits,
      ),
    ).toThrow();
  });
  it.each([
    ['compressed', 20, 6, 2],
    ['float', 20, 3, 2],
    ['extensible', 20, 65534, 2],
    ['three channels', 22, 3, 2],
    ['eight bits', 34, 8, 2],
    ['zero rate', 24, 0, 4],
    ['byte rate mismatch', 28, 123, 4],
    ['alignment mismatch', 32, 1, 2],
    ['RIFF length mismatch', 4, 7, 4],
    ['fmt extension', 16, 18, 4],
    ['empty samples', 40, 0, 4],
    ['partial sample', 40, 15999, 4],
  ] as const)(
    'rejects %s even when hash matches the bytes',
    (_label, offset, value, width) => {
      const bytes = wav();
      if (width === 2) bytes.writeUInt16LE(value, offset);
      else bytes.writeUInt32LE(value, offset);
      expect(() => decodeCodexChatAudio([audio(bytes)], limits)).toThrow(
        expect.objectContaining({ code: 'codex_audio_invalid' }),
      );
    },
  );
  it('rejects RF64, truncated data, extra chunks, duplicate data and trailing bytes', () => {
    const rf64 = wav();
    rf64.write('RF64');
    const duplicate = Buffer.concat([wav(), Buffer.from('data\0\0\0\0')]);
    duplicate.writeUInt32LE(duplicate.length - 8, 4);
    const unknown = wav();
    unknown.write('JUNK', 36);
    const maskedMagic = wav();
    maskedMagic[0] |= 0x80;
    for (const bytes of [
      rf64,
      maskedMagic,
      wav().subarray(0, 43),
      duplicate,
      unknown,
      Buffer.concat([wav(), Buffer.alloc(1)]),
    ])
      expect(() => decodeCodexChatAudio([audio(bytes)], limits)).toThrow();
  });
  it.each([
    { sha256: '0'.repeat(64) },
    { mediaType: 'audio/webm' },
    { contentBase64: wav().toString('base64') + '\n' },
    { contentBase64: '%%%' },
    { unexpected: true },
  ])('rejects untrusted transport claims %j', (change) => {
    expect(() =>
      decodeCodexChatAudio(
        [{ ...audio(), ...change } as CodexChatAudio],
        limits,
      ),
    ).toThrow();
  });
  it.each([
    { seconds: 0 },
    { seconds: Infinity },
    { count: 1.5 },
    { fileBytes: -1 },
    { unexpected: 1 },
  ])('rejects invalid policy limits %j', (change) => {
    expect(() =>
      decodeCodexChatAudio([audio()], { ...limits, ...change }),
    ).toThrow();
  });
});
