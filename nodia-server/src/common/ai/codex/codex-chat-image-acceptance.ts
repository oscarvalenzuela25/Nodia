import {
  CodexChatAcceptanceStore,
  type CodexMcpAcceptance,
} from './codex-chat-acceptance.js';
import { CodexChatJournal } from './codex-chat-journal.js';
import { codexError } from './codex-contract.js';
import {
  isCodexChatImageMime,
  type CodexChatImageMime,
} from './codex-chat-images.js';

export interface CodexChatImageAcceptance extends CodexMcpAcceptance {
  mediaType: CodexChatImageMime;
}
/** Separate proof per exact MIME. Discovery/OCR/MCP acceptance cannot populate these files. */
export class CodexChatImageAcceptanceStore extends CodexChatAcceptanceStore {
  constructor(
    readonly mediaType: CodexChatImageMime,
    journal = new CodexChatJournal(),
  ) {
    super(journal);
  }
  override decode(value: unknown): CodexChatImageAcceptance {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !==
        'mediaType,nonceSha256,scope,terminalProofId,verifiedAt,version'
    )
      throw codexError('codex_protocol_invalid', 502);
    const { mediaType, ...base } = value as Record<string, unknown>;
    if (!isCodexChatImageMime(mediaType) || mediaType !== this.mediaType)
      throw codexError('codex_protocol_invalid', 502);
    return { ...super.decode(base), mediaType };
  }
  protected override async path(connectionId: string) {
    return `${await super.path(connectionId)}-image-${this.mediaType.slice(6)}`;
  }
  override async read(
    connectionId: string,
  ): Promise<CodexChatImageAcceptance | null> {
    return (await super.read(connectionId)) as CodexChatImageAcceptance | null;
  }
}
