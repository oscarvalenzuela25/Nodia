import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from '../provider/entities/provider.entity.js';
import { ProviderContact } from './entities/provider-contact.entity.js';
import type { ContactValues } from './types/provider-contact.types.js';
import type { ContactListDto } from './dto/provider-contact.dto.js';

@Injectable()
export class ProviderContactService {
  constructor(
    @InjectRepository(ProviderContact)
    private readonly contacts: Repository<ProviderContact>,
    @InjectRepository(Provider)
    private readonly providers: Repository<Provider>,
  ) {}
  providerExists(providerId: string) {
    return this.providers.existsBy({ id: providerId });
  }
  async list(providerId: string, { page, limit, search }: ContactListDto) {
    const qb = this.contacts
      .createQueryBuilder('contact')
      .where('contact.provider_id = :providerId', { providerId });
    if (search?.trim())
      qb.andWhere("contact.name ILIKE :search ESCAPE '!'", {
        search: `%${search.trim().replace(/[!%_]/g, '!$&')}%`,
      });
    const [data, total_items] = await qb
      .orderBy('contact.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      data,
      meta: {
        page,
        limit,
        total_items,
        total_pages: Math.ceil(total_items / limit),
      },
    };
  }
  find(providerId: string, id: string) {
    return this.contacts.findOneBy({ provider_id: providerId, id });
  }
  async createOnce(
    providerId: string,
    key: string,
    hash: string,
    values: ContactValues,
  ) {
    await this.contacts
      .createQueryBuilder()
      .insert()
      .values({
        ...values,
        provider_id: providerId,
        creation_key: key,
        creation_hash: hash,
      })
      .orIgnore()
      .execute();
    return this.contacts
      .createQueryBuilder('contact')
      .addSelect('contact.creation_hash')
      .where(
        'contact.provider_id = :providerId AND contact.creation_key = :key',
        { providerId, key },
      )
      .getOneOrFail();
  }
  async updateVersion(
    providerId: string,
    id: string,
    version: number,
    values: ContactValues,
  ) {
    const result = await this.contacts
      .createQueryBuilder()
      .update()
      .set({
        ...values,
        version: () => 'version + 1',
        updated_at: () => 'clock_timestamp()',
      })
      .where('provider_id = :providerId AND id = :id AND version = :version', {
        providerId,
        id,
        version,
      })
      .execute();
    return result.affected === 1;
  }
}
