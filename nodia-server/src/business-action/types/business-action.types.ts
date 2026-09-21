import { BusinessAction } from '../entities/business-action.entity.js';

export type PaginationMeta = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type GetBusinessActionsResponse = {
  data: BusinessAction[];
  meta: PaginationMeta;
};
