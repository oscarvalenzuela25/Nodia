import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { TranslationService } from '../../translation/translation.service.js';
import { UpdateModuleDto } from '../dto/update-module.dto.js';
import { Module } from '../entities/module.entity.js';
import { ModuleService } from '../module.service.js';

@Injectable()
export class SaveModuleUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly reader: ModuleService,
    private readonly redisService: RedisService,
    private readonly translationService: TranslationService,
  ) {}
  async execute(
    id: string | undefined,
    dto: UpdateModuleDto,
    actor: ActorReference,
  ): Promise<Module> {
    const savedId = await runCoreAuthorityTransaction(
      this.source,
      actor,
      async (manager) => {
        const repository = manager.getRepository(Module);
        const existing = id
          ? await repository.findOneBy({ id })
          : dto.key
            ? await repository.findOneBy({ key: dto.key })
            : null;
        if (id && !existing) throw new NotFoundException('modules:not_found');
        if (existing && dto.key !== undefined && dto.key !== existing.key)
          throw new ForbiddenException('modules:immutable_key');
        const { translates, ...fields } = dto;
        const saved = await repository.save(
          repository.create({ ...existing, ...fields }),
        );

        if (translates !== undefined)
          await this.translationService.updateTranslations(
            'modules',
            saved.id,
            translates,
            manager,
          );
        return saved.id;
      },
    );
    if (actor.transaction)
      return actor.transaction
        .getRepository(Module)
        .findOneByOrFail({ id: savedId });
    await this.redisService.delByPattern('auth:context:*');
    return this.reader.findOne(savedId);
  }
}
