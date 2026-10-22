import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { TranslationService } from '../../translation/translation.service.js';
import { BusinessActionService } from '../business-action.service.js';
import { UpdateBusinessActionDto } from '../dto/update-business-action.dto.js';
import { BusinessAction } from '../entities/business-action.entity.js';

@Injectable()
export class SaveBusinessActionUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly reader: BusinessActionService,
    private readonly redis: RedisService,
    private readonly translations: TranslationService,
  ) {}

  async execute(
    id: string | undefined,
    dto: UpdateBusinessActionDto,
    actor: ActorReference,
  ): Promise<BusinessAction> {
    const savedId = await runCoreAuthorityTransaction(
      this.source,
      actor,
      async (manager) => {
        const repository = manager.getRepository(BusinessAction);
        const existing = id
          ? await repository.findOneBy({ id })
          : dto.key
            ? await repository.findOneBy({ key: dto.key })
            : null;
        if (id && !existing)
          throw new NotFoundException(
            `BusinessAction with ID "${id}" not found`,
          );
        const { translates, ...fields } = dto;
        const saved = await repository.save(
          repository.create({ ...existing, ...fields }),
        );
        if (translates !== undefined)
          await this.translations.updateTranslations(
            'business_actions',
            saved.id,
            translates,
            manager,
          );
        return saved.id;
      },
    );
    if (actor.transaction)
      return actor.transaction
        .getRepository(BusinessAction)
        .findOneByOrFail({ id: savedId });
    await this.redis.delByPattern('auth:context:*');
    return this.reader.findOne(savedId);
  }
}
