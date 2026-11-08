import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { moveCatalogOrder } from '../../module-order/move-catalog-order.js';
import {
  validateMoveOrderCommand,
  type OrderMoveResult,
} from '../../module-order/order-policy.js';
import { MoveModuleOrderDto } from '../dto/move-module-order.dto.js';

@Injectable()
export class MoveModuleOrderUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly redis: RedisService,
  ) {}

  async execute(
    id: string,
    command: MoveModuleOrderDto,
    actor: ActorReference,
  ): Promise<OrderMoveResult> {
    validateMoveOrderCommand(id, command);
    validateCatalogId(command.expected_module_group_id);
    const result = await runCoreAuthorityTransaction(
      this.source,
      actor,
      (manager) =>
        moveCatalogOrder(
          manager,
          'module',
          id,
          command,
          command.expected_module_group_id,
        ),
    );
    if (!actor.transaction && result.status === 'moved')
      await this.redis.delByPattern('auth:context:*');
    return result;
  }
}
