import {
  CodexChatAcceptanceStore,
  type CodexMcpAcceptance,
} from './codex-chat-acceptance.js';
import { CodexChatJournal } from './codex-chat-journal.js';
import { codexError } from './codex-contract.js';
import {
  isCodexChatAudioMime,
  type CodexChatAudioMime,
} from './codex-chat-audio.js';

export interface CodexChatAudioAcceptance extends CodexMcpAcceptance {
  mediaType: CodexChatAudioMime;
}
/** Original-audio proof is distinct from image, MCP, transcription and discovery proofs. */
export class CodexChatAudioAcceptanceStore extends CodexChatAcceptanceStore {
  constructor(
    readonly mediaType: CodexChatAudioMime,
    journal = new CodexChatJournal(),
  ) {
    super(journal);
  }
  override decode(value: unknown): CodexChatAudioAcceptance {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !==
        'mediaType,nonceSha256,scope,terminalProofId,verifiedAt,version'
    )
      throw codexError('codex_protocol_invalid', 502);
    const { mediaType, ...base } = value as Record<string, unknown>;
    if (!isCodexChatAudioMime(mediaType) || mediaType !== this.mediaType)
      throw codexError('codex_protocol_invalid', 502);
    return { ...super.decode(base), mediaType };
  }
  protected override async path(connectionId: string) {
    return `${await super.path(connectionId)}-audio-wav`;
  }
  override async read(
    connectionId: string,
  ): Promise<CodexChatAudioAcceptance | null> {
    return (await super.read(connectionId)) as CodexChatAudioAcceptance | null;
  }
}
