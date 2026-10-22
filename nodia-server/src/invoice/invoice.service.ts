import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { Invoice } from './entities/invoice.entity.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { GetInvoicesDto } from './dto/get-invoices.dto.js';
import { applyRansack, validateRansackEnvelope } from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { GetInvoicesResponse } from './types/invoice.types.js';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  async findAllInvoices({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetInvoicesDto): Promise<GetInvoicesResponse> {
    const qb = this.invoiceRepository.createQueryBuilder('invoice');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('invoice.business', 'business')
        .leftJoinAndSelect('invoice.provider', 'provider');
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

    if (!q?.s) {
      qb.addOrderBy('invoice.created_at', 'DESC');
    }
    if (!/^id(?:\s|$)/i.test(q?.s?.trim() ?? '')) qb.addOrderBy('invoice.id', 'ASC');

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

  async findOneInvoice(id: string, manager?: EntityManager): Promise<Invoice> {
    const repository = manager?.getRepository(Invoice) ?? this.invoiceRepository;
    const invoice = await repository.findOne({
      where: { id },
      relations: { business: true, provider: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }
    return invoice;
  }

  async createInvoice(dto: CreateInvoiceDto, manager?: EntityManager): Promise<Invoice> {
    if (!manager)
      return this.invoiceRepository.manager.transaction(transaction => this.createInvoice(dto, transaction));
    this.requireTransaction(manager);
    try {
      await this.lockReferences(manager, [dto.business_id], dto.business_id, dto.provider_id ?? null);
      const repository = manager.getRepository(Invoice);
      const invoice = repository.create(dto);
      return await repository.save(invoice);
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new BadRequestException('Referenced business or provider does not exist');
      }
      if (error?.code === '22P02') {
        throw new BadRequestException('Invalid input syntax for ID or numeric field');
      }
      throw error;
    }
  }

  async updateInvoice(id: string, dto: UpdateInvoiceDto, manager?: EntityManager): Promise<Invoice> {
    if (!manager)
      return this.invoiceRepository.manager.transaction(transaction => this.updateInvoice(id, dto, transaction));
    this.requireTransaction(manager);
    try {
    const before = await this.referenceSnapshot(manager, id);
    if (!before) throw new NotFoundException(`Invoice with ID "${id}" not found`);
    const destination = dto.business_id ?? before.business_id;
    const providerId = dto.provider_id === undefined ? before.provider_id : dto.provider_id;
    await this.lockReferences(manager, [before.business_id, destination], destination, providerId);
    const locked = await this.referenceSnapshot(manager, id, true);
    if (!isDeepStrictEqual(before, locked)) throw new ConflictException('Invoice changed. Reload it before retrying.');
    const repository = manager.getRepository(Invoice);
    const invoice = await this.findOneInvoice(id, manager);
    // TypeORM gives a hydrated relation precedence over its scalar join column.
    // A requested FK change must not be overwritten by the previous object.
    if (dto.provider_id !== undefined && (dto.provider_id === null || dto.provider_id !== invoice.provider_id))
      Object.assign(invoice, { provider: dto.provider_id === null ? null : undefined });
    if (dto.business_id !== undefined && dto.business_id !== invoice.business_id)
      Object.assign(invoice, { business: undefined });
    Object.assign(invoice, dto);
      return await repository.save(invoice);
    } catch (error: any) {
      if (error?.code === '23503') {
        throw new BadRequestException('Referenced business or provider does not exist');
      }
      if (error?.code === '22P02') {
        throw new BadRequestException('Invalid input syntax for ID or numeric field');
      }
      throw error;
    }
  }

  private requireTransaction(manager: EntityManager) {
    if (!manager.queryRunner?.isTransactionActive)
      throw new ConflictException('Invoice effect requires an active transaction');
  }

  private async referenceSnapshot(manager: EntityManager, id: string, lock = false): Promise<{ business_id: string; provider_id: string | null } | null> {
    const rows: { business_id: string; provider_id: string | null }[] = await manager.query(
      `SELECT id::text,business_id::text,provider_id::text,code,total_amount,path_storage,data,is_active,updated_at::text
       FROM invoices WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id]);
    return rows[0] ?? null;
  }

  /** Global authenticated access is intentional; these locks enforce relation integrity, not ownership. */
  private async lockReferences(manager: EntityManager, sourceAndDestination: readonly string[], destination: string, providerId: string | null) {
    const businesses = [...new Set(sourceAndDestination.map(value => value.toLowerCase()))].sort();
    const rows: { id: string }[] = await manager.query(
      'SELECT id::text FROM businesses WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE', [businesses]);
    if (rows.length !== businesses.length)
      throw new BadRequestException('Referenced business does not exist');
    if (providerId === null) return;
    const providers: { id: string; business_id: string }[] = await manager.query(
      'SELECT id::text,business_id::text FROM providers WHERE id=$1 FOR SHARE', [providerId]);
    if (!providers[0]) throw new BadRequestException('Referenced provider does not exist');
    if (providers[0].business_id.toLowerCase() !== destination.toLowerCase())
      throw new BadRequestException('Referenced provider must belong to the invoice business');
  }
}
