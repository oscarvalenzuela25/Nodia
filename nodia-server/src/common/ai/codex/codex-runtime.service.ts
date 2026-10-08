import {
  BadRequestException,
  Injectable,
  type OnModuleDestroy,
} from '@nestjs/common';
import { createRequire } from 'node:module';
import { dirname, join, resolve, relative } from 'node:path';
import { homedir } from 'node:os';
import {
  mkdir,
  lstat,
  open,
  realpath,
  rm,
  writeFile,
  mkdtemp,
  type FileHandle,
} from 'node:fs/promises';
import { CodexRpc } from './codex-rpc.js';
import {
  codexError,
  codexObject,
  codexModels,
  codexQuotas,
  type CodexModel,
  type CodexSession,
} from './codex-contract.js';

type Profile = {
  rpc: CodexRpc;
  cwd: string;
  lock: FileHandle;
  lockPath: string;
  busy: boolean;
  lastUsed: number;
  observation?: { expires: number; promise: Promise<CodexSession> };
  models?: { expires: number; promise: Promise<CodexModel[]> };
  lastInferenceAt: string | null;
  closing?: Promise<void>;
};

@Injectable()
export class CodexRuntimeService implements OnModuleDestroy {
  private readonly profiles = new Map<string, Promise<Profile>>();
  private readonly idleTimer = setInterval(() => {
    for (const [id, pending] of this.profiles)
      void pending
        .then((p) => {
          if (!p.busy && Date.now() - p.lastUsed > 5 * 60_000)
            return this.stop(id);
        })
        .catch(() => undefined);
  }, 60_000).unref();
  private stopping = false;

  private async create(id: string): Promise<Profile> {
    if (
      process.env.NODIA_CODEX_ENABLED !== 'true' ||
      process.platform === 'win32'
    )
      throw codexError('codex_runtime_unavailable');
    const root = resolve(
      process.env.NODIA_CODEX_PROFILE_ROOT ||
        join(homedir(), '.local', 'share', 'nodia', 'codex'),
    );
    const repo = resolve(process.cwd(), '..');
    if (!relative(repo, root).startsWith('..') || root === homedir())
      throw codexError('codex_runtime_unavailable');
    await mkdir(root, { recursive: true, mode: 0o700 });
    const rootInfo = await lstat(root);
    const owner = process.getuid?.();
    if (
      owner == null ||
      rootInfo.uid !== owner ||
      rootInfo.isSymbolicLink() ||
      !rootInfo.isDirectory() ||
      (rootInfo.mode & 0o077) !== 0
    )
      throw codexError('codex_runtime_unavailable');
    if ((await realpath(root)) !== root)
      throw codexError('codex_runtime_unavailable');
    const profile = join(root, id);
    await mkdir(profile, { recursive: true, mode: 0o700 });
    const info = await lstat(profile);
    if (
      info.uid !== owner ||
      info.isSymbolicLink() ||
      (info.mode & 0o077) !== 0
    )
      throw codexError('codex_runtime_unavailable');
    const lockPath = join(profile, 'nodia.lock');
    let lock: FileHandle;
    try {
      lock = await open(lockPath, 'wx', 0o600);
    } catch {
      throw codexError('codex_profile_busy', 409);
    }
    // Fail closed on stale locks. A dead supervisor PID does not prove its
    // detached native child is dead; automatic reclamation can share a profile.
    let cwd: string | undefined;
    let rpc: CodexRpc | undefined;
    try {
      await lock.writeFile(
        JSON.stringify({ serverPid: process.pid, runtimePid: null }),
      );
      // Nodia-owned profiles never import global auth/config, plugins or tools.
      for (const name of ['config.toml', 'auth.json']) {
        try {
          const info = await lstat(join(profile, name));
          if (info.isSymbolicLink() || name === 'auth.json')
            throw codexError('codex_runtime_unavailable');
        } catch (error) {
          if (!(
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'ENOENT'
          ))
            throw error;
        }
      }
      await writeFile(join(profile, 'config.toml'), '', { mode: 0o600 });
      cwd = await mkdtemp(join(profile, 'work-'));
      const executable = this.executable();
      rpc = new CodexRpc(executable, cwd, profile, homedir());
      const ownership = Buffer.from(
        JSON.stringify({ serverPid: process.pid, runtimePid: rpc.ownedPid }),
      );
      await lock.truncate(0);
      await lock.write(ownership, 0, ownership.length, 0);
      await lock.sync();
      await rpc.initialize();
      return {
        rpc,
        cwd,
        lock,
        lockPath,
        busy: false,
        lastUsed: Date.now(),
        lastInferenceAt: null,
      };
    } catch (error) {
      await rpc?.close();
      if (cwd) await rm(cwd, { recursive: true, force: true });
      await lock.close();
      await rm(lockPath, { force: true });
      throw error;
    }
  }
  private executable() {
    const require = createRequire(import.meta.url);
    const triples: Record<string, string> = {
      'darwin-arm64': 'aarch64-apple-darwin',
      'darwin-x64': 'x86_64-apple-darwin',
      'linux-arm64': 'aarch64-unknown-linux-musl',
      'linux-x64': 'x86_64-unknown-linux-musl',
      'win32-arm64': 'aarch64-pc-windows-msvc',
      'win32-x64': 'x86_64-pc-windows-msvc',
    };
    const platform = `${process.platform}-${process.arch}`;
    if (!triples[platform]) throw codexError('codex_runtime_unavailable');
    return join(
      dirname(require.resolve(`@openai/codex-${platform}/package.json`)),
      'vendor',
      triples[platform],
      'bin',
      process.platform === 'win32' ? 'codex.exe' : 'codex',
    );
  }
  async get(id: string): Promise<Profile> {
    if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n)
      throw new BadRequestException('Identificador de conexión inválido.');
    if (this.stopping) throw codexError('codex_runtime_unavailable');
    if (!this.profiles.has(id)) {
      if (this.profiles.size >= 4) throw codexError('codex_profile_busy', 503);
      const p = this.create(id).catch((error: unknown) => {
        this.profiles.delete(id);
        throw error;
      });
      this.profiles.set(id, p);
    }
    const p = await this.profiles.get(id)!;
    if (!p.rpc.alive || p.closing) {
      await this.stop(id);
      return this.get(id);
    }
    p.lastUsed = Date.now();
    return p;
  }
  async acquire(id: string) {
    const profile = await this.get(id);
    if (profile.busy) throw codexError('codex_profile_busy', 409);
    profile.busy = true;
    return {
      profile,
      release: () => {
        profile.busy = false;
        profile.lastUsed = Date.now();
        this.invalidate(id);
      },
    };
  }
  invalidate(id: string) {
    void this.profiles
      .get(id)
      ?.then((p) => {
        p.observation = undefined;
        p.models = undefined;
      })
      .catch(() => undefined);
  }
  async observe(id: string): Promise<CodexSession> {
    let p: Profile;
    try {
      p = await this.get(id);
    } catch {
      return {
        available: false,
        authenticated: null,
        planType: null,
        checkedAt: null,
        reason: 'codex_runtime_unavailable',
        quotas: null,
        lastInferenceAt: null,
        usageAllowed: null,
      };
    }
    if (p.observation && p.observation.expires > Date.now())
      return p.observation.promise;
    const promise = (async (): Promise<CodexSession> => {
      try {
        const result = codexObject(
          await p.rpc.request('account/read', { refreshToken: true }),
        );
        const account =
          result.account == null ? null : codexObject(result.account);
        const authenticated = account?.type === 'chatgpt';
        // API authentication can never validate the subscription channel.
        let quotas = null;
        let usageAllowed: boolean | null = null;
        if (authenticated)
          try {
            const usage = codexObject(
              await p.rpc.request('account/rateLimits/read'),
            );
            usageAllowed =
              typeof usage.ordinaryUsageAllowed === 'boolean'
                ? usage.ordinaryUsageAllowed
                : null;
            quotas = codexQuotas(usage);
          } catch {
            /* Unknown usage is not unlimited. */
          }
        return {
          available: true,
          authenticated,
          planType:
            typeof account?.planType === 'string' ? account.planType : null,
          checkedAt: new Date().toISOString(),
          reason: authenticated ? null : 'codex_session_required',
          quotas,
          lastInferenceAt: p.lastInferenceAt,
          usageAllowed,
        };
      } catch {
        return {
          available: false,
          authenticated: null,
          planType: null,
          checkedAt: null,
          reason: 'codex_runtime_unavailable',
          quotas: null,
          lastInferenceAt: p.lastInferenceAt,
          usageAllowed: null,
        };
      }
    })();
    p.observation = { expires: Date.now() + 30_000, promise };
    return promise;
  }
  async snapshot(id: string): Promise<CodexSession> {
    if (!this.profiles.has(id))
      return {
        available: false,
        authenticated: null,
        planType: null,
        checkedAt: null,
        reason: 'codex_runtime_unverified',
        quotas: null,
        lastInferenceAt: null,
        usageAllowed: null,
      };
    return this.observe(id);
  }
  async listModels(id: string): Promise<CodexModel[]> {
    const p = await this.get(id);
    if (!(await this.observe(id)).authenticated)
      throw codexError('codex_session_required', 409);
    if (p.models && p.models.expires > Date.now()) return p.models.promise;
    const promise = (async () => {
      const all: unknown[] = [];
      const cursors = new Set<string>();
      let cursor: string | undefined;
      for (let page = 0; page < 20; page++) {
        const response = codexObject(
          await p.rpc.request('model/list', {
            limit: 100,
            includeHidden: false,
            ...(cursor ? { cursor } : {}),
          }),
        );
        if (
          !Array.isArray(response.data) ||
          all.length + response.data.length > 1000
        )
          throw codexError('codex_protocol_invalid', 502);
        all.push(...response.data);
        if (response.nextCursor == null) return codexModels(all);
        if (
          typeof response.nextCursor !== 'string' ||
          !response.nextCursor ||
          cursors.has(response.nextCursor)
        )
          throw codexError('codex_protocol_invalid', 502);
        cursor = response.nextCursor;
        cursors.add(cursor);
      }
      throw codexError('codex_protocol_invalid', 502);
    })();
    p.models = { expires: Date.now() + 30_000, promise };
    try {
      return await promise;
    } catch (error) {
      p.models = undefined;
      throw error;
    }
  }
  async stop(id: string) {
    const pending = this.profiles.get(id);
    if (!pending) return;
    const p = await pending;
    p.closing ??= (async () => {
      try {
        await p.rpc.close();
        await rm(p.cwd, { recursive: true, force: true });
      } finally {
        await p.lock.close();
        await rm(p.lockPath, { force: true });
        this.profiles.delete(id);
      }
    })();
    return p.closing;
  }
  async onModuleDestroy() {
    this.stopping = true;
    clearInterval(this.idleTimer);
    await Promise.allSettled(
      [...this.profiles.keys()].map((id) => this.stop(id)),
    );
  }
}
