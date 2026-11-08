import { createHash } from 'node:crypto';
import { codexError } from './codex-contract.js';
import {
  stageCodexChatMedia,
  cleanupCodexChatMedia,
  CODEX_CHAT_MEDIA_PATH_BYTES,
} from './codex-chat-media-storage.js';
import type { CodexChatJournal } from './codex-chat-journal.js';
import type { CodexChatIdentity } from './codex-chat-contract.js';

export const CODEX_CHAT_AUDIO_MIMES = ['audio/wav'] as const;
export type CodexChatAudioMime = (typeof CODEX_CHAT_AUDIO_MIMES)[number];
export interface CodexChatAudio {
  mediaType: CodexChatAudioMime;
  sha256: string;
  contentBase64: string;
}
export interface CodexChatAudioLimits {
  fileBytes: number;
  totalBytes: number;
  count: number;
  seconds: number;
}
export const CODEX_CHAT_AUDIO_PATH_BYTES = CODEX_CHAT_MEDIA_PATH_BYTES;
export const CODEX_CHAT_AUDIO_PATH_PLACEHOLDER = '\\'.repeat(
  CODEX_CHAT_AUDIO_PATH_BYTES,
);
export function isCodexChatAudioMime(
  value: unknown,
): value is CodexChatAudioMime {
  return value === 'audio/wav';
}
/** Exact oracle normalization only; words, numbers and unrecognized markup stay significant. */
export function normalizeCodexChatAudioTranscript(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.,!?;:"'¡¿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
/** Bounded RIFF PCM16 candidate. Only LIST INFO/JUNK metadata may accompany samples;
 * extended/compressed/wave-list layouts are rejected, never normalized or transcoded. */
function pcmDuration(bytes: Buffer, seconds: number): number {
  const invalid = () => codexError('codex_audio_invalid', 400);
  if (
    bytes.length < 44 ||
    bytes.toString('latin1', 0, 4) !== 'RIFF' ||
    bytes.readUInt32LE(4) !== bytes.length - 8 ||
    bytes.toString('latin1', 8, 12) !== 'WAVE'
  )
    throw invalid();
  let offset = 12,
    chunks = 0,
    byteRate: number | null = null,
    alignment = 0,
    sampleBytes: number | null = null;
  while (offset < bytes.length) {
    if (++chunks > 64 || offset + 8 > bytes.length) throw invalid();
    const type = bytes.toString('latin1', offset, offset + 4),
      length = bytes.readUInt32LE(offset + 4),
      start = offset + 8,
      end = start + length,
      next = end + (length % 2);
    if (next > bytes.length) throw invalid();
    if (type === 'fmt ') {
      if (
        byteRate !== null ||
        sampleBytes !== null ||
        length !== 16 ||
        bytes.readUInt16LE(start) !== 1 ||
        bytes.readUInt16LE(start + 14) !== 16
      )
        throw invalid();
      const channels = bytes.readUInt16LE(start + 2),
        rate = bytes.readUInt32LE(start + 4);
      byteRate = bytes.readUInt32LE(start + 8);
      alignment = bytes.readUInt16LE(start + 12);
      if (
        ![1, 2].includes(channels) ||
        rate < 1 ||
        alignment !== channels * 2 ||
        byteRate !== rate * alignment
      )
        throw invalid();
    } else if (type === 'data') {
      if (
        byteRate === null ||
        sampleBytes !== null ||
        length < 1 ||
        length % alignment !== 0 ||
        length > seconds * byteRate
      )
        throw invalid();
      sampleBytes = length;
    } else if (type === 'LIST') {
      if (length < 4 || bytes.toString('latin1', start, start + 4) !== 'INFO')
        throw invalid();
    } else if (type !== 'JUNK') throw invalid();
    offset = next;
  }
  if (byteRate === null || sampleBytes === null) throw invalid();
  return sampleBytes / byteRate;
}
export function decodeCodexChatAudio(
  audio: readonly CodexChatAudio[],
  limits: CodexChatAudioLimits,
): readonly {
  mediaType: CodexChatAudioMime;
  sha256: string;
  bytes: Buffer;
  durationSeconds: number;
}[] {
  if (
    !limits ||
    Object.keys(limits).sort().join(',') !==
      'count,fileBytes,seconds,totalBytes' ||
    Object.values(limits).some(
      (value) => !Number.isSafeInteger(value) || value < 1,
    ) ||
    !Array.isArray(audio) ||
    audio.length > limits.count
  )
    throw codexError('codex_audio_invalid', 400);
  let total = 0;
  return audio.map((item) => {
    if (
      !item ||
      Object.keys(item).sort().join(',') !== 'contentBase64,mediaType,sha256' ||
      !isCodexChatAudioMime(item.mediaType) ||
      typeof item.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(item.sha256) ||
      typeof item.contentBase64 !== 'string' ||
      !item.contentBase64.length ||
      item.contentBase64.length > 4 * Math.ceil(limits.fileBytes / 3)
    )
      throw codexError('codex_audio_invalid', 400);
    const bytes = Buffer.from(item.contentBase64, 'base64');
    total += bytes.length;
    if (
      !bytes.length ||
      bytes.length > limits.fileBytes ||
      total > limits.totalBytes ||
      bytes.toString('base64') !== item.contentBase64 ||
      createHash('sha256').update(bytes).digest('hex') !== item.sha256
    )
      throw codexError('codex_audio_invalid', 400);
    return {
      mediaType: item.mediaType,
      sha256: item.sha256,
      bytes,
      durationSeconds: pcmDuration(bytes, limits.seconds),
    };
  });
}
export function stageCodexChatAudio(
  journal: CodexChatJournal,
  identity: CodexChatIdentity,
  audio: ReturnType<typeof decodeCodexChatAudio>,
  signal: AbortSignal,
): Promise<readonly string[]> {
  return stageCodexChatMedia(journal, identity, 'audio', audio, signal);
}
/** Caller must first prove the exact attempt's native process group is closed. */
export function cleanupCodexChatAudio(
  journal: CodexChatJournal,
  identity: CodexChatIdentity,
): Promise<void> {
  return cleanupCodexChatMedia(journal, identity, 'audio');
}
