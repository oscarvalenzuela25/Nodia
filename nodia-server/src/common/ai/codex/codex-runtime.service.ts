import {
  BadRequestException,
  Injectable,
  type OnModuleDestroy,
} from '@nestjs/common';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { lstat, open, rm, type FileHandle } from 'node:fs/promises';
import { CodexRpc } from './codex-rpc.js';
import { acquireCodexProfileLease, type CodexProfileLease } from './codex-profile-lease.js';
import { CodexChatAdmissionError } from './codex-chat-contract.js';
import { CodexChatJournal } from './codex-chat-journal.js';
import { codexChatRuntimeFingerprint } from './codex-chat-acceptance.js';
import {
  codexProcessIdentity,
  type CodexProcessIdentity,
} from './codex-process-ownership.js';
import {
  codexError,
  codexObject,
  codexModels,
  codexQuotas,
  CodexOperationException,
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
  chat?: boolean;
};

@Injectable()
export class CodexRuntimeService implements OnModuleDestroy {
  private readonly profiles = new Map<string, Promise<Profile>>();
  private readonly sessionSnapshots = new Map<
    string,
    { expires: number; generation: string; session: Promise<CodexSession> }
  >();
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

  private async create(
    id: string,
    signal?: AbortSignal,
    beforeNativeStart?: (identity: CodexProcessIdentity, rpc: CodexRpc) => Promise<void>,
    chat = false,
  ): Promise<Profile> {
    let lease: CodexProfileLease | undefined;
    let rpc: CodexRpc | undefined;
    const cancel = () => { void rpc?.close().catch(() => undefined); };
    try {
      lease = await acquireCodexProfileLease(id, !!beforeNativeStart, signal);
      rpc = new CodexRpc(this.executable(), lease.cwd, lease.profilePath, homedir(), !!beforeNativeStart);
      signal?.addEventListener('abort', cancel, { once: true });
      signal?.throwIfAborted();
      const runtimeIdentity = process.platform === 'linux' && rpc.ownedPid
        ? await codexProcessIdentity(rpc.ownedPid) : null;
      await lease.bindRuntime(rpc.ownedPid, runtimeIdentity);
      if (beforeNativeStart) {
        if (!runtimeIdentity) throw codexError('codex_login_unknown', 409);
        await beforeNativeStart(runtimeIdentity, rpc);
        signal?.throwIfAborted();
        rpc.releaseStartGate();
      }
      await rpc.initialize(chat ? { experimentalChatApi: true } : undefined);
      signal?.throwIfAborted();
      return { rpc, cwd: lease.cwd, lock: lease.lock, lockPath: lease.lockPath,
        busy: false, lastUsed: Date.now(), lastInferenceAt: null, chat };
    } catch (error) {
      // A failed native close keeps the profile barrier; absence of the parent is not closure.
      await rpc?.close();
      await lease?.release();
      if (chat) throw new CodexChatAdmissionError(error instanceof CodexOperationException
        ? error.code : 'codex_runtime_unavailable');
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
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
  /** Actual native executable and executed chat boundary, without account files. */
  chatFingerprint(): Promise<string> {
    return codexChatRuntimeFingerprint(this.executable());
  }
  async get(
    id: string,
    signal?: AbortSignal,
    beforeNativeStart?: (
      identity: CodexProcessIdentity,
      rpc: CodexRpc,
    ) => Promise<void>,
    chat = false,
  ): Promise<Profile> {
    signal?.throwIfAborted();
    if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n)
      throw new BadRequestException('Identificador de conexión inválido.');
    if (this.stopping) throw codexError('codex_runtime_unavailable');
    if (!this.profiles.has(id)) {
      if (
        !chat &&
        process.platform === 'linux' &&
        process.env.NODIA_CODEX_ENABLED === 'true'
      )
        await new CodexChatJournal().assertNoPending(id);
      // The disk barrier yielded: another caller may have installed the owner.
      if (this.profiles.has(id))
        return this.get(id, signal, beforeNativeStart, chat);
      if (this.profiles.size >= 4) throw codexError('codex_profile_busy', 503);
      const p = this.create(id, signal, beforeNativeStart, chat).catch(
        (error: unknown) => {
          this.profiles.delete(id);
          throw error;
        },
      );
      this.profiles.set(id, p);
    }
    const pending = this.profiles.get(id)!;
    const p = signal
      ? await new Promise<Profile>((resolve, reject) => {
          const abort = () => {
            signal.removeEventListener('abort', abort);
            reject(signal.reason);
          };
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
          void pending.then(
            (profile) => {
              signal.removeEventListener('abort', abort);
              resolve(profile);
            },
            (error) => {
              signal.removeEventListener('abort', abort);
              reject(error);
            },
          );
        }).catch(async (error) => {
          // A gated caller cannot abandon creation while it may still persist or
          // release a native child. Await its own cleanup certificate first.
          if (beforeNativeStart) {
            try {
              await pending;
            } catch (settled) {
              if (settled instanceof CodexChatAdmissionError) throw settled;
            }
          }
          throw error;
        })
      : await pending;
    if (!p.rpc.alive || p.closing) {
      await this.stop(id);
      return this.get(id, signal, beforeNativeStart, chat);
    }
    p.lastUsed = Date.now();
    return p;
  }
  async rotateChatGeneration(id: string) {
    this.sessionSnapshots.delete(id);
    if (process.platform === 'linux')
      await new CodexChatJournal().identity(id, true);
  }
  async acquire(
    id: string,
    signal?: AbortSignal,
    beforeNativeStart?: (
      identity: CodexProcessIdentity,
      rpc: CodexRpc,
    ) => Promise<void>,
    chat = false,
  ) {
    const profile = await this.get(id, signal, beforeNativeStart, chat);
    signal?.throwIfAborted();
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
  /** Chat never upgrades an existing OCR/login transport or interrupts its owner. */
  async acquireChat(
    id: string,
    signal: AbortSignal,
    beforeNativeStart: (
      identity: CodexProcessIdentity,
      rpc: CodexRpc,
    ) => Promise<void>,
  ) {
    if (
      process.env.NODIA_CODEX_ENABLED !== 'true' ||
      process.platform !== 'linux'
    )
      throw new CodexChatAdmissionError('codex_runtime_unavailable');
    try {
      await this.releaseIdle(id);
    } catch (error) {
      if (
        error instanceof CodexOperationException &&
        error.code === 'codex_profile_busy'
      )
        throw new CodexChatAdmissionError(error.code);
      throw error;
    }
    let lease: Awaited<ReturnType<CodexRuntimeService['acquire']>>;
    try {
      lease = await this.acquire(id, signal, beforeNativeStart, true);
    } catch (error) {
      if (
        error instanceof CodexOperationException &&
        error.code === 'codex_profile_busy'
      )
        throw new CodexChatAdmissionError(error.code);
      throw error;
    }
    if (!lease.profile.chat) {
      lease.release();
      throw codexError('codex_profile_busy', 409);
    }
    return lease;
  }
  /** Caller has already proved the old native group empty; never reclaim a live owner. */
  async recoverClosedChat(
    id: string,
    owner: CodexProcessIdentity,
    native: CodexProcessIdentity,
  ) {
    return this.recoverClosedProfile(id, owner, native);
  }
  /** Generic profile barrier recovery; the caller supplies its real native owner, never a chat alias. */
  async recoverClosedProfile(
    id: string,
    owner: CodexProcessIdentity,
    native: CodexProcessIdentity,
  ) {
    const { sameCodexProcess, assertCodexGroupEmpty } =
      await import('./codex-process-ownership.js');
    if (await sameCodexProcess(owner))
      throw codexError('codex_profile_busy', 409);
    await assertCodexGroupEmpty(native.group);
    if (this.profiles.has(id)) throw codexError('codex_profile_busy', 409);
    const root = resolve(
      process.env.NODIA_CODEX_PROFILE_ROOT ||
        join(homedir(), '.local', 'share', 'nodia', 'codex'),
    );
    const file = join(root, id, 'nodia.lock');
    let h: FileHandle;
    try {
      const { constants } = await import('node:fs');
      h = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT')
        return;
      throw e;
    }
    try {
      const stat = await h.stat();
      if (
        !stat.isFile() ||
        stat.uid !== process.getuid?.() ||
        (stat.mode & 0o077) !== 0 ||
        stat.size > 4096
      )
        throw codexError('codex_login_unknown', 409);
      const value = JSON.parse(await h.readFile('utf8')) as Record<
        string,
        unknown
      >;
      if (
        value.serverPid !== owner.pid ||
        value.serverBirth !== owner.birth ||
        value.serverBoot !== owner.boot ||
        value.runtimePid !== native.pid ||
        value.runtimeBirth !== native.birth ||
        value.runtimeBoot !== native.boot ||
        value.gated !== true
      )
        throw codexError('codex_login_unknown', 409);
      const current = await lstat(file);
      if (current.ino !== stat.ino || current.dev !== stat.dev)
        throw codexError('codex_login_unknown', 409);
      await rm(file);
      const directory = await open(dirname(file), 'r');
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await h.close();
    }
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
  /** Observation never interrupts another operation. Cancel only the profile leased here. */
  private async exclusiveObservation<T>(
    id: string,
    signal: AbortSignal,
    work: (profile: Profile) => Promise<T>,
  ): Promise<T> {
    signal.throwIfAborted();
    const lease = await this.acquire(id, signal);
    let stop: Promise<void> | undefined;
    const cancel = () => {
      stop ??= this.stop(id);
      void stop.catch(() => undefined);
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      signal.throwIfAborted();
      const result = await work(lease.profile);
      signal.throwIfAborted();
      return result;
    } finally {
      signal.removeEventListener('abort', cancel);
      try {
        await (stop ?? this.stop(id));
      } finally {
        lease.release();
      }
    }
  }
  private async ownedProfile(id: string, profile: Profile): Promise<Profile> {
    const current = await this.profiles.get(id);
    if (
      current !== profile ||
      !current.busy ||
      current.closing ||
      !current.rpc.alive
    )
      throw codexError('codex_profile_busy', 409);
    return current;
  }
  async observe(
    id: string,
    signal?: AbortSignal,
    owned?: Profile,
  ): Promise<CodexSession> {
    if (!owned) {
      const observationSignal = signal ?? new AbortController().signal;
      try {
        return await this.exclusiveObservation(
          id,
          observationSignal,
          (profile) => this.observe(id, undefined, profile),
        );
      } catch (error) {
        observationSignal.throwIfAborted();
        // Failure to acquire a runtime is an observation, not a failed inference.
        // Preserve unexpected failures and never interrupt another profile owner.
        if (
          !(error instanceof CodexOperationException) ||
          !['codex_runtime_unavailable', 'codex_profile_busy'].includes(
            error.code,
          )
        )
          throw error;
        return {
          available: false,
          authenticated: null,
          planType: null,
          checkedAt: null,
          reason: error.code,
          quotas: null,
          lastInferenceAt: null,
          usageAllowed: null,
        };
      }
    }
    let p: Profile;
    try {
      p = await this.ownedProfile(id, owned);
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
    if (
      process.platform === 'linux' &&
      process.env.NODIA_CODEX_ENABLED === 'true'
    ) {
      const identity = await new CodexChatJournal().identity(id);
      if (!this.sessionSnapshots.has(id) && this.sessionSnapshots.size >= 4)
        this.sessionSnapshots.delete(
          this.sessionSnapshots.keys().next().value!,
        );
      this.sessionSnapshots.set(id, {
        expires: p.observation.expires,
        generation: identity.runtimeSessionId,
        session: promise,
      });
    }
    return promise;
  }
  async snapshot(id: string, signal?: AbortSignal): Promise<CodexSession> {
    signal?.throwIfAborted();
    const cached = this.sessionSnapshots.get(id);
    if (cached && cached.expires > Date.now()) {
      try {
        const current = await new CodexChatJournal().identity(id, false, false);
        signal?.throwIfAborted();
        if (current.runtimeSessionId === cached.generation)
          return await cached.session;
      } catch {
        signal?.throwIfAborted();
      }
    }
    this.sessionSnapshots.delete(id);
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
  }
  async listModels(
    id: string,
    signal?: AbortSignal,
    owned?: Profile,
  ): Promise<CodexModel[]> {
    if (!owned)
      return this.exclusiveObservation(
        id,
        signal ?? new AbortController().signal,
        (profile) => this.listModels(id, undefined, profile),
      );
    const p = await this.ownedProfile(id, owned);
    if (!(await this.observe(id, undefined, p)).authenticated)
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
      await p.rpc.close();
      const snapshot = this.sessionSnapshots.get(id);
      if (snapshot && p.lastInferenceAt) {
        const lastInferenceAt = p.lastInferenceAt;
        snapshot.session = snapshot.session.then((session) => ({
          ...session,
          lastInferenceAt,
        }));
      }
      await rm(p.cwd, { recursive: true, force: true });
      await p.lock.close();
      await rm(p.lockPath, { force: true });
      this.profiles.delete(id);
    })();
    return p.closing;
  }
  /** Yield only a local idle profile. Reserving busy prevents a concurrent lease during close. */
  async releaseIdle(id: string) {
    const pending = this.profiles.get(id);
    if (!pending) return;
    const profile = await pending;
    if (profile.busy || profile.closing)
      throw codexError('codex_profile_busy', 409);
    profile.busy = true;
    await this.stop(id);
  }
  async onModuleDestroy() {
    this.stopping = true;
    clearInterval(this.idleTimer);
    await Promise.allSettled(
      [...this.profiles.keys()].map((id) => this.stop(id)),
    );
  }
}
