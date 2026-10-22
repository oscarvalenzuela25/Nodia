import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GeminiService,
  type GeminiLoginJob,
} from '../../common/ai/gemini.service.js';
import {
  GEMINI_LOGIN_KEYS,
  type GeminiLoginInput,
} from '../../common/ai/gemini-login-viewer.js';

/** Shared input contract; ownership is checked by the authenticated transport and native job. */
export function validateGeminiLoginInput(command: GeminiLoginInput): void {
  if (
    !command ||
    typeof command !== 'object' ||
    Array.isArray(command) ||
    Object.keys(command).some(
      (key) =>
        !['frame_id', 'action', 'x', 'y', 'text', 'key', 'delta'].includes(key),
    )
  )
    throw new BadRequestException('Comando de visor inválido.');
  const required = {
    click: ['x', 'y'],
    text: ['text'],
    key: ['key'],
    scroll: ['delta'],
  }[command.action];
  const supplied = ['x', 'y', 'text', 'key', 'delta'].filter(
    (key) => command[key as keyof GeminiLoginInput] !== undefined,
  );
  if (
    !required ||
    supplied.length !== required.length ||
    supplied.some((key) => !required.includes(key)) ||
    !/^[0-9a-f]{32}$/.test(command.frame_id) ||
    (command.action === 'text' &&
      (typeof command.text !== 'string' ||
        !command.text.length ||
        command.text.length > 2048)) ||
    (command.action === 'key' &&
      !GEMINI_LOGIN_KEYS.includes(command.key ?? '')) ||
    (command.action === 'click' &&
      (!Number.isInteger(command.x) ||
        !Number.isInteger(command.y) ||
        command.x! < 0 ||
        command.x! >= 1280 ||
        command.y! < 0 ||
        command.y! >= 850)) ||
    (command.action === 'scroll' &&
      (!Number.isInteger(command.delta) || Math.abs(command.delta!) > 600))
  ) {
    throw new BadRequestException('Comando de visor inválido.');
  }
}

@Injectable()
export class ManageGeminiLoginUseCase {
  private readonly logger = new Logger(ManageGeminiLoginUseCase.name);
  private owner: { id: string; actor: string; expires: number } | null = null;
  constructor(private readonly geminiService: GeminiService) {}

  private assertActor(actor: string): void {
    if (
      typeof actor !== 'string' ||
      !/^[1-9][0-9]{0,18}$/.test(actor) ||
      BigInt(actor) > 9223372036854775807n
    ) {
      throw new BadRequestException('Identidad de usuario inválida.');
    }
  }

  private assertOwner(id: string, actor: string): void {
    this.assertActor(actor);
    this.assertJobId(id);
    if (
      !this.owner ||
      this.owner.id !== id ||
      this.owner.actor !== actor ||
      Date.now() >= this.owner.expires
    ) {
      throw new NotFoundException('La sesión de login Gemini no existe.');
    }
  }

  private assertJobId(jobId: string): void {
    if (!/^[0-9a-f]{32}$/.test(jobId)) {
      throw new BadRequestException('Identificador de login inválido.');
    }
  }

  async start(actorUserId: string): Promise<GeminiLoginJob> {
    this.assertActor(actorUserId);
    const job = await this.geminiService.startInteractiveLogin(actorUserId);
    this.owner = {
      id: job.id,
      actor: actorUserId,
      expires: Date.now() + 310_000,
    };
    this.logger.log(`Gemini login started: job=${job.id} actor=${actorUserId}`);
    return job;
  }

  async disconnect(actor: string): Promise<{ status: 'disconnected' }> {
    this.assertActor(actor);
    const result = await this.geminiService.disconnectWebSession(actor);
    this.owner = null;
    this.logger.log(`Gemini Web disconnected: actor=${actor}`);
    return result;
  }

  status(jobId: string, actor: string): Promise<GeminiLoginJob> {
    this.assertOwner(jobId, actor);
    return this.geminiService.getInteractiveLoginStatus(jobId, actor);
  }

  async cancel(jobId: string, actorUserId: string): Promise<GeminiLoginJob> {
    this.assertOwner(jobId, actorUserId);
    const job = await this.geminiService.cancelInteractiveLogin(
      jobId,
      actorUserId,
    );
    this.logger.log(
      `Gemini login cancelled: job=${job.id} actor=${actorUserId}`,
    );
    return job;
  }

  frame(id: string, actor: string) {
    this.assertOwner(id, actor);
    return this.geminiService.getInteractiveLoginFrame(id, actor);
  }

  input(
    id: string,
    actor: string,
    command: GeminiLoginInput,
  ): Promise<GeminiLoginJob> {
    this.assertOwner(id, actor);
    validateGeminiLoginInput(command);
    return this.geminiService.sendInteractiveLoginInput(id, actor, command);
  }
}
