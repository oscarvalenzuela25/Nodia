import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProviderContactService } from '../provider-contact.service.js';
import { ContactListDto } from '../dto/provider-contact.dto.js';
import { validateContactId } from './contact-validation.js';

@Injectable()
export class GetProviderContactsUseCase {
  constructor(private readonly service: ProviderContactService) {}
  async execute(providerId: string, query: ContactListDto) {
    validateContactId(providerId);
    if (
      !Number.isInteger(query.page) ||
      query.page < 1 ||
      query.page > 1000000 ||
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 100 ||
      (query.search !== undefined &&
        (typeof query.search !== 'string' || query.search.length > 255))
    )
      throw new BadRequestException('Invalid pagination');
    if (!(await this.service.providerExists(providerId)))
      throw new NotFoundException('Provider not found');
    return this.service.list(providerId, query);
  }
}
