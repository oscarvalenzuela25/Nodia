import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { Provider } from '../provider/entities/provider.entity.js';
import { ProviderContact } from './entities/provider-contact.entity.js';
import type { ContactValues } from './types/provider-contact.types.js';
import type { ContactListDto } from './dto/provider-contact.dto.js';
import type { ActorReference } from '../authorization/authority-transaction.js';
import {
  assertBusinessesAccess,
  resolveBusinessAccess,
  scopeBusinessQuery,
} from '../business-access/business-access.js';

@Injectable()
export class ProviderContactService {
  constructor(
    @InjectRepository(ProviderContact)
    private readonly contacts: Repository<ProviderContact>,
    @InjectRepository(Provider)
    private readonly providers: Repository<Provider>,
  ) {}
  async withAccess<T>(
    providerId: string,
    actor: ActorReference,
    manager: EntityManager | undefined,
    work: (transaction: EntityManager) => Promise<T>,
  ): Promise<T> {
    const operation = async (transaction: EntityManager) => {
      await assertBusinessesAccess(transaction, actor, [], { lock: true });
      const before: { business_id: string }[] = await transaction.query(
        'SELECT business_id::text FROM providers WHERE id=$1',
        [providerId],
      );
      if (!before[0]) throw new NotFoundException('Provider not found');
      await assertBusinessesAccess(
        transaction,
        actor,
        [before[0].business_id],
        { lock: true },
      );
      const current: { business_id: string }[] = await transaction.query(
        // Serialize writers on the parent before touching its contacts. A SHARE
        // lock here can deadlock with a worker holding a contact SHARE lock
        // while upgrading the same provider to UPDATE for its frozen snapshot.
        'SELECT business_id::text FROM providers WHERE id=$1 FOR UPDATE',
        [providerId],
      );
      if (!current[0]) throw new NotFoundException('Provider not found');
      if (current[0].business_id !== before[0].business_id)
        throw new ConflictException(
          'Provider scope changed. Reload before retrying.',
        );
      return work(transaction);
    };
    const transaction = manager ?? actor?.transaction;
    if (transaction) {
      if (!transaction.queryRunner?.isTransactionActive)
        throw new ConflictException(
          'Contact write requires an active transaction',
        );
      return operation(transaction);
    }
    return this.contacts.manager.transaction(operation);
  }
  async providerExists(
    providerId: string,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    const repository =
      (manager ?? actor?.transaction)?.getRepository(Provider) ??
      this.providers;
    const scope = await resolveBusinessAccess(repository.manager, actor!);
    return scopeBusinessQuery(
      repository
        .createQueryBuilder('provider')
        .where('provider.id = :providerId', { providerId }),
      'provider.business_id',
      scope,
    ).getExists();
  }
  async list(
    providerId: string,
    { page, limit, search }: ContactListDto,
    isActive?: boolean,
    actor?: ActorReference,
  ) {
    const repository =
      actor?.transaction?.getRepository(ProviderContact) ?? this.contacts;
    const scope = await resolveBusinessAccess(repository.manager, actor!);
    const qb = repository
      .createQueryBuilder('contact')
      .innerJoin(Provider, 'provider', 'provider.id = contact.provider_id')
      .where('contact.provider_id = :providerId', { providerId });
    if (isActive !== undefined)
      qb.andWhere('contact.is_active = :isActive', { isActive });
    if (search?.trim())
      qb.andWhere("contact.name ILIKE :search ESCAPE '!'", {
        search: `%${search.trim().replace(/[!%_]/g, '!$&')}%`,
      });
    scopeBusinessQuery(qb, 'provider.business_id', scope);
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
  find(providerId: string, id: string, manager?: EntityManager) {
    return (manager?.getRepository(ProviderContact) ?? this.contacts).findOneBy(
      { provider_id: providerId, id },
    );
  }
  async createOnce(
    providerId: string,
    key: string,
    hash: string,
    values: ContactValues,
    manager?: EntityManager,
  ) {
    const repository = manager?.getRepository(ProviderContact) ?? this.contacts;
    await repository
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
    return repository
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
    manager?: EntityManager,
  ) {
    const result = await (
      manager?.getRepository(ProviderContact) ?? this.contacts
    )
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
