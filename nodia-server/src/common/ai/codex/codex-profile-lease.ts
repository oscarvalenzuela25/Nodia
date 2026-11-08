import { join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { lstat, mkdir, mkdtemp, open, realpath, rm, writeFile, type FileHandle } from 'node:fs/promises';
import { codexError } from './codex-contract.js';
import { codexProcessIdentity, type CodexProcessIdentity } from './codex-process-ownership.js';

export interface CodexProfileLease {
  profilePath: string;
  cwd: string;
  lockPath: string;
  lock: FileHandle;
  bindRuntime(pid: number | null, identity: CodexProcessIdentity | null): Promise<void>;
  /** Caller must first prove its native process group closed, or prove it never started. */
  release(): Promise<void>;
}

/** Single existing nodia.lock frontier shared by all native consumers, including Teacher. */
export async function acquireCodexProfileLease(id: string, gated: boolean, signal?: AbortSignal, outsideProfile = false): Promise<CodexProfileLease> {
  signal?.throwIfAborted();
  if (process.env.NODIA_CODEX_ENABLED !== 'true' || process.platform === 'win32' ||
      !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) throw codexError('codex_runtime_unavailable');
  const root = resolve(process.env.NODIA_CODEX_PROFILE_ROOT || join(homedir(), '.local', 'share', 'nodia', 'codex'));
  const repo = resolve(process.cwd(), '..');
  if (!relative(repo, root).startsWith('..') || root === homedir()) throw codexError('codex_runtime_unavailable');
  await mkdir(root, { recursive: true, mode: 0o700 });
  const owner = process.getuid?.();
  const rootInfo = await lstat(root);
  if (owner == null || rootInfo.uid !== owner || rootInfo.isSymbolicLink() || !rootInfo.isDirectory() ||
      (rootInfo.mode & 0o077) !== 0 || await realpath(root) !== root) throw codexError('codex_runtime_unavailable');
  const profilePath = join(root, id);
  await mkdir(profilePath, { recursive: true, mode: 0o700 });
  const info = await lstat(profilePath);
  if (info.uid !== owner || info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o077) !== 0) throw codexError('codex_runtime_unavailable');
  const lockPath = join(profilePath, 'nodia.lock');
  let lock: FileHandle;
  try { lock = await open(lockPath, 'wx', 0o600); } catch { throw codexError('codex_profile_busy', 409); }
  let cwd: string | undefined;
  let released = false;
  let server: CodexProcessIdentity | null = null;
  const bindRuntime = async (pid: number | null, native: CodexProcessIdentity | null) => {
    const bytes = Buffer.from(JSON.stringify({ serverPid: process.pid, runtimePid: pid, gated,
      ...(server ? { serverBirth: server.birth, serverBoot: server.boot } : {}),
      ...(native ? { runtimeBirth: native.birth, runtimeBoot: native.boot } : {}) }));
    await lock.truncate(0);
    await lock.write(bytes, 0, bytes.length, 0);
    await lock.sync();
  };
  try {
    server = process.platform === 'linux' ? await codexProcessIdentity(process.pid) : null;
    await bindRuntime(null, null);
    const directory = await open(profilePath, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
    for (const name of ['config.toml', 'auth.json']) {
      try {
        const item = await lstat(join(profilePath, name));
        if (item.isSymbolicLink() || name === 'auth.json') throw codexError('codex_runtime_unavailable');
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
      }
    }
    await writeFile(join(profilePath, 'config.toml'), '', { mode: 0o600 });
    cwd = await mkdtemp(outsideProfile ? join(root, 'teacher-work-') : join(profilePath, 'work-'));
    signal?.throwIfAborted();
    const workspace = cwd;
    return { profilePath, cwd: workspace, lockPath, lock, bindRuntime,
      async release() {
        if (released) return;
        await rm(workspace, { recursive: true, force: true });
        await lock.close();
        await rm(lockPath, { force: true });
        released = true;
      },
    };
  } catch (error) {
    if (cwd) await rm(cwd, { recursive: true, force: true });
    await lock.close();
    await rm(lockPath, { force: true });
    throw error;
  }
}
