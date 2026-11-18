import { normalizeInvoiceCode } from './invoice-code.js';
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
import { assertInvoiceCashCompatibility } from './invoice-cash-compatibility.js';

const invoiceFields = [
  'business_id',
  'provider_id',
  'code',
  'total_amount',
  'path_storage',
  'data',
  'is_active',
] as const;

type InvoiceWriteSnapshot = Pick<
  Invoice,
  'id' | 'version' | (typeof invoiceFields)[number]
> & {
  updated_at: string;
};

export interface PreparedInvoiceUpdate {
  before: Invoice;
  candidate: Invoice;
}

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  async findAllInvoices(
    { page = 1, limit = 10, all = false, includes = true, q }: GetInvoicesDto,
    actor?: ActorReference,
    includeCash = false,
  ): Promise<GetInvoicesResponse> {
    const scope = await resolveBusinessAccess(
      this.invoiceRepository.manager,
      actor,
    );
    const qb = this.invoiceRepository.createQueryBuilder('invoice');
    validateRansackEnvelope(q);
    if (includeCash) qb.addSelect('invoice.cash_expense');

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
    includeCash = false,
  ): Promise<Invoice> {
    const repository =
      manager?.getRepository(Invoice) ?? this.invoiceRepository;
    // Validate the actor even when the requested record does not exist.
    await resolveBusinessAccess(manager ?? repository.manager, actor);
    const invoice = includeCash
      ? await repository
          .createQueryBuilder('invoice')
          .addSelect('invoice.cash_expense')
          .leftJoinAndSelect('invoice.business', 'business')
          .leftJoinAndSelect('invoice.provider', 'provider')
          .where('invoice.id = :id', { id })
          .getOne()
      : await repository.findOne({
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
      const provider = await this.lockProvider(
        manager,
        dto.provider_id ?? null,
      );
      this.assertProviderScope(
        dto.provider_id ?? null,
        provider,
        dto.business_id,
      );
      const repository = manager.getRepository(Invoice);
      const invoice = repository.create({
        ...dto,
        code: normalizeInvoiceCode(dto.code),
      });
      return await repository.save(invoice);
    } catch (error) {
      this.mapDatabaseError(error);
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
    const update = await this.prepareInvoiceUpdate(manager, id, dto, actor);
    return this.applyInvoiceUpdate(manager, update);
  }

  /** A receipt-backed caller fixes the resolved source business and performs Cash sync. */
  async prepareInvoiceUpdate(
    manager: EntityManager,
    id: string,
    dto: UpdateInvoiceDto,
    actor?: ActorReference,
    expectedBusinessId?: string,
  ): Promise<PreparedInvoiceUpdate> {
    this.requireTransaction(manager);
    try {
      await assertBusinessesAccess(manager, actor, [], { lock: true });
      const first = await this.referenceSnapshot(manager, id);
      if (!first)
        throw new NotFoundException(`Invoice with ID "${id}" not found`);
      if (expectedBusinessId && first.business_id !== expectedBusinessId)
        throw new ConflictException('business:cash_version_conflict');
      const destination = (dto.business_id ?? first.business_id).toLowerCase();
      const transfer = destination !== first.business_id;
      const providerId =
        dto.provider_id === undefined ? first.provider_id : dto.provider_id;
      const lockedBusiness = expectedBusinessId ?? destination;
      await assertBusinessesAccess(
        manager,
        actor,
        [first.business_id, lockedBusiness],
        { lock: true },
      );
      // Receipt-backed edits never transfer. A rejected transfer needs no
      // destination provider lock and can still check source history.
      const provider = await this.lockProvider(
        manager,
        expectedBusinessId && transfer ? null : providerId,
      );
      const locked = await this.referenceSnapshot(manager, id, true);
      if (!locked || !isDeepStrictEqual(first, locked))
        throw new ConflictException(
          expectedBusinessId
            ? 'business:cash_version_conflict'
            : 'Invoice changed. Reload it before retrying.',
        );

      if (!expectedBusinessId || transfer)
        await assertInvoiceCashCompatibility(manager, locked, {
          business_id: destination,
          total_amount:
            dto.total_amount === undefined
              ? locked.total_amount
              : dto.total_amount,
          data: dto.data === undefined ? locked.data : dto.data,
        });
      if (expectedBusinessId && transfer)
        throw new BadRequestException('business:cash_invalid_command');
      this.assertProviderScope(providerId, provider, destination);
      if (dto.path_storage !== undefined || transfer)
        assertInvoiceFileScope(
          dto.path_storage ?? locked.path_storage,
          destination,
        );

      const before = await this.findOneInvoice(id, manager, actor);
      const candidate = { ...before };
      for (const field of invoiceFields) {
        if (dto[field] !== undefined)
          Object.assign(candidate, { [field]: dto[field] });
      }
      // TypeORM gives a hydrated relation precedence over its scalar join column.
      // A requested FK change must not be overwritten by the previous object.
      candidate.provider_id = provider?.id ?? null;
      if (
        candidate.provider_id !== before.provider_id ||
        dto.provider_id === null
      )
        Object.assign(candidate, {
          provider: candidate.provider_id === null ? null : undefined,
        });
      candidate.business_id = destination;
      if (transfer) Object.assign(candidate, { business: undefined });
      if (dto.code !== undefined)
        candidate.code = normalizeInvoiceCode(dto.code);
      return { before, candidate };
    } catch (error) {
      this.mapDatabaseError(error);
    }
  }

  async applyInvoiceUpdate(
    manager: EntityManager,
    { before, candidate }: PreparedInvoiceUpdate,
    touchVersion = false,
  ): Promise<Invoice> {
    this.requireTransaction(manager);
    const edited = invoiceFields.some(
      (field) => !isDeepStrictEqual(before[field], candidate[field]),
    );
    if (!edited && !touchVersion) return before;
    if (before.version >= 2147483647)
      throw new ConflictException('business:cash_version_conflict');
    if (!edited) candidate.version = before.version + 1;
    try {
      const invoice = await manager.getRepository(Invoice).save(candidate);
      // A normal column can be advanced by the database even when TypeORM did
      // not carry it in UPDATE ... RETURNING.
      const [row] = await manager.query<{ version: number }[]>(
        'SELECT version FROM invoices WHERE id=$1',
        [invoice.id],
      );
      return Object.assign(invoice, { version: row.version });
    } catch (error) {
      this.mapDatabaseError(error);
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
  ): Promise<InvoiceWriteSnapshot | null> {
    const rows = await manager.query<InvoiceWriteSnapshot[]>(
      `SELECT id::text,business_id::text,provider_id::text,code,total_amount,path_storage,data,is_active,version,updated_at::text
       FROM invoices WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );
    return rows[0] ?? null;
  }

  private async lockProvider(
    manager: EntityManager,
    providerId: string | null,
  ) {
    if (providerId === null) return undefined;
    const [provider] = await manager.query<
      { id: string; business_id: string }[]
    >(
      'SELECT id::text,business_id::text FROM providers WHERE id=$1 FOR SHARE',
      [providerId],
    );
    return provider;
  }

  private assertProviderScope(
    providerId: string | null,
    provider: { business_id: string } | undefined,
    destination: string,
  ) {
    if (providerId === null) return;
    if (!provider)
      throw new BadRequestException('Referenced provider does not exist');
    if (provider.business_id !== destination.toLowerCase())
      throw new BadRequestException(
        'Referenced provider must belong to the invoice business',
      );
  }

  private mapDatabaseError(error: unknown): never {
    const code =
      error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === '23503')
      throw new BadRequestException(
        'Referenced business or provider does not exist',
      );
    if (code === '22P02')
      throw new BadRequestException(
        'Invalid input syntax for ID or numeric field',
      );
    throw error;
  }
}
