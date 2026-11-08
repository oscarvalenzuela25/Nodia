import { requireCompatibleProviderTransfers } from './use-case/provider-transfer.rules.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type EntityManager } from 'typeorm';
import { ProviderContact } from '../provider-contact/entities/provider-contact.entity.js';
import type { ExportProvidersCsvDto } from './dto/export-providers-csv.dto.js';
import { Provider } from './entities/provider.entity.js';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { BulkCreateProviderDto } from './dto/bulk-create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import { BulkUpdateProviderDto } from './dto/bulk-update-provider.dto.js';
import { GetProvidersDto } from './dto/get-providers.dto.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { GetProvidersResponse } from './types/provider.types.js';
import type { ActorReference } from '../authorization/authority-transaction.js';
import {
  assertBusinessesAccess,
  resolveBusinessAccess,
  scopeBusinessQuery,
} from '../business-access/business-access.js';

@Injectable()
export class ProviderService {
  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async transaction<T>(
    manager: EntityManager | undefined,
    work: (transaction: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (manager) {
      if (!manager.queryRunner?.isTransactionActive)
        throw new ConflictException(
          'Provider transfer requires an active transaction',
        );
      return work(manager);
    }
    return this.providerRepository.manager.transaction(work);
  }
  async scopes(
    manager: EntityManager,
    ids: readonly string[],
  ): Promise<{ id: string; business_id: string }[]> {
    const rows: { id: string; business_id: string }[] = await manager.query(
      'SELECT id::text,business_id::text FROM providers WHERE id=ANY($1::bigint[]) ORDER BY id',
      [ids],
    );
    if (rows.length !== ids.length)
      throw new NotFoundException('Provider not found');
    return rows;
  }
  assertBusinessAccess(
    manager: EntityManager,
    actor: ActorReference,
    ids: readonly string[],
  ) {
    return assertBusinessesAccess(manager, actor, ids, { lock: true });
  }
  async lockBusinesses(
    manager: EntityManager,
    ids: readonly string[],
  ): Promise<void> {
    const unique = [...new Set(ids.map((id) => id.toLowerCase()))].sort();
    const rows: { id: string }[] = await manager.query(
      'SELECT id::text FROM businesses WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',
      [unique],
    );
    if (rows.length !== unique.length)
      throw new NotFoundException('Business not found');
  }
  async lockProvider(manager: EntityManager, id: string): Promise<Provider> {
    const provider = await manager
      .getRepository(Provider)
      .createQueryBuilder('provider')
      .setLock('pessimistic_write')
      .where('provider.id = :id', { id })
      .getOne();
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  async findAll(
    { page = 1, limit = 10, all = false, includes = true, q }: GetProvidersDto,
    actor?: ActorReference,
  ): Promise<GetProvidersResponse> {
    const repository =
      actor?.transaction?.getRepository(Provider) ?? this.providerRepository;
    const scope = await resolveBusinessAccess(repository.manager, actor!);
    const qb = repository.createQueryBuilder('provider');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('provider.business', 'business');
    }

    applyRansack(qb, q, 'provider', RANSACK_POLICIES.provider);

    if (!q?.s) {
      qb.addOrderBy('provider.created_at', 'DESC');
    }
    if (!/^id(?:\s|$)/i.test(q?.s?.trim() ?? ''))
      qb.addOrderBy('provider.id', 'ASC');

    scopeBusinessQuery(qb, 'provider.business_id', scope);

    if (all) {
      const data = await qb.getMany();
      return {
        data,
        meta: {
          page: 1,
          limit: data.length,
          total_items: data.length,
          total_pages: 1,
        },
      };
    }

    const [data, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const total_pages = Math.ceil(total_items / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findOne(id: string, actor?: ActorReference): Promise<Provider> {
    const repository =
      actor?.transaction?.getRepository(Provider) ?? this.providerRepository;
    const scope = await resolveBusinessAccess(repository.manager, actor!);
    const provider = await scopeBusinessQuery(
      repository
        .createQueryBuilder('provider')
        .leftJoinAndSelect('provider.business', 'business')
        .where('provider.id = :id', { id }),
      'provider.business_id',
      scope,
    ).getOne();
    if (!provider) {
      throw new NotFoundException(`Provider with ID "${id}" not found`);
    }
    return provider;
  }

  async findForExport(
    dto: ExportProvidersCsvDto,
    limits?: { maxRows: number; maxBytes: number },
    actor?: ActorReference,
  ) {
    const maxRows = limits ? Math.min(1000, limits.maxRows) : 1000;
    if (
      !Number.isSafeInteger(maxRows) ||
      maxRows < 1 ||
      (limits &&
        (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 1))
    )
      throw new BadRequestException('Export resource limits are invalid');
    const repository =
      actor?.transaction?.getRepository(Provider) ?? this.providerRepository;
    const scope = await resolveBusinessAccess(repository.manager, actor!);
    const qb = repository.createQueryBuilder('provider');
    if (dto.business_id)
      qb.andWhere('provider.business_id = :businessId', {
        businessId: dto.business_id,
      });
    if (dto.ids) qb.andWhere('provider.id IN (:...ids)', { ids: dto.ids });
    scopeBusinessQuery(qb, 'provider.business_id', scope);
    qb.orderBy('provider.id', 'ASC').take(maxRows + 1);
    let mappingBytes = 0;
    if (limits) {
      // Bound arbitrary legacy mapping JSON before hydrating it into Node memory.
      const sizes: { id: string; bytes: string }[] = await qb
        .clone()
        .select('provider.id', 'id')
        .addSelect("octet_length(COALESCE(provider.fields::text, ''))", 'bytes')
        .getRawMany();
      mappingBytes = sizes.reduce((sum, item) => sum + Number(item.bytes), 0);
      if (sizes.length > maxRows || mappingBytes > limits.maxBytes)
        throw new BadRequestException(
          'Export exceeds resource limits; narrow the view',
        );
    }
    const providers = await qb.getMany();
    if (providers.length > maxRows)
      throw new BadRequestException(
        'Export exceeds row limit; narrow the view',
      );
    if (dto.ids && new Set(dto.ids).size !== providers.length)
      throw new ConflictException(
        'Providers changed; refresh the view before downloading',
      );
    if (!providers.length)
      return { providers, contacts: [] as ProviderContact[] };
    const contactRepository = repository.manager.getRepository(ProviderContact);
    if (limits) {
      const sizes: { id: string; bytes: string }[] = await contactRepository
        .createQueryBuilder('contact')
        .select('contact.id', 'id')
        .addSelect(
          "octet_length(contact.phone::text) + octet_length(contact.schedule::text) + octet_length(COALESCE(contact.description, ''))",
          'bytes',
        )
        .where('contact.provider_id IN (:...ids)', {
          ids: providers.map((p) => p.id),
        })
        .orderBy('contact.id', 'ASC')
        .take(5001)
        .getRawMany();
      if (
        sizes.length > 5000 ||
        mappingBytes +
          sizes.reduce((sum, item) => sum + Number(item.bytes), 0) >
          limits.maxBytes
      )
        throw new BadRequestException(
          'Export exceeds resource limits; narrow the view',
        );
    }
    const contacts = await contactRepository.find({
      where: { provider_id: In(providers.map((p) => p.id)) },
      order: { id: 'ASC' },
      take: 5001,
    });
    if (contacts.length > 5000)
      throw new BadRequestException('Export supports up to 5000 contacts');
    const byId = new Map(providers.map((p) => [p.id, p]));
    return {
      providers: dto.ids ? dto.ids.map((id) => byId.get(id)!) : providers,
      contacts,
    };
  }

  async create(
    createProviderDto: CreateProviderDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<Provider> {
    return this.transaction(
      manager ?? actor?.transaction,
      async (transaction) => {
        await assertBusinessesAccess(
          transaction,
          actor!,
          [createProviderDto.business_id],
          { lock: true },
        );
        const payload = {
          ...createProviderDto,
          tax:
            createProviderDto.tax !== undefined &&
            createProviderDto.tax !== null
              ? Number(createProviderDto.tax)
              : 19,
          name: createProviderDto.name
            ? createProviderDto.name.trim().toLowerCase()
            : createProviderDto.name,
        };
        const repository = transaction.getRepository(Provider);
        const provider = repository.create(payload);
        return repository.save(provider);
      },
    );
  }

  async update(
    id: string,
    updateProviderDto: UpdateProviderDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<Provider> {
    const repository =
      manager?.getRepository(Provider) ?? this.providerRepository;
    const scope = await resolveBusinessAccess(repository.manager, actor!);
    const provider = await scopeBusinessQuery(
      repository
        .createQueryBuilder('provider')
        .where('provider.id = :id', { id }),
      'provider.business_id',
      scope,
    )
      .setLock('pessimistic_write')
      .getOne();
    if (!provider) throw new NotFoundException('Provider not found');
    const payload = {
      ...updateProviderDto,
      ...(updateProviderDto.tax !== undefined && {
        tax: Number(updateProviderDto.tax),
      }),
      ...(updateProviderDto.name !== undefined && {
        name: updateProviderDto.name
          ? updateProviderDto.name.trim().toLowerCase()
          : updateProviderDto.name,
      }),
    };
    Object.assign(provider, payload);
    return repository.save(provider);
  }

  async createBulk(
    bulkDto: BulkCreateProviderDto,
    actor?: ActorReference,
  ): Promise<Provider[]> {
    return this.transaction(actor?.transaction, async (manager) => {
      await assertBusinessesAccess(
        manager,
        actor!,
        bulkDto.items.map((item) => item.business_id),
        { lock: true },
      );
      const payload = bulkDto.items.map((item) => ({
        ...item,
        tax:
          item.tax !== undefined && item.tax !== null ? Number(item.tax) : 19,
        name: item.name ? item.name.trim().toLowerCase() : item.name,
        fields: item.fields ?? {},
      }));
      const repository = manager.getRepository(Provider);
      const entities = repository.create(payload);
      return repository.save(entities);
    });
  }

  async updateBulk(
    bulkDto: BulkUpdateProviderDto,
    actor?: ActorReference,
  ): Promise<Provider[]> {
    const items = bulkDto.items.map((item) => {
      if (
        typeof item.id !== 'string' ||
        !/^\d{1,19}$/.test(item.id) ||
        BigInt(item.id) < 1n ||
        BigInt(item.id) > 9223372036854775807n
      )
        throw new BadRequestException('Invalid provider ID');
      return { ...item, id: BigInt(item.id).toString() };
    });
    const ids = items.map((item) => item.id);
    if (!ids.length || new Set(ids).size !== ids.length)
      throw new BadRequestException('Duplicate or empty provider selection');
    return this.transaction(actor?.transaction, async (manager) => {
      await assertBusinessesAccess(manager, actor!, [], { lock: true });
      const before = await this.scopes(manager, ids);
      const origins = new Map(before.map((row) => [row.id, row.business_id]));
      await assertBusinessesAccess(
        manager,
        actor!,
        [
          ...before.map((row) => row.business_id),
          ...items.flatMap((item) =>
            item.business_id === undefined ? [] : [item.business_id],
          ),
        ],
        { lock: true },
      );
      const repository = manager.getRepository(Provider);
      const providers = await repository
        .createQueryBuilder('provider')
        .where('provider.id IN (:...ids)', { ids })
        .orderBy('provider.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      if (providers.length !== ids.length)
        throw new NotFoundException('Provider not found');
      if (
        providers.some(
          (provider) => provider.business_id !== origins.get(provider.id),
        )
      )
        throw new ConflictException(
          'Provider scope changed. Reload before retrying.',
        );
      const byId = new Map(
        providers.map((provider) => [provider.id, provider]),
      );
      const transfers = items.flatMap((item) =>
        item.business_id !== undefined &&
        item.business_id !== byId.get(item.id)!.business_id
          ? [{ providerId: item.id, destinationBusinessId: item.business_id }]
          : [],
      );
      await requireCompatibleProviderTransfers(manager, transfers);
      const updated = items.map((item) => {
        const { id, ...attrs } = item;
        const provider = byId.get(id)!;
        Object.assign(provider, attrs, {
          ...(attrs.tax !== undefined ? { tax: Number(attrs.tax) } : {}),
          ...(attrs.name !== undefined
            ? {
                name: attrs.name ? attrs.name.trim().toLowerCase() : attrs.name,
              }
            : {}),
        });
        return provider;
      });
      return repository.save(updated);
    });
  }
}
