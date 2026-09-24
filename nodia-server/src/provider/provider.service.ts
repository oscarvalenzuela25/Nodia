import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from './entities/provider.entity.js';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { BulkCreateProviderDto } from './dto/bulk-create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import { BulkUpdateProviderDto } from './dto/bulk-update-provider.dto.js';
import { GetProvidersDto } from './dto/get-providers.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetProvidersResponse } from './types/provider.types.js';

@Injectable()
export class ProviderService {
  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetProvidersDto): Promise<GetProvidersResponse> {
    const qb = this.providerRepository.createQueryBuilder('provider');

    if (includes) {
      qb.leftJoinAndSelect('provider.business', 'business');
    }

    applyRansack(qb, q, 'provider');

    if (!q?.s) {
      qb.addOrderBy('provider.created_at', 'DESC');
    }

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

  async findOne(id: string): Promise<Provider> {
    const provider = await this.providerRepository.findOne({
      where: { id },
      relations: { business: true },
    });
    if (!provider) {
      throw new NotFoundException(`Provider with ID "${id}" not found`);
    }
    return provider;
  }

  async create(createProviderDto: CreateProviderDto): Promise<Provider> {
    const payload = {
      ...createProviderDto,
      tax:
        createProviderDto.tax !== undefined && createProviderDto.tax !== null
          ? Number(createProviderDto.tax)
          : 19,
      name: createProviderDto.name ? createProviderDto.name.trim().toLowerCase() : createProviderDto.name,
    };
    const provider = this.providerRepository.create(payload);
    return this.providerRepository.save(provider);
  }

  async update(id: string, updateProviderDto: UpdateProviderDto): Promise<Provider> {
    const provider = await this.findOne(id);
    const payload = {
      ...updateProviderDto,
      ...(updateProviderDto.tax !== undefined && {
        tax: Number(updateProviderDto.tax),
      }),
      ...(updateProviderDto.name !== undefined && {
        name: updateProviderDto.name ? updateProviderDto.name.trim().toLowerCase() : updateProviderDto.name,
      }),
    };
    Object.assign(provider, payload);
    return this.providerRepository.save(provider);
  }

  async createBulk(bulkDto: BulkCreateProviderDto): Promise<Provider[]> {
    const payload = bulkDto.items.map((item) => ({
      ...item,
      tax: item.tax !== undefined && item.tax !== null ? Number(item.tax) : 19,
      name: item.name ? item.name.trim().toLowerCase() : item.name,
      fields: item.fields ?? {},
    }));
    const entities = this.providerRepository.create(payload);
    return this.providerRepository.save(entities);
  }

  async updateBulk(bulkDto: BulkUpdateProviderDto): Promise<Provider[]> {
    const updatedProviders: Provider[] = [];
    for (const item of bulkDto.items) {
      const { id, ...attrs } = item;
      const provider = await this.findOne(id);
      const payload = {
        ...attrs,
        ...(attrs.tax !== undefined && {
          tax: Number(attrs.tax),
        }),
        ...(attrs.name !== undefined && {
          name: attrs.name ? attrs.name.trim().toLowerCase() : attrs.name,
        }),
      };
      Object.assign(provider, payload);
      updatedProviders.push(provider);
    }
    return this.providerRepository.save(updatedProviders);
  }
}
