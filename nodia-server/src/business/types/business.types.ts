import { Business } from '../entities/business.entity.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetBusinessesResponse = {
  data: Business[];
  meta: PaginationMeta;
};
