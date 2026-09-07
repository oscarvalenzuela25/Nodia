import { Translation } from '../entities/translation.entity.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetTranslationsResponse = {
  data: Translation[];
  meta: PaginationMeta;
};

export type TranslationsBundleResponse = {
  locale: string;
  translations: Record<string, string>;
};
