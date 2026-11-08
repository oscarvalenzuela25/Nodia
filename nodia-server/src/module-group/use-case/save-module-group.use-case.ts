import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { TranslationService } from '../../translation/translation.service.js';
import { UpdateModuleGroupDto } from '../dto/update-module-group.dto.js';
import { ModuleGroup } from '../entities/module-group.entity.js';
import { ModuleGroupService } from '../module-group.service.js';
import { nextModuleGroupSortOrder } from '../../module-order/next-sort-order.js';

@Injectable()
export class SaveModuleGroupUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly reader: ModuleGroupService,
    private readonly redisService: RedisService,
    private readonly translationService: TranslationService,
  ) {}
  async execute(
    id: string | undefined,
    dto: UpdateModuleGroupDto,
    actor: ActorReference,
  ): Promise<ModuleGroup> {
    if (Object.hasOwn(dto, 'sort_order'))
      throw new BadRequestException('modules:order_managed');
    const savedId = await runCoreAuthorityTransaction(
      this.source,
      actor,
      async (manager) => {
        const repository = manager.getRepository(ModuleGroup);
        const existing = id
          ? await repository.findOneBy({ id })
          : dto.key
            ? await repository.findOneBy({ key: dto.key })
            : null;
        if (id && !existing)
          throw new NotFoundException('modules:groups.not_found');

        const { translates, ...fields } = dto;
        const sortOrder =
          existing?.sort_order ?? (await nextModuleGroupSortOrder(manager));
        const saved = await repository.save(
          repository.create({ ...existing, ...fields, sort_order: sortOrder }),
        );

        if (translates !== undefined)
          await this.translationService.updateTranslations(
            'module_groups',
            saved.id,
            translates,
            manager,
          );
        return saved.id;
      },
    );
    if (actor.transaction)
      return actor.transaction
        .getRepository(ModuleGroup)
        .findOneByOrFail({ id: savedId });
    await this.redisService.delByPattern('auth:context:*');
    return this.reader.findOne(savedId);
  }
}
