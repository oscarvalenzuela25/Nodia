import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { Invoice } from './entities/invoice.entity.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { GetInvoicesDto } from './dto/get-invoices.dto.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { GetInvoicesResponse } from './types/invoice.types.js';
import type { ActorReference } from '../authorization/authority-transaction.js';
import {
  assertBusinessesAccess,
  resolveBusinessAccess,
  scopeBusinessQuery,
} from '../business-access/business-access.js';
import { assertInvoiceFileScope } from './invoice-file-scope.js';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  async findAllInvoices(
    { page = 1, limit = 10, all = false, includes = true, q }: GetInvoicesDto,
    actor?: ActorReference,
  ): Promise<GetInvoicesResponse> {
    const scope = await resolveBusinessAccess(
      this.invoiceRepository.manager,
      actor,
    );
    const qb = this.invoiceRepository.createQueryBuilder('invoice');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('invoice.business', 'business').leftJoinAndSelect(
        'invoice.provider',
        'provider',
        'provider.business_id = invoice.business_id',
      );
    }

    if (q) {
      const qCopy = { ...q };

      if (qCopy.issue_date_gteq) {
        qb.andWhere(
          "(COALESCE(invoice.data->>'issue_date', to_char(invoice.created_at, 'YYYY-MM-DD')) >= :issueDateFrom)",
          { issueDateFrom: qCopy.issue_date_gteq },
        );
        delete qCopy.issue_date_gteq;
      }

      if (qCopy.issue_date_lteq) {
        qb.andWhere(
          "(COALESCE(invoice.data->>'issue_date', to_char(invoice.created_at, 'YYYY-MM-DD')) <= :issueDateTo)",
          { issueDateTo: qCopy.issue_date_lteq },
        );
        delete qCopy.issue_date_lteq;
      }

      applyRansack(qb, qCopy, 'invoice', RANSACK_POLICIES.invoice);
    }

    scopeBusinessQuery(qb, 'invoice.business_id', scope);
    if (!q?.s) {
      qb.addOrderBy('invoice.created_at', 'DESC');
    }
    if (!/^id(?:\s|$)/i.test(q?.s?.trim() ?? ''))
      qb.addOrderBy('invoice.id', 'ASC');

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

  async findOneInvoice(
    id: string,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<Invoice> {
    const repository =
      manager?.getRepository(Invoice) ?? this.invoiceRepository;
    // Validate the actor even when the requested record does not exist.
    await resolveBusinessAccess(manager ?? repository.manager, actor);
    const invoice = await repository.findOne({
      where: { id },
      relations: { business: true, provider: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }
    await assertBusinessesAccess(manager ?? repository.manager, actor, [
      invoice.business_id,
    ]);
    if (
      invoice.provider &&
      invoice.provider.business_id !== invoice.business_id
    )
      throw new ConflictException('business:invoice_provider_scope_invalid');
    return invoice;
  }

  async assertBusinessAccess(
    businessId: string,
    actor?: ActorReference,
  ): Promise<void> {
    await assertBusinessesAccess(this.invoiceRepository.manager, actor, [
      businessId,
    ]);
  }

  async createInvoice(
    dto: CreateInvoiceDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<Invoice> {
    if (!manager)
      return this.invoiceRepository.manager.transaction((transaction) =>
        this.createInvoice(dto, transaction, actor),
      );
    this.requireTransaction(manager);
    try {
      await assertBusinessesAccess(manager, actor, [dto.business_id], {
        lock: true,
      });
      assertInvoiceFileScope(dto.path_storage, dto.business_id);
      await this.lockReferences(
        manager,
        [dto.business_id],
        dto.business_id,
        dto.provider_id ?? null,
      );
      const repository = manager.getRepository(Invoice);
      const invoice = repository.create(dto);
      return await repository.save(invoice);
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new BadRequestException(
          'Referenced business or provider does not exist',
        );
      }
      if (error?.code === '22P02') {
        throw new BadRequestException(
          'Invalid input syntax for ID or numeric field',
        );
      }
      throw error;
    }
  }

  async updateInvoice(
    id: string,
    dto: UpdateInvoiceDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<Invoice> {
    if (!manager)
      return this.invoiceRepository.manager.transaction((transaction) =>
        this.updateInvoice(id, dto, transaction, actor),
      );
    this.requireTransaction(manager);
    try {
      await assertBusinessesAccess(manager, actor, [], { lock: true });
      const before = await this.referenceSnapshot(manager, id);
      if (!before)
        throw new NotFoundException(`Invoice with ID "${id}" not found`);
      const destination = dto.business_id ?? before.business_id;
      const providerId =
        dto.provider_id === undefined ? before.provider_id : dto.provider_id;
      await assertBusinessesAccess(
        manager,
        actor,
        [before.business_id, destination],
        { lock: true },
      );
      if (dto.path_storage !== undefined || destination !== before.business_id)
        assertInvoiceFileScope(
          dto.path_storage ?? before.path_storage,
          destination,
        );
      await this.lockReferences(
        manager,
        [before.business_id, destination],
        destination,
        providerId,
      );
      const locked = await this.referenceSnapshot(manager, id, true);
      if (!isDeepStrictEqual(before, locked))
        throw new ConflictException(
          'Invoice changed. Reload it before retrying.',
        );
      const repository = manager.getRepository(Invoice);
      const invoice = await this.findOneInvoice(id, manager, actor);
      // TypeORM gives a hydrated relation precedence over its scalar join column.
      // A requested FK change must not be overwritten by the previous object.
      if (
        dto.provider_id !== undefined &&
        (dto.provider_id === null || dto.provider_id !== invoice.provider_id)
      )
        Object.assign(invoice, {
          provider: dto.provider_id === null ? null : undefined,
        });
      if (
        dto.business_id !== undefined &&
        dto.business_id !== invoice.business_id
      )
        Object.assign(invoice, { business: undefined });
      Object.assign(invoice, dto);
      return await repository.save(invoice);
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new BadRequestException(
          'Referenced business or provider does not exist',
        );
      }
      if (error?.code === '22P02') {
        throw new BadRequestException(
          'Invalid input syntax for ID or numeric field',
        );
      }
      throw error;
    }
  }

  private requireTransaction(manager: EntityManager) {
    if (!manager.queryRunner?.isTransactionActive)
      throw new ConflictException(
        'Invoice effect requires an active transaction',
      );
  }

  private async referenceSnapshot(
    manager: EntityManager,
    id: string,
    lock = false,
  ): Promise<{
    business_id: string;
    provider_id: string | null;
    path_storage: string;
  } | null> {
    const rows: {
      business_id: string;
      provider_id: string | null;
      path_storage: string;
    }[] = await manager.query(
      `SELECT id::text,business_id::text,provider_id::text,code,total_amount,path_storage,data,is_active,updated_at::text
       FROM invoices WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );
    return rows[0] ?? null;
  }

  /** Ownership is checked under the same authority/parent locks as relation integrity. */
  private async lockReferences(
    manager: EntityManager,
    sourceAndDestination: readonly string[],
    destination: string,
    providerId: string | null,
  ) {
    const businesses = [
      ...new Set(sourceAndDestination.map((value) => value.toLowerCase())),
    ].sort();
    const rows: { id: string }[] = await manager.query(
      'SELECT id::text FROM businesses WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',
      [businesses],
    );
    if (rows.length !== businesses.length)
      throw new BadRequestException('Referenced business does not exist');
    if (providerId === null) return;
    const providers: { id: string; business_id: string }[] =
      await manager.query(
        'SELECT id::text,business_id::text FROM providers WHERE id=$1 FOR SHARE',
        [providerId],
      );
    if (!providers[0])
      throw new BadRequestException('Referenced provider does not exist');
    if (providers[0].business_id.toLowerCase() !== destination.toLowerCase())
      throw new BadRequestException(
        'Referenced provider must belong to the invoice business',
      );
  }
}
