import { Provider } from '../entities/provider.entity.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetProvidersResponse = {
  data: Provider[];
  meta: PaginationMeta;
};
