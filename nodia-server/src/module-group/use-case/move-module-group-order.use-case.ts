import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { moveCatalogOrder } from '../../module-order/move-catalog-order.js';
import {
  validateMoveOrderCommand,
  type OrderMoveResult,
} from '../../module-order/order-policy.js';
import { MoveModuleGroupOrderDto } from '../dto/move-module-group-order.dto.js';

@Injectable()
export class MoveModuleGroupOrderUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly redis: RedisService,
  ) {}

  async execute(
    id: string,
    command: MoveModuleGroupOrderDto,
    actor: ActorReference,
  ): Promise<OrderMoveResult> {
    validateMoveOrderCommand(id, command);
    const result = await runCoreAuthorityTransaction(
      this.source,
      actor,
      (manager) => moveCatalogOrder(manager, 'module-group', id, command),
    );
    if (!actor.transaction && result.status === 'moved')
      await this.redis.delByPattern('auth:context:*');
    return result;
  }
}
