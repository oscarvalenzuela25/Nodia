import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from '../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import { assertBusinessesAccess } from '../business-access/business-access.js';
import {
  normalizeCashUuid,
  validateCashCategoryId,
} from './policies/cash-category.policy.js';

@Injectable()
export class CashBusinessScope {
  constructor(
    private readonly source: DataSource,
    private readonly modules: CheckModuleAccessUseCase,
  ) {}

  run<T>(
    businessId: string,
    actor: ActorReference,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.transaction(actor, async (manager) => {
      await assertBusinessesAccess(manager, actor, [businessId], {
        lock: true,
      });
      return work(manager);
    });
  }

  forCategory<T>(
    id: string,
    actor: ActorReference,
    work: (manager: EntityManager, businessId: string) => Promise<T>,
  ): Promise<T> {
    validateCashCategoryId(id);
    return this.forRecord('business_cash_categories', id, actor, work);
  }

  forMovement<T>(
    rawId: string,
    actor: ActorReference,
    work: (
      manager: EntityManager,
      businessId: string,
      id: string,
    ) => Promise<T>,
  ): Promise<T> {
    const id = normalizeCashUuid(rawId);
    return this.forRecord('business_cash_movements', id, actor, work);
  }

  private forRecord<T>(
    table: 'business_cash_categories' | 'business_cash_movements',
    id: string,
    actor: ActorReference,
    work: (
      manager: EntityManager,
      businessId: string,
      id: string,
    ) => Promise<T>,
  ): Promise<T> {
    return this.transaction(actor, async (manager) => {
      await currentActor(manager, actor);
      // Only resolve the immutable parent before its lock. Domain data is read
      // after membership has been rechecked under that lock.
      const [record] = await manager.query<{ business_id: string }[]>(
        `SELECT business_id FROM ${table} WHERE id=$1`,
        [id],
      );
      if (!record) throw new NotFoundException('business:resource_not_found');
      await assertBusinessesAccess(manager, actor, [record.business_id], {
        lock: true,
      });
      return work(manager, record.business_id, id);
    });
  }

  private async transaction<T>(
    actor: ActorReference,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.source.transaction(
        'READ COMMITTED',
        async (manager) => {
          await lockAuthority(manager, false, actor.statementTimeoutMs);
          await this.modules.execute(actor.userId, ['/business'], manager);
          return work(manager);
        },
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        ['55P03', '57014', '40001', '40P01'].includes(error.driverError.code)
      ) {
        throw new ServiceUnavailableException(
          'business:cash_mutation_unavailable',
        );
      }
      throw error;
    }
  }
}
