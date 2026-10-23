import {
  mkdir,
  lstat,
  realpath,
  open,
  rename,
  rm,
  readdir,
  chmod,
  link,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, join, relative } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { codexError, type CodexLoginJob } from './codex-contract.js';
import type { CodexProcessIdentity } from './codex-process-ownership.js';

export const codexLoginUuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export type CodexLoginRecord = {
  version: 1;
  id: string;
  providerId: string;
  actorId: string;
  expiresAt: string;
  state: CodexLoginJob['state'] | 'reserved' | 'unknown';
  reason: string | null;
  owner: CodexProcessIdentity | null;
  native: CodexProcessIdentity | null;
  acknowledged: boolean;
};
export const terminalCodexLogin = (state: string) =>
  ['succeeded', 'failed', 'cancelled'].includes(state);
export function validateCodexIdentity(
  id: string,
  actor: string,
  request: string,
) {
  if (
    ![id, actor].every(
      (v) => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n,
    ) ||
    !codexLoginUuid.test(request)
  )
    throw codexError('codex_protocol_invalid', 400);
}
function certificate(value: unknown): value is CodexProcessIdentity | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return (
    Object.keys(o).sort().join(',') === 'birth,boot,group,pid' &&
    Number.isSafeInteger(o.pid) &&
    Number(o.pid) > 1 &&
    Number.isSafeInteger(o.group) &&
    Number(o.group) > 1 &&
    typeof o.birth === 'string' &&
    /^\d{1,32}$/.test(o.birth) &&
    typeof o.boot === 'string' &&
    /^[a-f0-9-]{36}$/.test(o.boot)
  );
}
export class CodexLoginJournal {
  constructor(
    private readonly configuredRoot?: string,
    private readonly journalDirectory:
      'login-jobs' | 'chat-jobs' = 'login-jobs',
  ) {}
  async root() {
    if (process.platform !== 'linux' || process.getuid?.() === undefined)
      throw codexError('codex_runtime_unavailable');
    const profileRoot = resolve(
      this.configuredRoot ??
        process.env.NODIA_CODEX_PROFILE_ROOT ??
        join(homedir(), '.local', 'share', 'nodia', 'codex'),
    );
    if (
      !relative(resolve(process.cwd(), '..'), profileRoot).startsWith('..') ||
      profileRoot === homedir()
    )
      throw codexError('codex_runtime_unavailable');
    const root = join(profileRoot, this.journalDirectory);
    for (const path of [profileRoot, root]) {
      await mkdir(path, { recursive: true, mode: 0o700 });
      const info = await lstat(path);
      if (
        !info.isDirectory() ||
        info.isSymbolicLink() ||
        info.uid !== process.getuid!() ||
        (info.mode & 0o077) !== 0 ||
        (await realpath(path)) !== path
      )
        throw codexError('codex_runtime_unavailable');
    }
    if (Buffer.byteLength(join(root, `${'0'.repeat(36)}.sock`)) > 103)
      throw codexError('codex_runtime_unavailable');
    return root;
  }
  async paths(id: string) {
    if (!codexLoginUuid.test(id))
      throw codexError('codex_protocol_invalid', 400);
    const root = await this.root();
    return {
      root,
      file: join(root, `${id}.json`),
      socket: join(root, `${id}.sock`),
    };
  }
  decode(value: unknown): CodexLoginRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw codexError('codex_login_unknown', 409);
    const o = value as Record<string, unknown>;
    if (
      Object.keys(o).sort().join(',') !==
        'acknowledged,actorId,expiresAt,id,native,owner,providerId,reason,state,version' ||
      o.version !== 1 ||
      typeof o.acknowledged !== 'boolean' ||
      typeof o.id !== 'string' ||
      typeof o.providerId !== 'string' ||
      typeof o.actorId !== 'string' ||
      typeof o.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(o.expiresAt)) ||
      typeof o.state !== 'string' ||
      ![
        'reserved',
        'running',
        'waiting_authorization',
        'verifying',
        'succeeded',
        'failed',
        'cancelled',
        'unknown',
      ].includes(o.state) ||
      !(
        o.reason === null ||
        (typeof o.reason === 'string' && /^codex_[a-z_]{1,64}$/.test(o.reason))
      ) ||
      !certificate(o.owner) ||
      !certificate(o.native)
    )
      throw codexError('codex_login_unknown', 409);
    validateCodexIdentity(o.providerId, o.actorId, o.id);
    return o as CodexLoginRecord;
  }
  async read(id: string): Promise<CodexLoginRecord | null> {
    const { file } = await this.paths(id);
    let info;
    try {
      info = await lstat(file);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return null;
      throw error;
    }
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== process.getuid!() ||
      (info.mode & 0o077) !== 0 ||
      info.size > 4096
    )
      throw codexError('codex_login_unknown', 409);
    const handle = await open(file, 'r');
    try {
      const stat = await handle.stat();
      if (stat.ino !== info.ino || stat.dev !== info.dev)
        throw codexError('codex_login_unknown', 409);
      return this.decode(JSON.parse(await handle.readFile('utf8')));
    } finally {
      await handle.close();
    }
  }
  private async syncDirectory() {
    const directory = await open(await this.root(), 'r');
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
  async reserve(value: CodexLoginRecord) {
    this.decode(value);
    const { file } = await this.paths(value.id);
    const temp = `${file}.${randomUUID()}.tmp`,
      h = await open(temp, 'wx', 0o600);
    try {
      try {
        await h.writeFile(JSON.stringify(value));
        await h.sync();
      } finally {
        await h.close();
      }
      try {
        await link(temp, file);
        await this.syncDirectory();
        return true;
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'EEXIST'
        )
          return false;
        throw error;
      }
    } finally {
      await rm(temp, { force: true });
    }
  }
  /** flock belongs to this open file description and is released by kernel on crash. No network I/O inside. */
  async locked<T>(id: string, work: () => Promise<T>): Promise<T> {
    const { file } = await this.paths(id);
    return this.lockFile(`${file}.guard`, work);
  }
  async admission<T>(work: () => Promise<T>) {
    return this.lockFile(join(await this.root(), 'admission.guard'), work);
  }
  private async lockFile<T>(file: string, work: () => Promise<T>) {
    const handle = await open(
      file,
      constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      const info = await handle.stat();
      if (
        !info.isFile() ||
        info.uid !== process.getuid!() ||
        (info.mode & 0o077) !== 0
      )
        throw codexError('codex_login_unknown', 409);
      await new Promise<void>((resolve, reject) => {
        const child = spawn('/usr/bin/flock', ['-x', '-w', '2', '3'], {
          stdio: ['ignore', 'ignore', 'ignore', handle.fd],
          env: { PATH: '/usr/bin:/bin' },
          shell: false,
        });
        child.once('error', () =>
          reject(codexError('codex_login_unknown', 409)),
        );
        child.once('exit', (code) =>
          code === 0
            ? resolve()
            : reject(codexError('codex_profile_busy', 409)),
        );
      });
      return await work();
    } finally {
      await handle.close();
    }
  }
  async write(value: CodexLoginRecord) {
    this.decode(value);
    const { file } = await this.paths(value.id),
      temp = `${file}.${randomUUID()}.tmp`;
    const h = await open(temp, 'wx', 0o600);
    try {
      await h.writeFile(JSON.stringify(value));
      await h.sync();
    } finally {
      await h.close();
    }
    await rename(temp, file);
    await this.syncDirectory();
  }
  async socketSafe(id: string) {
    const { socket } = await this.paths(id),
      info = await lstat(socket);
    if (
      !info.isSocket() ||
      info.isSymbolicLink() ||
      info.uid !== process.getuid!() ||
      (info.mode & 0o077) !== 0
    )
      throw codexError('codex_login_unknown', 409);
    return socket;
  }
  async protectSocket(id: string) {
    await chmod((await this.paths(id)).socket, 0o600);
    await this.socketSafe(id);
  }
  async entries() {
    const root = await this.root(),
      names = await readdir(root);
    // Admission bounds records, not private guard/socket files. Stale temps are swept separately.
    if (names.length > 10000) throw codexError('codex_profile_busy', 503);
    const records: CodexLoginRecord[] = [];
    for (const name of names)
      if (/^[a-f0-9-]{36}\.json$/i.test(name)) {
        const record = await this.read(name.slice(0, -5));
        if (record) records.push(record);
      }
    return records;
  }
  async prune() {
    const root = await this.root();
    for (const name of await readdir(root)) {
      if (!/^[a-f0-9-]{36}\.json\.[a-f0-9-]{36}\.tmp$/.test(name)) continue;
      const file = join(root, name),
        info = await lstat(file);
      if (
        info.isFile() &&
        !info.isSymbolicLink() &&
        info.uid === process.getuid!() &&
        Date.now() - info.mtimeMs > 360000
      )
        await rm(file, { force: true });
    }
    const records = await this.entries();
    for (const value of records)
      if (
        terminalCodexLogin(value.state) &&
        value.acknowledged &&
        !value.native &&
        Date.parse(value.expiresAt) + 60000 < Date.now()
      ) {
        await this.locked(value.id, async () => {
          const current = await this.read(value.id);
          if (
            !current ||
            !current.acknowledged ||
            !terminalCodexLogin(current.state) ||
            current.native ||
            Date.parse(current.expiresAt) + 60000 >= Date.now()
          )
            return;
          const { file, socket } = await this.paths(value.id);
          await rm(file, { force: true });
          await rm(socket, { force: true });
        });
        if (!(await this.read(value.id)))
          await rm(`${(await this.paths(value.id)).file}.guard`, {
            force: true,
          });
      }
    await this.syncDirectory();
    return (await this.entries()).length;
  }
  public(value: CodexLoginRecord): CodexLoginJob {
    if (value.state === 'unknown') throw codexError('codex_login_unknown', 409);
    return {
      id: value.id,
      state: value.state === 'reserved' ? 'running' : value.state,
      verificationUrl: null,
      userCode: null,
      reason: value.reason,
    };
  }
}
