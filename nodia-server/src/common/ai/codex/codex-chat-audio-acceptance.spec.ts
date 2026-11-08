import { describe, expect, it } from 'vitest';
import { CodexChatAudioAcceptanceStore } from './codex-chat-audio-acceptance.js';
import type { CodexChatJournal } from './codex-chat-journal.js';

const proof = () => ({
  version: 1,
  verifiedAt: new Date().toISOString(),
  terminalProofId: '11111111-1111-4111-8111-111111111111',
  nonceSha256: 'a'.repeat(64),
  scope: {
    connectionId: '1',
    resourceKey: 'codex-profile:' + 'b'.repeat(64),
    sessionGeneration: 'c'.repeat(32),
    configurationGeneration: 'd'.repeat(64),
    modelId: 'synthetic-discovered-model',
    effortId: null,
    runtimeFingerprint: 'e'.repeat(64),
  },
});
describe('Codex original audio acceptance isolation', () => {
  it('requires original WAV proof and validates the inherited exact scope and terminal receipt', () => {
    const store = new CodexChatAudioAcceptanceStore('audio/wav');
    expect(store.decode({ ...proof(), mediaType: 'audio/wav' }).scope).toEqual(
      proof().scope,
    );
    for (const value of [
      proof(),
      { ...proof(), mediaType: 'audio/webm' },
      { ...proof(), mediaType: 'image/png' },
      { ...proof(), mediaType: 'audio/wav', transcript: 'not retained' },
      {
        ...proof(),
        mediaType: 'audio/wav',
        scope: { ...proof().scope, runtimeFingerprint: 'invalid' },
      },
      { ...proof(), mediaType: 'audio/wav', terminalProofId: 'invalid' },
    ])
      expect(() => store.decode(value)).toThrow();
  });
  it('uses a separate audio-wav proof path, not MCP or image acceptance', async () => {
    class InspectableStore extends CodexChatAudioAcceptanceStore {
      proofPath(id: string) {
        return this.path(id);
      }
    }
    const journal = {
      identity: async () => ({}),
      root: async () => '/private/chat-jobs',
    } as unknown as CodexChatJournal;
    const path = await new InspectableStore('audio/wav', journal).proofPath(
      '1',
    );
    expect(path.replaceAll('\\', '/')).toBe(
      '/private/1/nodia-chat-mcp-audio-wav',
    );
  });
});
