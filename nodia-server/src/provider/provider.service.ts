import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from './entities/provider.entity.js';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
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
      name: createProviderDto.name ? createProviderDto.name.trim().toLowerCase() : createProviderDto.name,
    };
    const provider = this.providerRepository.create(payload);
    return this.providerRepository.save(provider);
  }

  async update(id: string, updateProviderDto: UpdateProviderDto): Promise<Provider> {
    const provider = await this.findOne(id);
    const payload = {
      ...updateProviderDto,
      ...(updateProviderDto.name !== undefined && {
        name: updateProviderDto.name ? updateProviderDto.name.trim().toLowerCase() : updateProviderDto.name,
      }),
    };
    Object.assign(provider, payload);
    return this.providerRepository.save(provider);
  }
}
