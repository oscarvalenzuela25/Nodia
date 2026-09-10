import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Translation } from './entities/translation.entity.js';
import { TranslateItemDto } from './dto/translate-item.dto.js';

export interface EntityTranslations {
  translates?: Array<{ key: string; es: string; en: string }>;
  [key: string]: any;
}

@Injectable()
export class TranslationService {
  constructor(
    @InjectRepository(Translation)
    private readonly translationRepository: Repository<Translation>,
  ) {}

  async saveTranslations(
    sourceEntity: string,
    sourceId: string,
    translates?: TranslateItemDto[],
  ): Promise<void> {
    return this.updateTranslations(sourceEntity, sourceId, translates);
  }

  async updateTranslations(
    sourceEntity: string,
    sourceId: string,
    translates?: TranslateItemDto[],
  ): Promise<void> {
    if (!translates || translates.length === 0) return;

    const mapByKeys = new Map<string, TranslateItemDto>();
    for (const item of translates) {
      if (item && item.key) {
        mapByKeys.set(item.key, item);
      }
    }

    for (const item of mapByKeys.values()) {
      const locales: Array<{ locale: string; value: string }> = [
        { locale: 'es', value: item.es },
        { locale: 'en', value: item.en },
      ];

      for (const { locale, value } of locales) {
        if (value === undefined || value === null) continue;

        const existing = await this.translationRepository.findOne({
          where: {
            source_entity: sourceEntity,
            source_id: String(sourceId),
            source_key: item.key,
            locale,
          },
        });

        if (existing) {
          existing.value = value;
          existing.is_active = true;
          await this.translationRepository.save(existing);
        } else {
          const created = this.translationRepository.create({
            source_entity: sourceEntity,
            source_id: String(sourceId),
            source_key: item.key,
            locale,
            value,
            is_active: true,
          });
          await this.translationRepository.save(created);
        }
      }
    }
  }

  async attachTranslationsToOne<T extends { id: string }>(
    sourceEntity: string,
    item: T,
  ): Promise<T & EntityTranslations> {
    if (!item) return item as any;
    const [result] = await this.attachTranslations(sourceEntity, [item]);
    return result;
  }

  async attachTranslations<T extends { id: string }>(
    sourceEntity: string,
    items: T[],
  ): Promise<Array<T & EntityTranslations>> {
    if (!items || items.length === 0) return items as any;

    const ids = items.map((i) => String(i.id)).filter(Boolean);
    if (ids.length === 0) return items as any;

    const translations = await this.translationRepository.find({
      where: {
        source_entity: sourceEntity,
        source_id: In(ids),
      },
    });

    const map = new Map<string, Map<string, Record<string, string>>>();
    for (const t of translations) {
      if (!map.has(t.source_id)) {
        map.set(t.source_id, new Map());
      }
      const entityMap = map.get(t.source_id)!;
      if (!entityMap.has(t.source_key)) {
        entityMap.set(t.source_key, {});
      }
      entityMap.get(t.source_key)![t.locale] = t.value;
    }

    return items.map((item) => {
      const entityMap = map.get(String(item.id));
      const translatesList: Array<{ key: string; es: string; en: string }> = [];

      if (entityMap) {
        for (const [sourceKey, locales] of entityMap.entries()) {
          translatesList.push({
            key: sourceKey,
            es: locales.es ?? '',
            en: locales.en ?? '',
          });
        }
      }

      return {
        ...item,
        ...(translatesList.length > 0 ? { translates: translatesList } : {}),
      };
    });
  }
}

