import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProviderContactService } from '../provider-contact.service.js';
import { CreateProviderContactDto } from '../dto/provider-contact.dto.js';
import {
  contactHash,
  normalizeContact,
  validateContactId,
  validateRequestKey,
} from './contact-validation.js';

@Injectable()
export class CreateProviderContactUseCase {
  constructor(private readonly service: ProviderContactService) {}
  async execute(providerId: string, dto: CreateProviderContactDto) {
    validateContactId(providerId);
    validateRequestKey(dto.request_key);
    const values = normalizeContact(dto);
    if (!(await this.service.providerExists(providerId)))
      throw new NotFoundException('Provider not found');
    const hash = contactHash(values);
    const contact = await this.service.createOnce(
      providerId,
      dto.request_key,
      hash,
      values,
    );
    if (contact.creation_hash !== hash)
      throw new ConflictException(
        'This request key was already used for different contact data',
      );
    // Persistence keys and hashes are internal; never expose them in HTTP responses.
    const { creation_hash: _hash, creation_key: _key, ...response } = contact;
    return response;
  }
}
