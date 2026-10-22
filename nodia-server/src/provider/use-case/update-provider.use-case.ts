import { requireCompatibleProviderTransfer } from './provider-transfer.rules.js';
import type { EntityManager } from 'typeorm';
import { ConflictException, Injectable } from '@nestjs/common';
import { UpdateProviderDto } from '../dto/update-provider.dto.js';
import { ProviderService } from '../provider.service.js';

@Injectable()
export class UpdateProviderUseCase {
  constructor(private readonly providerService: ProviderService) {}

  async execute(id: string, dto: UpdateProviderDto, manager?: EntityManager) {
    if (dto.name) {
      dto.name = dto.name.trim().toLowerCase();
    }
    if (dto.business_id !== undefined)
      return this.providerService.transaction(manager, async (transaction) => {
        const [before] = await this.providerService.scopes(transaction, [id]);
        await this.providerService.lockBusinesses(transaction, [
          before.business_id,
          dto.business_id!,
        ]);
        const current = await this.providerService.lockProvider(
          transaction,
          id,
        );
        if (current.business_id !== before.business_id)
          throw new ConflictException(
            'Provider scope changed. Reload before retrying.',
          );
        if (current.business_id !== dto.business_id)
          await requireCompatibleProviderTransfer(
            transaction,
            id,
            dto.business_id!,
          );
        return this.providerService.update(id, dto, transaction);
      });
    return manager
      ? this.providerService.update(id, dto, manager)
      : this.providerService.update(id, dto);
  }
}
