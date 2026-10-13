import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { isUUID } from 'class-validator';
import { Provider } from '../entities/provider.entity.js';
import { ProviderContact } from '../../provider-contact/entities/provider-contact.entity.js';
import { Business } from '../../business/entities/business.entity.js';
import {
  contactHash,
  normalizeContact,
  validateContactId,
  validateVersion,
} from '../../provider-contact/use-case/contact-validation.js';
import type { ImportProvidersDto } from '../dto/import-providers.dto.js';

@Injectable()
export class ImportProvidersUseCase {
  constructor(private readonly source: DataSource) {}

  async execute(dto: ImportProvidersDto) {
    if (
      !Array.isArray(dto.items) ||
      !dto.items.length ||
      dto.items.length > 1000
    )
      throw new BadRequestException('Invalid provider import size');
    const businessId = dto.items[0].business_id;
    if (!isUUID(businessId)) throw new BadRequestException('Invalid business');
    const identities = new Set<string>();
    let contactCount = 0;
    const items = dto.items.map((item) => {
      if (item.business_id !== businessId)
        throw new BadRequestException('Import must belong to one business');
      if (item.id !== undefined) validateContactId(item.id);
      const name =
        typeof item.name === 'string' ? item.name.trim().toLowerCase() : '';
      if (
        item.fields !== undefined &&
        (!item.fields ||
          typeof item.fields !== 'object' ||
          Array.isArray(item.fields))
      )
        throw new BadRequestException('Invalid provider mapping');
      if (item.tax === null)
        throw new BadRequestException('Invalid provider tax');
      if (
        name.length < 2 ||
        name.length > 255 ||
        !Number.isInteger(item.tax ?? 19) ||
        (item.tax ?? 19) < 0 ||
        (item.tax ?? 19) > 100 ||
        (item.is_active !== undefined && typeof item.is_active !== 'boolean')
      )
        throw new BadRequestException('Invalid provider values');
      const identity = item.id ? `id:${item.id}` : `name:${name}`;
      if (identities.has(identity))
        throw new BadRequestException('Duplicate provider in import');
      identities.add(identity);
      if (
        item.contacts !== undefined &&
        (!Array.isArray(item.contacts) || item.contacts.length > 100)
      )
        throw new BadRequestException('Invalid contact size');
      const contactIds = new Set<string>();
      const contacts = item.contacts?.map((contact, index) => {
        contactCount++;
        if (contact.id !== undefined) {
          validateContactId(contact.id);
          validateVersion(contact.version!);
          if (contactIds.has(contact.id))
            throw new BadRequestException('Duplicate contact in import');
          contactIds.add(contact.id);
        }
        const values = normalizeContact(contact);
        const hash = contactHash(values);
        const digest = createHash('sha256')
          .update(`provider-csv:${index}:${hash}`)
          .digest('hex');
        const key = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
        return { id: contact.id, version: contact.version, values, hash, key };
      });
      return { ...item, name, contacts };
    });
    if (contactCount > 5000)
      throw new BadRequestException('Too many contacts in import');

    return this.source.transaction(async (manager) => {
      // All imports of a business serialize; row locks coordinate with ordinary editors.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`provider-import:${businessId}`],
      );
      if (!(await manager.getRepository(Business).existsBy({ id: businessId })))
        throw new NotFoundException('Business not found');
      const providers = manager.getRepository(Provider);
      const contacts = manager.getRepository(ProviderContact);
      const existing = await providers
        .createQueryBuilder('provider')
        .where('provider.business_id = :businessId', { businessId })
        .andWhere(
          '(provider.id IN (:...ids) OR lower(trim(provider.name)) IN (:...names))',
          {
            ids: items.map((p) => p.id ?? '0'),
            names: items
              .filter((p) => !p.id)
              .map((p) => p.name)
              .concat(['']),
          },
        )
        .orderBy('provider.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      const byId = new Map(existing.map((p) => [p.id, p]));
      const imported: Provider[] = [];
      const targets = new Set<string>();
      const ids = items.flatMap(
        (p) => p.contacts?.flatMap((c) => (c.id ? [c.id] : [])) ?? [],
      );
      const existingContacts = ids.length
        ? await contacts.findBy({ id: In(ids) })
        : [];
      const contactById = new Map(existingContacts.map((c) => [c.id, c]));
      for (const item of items) {
        let provider = item.id ? byId.get(item.id) : undefined;
        if (item.id && !provider)
          throw new NotFoundException(
            'Provider does not belong to import business',
          );
        if (!item.id) {
          const matches = existing.filter(
            (p) => p.name.trim().toLowerCase() === item.name,
          );
          if (matches.length > 1)
            throw new ConflictException('Ambiguous provider name; use an ID');
          provider = matches[0];
        }
        if (provider && targets.has(provider.id))
          throw new BadRequestException('Provider targeted twice');
        const values = {
          business_id: businessId,
          name: item.name,
          tax: item.tax ?? 19,
          is_active: item.is_active ?? true,
          fields: item.fields ?? {},
        };
        if (!provider) {
          provider = await providers.save(providers.create(values));
        } else if (
          provider.name !== values.name ||
          provider.tax !== values.tax ||
          provider.is_active !== values.is_active ||
          !isDeepStrictEqual(provider.fields, values.fields)
        ) {
          // Already fetched and locked: avoid save's extra SELECT per existing row.
          await providers
            .createQueryBuilder()
            .update()
            .set(values)
            .where('id = :id AND business_id = :businessId', {
              id: provider.id,
              businessId,
            })
            .execute();
          Object.assign(provider, values);
        }
        targets.add(provider.id);
        for (const contact of item.contacts ?? []) {
          if (contact.id) {
            const current = contactById.get(contact.id);
            if (!current || current.provider_id !== provider.id)
              throw new NotFoundException(
                'Contact does not belong to provider',
              );
            const same =
              contactHash(normalizeContact(current)) === contact.hash;
            if (
              current.version !== contact.version &&
              !(same && current.version === contact.version! + 1)
            )
              throw new ConflictException(
                'Contact changed; download its latest version',
              );
            if (same) continue;
            const result = await contacts
              .createQueryBuilder()
              .update()
              .set({ ...contact.values, version: () => 'version + 1' })
              .where(
                'id = :id AND provider_id = :providerId AND version = :version',
                {
                  id: contact.id,
                  providerId: provider.id,
                  version: contact.version,
                },
              )
              .execute();
            if (result.affected !== 1)
              throw new ConflictException(
                'Contact changed; download its latest version',
              );
          } else {
            await contacts
              .createQueryBuilder()
              .insert()
              .values({
                ...contact.values,
                provider_id: provider.id,
                creation_key: contact.key,
                creation_hash: contact.hash,
              })
              .orIgnore()
              .execute();
          }
        }
        imported.push(provider);
      }
      return { providers: imported.length, contacts: contactCount };
    });
  }
}
