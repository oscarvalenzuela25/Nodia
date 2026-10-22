import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { TranslationService } from '../../translation/translation.service.js';
import { ActionService } from '../action.service.js';
import { UpdateActionDto } from '../dto/update-action.dto.js';
import { Action } from '../entities/action.entity.js';

@Injectable()
export class SaveActionUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly reader: ActionService,
    private readonly redisService: RedisService,
    private readonly translationService: TranslationService,
  ) {}
  async execute(
    id: string | undefined,
    dto: UpdateActionDto,
    actor: ActorReference,
  ): Promise<Action> {
    const savedId = await runCoreAuthorityTransaction(
      this.source,
      actor,
      async (manager) => {
        const repository = manager.getRepository(Action);
        const existing = id
          ? await repository.findOneBy({ id })
          : dto.key
            ? await repository.findOneBy({ key: dto.key })
            : null;
        if (id && !existing) throw new NotFoundException('actions:not_found');

        const { translates, ...fields } = dto;
        const saved = await repository.save(
          repository.create({ ...existing, ...fields }),
        );

        if (translates !== undefined)
          await this.translationService.updateTranslations(
            'actions',
            saved.id,
            translates,
            manager,
          );
        return saved.id;
      },
    );
    if (actor.transaction)
      return actor.transaction
        .getRepository(Action)
        .findOneByOrFail({ id: savedId });
    await this.redisService.delByPattern('auth:context:*');
    return this.reader.findOne(savedId);
  }
}
