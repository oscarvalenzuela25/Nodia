import type { ActorReference } from '../../authorization/authority-transaction.js';
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalPropertyService } from '../rental-property.service.js';
import { RentalConfigurationQueryDto } from '../dto/rental-configuration-query.dto.js';
import {
  configurationCommand,
  configurationId,
} from '../dto/configuration-validation.js';
import {
  configurationPage,
  validateConfigurationQuery,
} from '../types/rental-configuration.types.js';
import { rentalPropertyResponse } from '../types/rental-property.types.js';

@Injectable()
export class GetRentalPropertiesUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalPropertyService,
  ) {}
  async execute(actor: ActorReference, input: RentalConfigurationQueryDto) {
    const actorId = actor.userId;
    if (!configurationId(actorId))
      throw new UnauthorizedException('rental:not_found');
    const query = await configurationCommand(
      RentalConfigurationQueryDto,
      input,
    );
    validateConfigurationQuery(query, 'property');
    return this.transactions.list(actor, async (manager, isSuperAdmin) => {
      const [rows, total] = await this.service.findPage(
        manager,
        actorId,
        query,
        isSuperAdmin,
      );
      return configurationPage(
        rows.map((row) =>
          rentalPropertyResponse(row, row.owner_id === actorId, isSuperAdmin),
        ),
        total,
        query,
      );
    });
  }
  /** Recheck every resource and membership flag before delivering a cached/public page. */
  async verifyResultAuthority(
    actor: ActorReference,
    records: readonly {
      id: string;
      owner_id: string;
      membership: {
        type: string;
        can_manage_configuration: boolean;
        can_manage_collaborators: boolean;
      };
    }[],
  ): Promise<void> {
    if (
      records.length > 100 ||
      new Set(records.map((row) => row.id)).size !== records.length ||
      records.some((row) => !configurationId(row.id))
    )
      throw new NotFoundException('rental:not_found');
    await this.transactions.list(actor, async (manager, isSuperAdmin) => {
      const rows = records.length
        ? await this.service.visibleMemberships(
            manager,
            actor.userId,
            records.map((row) => row.id),
            isSuperAdmin,
          )
        : [];
      const owners = new Map(rows.map((row) => [row.id, row.owner_id]));
      for (const record of records) {
        const owner = owners.get(record.id);
        const own = owner === actor.userId;
        const type = own
          ? 'owner'
          : isSuperAdmin
            ? 'super_admin'
            : 'collaborator';
        if (
          !owner ||
          owner !== record.owner_id ||
          record.membership.type !== type ||
          record.membership.can_manage_configuration !==
            (own || isSuperAdmin) ||
          record.membership.can_manage_collaborators !== (own || isSuperAdmin)
        )
          throw new NotFoundException('rental:not_found');
      }
    });
  }
}
