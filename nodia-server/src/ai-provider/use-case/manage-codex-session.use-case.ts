import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  Inject,
} from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import { CodexLoginControl } from '../../common/ai/codex/codex-login-control.js';

@Injectable()
export class ManageCodexSessionUseCase {
  constructor(
    private readonly providers: AiProviderService,
    private readonly runtime: CodexRuntimeService,
    @Optional()
    @Inject('CODEX_LOGIN_CONTROL')
    private readonly logins: CodexLoginControl = new CodexLoginControl(),
  ) {}
  private async connection(id: string) {
    if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n)
      throw new BadRequestException('Identificador de conexión inválido.');
    const provider = await this.providers.findProviderById(id);
    if (!provider) throw new NotFoundException('La conexión IA no existe.');
    if ((provider.catalog?.key ?? provider.key) !== 'openai')
      throw new BadRequestException('Esta conexión no corresponde a OpenAI.');
    return provider;
  }
  async session(id: string) {
    await this.connection(id);
    return this.runtime.observe(id);
  }
  async current(providerId: string, actorId: string) {
    await this.connection(providerId);
    return this.logins.current(providerId, actorId);
  }
  async status(providerId: string, jobId: string, actorId: string) {
    await this.connection(providerId);
    return this.statusRequest(providerId, jobId, actorId);
  }
  async statusRequest(providerId: string, requestId: string, actorId: string) {
    return this.logins.status(providerId, requestId, actorId);
  }
  async start(
    providerId: string,
    actorId: string,
    requestId?: string,
    expiresAt?: string,
  ) {
    const provider = await this.connection(providerId);
    if (!provider.is_active || provider.catalog?.is_active === false)
      throw new BadRequestException('La conexión IA está inactiva.');
    return this.logins.start(providerId, actorId, requestId, expiresAt, () =>
      this.runtime.releaseIdle(providerId),
    );
  }
  async cancel(providerId: string, jobId: string, actorId: string) {
    await this.connection(providerId);
    return this.cancelRequest(providerId, jobId, actorId);
  }
  async cancelRequest(providerId: string, requestId: string, actorId: string) {
    return this.logins.cancel(providerId, requestId, actorId);
  }
  async acknowledgeRequest(
    providerId: string,
    requestId: string,
    actorId: string,
  ) {
    return this.logins.acknowledge(providerId, requestId, actorId);
  }
  async logout(providerId: string) {
    await this.connection(providerId);
    const lease = await this.runtime.acquire(providerId);
    try {
      await this.runtime.rotateChatGeneration(providerId);
      await lease.profile.rpc.request('account/logout');
      this.runtime.invalidate(providerId);
      return { disconnected: true };
    } finally {
      lease.release();
    }
  }
  onModuleDestroy() {
    /* The independent supervisor owns its bounded deadline; an API restart must not erase its job. */
  }
}
