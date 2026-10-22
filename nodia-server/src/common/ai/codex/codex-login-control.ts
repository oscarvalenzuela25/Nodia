import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CodexLoginJournal,
  terminalCodexLogin,
  validateCodexIdentity,
  type CodexLoginRecord,
} from './codex-login-journal.js';
import { sameCodexProcess, stopCodexGroup } from './codex-process-ownership.js';
import {
  codexError,
  codexObject,
  type CodexLoginJob,
} from './codex-contract.js';

export class CodexLoginControl {
  constructor(
    readonly journal = new CodexLoginJournal(),
    private readonly supervisor = new URL(
      './codex-login-supervisor.js',
      import.meta.url,
    ),
  ) {}
  private bound(
    value: CodexLoginRecord | null,
    providerId: string,
    actorId: string,
  ): CodexLoginRecord {
    if (!value || value.providerId !== providerId || value.actorId !== actorId)
      throw codexError('codex_login_not_found', 404);
    return value;
  }
  private async communicate(
    value: CodexLoginRecord,
    action: 'status' | 'cancel',
  ): Promise<CodexLoginJob> {
    const path = await this.journal.socketSafe(value.id);
    return new Promise((resolve, reject) => {
      const socket = createConnection(path);
      let buffer = '',
        done = false;
      const finish = (error?: unknown, result?: CodexLoginJob) => {
        if (done) return;
        done = true;
        socket.destroy();
        if (error) reject(error);
        else resolve(result!);
      };
      socket.setTimeout(12000, () =>
        finish(codexError('codex_login_unknown', 409)),
      );
      socket.once('error', () =>
        finish(codexError('codex_login_unknown', 409)),
      );
      socket.once('connect', () =>
        socket.write(
          JSON.stringify({
            version: 1,
            id: value.id,
            providerId: value.providerId,
            actorId: value.actorId,
            action,
          }) + '\n',
        ),
      );
      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        if (Buffer.byteLength(buffer) > 8192) {
          finish(codexError('codex_protocol_invalid', 502));
          return;
        }
        if (!buffer.includes('\n')) return;
        try {
          const body = codexObject(JSON.parse(buffer.trim()));
          if (body.error) throw codexError('codex_login_unknown', 409);
          const job = codexObject(body.job);
          if (
            Object.keys(job).sort().join(',') !==
              'id,reason,state,userCode,verificationUrl' ||
            job.id !== value.id ||
            typeof job.state !== 'string' ||
            ![
              'running',
              'waiting_authorization',
              'verifying',
              'succeeded',
              'failed',
              'cancelled',
            ].includes(job.state) ||
            !(
              job.reason === null ||
              (typeof job.reason === 'string' &&
                /^codex_[a-z_]+$/.test(job.reason))
            )
          )
            throw codexError('codex_protocol_invalid', 502);
          if (
            job.state === 'waiting_authorization'
              ? job.verificationUrl !==
                  'https://auth.openai.com/codex/device' ||
                typeof job.userCode !== 'string' ||
                !/^[A-Za-z0-9-]{4,32}$/.test(job.userCode)
              : job.verificationUrl !== null || job.userCode !== null
          )
            throw codexError('codex_protocol_invalid', 502);
          finish(undefined, job as unknown as CodexLoginJob);
        } catch (error) {
          finish(error);
        }
      });
      socket.once('end', () => {
        if (!done) finish(codexError('codex_login_unknown', 409));
      });
    });
  }
  async start(
    providerId: string,
    actorId: string,
    requestId?: string,
    expiresAt?: string,
    beforeLaunch?: () => Promise<void>,
  ): Promise<CodexLoginJob> {
    const id = requestId ?? randomUUID();
    validateCodexIdentity(providerId, actorId, id);
    if (requestId && !expiresAt)
      throw codexError('codex_protocol_invalid', 400);
    const deadline = expiresAt ?? new Date(Date.now() + 300000).toISOString(),
      expiry = Date.parse(deadline);
    if (
      !Number.isFinite(expiry) ||
      expiry <= Date.now() ||
      expiry > Date.now() + 300000
    )
      throw codexError('codex_login_expired', 410);
    let created = false;
    await this.journal.admission(async () => {
      const count = await this.journal.prune();
      return this.journal.locked(id, async () => {
        const existing = await this.journal.read(id);
        if (existing) {
          this.bound(existing, providerId, actorId);
          if (existing.state !== 'cancelled' && existing.expiresAt !== deadline)
            throw codexError('codex_request_conflict', 409);
          return existing;
        }
        if (count >= 100) throw codexError('codex_profile_busy', 503);
        if (
          (await this.journal.entries()).filter(
            (record) => !terminalCodexLogin(record.state),
          ).length >= 4
        )
          throw codexError('codex_profile_busy', 503);
        const record: CodexLoginRecord = {
          version: 1,
          id,
          providerId,
          actorId,
          expiresAt: deadline,
          state: 'reserved',
          reason: null,
          owner: null,
          native: null,
          acknowledged: requestId === undefined,
        };
        created = await this.journal.reserve(record);
        return record;
      });
    });
    if (!created) return this.status(providerId, id, actorId);
    try {
      await beforeLaunch?.();
    } catch (error) {
      await this.journal.locked(id, async () => {
        const latest = await this.journal.read(id);
        if (latest?.state === 'reserved')
          await this.journal.write({
            ...latest,
            state: 'failed',
            reason: 'codex_profile_busy',
          });
      });
      throw error;
    }
    const child = spawn(
      process.execPath,
      [fileURLToPath(this.supervisor), id],
      {
        shell: false,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: {
          NODIA_CODEX_ENABLED: process.env.NODIA_CODEX_ENABLED ?? '',
          NODIA_CODEX_PROFILE_ROOT: (await this.journal.paths(id)).root.replace(
            /[\\/]login-jobs$/,
            '',
          ),
          PATH: '/usr/bin:/bin',
          HOME: process.env.HOME ?? '',
          LANG: 'en_US.UTF-8',
          ...(process.env.DBUS_SESSION_BUS_ADDRESS
            ? { DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS }
            : {}),
          ...(process.env.XDG_RUNTIME_DIR
            ? { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR }
            : {}),
        },
      },
    );
    child.on('error', () => undefined);
    child.unref();
    const until = Date.now() + 35000;
    do {
      const latest = this.bound(
        await this.journal.read(id),
        providerId,
        actorId,
      );
      if (terminalCodexLogin(latest.state)) return this.journal.public(latest);
      try {
        const result = await this.communicate(latest, 'status');
        if (result.state !== 'running' && result.state !== 'verifying')
          return result;
      } catch {
        /* The same reservation is observed, never relaunched. */
      }
      await delay(50);
    } while (Date.now() < until);
    // Reservation survives response loss. Never dispatch the same request again.
    throw codexError('codex_login_unknown', 409);
  }
  async status(
    providerId: string,
    id: string,
    actorId: string,
  ): Promise<CodexLoginJob> {
    validateCodexIdentity(providerId, actorId, id);
    const value = this.bound(await this.journal.read(id), providerId, actorId);
    if (terminalCodexLogin(value.state) && !value.native)
      return this.journal.public(value);
    try {
      return await this.communicate(value, 'status');
    } catch {
      if (value.owner && (await sameCodexProcess(value.owner)))
        throw codexError('codex_login_unknown', 409);
      // An absent supervisor cannot prove that the detached app-server stopped.
      throw codexError('codex_login_unknown', 409);
    }
  }
  async cancel(
    providerId: string,
    id: string,
    actorId: string,
  ): Promise<CodexLoginJob> {
    validateCodexIdentity(providerId, actorId, id);
    const value = await this.journal.admission(async () => {
      const count = await this.journal.prune();
      return this.journal.locked(id, async () => {
        const existing = await this.journal.read(id);
        if (existing) return this.bound(existing, providerId, actorId);
        if (count >= 100) throw codexError('codex_profile_busy', 503);
        const tombstone: CodexLoginRecord = {
          version: 1,
          id,
          providerId,
          actorId,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          state: 'cancelled',
          reason: null,
          owner: null,
          native: null,
          acknowledged: false,
        };
        await this.journal.reserve(tombstone);
        return tombstone;
      });
    });
    if (terminalCodexLogin(value.state) && !value.native)
      return this.journal.public(value);
    if (value.owner && (await sameCodexProcess(value.owner)))
      return this.communicate(value, 'cancel');
    return this.journal.locked(id, async () => {
      const current = this.bound(
        await this.journal.read(id),
        providerId,
        actorId,
      );
      if (current.owner && (await sameCodexProcess(current.owner)))
        throw codexError('codex_login_unknown', 409);
      if (current.native) {
        await stopCodexGroup(current.native);
        await this.clearStoppedProfile(current);
      } else if (
        current.state !== 'reserved' &&
        !terminalCodexLogin(current.state)
      )
        await this.recoverGate(current);
      const next: CodexLoginRecord = {
        ...current,
        state: 'cancelled',
        reason: null,
        native: null,
        owner: null,
      };
      await this.journal.write(next);
      return this.journal.public(next);
    });
  }
  private async recoverGate(value: CodexLoginRecord) {
    if (!value.owner) throw codexError('codex_login_unknown', 409);
    const { root } = await this.journal.paths(value.id),
      fs = await import('node:fs/promises');
    const lock = join(root, '..', value.providerId, 'nodia.lock');
    const info = await fs.lstat(lock);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== process.getuid!() ||
      (info.mode & 0o077) !== 0 ||
      info.size > 1024
    )
      throw codexError('codex_login_unknown', 409);
    const body = JSON.parse(await fs.readFile(lock, 'utf8')) as Record<
      string,
      unknown
    >;
    if (
      body.gated !== true ||
      body.serverPid !== value.owner.pid ||
      body.serverBirth !== value.owner.birth ||
      body.serverBoot !== value.owner.boot
    )
      throw codexError('codex_login_unknown', 409);
    if (body.runtimePid !== null) {
      const native = {
        pid: body.runtimePid,
        group: body.runtimePid,
        birth: body.runtimeBirth,
        boot: body.runtimeBoot,
      };
      const decoded = this.journal.decode({ ...value, native });
      await stopCodexGroup(decoded.native!);
    }
    // No CLI can cross the gate until its certificate is fsynced in this journal.
    await rm(lock);
  }
  private async clearStoppedProfile(value: CodexLoginRecord) {
    // Only the journal-certified native group may justify retiring its exact residual lock.
    const { root } = await this.journal.paths(value.id);
    const profile = join(root, '..', value.providerId);
    const fs = await import('node:fs/promises');
    const lock = join(profile, 'nodia.lock');
    try {
      const info = await fs.lstat(lock);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.uid !== process.getuid!() ||
        info.size > 1024
      )
        throw codexError('codex_login_unknown', 409);
      const body = JSON.parse(await fs.readFile(lock, 'utf8')) as Record<
        string,
        unknown
      >;
      if (
        body.runtimePid !== value.native?.pid ||
        body.serverPid !== value.owner?.pid ||
        body.runtimeBirth !== value.native?.birth ||
        body.runtimeBoot !== value.native?.boot ||
        body.serverBirth !== value.owner?.birth ||
        body.serverBoot !== value.owner?.boot
      )
        throw codexError('codex_login_unknown', 409);
      await rm(lock);
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
  async current(providerId: string, actorId: string) {
    validateCodexIdentity(providerId, actorId, randomUUID());
    const records = (await this.journal.entries())
      .filter(
        (r) =>
          r.providerId === providerId &&
          r.actorId === actorId &&
          !terminalCodexLogin(r.state),
      )
      .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));
    return {
      job: records.length
        ? await this.status(providerId, records[0].id, actorId)
        : null,
    };
  }
  async acknowledge(
    providerId: string,
    id: string,
    actorId: string,
  ): Promise<{ acknowledged: true }> {
    validateCodexIdentity(providerId, actorId, id);
    if (!(await this.journal.read(id))) return { acknowledged: true };
    return this.journal.locked(id, async () => {
      const observed = await this.journal.read(id);
      if (!observed) return { acknowledged: true };
      const value = this.bound(observed, providerId, actorId);
      if (!terminalCodexLogin(value.state) || value.native)
        throw codexError('codex_login_unknown', 409);
      if (!value.acknowledged)
        await this.journal.write({ ...value, acknowledged: true });
      return { acknowledged: true };
    });
  }
}
