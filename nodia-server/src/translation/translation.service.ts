import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Translation } from './entities/translation.entity.js';
import { CreateTranslationDto } from './dto/create-translation.dto.js';
import { UpdateTranslationDto } from './dto/update-translation.dto.js';
import { GetTranslationsDto } from './dto/get-translations.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import {
  GetTranslationsResponse,
  TranslationsBundleResponse,
} from './types/translation.types.js';

@Injectable()
export class TranslationService {
  constructor(
    @InjectRepository(Translation)
    private readonly translationRepository: Repository<Translation>,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    q,
  }: GetTranslationsDto): Promise<GetTranslationsResponse> {
    const qb = this.translationRepository.createQueryBuilder('translation');

    applyRansack(qb, q, 'translation');

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

  async findOne(id: string): Promise<Translation> {
    const translation = await this.translationRepository.findOne({
      where: { id },
    });
    if (!translation) {
      throw new NotFoundException(`Translation with ID "${id}" not found`);
    }
    return translation;
  }

  async getBundle(locale: string): Promise<TranslationsBundleResponse> {
    const list = await this.translationRepository.find({
      where: { locale },
    });

    const map: Record<string, string> = {};
    for (const item of list) {
      map[item.key] = item.value;
    }

    return {
      locale,
      translations: map,
    };
  }

  async create(createTranslationDto: CreateTranslationDto): Promise<Translation> {
    const existing = await this.translationRepository.findOne({
      where: {
        key: createTranslationDto.key,
        locale: createTranslationDto.locale,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Translation for key "${createTranslationDto.key}" and locale "${createTranslationDto.locale}" already exists`,
      );
    }

    const translation = this.translationRepository.create(createTranslationDto);
    return this.translationRepository.save(translation);
  }

  async update(
    id: string,
    updateTranslationDto: UpdateTranslationDto,
  ): Promise<Translation> {
    const translation = await this.findOne(id);

    const targetKey = updateTranslationDto.key ?? translation.key;
    const targetLocale = updateTranslationDto.locale ?? translation.locale;

    if (targetKey !== translation.key || targetLocale !== translation.locale) {
      const existing = await this.translationRepository.findOne({
        where: { key: targetKey, locale: targetLocale },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Translation for key "${targetKey}" and locale "${targetLocale}" already exists`,
        );
      }
    }

    Object.assign(translation, updateTranslationDto);
    return this.translationRepository.save(translation);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const translation = await this.findOne(id);
    await this.translationRepository.remove(translation);
    return { deleted: true };
  }
}
