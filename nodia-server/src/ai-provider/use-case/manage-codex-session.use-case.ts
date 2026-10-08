import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiProviderService } from '../ai-provider.service.js';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import {
  codexError,
  codexObject,
  type CodexLoginJob,
} from '../../common/ai/codex/codex-contract.js';

type Job = {
  public: CodexLoginJob;
  providerId: string;
  actorId: string;
  loginId: string | null;
  finish: () => void;
  beforeStop: () => void;
  timer: NodeJS.Timeout;
  expires: number;
};

@Injectable()
export class ManageCodexSessionUseCase implements OnModuleDestroy {
  private readonly jobs = new Map<string, Job>();
  constructor(
    private readonly providers: AiProviderService,
    private readonly runtime: CodexRuntimeService,
  ) {}
  private async connection(id: string) {
    if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n)
      throw new BadRequestException('Identificador de conexión inválido.');
    const p = await this.providers.findProviderById(id);
    if (!p) throw new NotFoundException('La conexión IA no existe.');
    if ((p.catalog?.key ?? p.key) !== 'openai')
      throw new BadRequestException('Esta conexión no corresponde a OpenAI.');
    return p;
  }
  async session(id: string) {
    await this.connection(id);
    return this.runtime.observe(id);
  }
  private job(id: string, providerId: string, actorId: string) {
    const job = this.jobs.get(id);
    if (
      !job ||
      job.expires <= Date.now() ||
      job.providerId !== providerId ||
      job.actorId !== actorId
    )
      throw new NotFoundException(
        'No existe un intento de conexión accesible.',
      );
    return job;
  }
  async current(providerId: string, actorId: string) {
    await this.connection(providerId);
    const job = [...this.jobs.values()].find(
      (j) =>
        j.providerId === providerId &&
        j.actorId === actorId &&
        j.expires > Date.now() &&
        ['running', 'waiting_authorization', 'verifying'].includes(
          j.public.state,
        ),
    );
    return { job: job ? { ...job.public } : null };
  }
  async status(providerId: string, jobId: string, actorId: string) {
    await this.connection(providerId);
    return { ...this.job(jobId, providerId, actorId).public };
  }
  async start(providerId: string, actorId: string) {
    const connection = await this.connection(providerId);
    if (!connection.is_active || connection.catalog?.is_active === false)
      throw new BadRequestException('La conexión IA está inactiva.');
    if (
      !/^[1-9]\d{0,18}$/.test(actorId) ||
      BigInt(actorId) > 9223372036854775807n
    )
      throw new BadRequestException('Actor inválido.');
    for (const [id, job] of this.jobs)
      if (job.expires <= Date.now()) this.jobs.delete(id);
    if (this.jobs.size >= 100) throw codexError('codex_profile_busy', 503);
    const lease = await this.runtime.acquire(providerId);
    const id = randomUUID();
    const job: Job = {
      providerId,
      actorId,
      loginId: null,
      public: {
        id,
        state: 'running',
        verificationUrl: null,
        userCode: null,
        reason: null,
      },
      expires: Date.now() + 10 * 60_000,
      timer: setTimeout(() => undefined, 0),
      finish: () => undefined,
      beforeStop: () => undefined,
    };
    let finished = false;
    const finish = (
      state: CodexLoginJob['state'],
      reason: string | null = null,
    ) => {
      if (finished) return;
      finished = true;
      clearTimeout(job.timer);
      lease.profile.rpc.off('notification', onNotification);
      lease.profile.rpc.off('closed', onClosed);
      job.public = { id, state, reason, verificationUrl: null, userCode: null };
      lease.release();
    };
    const onClosed = () => finish('failed', 'codex_runtime_unavailable');
    let early: unknown;
    const onNotification = (method: string, params: unknown) => {
      if (method !== 'account/login/completed') return;
      if (!job.loginId) {
        early = params;
        return;
      }
      let result: Record<string, unknown>;
      try {
        result = codexObject(params);
      } catch {
        finish('failed', 'codex_protocol_invalid');
        return;
      }
      if (result.loginId !== job.loginId || finished) return;
      if (result.success !== true) {
        finish('failed', 'codex_login_failed');
        return;
      }
      job.public = {
        id,
        state: 'verifying',
        verificationUrl: null,
        userCode: null,
        reason: null,
      };
      this.runtime.invalidate(providerId);
      void this.runtime
        .observe(providerId)
        .then((session) => {
          if (finished) return;
          finish(
            session.authenticated === true ? 'succeeded' : 'failed',
            session.authenticated === true ? null : 'codex_session_required',
          );
        })
        .catch(() => finish('failed', 'codex_runtime_unavailable'));
    };
    job.finish = () => finish('cancelled');
    job.beforeStop = () => lease.profile.rpc.off('closed', onClosed);
    job.timer = setTimeout(() => {
      // Stop the profile before releasing its lease when cancellation cannot be confirmed.
      lease.profile.rpc.off('closed', onClosed);
      void this.runtime.stop(providerId).then(
        () => finish('failed', 'codex_login_timeout'),
        () => finish('failed', 'codex_runtime_unavailable'),
      );
    }, 5 * 60_000).unref();
    this.jobs.set(id, job);
    lease.profile.rpc.on('notification', onNotification);
    lease.profile.rpc.on('closed', onClosed);
    try {
      const result = codexObject(
        await lease.profile.rpc.request(
          'account/login/start',
          { type: 'chatgptDeviceCode' },
          30000,
        ),
      );
      if (
        result.type !== 'chatgptDeviceCode' ||
        typeof result.loginId !== 'string' ||
        result.loginId.length > 128 ||
        result.verificationUrl !== 'https://auth.openai.com/codex/device' ||
        typeof result.userCode !== 'string' ||
        !/^[A-Za-z0-9-]{4,32}$/.test(result.userCode)
      )
        throw codexError('codex_protocol_invalid', 502);
      job.loginId = result.loginId;
      if (!finished)
        job.public = {
          id,
          state: 'waiting_authorization',
          verificationUrl: result.verificationUrl,
          userCode: result.userCode,
          reason: null,
        };
      if (early) onNotification('account/login/completed', early);
      return { ...job.public };
    } catch (error) {
      lease.profile.rpc.off('closed', onClosed);
      try {
        await this.runtime.stop(providerId);
      } finally {
        finish('failed', 'codex_login_failed');
      }
      throw error;
    }
  }
  async cancel(providerId: string, jobId: string, actorId: string) {
    await this.connection(providerId);
    const job = this.job(jobId, providerId, actorId);
    if (['succeeded', 'failed', 'cancelled'].includes(job.public.state))
      return { ...job.public };
    try {
      const p = await this.runtime.get(providerId);
      if (job.loginId)
        await p.rpc.request('account/login/cancel', { loginId: job.loginId });
      job.finish();
    } catch {
      job.beforeStop();
      try {
        await this.runtime.stop(providerId);
      } finally {
        job.finish();
      }
    }
    return { ...job.public };
  }
  async logout(providerId: string) {
    await this.connection(providerId);
    const lease = await this.runtime.acquire(providerId);
    try {
      await lease.profile.rpc.request('account/logout');
      this.runtime.invalidate(providerId);
      return { disconnected: true };
    } finally {
      lease.release();
    }
  }
  onModuleDestroy() {
    for (const job of this.jobs.values()) {
      clearTimeout(job.timer);
      job.finish();
    }
    this.jobs.clear();
  }
}
