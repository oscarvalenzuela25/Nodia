import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  realpath,
  readdir,
  rm,
  rmdir,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { codexError } from './codex-contract.js';
import {
  assertCodexChatIdentity,
  CodexChatJournal,
} from './codex-chat-journal.js';
import type { CodexChatIdentity } from './codex-chat-contract.js';

export type CodexChatMediaKind = 'image' | 'audio';
export const CODEX_CHAT_MEDIA_PATH_BYTES = 4096;
function storageError(kind: CodexChatMediaKind) {
  return codexError(
    kind === 'image'
      ? 'codex_image_storage_invalid'
      : 'codex_audio_storage_invalid',
    503,
  );
}
function extensionFor(kind: CodexChatMediaKind, mime: string): string {
  if (kind === 'audio' && mime === 'audio/wav') return 'wav';
  if (kind === 'image') {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/webp') return 'webp';
  }
  throw storageError(kind);
}
async function privateDirectory(
  path: string,
  create: boolean,
  kind: CodexChatMediaKind,
) {
  if (create) await mkdir(path, { mode: 0o700 });
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    info.uid !== process.getuid?.() ||
    (info.mode & 0o077) !== 0 ||
    (await realpath(path)) !== path
  )
    throw storageError(kind);
}
async function mediaRoot(
  journal: CodexChatJournal,
  identity: CodexChatIdentity,
  create: boolean,
  kind: CodexChatMediaKind,
) {
  if (kind !== 'image' && kind !== 'audio')
    throw codexError('codex_protocol_invalid', 502);
  assertCodexChatIdentity(identity);
  const current = await journal.identity(
    identity.adapterIdentity.connectionId,
    false,
    false,
  );
  if (
    current.resourceKey !== identity.resourceKey ||
    (create && current.runtimeSessionId !== identity.sessionGeneration)
  )
    throw codexError('codex_request_conflict', 409);
  const profile = join(
    dirname(await journal.root()),
    identity.adapterIdentity.connectionId,
  );
  await privateDirectory(profile, false, kind);
  const root = join(
    profile,
    kind === 'image' ? 'nodia-chat-images' : 'nodia-chat-audio',
  );
  if (create) {
    try {
      await privateDirectory(root, true, kind);
    } catch (e) {
      if (!(e && typeof e === 'object' && 'code' in e && e.code === 'EEXIST'))
        throw e;
      await privateDirectory(root, false, kind);
    }
  } else await privateDirectory(root, false, kind);
  return root;
}
/** Paths are derived only from the private profile/attempt identity; callers never supply paths. */
export async function stageCodexChatMedia(
  journal: CodexChatJournal,
  identity: CodexChatIdentity,
  kind: CodexChatMediaKind,
  media: readonly { mediaType: string; bytes: Buffer }[],
  signal: AbortSignal,
): Promise<readonly string[]> {
  signal.throwIfAborted();
  const root = await mediaRoot(journal, identity, true, kind),
    directory = join(root, identity.attemptId);
  await privateDirectory(directory, true, kind);
  const paths: string[] = [];
  // Partial staging remains owned by the already-durable attempt. The supervisor cleans it
  // only after proving its native group closed, including on write failure or cancellation.
  for (const [index, item] of media.entries()) {
    signal.throwIfAborted();
    const extension = extensionFor(kind, item.mediaType);
    const path = join(directory, `${index}.${extension}`);
    if (Buffer.byteLength(path) > CODEX_CHAT_MEDIA_PATH_BYTES)
      throw storageError(kind);
    const handle = await open(
      path,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      const info = await handle.stat();
      if (
        !info.isFile() ||
        info.uid !== process.getuid?.() ||
        (info.mode & 0o077) !== 0 ||
        info.nlink !== 1
      )
        throw storageError(kind);
      await handle.writeFile(item.bytes, { signal });
      await handle.sync();
    } finally {
      await handle.close();
    }
    paths.push(path);
  }
  return paths;
}
/** Caller must first prove the exact attempt's native process group is closed. */
export async function cleanupCodexChatMedia(
  journal: CodexChatJournal,
  identity: CodexChatIdentity,
  kind: CodexChatMediaKind,
): Promise<void> {
  let root: string;
  try {
    root = await mediaRoot(journal, identity, false, kind);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT')
      return;
    throw e;
  }
  const directory = join(root, identity.attemptId);
  try {
    await privateDirectory(directory, false, kind);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT')
      return;
    throw e;
  }
  const names = await readdir(directory);
  if (names.length > 1000) throw storageError(kind);
  const paths: string[] = [];
  for (const name of names) {
    if (
      !(
        kind === 'image'
          ? /^(0|[1-9]\d{0,2})\.(png|jpg|webp)$/
          : /^(0|[1-9]\d{0,2})\.wav$/
      ).test(name)
    )
      throw storageError(kind);
    const path = join(directory, name),
      info = await lstat(path);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== process.getuid?.() ||
      (info.mode & 0o077) !== 0 ||
      info.nlink !== 1
    )
      throw storageError(kind);
    paths.push(path);
  }
  for (const path of paths) await rm(path);
  await rmdir(directory);
}
