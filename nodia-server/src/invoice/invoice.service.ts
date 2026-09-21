import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { GetInvoicesDto } from './dto/get-invoices.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
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

    if (includes) {
      qb.leftJoinAndSelect('invoice.business', 'business')
        .leftJoinAndSelect('invoice.provider', 'provider');
    }

    applyRansack(qb, q, 'invoice');

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

  async findOneInvoice(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: { business: true, provider: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }
    return invoice;
  }

  async createInvoice(dto: CreateInvoiceDto): Promise<Invoice> {
    try {
      const invoice = this.invoiceRepository.create(dto);
      return await this.invoiceRepository.save(invoice);
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

  async updateInvoice(id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOneInvoice(id);
    Object.assign(invoice, dto);
    try {
      return await this.invoiceRepository.save(invoice);
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
}
