import { ConflictException, Injectable } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  type DeepPartial,
} from 'typeorm';
import { FinanceCategory } from '../finance-category/entities/finance-category.entity.js';
import { FinanceMovement } from '../finance-movement/entities/finance-movement.entity.js';
import { FinanceObligation } from './entities/finance-obligation.entity.js';

/** Persistence only. Every writer uses the same obligation row lock before reading settlement. */
@Injectable()
export class FinanceLedgerService {
  constructor(private readonly dataSource: DataSource) {}

  async transaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(work);
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const cause: unknown = error.driverError;
        if (typeof cause === 'object' && cause !== null && 'code' in cause) {
          if (cause.code === '23505')
            throw new ConflictException('finance:duplicate_key');
          if (
            cause.code === '23503' ||
            cause.code === '40P01' ||
            cause.code === '40001'
          ) {
            throw new ConflictException('finance:concurrent_conflict');
          }
        }
      }
      throw error;
    }
  }

  category(manager: EntityManager, userId: string, id: string) {
    return manager.getRepository(FinanceCategory).findOne({
      where: { id, user_id: userId },
      lock: { mode: 'pessimistic_read' },
    });
  }

  obligation(manager: EntityManager, userId: string, id: string, lock = true) {
    return manager.getRepository(FinanceObligation).findOne({
      where: { id, user_id: userId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }

  movement(manager: EntityManager, userId: string, id: string, lock = true) {
    return manager.getRepository(FinanceMovement).findOne({
      where: { id, user_id: userId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }

  initialMovements(manager: EntityManager, obligation: FinanceObligation) {
    return manager.getRepository(FinanceMovement).find({
      where: {
        user_id: obligation.user_id,
        obligation_id: obligation.id,
        type: obligation.type === 'loan' ? 'expense' : 'income',
      },
    });
  }

  async confirmedPaid(
    manager: EntityManager,
    obligation: FinanceObligation,
    excludingId?: string,
  ): Promise<string> {
    const qb = manager
      .getRepository(FinanceMovement)
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)::text', 'amount')
      .where(
        'payment.user_id = :userId AND payment.obligation_id = :obligationId',
        { userId: obligation.user_id, obligationId: obligation.id },
      )
      .andWhere('payment.type = :type AND payment.status = :status', {
        type: obligation.type === 'loan' ? 'income' : 'expense',
        status: obligation.type === 'loan' ? 'received' : 'paid',
      });
    if (excludingId !== undefined)
      qb.andWhere('payment.id <> :excludingId', { excludingId });
    const row = await qb.getRawOne<{ amount: string }>();
    return row?.amount ?? '0';
  }

  saveMovement(
    manager: EntityManager,
    data: DeepPartial<FinanceMovement>,
  ): Promise<FinanceMovement> {
    const repo = manager.getRepository(FinanceMovement);
    return repo.save(repo.create(data));
  }

  saveObligation(
    manager: EntityManager,
    data: DeepPartial<FinanceObligation>,
  ): Promise<FinanceObligation> {
    const repo = manager.getRepository(FinanceObligation);
    return repo.save(repo.create(data));
  }
}
