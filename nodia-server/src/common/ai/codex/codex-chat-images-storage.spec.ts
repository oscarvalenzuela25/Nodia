import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { constants } from 'node:fs';
import type { CodexChatJournal } from './codex-chat-journal.js';
import type { CodexChatIdentity } from './codex-chat-contract.js';
import {
  cleanupCodexChatImages,
  stageCodexChatImages,
} from './codex-chat-images.js';
import {
  cleanupCodexChatAudio,
  stageCodexChatAudio,
} from './codex-chat-audio.js';

const disk = vi.hoisted(() => ({
  entries: new Map<
    string,
    {
      directory: boolean;
      mode: number;
      uid: number;
      nlink: number;
      symbolic?: boolean;
      bytes?: Buffer;
    }
  >(),
  failOpen: false,
  removed: [] as string[],
  flags: [] as number[],
}));
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async (path: string) => {
    if (disk.entries.has(path))
      throw Object.assign(Error(), { code: 'EEXIST' });
    disk.entries.set(path, {
      directory: true,
      mode: 0o700,
      uid: 123,
      nlink: 1,
    });
  }),
  lstat: vi.fn(async (path: string) => {
    const value = disk.entries.get(path);
    if (!value) throw Object.assign(Error(), { code: 'ENOENT' });
    return {
      ...value,
      isDirectory: () => value.directory,
      isFile: () => !value.directory,
      isSymbolicLink: () => value.symbolic === true,
    };
  }),
  realpath: vi.fn(async (path: string) => path),
  open: vi.fn(async (path: string, flags: number) => {
    disk.flags.push(flags);
    if (disk.failOpen && (path.endsWith('1.png') || path.endsWith('1.wav')))
      throw Object.assign(Error(), { code: 'EIO' });
    if (disk.entries.has(path))
      throw Object.assign(Error(), { code: 'EEXIST' });
    const file = {
      directory: false,
      mode: 0o600,
      uid: 123,
      nlink: 1,
      bytes: Buffer.alloc(0),
    };
    disk.entries.set(path, file);
    return {
      stat: async () => ({ ...file, isFile: () => true }),
      writeFile: async (bytes: Buffer) => {
        file.bytes = Buffer.from(bytes);
      },
      sync: async () => {},
      close: async () => {},
    };
  }),
  readdir: vi.fn(async (path: string) =>
    [...disk.entries.keys()]
      .filter(
        (key) =>
          key.startsWith(join(path, 'x').slice(0, -1)) &&
          !key.slice(path.length + 1).includes('/') &&
          !key.slice(path.length + 1).includes('\\'),
      )
      .map((key) => key.slice(path.length + 1)),
  ),
  rm: vi.fn(async (path: string) => {
    disk.removed.push(path);
    disk.entries.delete(path);
  }),
  rmdir: vi.fn(async (path: string) => {
    disk.removed.push(path);
    disk.entries.delete(path);
  }),
}));

const profile = join('private', 'profiles', '1');
const identity: CodexChatIdentity = {
  engine: 'agentic',
  attemptId: '11111111-1111-4111-8111-111111111111',
  operationRef: '11111111-1111-4111-8111-111111111111',
  adapterIdentity: {
    providerKey: 'openai',
    contractVersion: 'nodia-ai-codex-chat/1',
    connectionId: '1',
  },
  resourceKey: 'codex-profile:' + 'a'.repeat(64),
  sessionGeneration: 'b'.repeat(32),
};
const journal = {
  root: async () => join('private', 'profiles', 'chat-jobs'),
  identity: async () => ({
    resourceKey: identity.resourceKey,
    runtimeSessionId: identity.sessionGeneration,
  }),
} as CodexChatJournal;
let uidDescriptor: PropertyDescriptor | undefined;
beforeEach(() => {
  uidDescriptor = Object.getOwnPropertyDescriptor(process, 'getuid');
  Object.defineProperty(process, 'getuid', {
    configurable: true,
    value: () => 123,
  });
  disk.entries.clear();
  disk.flags.length = 0;
  disk.removed.length = 0;
  disk.failOpen = false;
  disk.entries.set(profile, {
    directory: true,
    mode: 0o700,
    uid: 123,
    nlink: 1,
  });
});
afterEach(() => {
  if (uidDescriptor) Object.defineProperty(process, 'getuid', uidDescriptor);
  else Reflect.deleteProperty(process, 'getuid');
});

describe.each(['image', 'audio'] as const)(
  'Codex %s staging ownership and explicit cleanup',
  (kind) => {
    const root = join(
      profile,
      kind === 'image' ? 'nodia-chat-images' : 'nodia-chat-audio',
    );
    const extension = kind === 'image' ? 'png' : 'wav';
    const stage = (
      journal: CodexChatJournal,
      identity: CodexChatIdentity,
      inputs: readonly {
        mediaType: 'image/png' | 'audio/wav';
        sha256: string;
        bytes: Buffer;
        durationSeconds: number;
      }[],
      signal: AbortSignal,
    ) =>
      kind === 'image'
        ? stageCodexChatImages(
            journal,
            identity,
            inputs.map((item) => ({
              ...item,
              mediaType: 'image/png' as const,
            })),
            signal,
          )
        : stageCodexChatAudio(
            journal,
            identity,
            inputs.map((item) => ({
              ...item,
              mediaType: 'audio/wav' as const,
            })),
            signal,
          );
    const cleanup =
      kind === 'image' ? cleanupCodexChatImages : cleanupCodexChatAudio;
    const decoded = [
      {
        mediaType:
          kind === 'image' ? ('image/png' as const) : ('audio/wav' as const),
        sha256: 'a'.repeat(64),
        bytes: Buffer.from('synthetic inspected media'),
        durationSeconds: 1,
      },
    ];
    it('uses only identity-derived private paths, exclusive no-follow files and bounded permissions', async () => {
      const [path] = await stage(
        journal,
        identity,
        decoded,
        new AbortController().signal,
      );
      expect(path).toBe(join(root, identity.attemptId, `0.${extension}`));
      expect(disk.entries.get(path)?.mode).toBe(0o600);
      expect(disk.entries.get(join(root, identity.attemptId))?.mode).toBe(
        0o700,
      );
      expect(disk.flags[0] & constants.O_EXCL).toBe(constants.O_EXCL);
      expect(disk.flags[0] & constants.O_NOFOLLOW).toBe(
        constants.O_NOFOLLOW ?? 0,
      );
      expect(disk.removed).toEqual([]); // staging alone never asserts native closure
      await cleanup(journal, identity);
      expect(disk.entries.has(join(root, identity.attemptId))).toBe(false);
      expect(disk.entries.has(profile)).toBe(true);
    });
    it('retains partial staging on write failure until the owning supervisor explicitly proves closure', async () => {
      disk.failOpen = true;
      await expect(
        stage(
          journal,
          identity,
          [...decoded, ...decoded],
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: 'EIO' });
      expect(
        disk.entries.has(join(root, identity.attemptId, `0.${extension}`)),
      ).toBe(true);
      expect(disk.removed).toEqual([]);
      await cleanup(journal, identity);
      expect(
        disk.entries.has(join(root, identity.attemptId, `0.${extension}`)),
      ).toBe(false);
    });
    it.each([
      'hardlink',
      'symbolic',
      'wrong_owner',
      'public_permissions',
    ] as const)(
      'refuses %s without deleting valid neighbouring data',
      async (failure) => {
        const [path] = await stage(
          journal,
          identity,
          decoded,
          new AbortController().signal,
        );
        const other = join(root, identity.attemptId, `1.${extension}`);
        disk.entries.set(other, {
          ...disk.entries.get(path)!,
          ...(failure === 'hardlink'
            ? { nlink: 2 }
            : failure === 'symbolic'
              ? { symbolic: true }
              : failure === 'wrong_owner'
                ? { uid: 456 }
                : { mode: 0o644 }),
        });
        await expect(cleanup(journal, identity)).rejects.toMatchObject({
          code: `codex_${kind}_storage_invalid`,
        });
        expect(disk.entries.has(path)).toBe(true);
        expect(disk.removed).toEqual([]);
      },
    );
    it('does not follow an existing staging symlink or accept another attempt path', async () => {
      disk.entries.set(root, {
        directory: true,
        mode: 0o700,
        uid: 123,
        nlink: 1,
        symbolic: true,
      });
      await expect(
        stage(journal, identity, decoded, new AbortController().signal),
      ).rejects.toMatchObject({ code: `codex_${kind}_storage_invalid` });
      await expect(
        cleanup(journal, { ...identity, attemptId: '../other' }),
      ).rejects.toThrow();
      expect(disk.removed).toEqual([]);
    });
  },
);
