import { constants, createReadStream } from 'node:fs';
import { lstat, open, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { CodexChatJournal } from './codex-chat-journal.js';
import { codexError } from './codex-contract.js';
import { codexLoginUuid } from './codex-login-journal.js';

export interface CodexMcpAcceptanceScope {
  connectionId: string;
  resourceKey: string;
  sessionGeneration: string;
  configurationGeneration: string;
  modelId: string;
  effortId: string | null;
  runtimeFingerprint: string;
}
export interface CodexMcpAcceptance {
  version: 1;
  scope: CodexMcpAcceptanceScope;
  verifiedAt: string;
  terminalProofId: string;
  nonceSha256: string;
}
const hash = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const absent = (e: unknown) =>
  !!e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT';
export function sameCodexMcpScope(
  a: CodexMcpAcceptanceScope,
  b: CodexMcpAcceptanceScope,
) {
  return (
    (Object.keys(a) as (keyof CodexMcpAcceptanceScope)[]).every(
      (key) => a[key] === b[key],
    ) && Object.keys(a).length === Object.keys(b).length
  );
}

/** One bounded technical acceptance per connection. No credentials, prompt or result. */
export class CodexChatAcceptanceStore {
  constructor(private readonly journal = new CodexChatJournal()) {}
  decode(value: unknown): CodexMcpAcceptance {
    const v = value as CodexMcpAcceptance | null;
    const s = v?.scope;
    if (
      !v ||
      typeof v !== 'object' ||
      Array.isArray(v) ||
      Object.keys(v).sort().join(',') !==
        'nonceSha256,scope,terminalProofId,verifiedAt,version' ||
      v.version !== 1 ||
      !s ||
      typeof s !== 'object' ||
      Array.isArray(s) ||
      Object.keys(s).sort().join(',') !==
        'configurationGeneration,connectionId,effortId,modelId,resourceKey,runtimeFingerprint,sessionGeneration' ||
      typeof s.connectionId !== 'string' ||
      !/^[1-9]\d{0,18}$/.test(s.connectionId) ||
      BigInt(s.connectionId) > 9223372036854775807n ||
      typeof s.resourceKey !== 'string' ||
      !/^codex-profile:[a-f0-9]{64}$/.test(s.resourceKey) ||
      typeof s.sessionGeneration !== 'string' ||
      !/^[a-f0-9]{32}$/.test(s.sessionGeneration) ||
      !hash(s.configurationGeneration) ||
      !hash(s.runtimeFingerprint) ||
      typeof s.modelId !== 'string' ||
      !s.modelId.trim() ||
      Buffer.byteLength(s.modelId) > 128 ||
      !(
        s.effortId === null ||
        (typeof s.effortId === 'string' &&
          /^[a-z][a-z0-9_-]{0,31}$/.test(s.effortId))
      ) ||
      typeof v.verifiedAt !== 'string' ||
      !Number.isFinite(Date.parse(v.verifiedAt)) ||
      Date.parse(v.verifiedAt) > Date.now() + 5000 ||
      typeof v.terminalProofId !== 'string' ||
      !codexLoginUuid.test(v.terminalProofId) ||
      !hash(v.nonceSha256)
    )
      throw codexError('codex_protocol_invalid', 502);
    return v;
  }
  protected async path(connectionId: string) {
    await this.journal.identity(connectionId, false, false);
    return join(
      dirname(await this.journal.root()),
      connectionId,
      'nodia-chat-mcp',
    );
  }
  async read(connectionId: string): Promise<CodexMcpAcceptance | null> {
    const file = await this.path(connectionId);
    let handle;
    try {
      handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (e) {
      if (absent(e)) return null;
      throw e;
    }
    try {
      const info = await handle.stat();
      if (
        !info.isFile() ||
        info.nlink !== 1 ||
        info.uid !== process.getuid!() ||
        (info.mode & 0o077) !== 0 ||
        info.size > 4096
      )
        throw codexError('codex_protocol_invalid', 502);
      const value = this.decode(JSON.parse(await handle.readFile('utf8')));
      if (value.scope.connectionId !== connectionId)
        throw codexError('codex_protocol_invalid', 502);
      // A login/logout may rotate the marker after an observer yielded its
      // physical profile. Never revive the old proof from that in-flight read.
      const current = await this.journal.identity(connectionId, false, false);
      if (
        value.scope.sessionGeneration !== current.runtimeSessionId ||
        value.scope.resourceKey !== current.resourceKey
      )
        return null;
      return value;
    } finally {
      await handle.close();
    }
  }
  async write(value: CodexMcpAcceptance) {
    this.decode(value);
    const file = await this.path(value.scope.connectionId);
    const temporary = `${file}.${randomUUID()}.tmp`;
    const h = await open(temporary, 'wx', 0o600);
    try {
      try {
        await h.writeFile(JSON.stringify(value));
        await h.sync();
      } finally {
        await h.close();
      }
      await rename(temporary, file);
      const directory = await open(dirname(file), 'r');
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await rm(temporary, { force: true });
    }
  }
  async invalidate(scope: CodexMcpAcceptanceScope) {
    await this.journal.admission(async () => {
      const value = await this.read(scope.connectionId);
      if (value && sameCodexMcpScope(value.scope, scope)) {
        const file = await this.path(scope.connectionId);
        await rm(file);
        const directory = await open(dirname(file), 'r');
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
    });
  }
}

// Cache only immutable file identities; changing bytes/deployment invalidates the digest.
const fingerprints = new Map<string, Promise<string>>();
export async function codexChatRuntimeFingerprint(
  executable: string,
): Promise<string> {
  const files = [
    executable,
    ...[
      './codex-chat-runtime.js',
      './codex-generated-image.js',
      './codex-chat-images.js',
      './codex-chat-image-acceptance.js',
      './codex-chat-audio.js',
      './codex-chat-audio-acceptance.js',
      './codex-chat-media-storage.js',
      './codex-chat-acceptance.js',
      './codex-chat-journal.js',
      './codex-contract.js',
      './codex-rpc.js',
      './codex-runtime.service.js',
      './codex-profile-lease.js',
      './codex-process-ownership.js',
      '../../../ai-provider/use-case/codex-chat-tool-channel.use-case.js',
      '../../../nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.js',
    ].map((name) => fileURLToPath(new URL(name, import.meta.url))),
  ];
  const identities = await Promise.all(
    files.map(async (file) => {
      const info = await lstat(file, { bigint: true });
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size > 512n * 1024n * 1024n
      )
        throw codexError('codex_runtime_unavailable');
      return `${file}\0${info.dev}\0${info.ino}\0${info.size}\0${info.mtimeNs}\0${info.ctimeNs}`;
    }),
  );
  const key = createHash('sha256').update(identities.join('\n')).digest('hex');
  let fingerprint = fingerprints.get(key);
  if (!fingerprint) {
    fingerprints.clear();
    fingerprint = (async () => {
      const digest = createHash('sha256').update('nodia-ai-codex-chat/1\0');
      digest.update(
        JSON.stringify({
          node: process.version,
          v8: process.versions.v8,
          platform: process.platform,
          architecture: process.arch,
        }),
      );
      for (const file of files) {
        const item = createHash('sha256');
        for await (const bytes of createReadStream(file))
          item.update(bytes as Buffer);
        digest.update(item.digest());
      }
      return digest.digest('hex');
    })();
    fingerprints.set(key, fingerprint);
    void fingerprint.catch(() => fingerprints.delete(key));
  }
  return fingerprint;
}
