import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProviderContactService } from '../provider-contact.service.js';
import {
  UpdateProviderContactDto,
  ToggleProviderContactDto,
} from '../dto/provider-contact.dto.js';
import {
  contactHash,
  normalizeContact,
  validateContactId,
  validateVersion,
} from './contact-validation.js';

@Injectable()
export class UpdateProviderContactUseCase {
  constructor(private readonly service: ProviderContactService) {}
  async execute(
    providerId: string,
    id: string,
    dto: UpdateProviderContactDto | ToggleProviderContactDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    validateContactId(providerId);
    validateContactId(id);
    validateVersion(dto.version);
    return this.service.withAccess(
      providerId,
      actor!,
      manager,
      async (manager) => {
        const current = await (manager
          ? this.service.find(providerId, id, manager)
          : this.service.find(providerId, id));
        if (!current)
          throw new NotFoundException('Contact not found for this provider');
        const values = normalizeContact(
          'name' in dto ? dto : { ...current, is_active: dto.is_active },
        );
        if (
          await (manager
            ? this.service.updateVersion(
                providerId,
                id,
                dto.version,
                values,
                manager,
              )
            : this.service.updateVersion(providerId, id, dto.version, values))
        ) {
          const updated = await (manager
            ? this.service.find(providerId, id, manager)
            : this.service.find(providerId, id));
          if (!updated) throw new NotFoundException('Contact not found');
          return updated;
        }
        const latest = await (manager
          ? this.service.find(providerId, id, manager)
          : this.service.find(providerId, id));
        if (
          latest?.version === dto.version + 1 &&
          contactHash(normalizeContact(latest)) === contactHash(values)
        )
          return latest;
        throw new ConflictException(
          'Contact changed in another session. Reload it before editing again',
        );
      },
    );
  }
}
