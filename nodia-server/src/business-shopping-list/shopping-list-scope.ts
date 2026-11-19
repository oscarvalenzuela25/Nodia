import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import {
  lockAuthority,
  type ActorReference,
} from '../authorization/authority-transaction.js';
import { hasAuthorityTransactionLocks } from '../authorization/authority-transaction-proof.js';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import { assertBusinessesAccess } from '../business-access/business-access.js';

@Injectable()
export class ShoppingListScope {
  constructor(
    private readonly source: DataSource,
    private readonly modules: CheckModuleAccessUseCase,
  ) {}

  async run<T>(
    businessId: string,
    actor: ActorReference,
    work: (manager: EntityManager, actorId: string) => Promise<T>,
  ): Promise<T> {
    const authorizedWork = async (manager: EntityManager): Promise<T> => {
      await this.modules.execute(actor.userId, ['/business'], manager);
      const { userId } = await assertBusinessesAccess(
        manager,
        actor,
        [businessId],
        { lock: true },
      );
      return work(manager, userId);
    };
    try {
      if (actor.transaction) {
        if (
          actor.transaction.dataSource !== this.source ||
          !(await hasAuthorityTransactionLocks(actor.transaction))
        )
          throw new ForbiddenException('authorization:transaction_required');
        return await authorizedWork(actor.transaction);
      }
      return await this.source.transaction(
        'READ COMMITTED',
        async (manager) => {
          await lockAuthority(manager, false, actor.statementTimeoutMs);
          return authorizedWork(manager);
        },
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        ['55P03', '57014', '40001', '40P01'].includes(error.driverError.code)
      )
        throw new ServiceUnavailableException(
          'business:shopping_list_unavailable',
        );
      throw error;
    }
  }
}
