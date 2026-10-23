import { constants } from 'node:fs';
import {
  lstat,
  open,
  rename,
  rm,
  mkdir,
  realpath,
  readdir,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { CodexLoginJournal, codexLoginUuid } from './codex-login-journal.js';
import { codexError } from './codex-contract.js';
import type { CodexProcessIdentity } from './codex-process-ownership.js';
import type { CodexChatIdentity } from './codex-chat-contract.js';
import type { NodiaAiRuntimeTerminalProof } from '../../../nodia-ai-runtime/types/reconciliation.types.js';

export interface CodexChatRecord {
  version: 1;
  identity: CodexChatIdentity;
  expiresAt: string;
  owner: CodexProcessIdentity;
  native: CodexProcessIdentity | null;
  state:
    'reserved' | 'prepared' | 'submitted' | 'completed' | 'abandoned_unknown';
  payloadSha256: string;
  rpcCount: number;
  frames: number;
  bytes: number;
  unforwardedRequests: number;
  cancelRequested: boolean;
  terminalProofId: string | null;
  observedAt: string | null;
  acknowledged: boolean;
}

const bigintId = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[1-9]\d{0,18}$/.test(v) &&
  BigInt(v) <= 9223372036854775807n;
export function assertCodexChatIdentity(
  value: unknown,
): asserts value is CodexChatIdentity {
  const v = value as CodexChatIdentity | null;
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    Object.keys(v).sort().join(',') !==
      'adapterIdentity,attemptId,engine,operationRef,resourceKey,sessionGeneration' ||
    v.engine !== 'agentic' ||
    !codexLoginUuid.test(v.attemptId) ||
    v.operationRef !== v.attemptId ||
    !/^codex-profile:[a-f0-9]{64}$/.test(v.resourceKey) ||
    !/^[a-f0-9]{32}$/.test(v.sessionGeneration) ||
    !v.adapterIdentity ||
    Object.keys(v.adapterIdentity).sort().join(',') !==
      'connectionId,contractVersion,providerKey' ||
    v.adapterIdentity.providerKey !== 'openai' ||
    v.adapterIdentity.contractVersion !== 'nodia-ai-codex-chat/1' ||
    !bigintId(v.adapterIdentity.connectionId)
  )
    throw codexError('codex_protocol_invalid', 502);
}
export function sameCodexChatIdentity(
  a: CodexChatIdentity,
  b: CodexChatIdentity,
) {
  assertCodexChatIdentity(a);
  assertCodexChatIdentity(b);
  return (
    a.attemptId === b.attemptId &&
    a.resourceKey === b.resourceKey &&
    a.sessionGeneration === b.sessionGeneration &&
    a.adapterIdentity.connectionId === b.adapterIdentity.connectionId
  );
}
function certificate(v: unknown): v is CodexProcessIdentity {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as CodexProcessIdentity;
  return (
    Object.keys(p).sort().join(',') === 'birth,boot,group,pid' &&
    Number.isSafeInteger(p.pid) &&
    p.pid > 1 &&
    Number.isSafeInteger(p.group) &&
    p.group > 1 &&
    typeof p.birth === 'string' &&
    /^\d{1,32}$/.test(p.birth) &&
    typeof p.boot === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      p.boot,
    )
  );
}
function missing(e: unknown) {
  return !!e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT';
}

/** Private crash journal. No prompt, catalog, arguments, result or authentication is stored. */
export class CodexChatJournal {
  private readonly files: CodexLoginJournal;
  constructor(root?: string) {
    this.files = new CodexLoginJournal(root, 'chat-jobs');
  }
  root() {
    return this.files.root();
  }
  locked<T>(attempt: string, work: () => Promise<T>) {
    return this.files.locked(attempt, work);
  }
  admission<T>(work: () => Promise<T>) {
    return this.files.admission(work);
  }
  async assertNoPending(connectionId: string) {
    const root = await this.root(),
      names = await readdir(root);
    if (names.length > 10000) throw codexError('codex_profile_busy', 503);
    for (const name of names) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      const record = await this.read(name.slice(0, -5));
      if (
        record &&
        record.identity.adapterIdentity.connectionId === connectionId &&
        !record.acknowledged
      )
        throw codexError('codex_profile_busy', 409);
    }
  }
  async identity(connectionId: string, rotate = false, create = true) {
    if (!bigintId(connectionId))
      throw codexError('codex_protocol_invalid', 400);
    const root = await this.root();
    const profile = join(dirname(root), connectionId);
    if (create) await mkdir(profile, { recursive: true, mode: 0o700 });
    const info = await lstat(profile);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      info.uid !== process.getuid!() ||
      (info.mode & 0o077) !== 0 ||
      (await realpath(profile)) !== profile
    )
      throw codexError('codex_runtime_unavailable');
    const file = join(profile, 'nodia-chat-session');
    const read = async () => {
      const h = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await h.stat();
        if (
          !stat.isFile() ||
          stat.uid !== process.getuid!() ||
          (stat.mode & 0o077) !== 0 ||
          stat.size !== 32
        )
          throw codexError('codex_runtime_unavailable');
        const text = await h.readFile('utf8');
        if (!/^[a-f0-9]{32}$/.test(text))
          throw codexError('codex_runtime_unavailable');
        return text;
      } finally {
        await h.close();
      }
    };
    let generation: string;
    try {
      generation = await read();
      if (rotate) throw Object.assign(new Error(), { code: 'ENOENT' });
    } catch (e) {
      if (!missing(e) || !create) throw e;
      generation = randomUUID().replaceAll('-', '');
      const temp = `${file}.${randomUUID()}.tmp`;
      const h = await open(temp, 'wx', 0o600);
      try {
        await h.writeFile(generation);
        await h.sync();
      } finally {
        await h.close();
      }
      try {
        if (rotate) await rename(temp, file);
        else {
          const { link } = await import('node:fs/promises');
          try {
            await link(temp, file);
          } catch (error) {
            if (!(
              error &&
              typeof error === 'object' &&
              'code' in error &&
              error.code === 'EEXIST'
            ))
              throw error;
          }
        }
        const dir = await open(profile, 'r');
        try {
          await dir.sync();
        } finally {
          await dir.close();
        }
      } finally {
        await rm(temp, { force: true });
      }
      generation = await read();
    }
    return {
      resourceKey: `codex-profile:${createHash('sha256').update(`nodia-codex-chat/1\0${profile}\0${process.getuid!()}`).digest('hex')}`,
      runtimeSessionId: generation,
    };
  }
  decode(value: unknown): CodexChatRecord {
    const v = value as CodexChatRecord | null;
    if (
      !v ||
      typeof v !== 'object' ||
      Array.isArray(v) ||
      Object.keys(v).sort().join(',') !==
        'acknowledged,bytes,cancelRequested,expiresAt,frames,identity,native,observedAt,owner,payloadSha256,rpcCount,state,terminalProofId,unforwardedRequests,version' ||
      v.version !== 1 ||
      !certificate(v.owner) ||
      (v.native !== null && !certificate(v.native)) ||
      typeof v.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(v.expiresAt)) ||
      !/^[a-f0-9]{64}$/.test(v.payloadSha256) ||
      !Number.isSafeInteger(v.rpcCount) ||
      v.rpcCount < 0 ||
      v.rpcCount > 10001 ||
      !Number.isSafeInteger(v.frames) ||
      v.frames < v.rpcCount ||
      v.frames > 10001 ||
      !Number.isSafeInteger(v.bytes) ||
      v.bytes < 0 ||
      !Number.isSafeInteger(v.unforwardedRequests) ||
      v.unforwardedRequests < 0 ||
      v.unforwardedRequests > v.rpcCount ||
      ![
        'reserved',
        'prepared',
        'submitted',
        'completed',
        'abandoned_unknown',
      ].includes(v.state) ||
      typeof v.acknowledged !== 'boolean' ||
      typeof v.cancelRequested !== 'boolean' ||
      (v.terminalProofId !== null && !codexLoginUuid.test(v.terminalProofId)) ||
      (v.observedAt !== null &&
        (typeof v.observedAt !== 'string' ||
          !Number.isFinite(Date.parse(v.observedAt))))
    )
      throw codexError('codex_login_unknown', 409);
    assertCodexChatIdentity(v.identity);
    const terminal = ['completed', 'abandoned_unknown'].includes(v.state);
    if (
      terminal !== (v.terminalProofId !== null && v.observedAt !== null) ||
      (!terminal && v.acknowledged) ||
      (['prepared', 'submitted', 'completed'].includes(v.state) &&
        v.native === null)
    )
      throw codexError('codex_login_unknown', 409);
    return v;
  }
  async read(attempt: string): Promise<CodexChatRecord | null> {
    const { file } = await this.files.paths(attempt);
    let h;
    try {
      h = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (e) {
      if (missing(e)) return null;
      throw e;
    }
    try {
      const s = await h.stat();
      if (
        !s.isFile() ||
        s.uid !== process.getuid!() ||
        (s.mode & 0o077) !== 0 ||
        s.size > 4096
      )
        throw codexError('codex_login_unknown', 409);
      return this.decode(JSON.parse(await h.readFile('utf8')));
    } finally {
      await h.close();
    }
  }
  async write(value: CodexChatRecord, reserve = false): Promise<void> {
    this.decode(value);
    const { file, root } = await this.files.paths(value.identity.attemptId);
    const temp = `${file}.${randomUUID()}.tmp`,
      h = await open(temp, 'wx', 0o600);
    try {
      try {
        await h.writeFile(JSON.stringify(value));
        await h.sync();
      } finally {
        await h.close();
      }
      if (reserve) {
        const { link } = await import('node:fs/promises');
        await link(temp, file);
      } else await rename(temp, file);
      const d = await open(root, 'r');
      try {
        await d.sync();
      } finally {
        await d.close();
      }
    } finally {
      await rm(temp, { force: true });
    }
  }
  async reserve(value: CodexChatRecord) {
    await this.admission(async () => {
      await this.pruneAcknowledged();
      const names = await readdir(await this.root());
      if (names.length > 2048) throw codexError('codex_profile_busy', 503);
      let active = 0;
      for (const name of names) {
        if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
        const existing = await this.read(name.slice(0, -5));
        if (!existing || existing.acknowledged) continue;
        active++;
        if (existing.identity.resourceKey === value.identity.resourceKey)
          throw codexError('codex_profile_busy', 409);
      }
      if (active >= 4) throw codexError('codex_profile_busy', 503);
      try {
        await this.write(value, true);
      } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && e.code === 'EEXIST')
          throw codexError('codex_request_conflict', 409);
        throw e;
      }
    });
  }
  /** ACK receipts only outlive their original admission deadline; unresolved work never expires. */
  async prune() {
    return this.admission(() => this.pruneAcknowledged());
  }
  private async pruneAcknowledged() {
    const root = await this.root();
    const names = await readdir(root);
    if (names.length > 10000) throw codexError('codex_profile_busy', 503);
    for (const name of names) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      const id = name.slice(0, -5),
        candidate = await this.read(id);
      if (
        !candidate ||
        !candidate.acknowledged ||
        !['completed', 'abandoned_unknown'].includes(candidate.state) ||
        Date.parse(candidate.expiresAt) > Date.now()
      )
        continue;
      await this.locked(id, async () => {
        const current = await this.read(id);
        if (
          !current ||
          !current.acknowledged ||
          !['completed', 'abandoned_unknown'].includes(current.state) ||
          Date.parse(current.expiresAt) > Date.now()
        )
          return;
        await rm((await this.files.paths(id)).file);
      });
      if (!(await this.read(id)))
        await rm(`${(await this.files.paths(id)).file}.guard`, { force: true });
    }
    const directory = await open(root, 'r');
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
  proof(value: CodexChatRecord): NodiaAiRuntimeTerminalProof {
    this.decode(value);
    if (
      !value.terminalProofId ||
      !value.observedAt ||
      !['completed', 'abandoned_unknown'].includes(value.state)
    )
      throw codexError('codex_login_unknown', 409);
    return {
      ...value.identity,
      terminalProofId: value.terminalProofId,
      processClosed: true,
      outcome: value.state as 'completed' | 'abandoned_unknown',
      observedAt: new Date(value.observedAt),
    };
  }
}
